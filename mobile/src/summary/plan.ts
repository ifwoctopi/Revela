// Deterministic results planning. Everything the summary states as fact —
// which conditions to address, recommendation tiers, which products, the
// routine order, cautions, timelines — is decided here, in code. The LLM only
// explains and personalizes this plan.
//
// REVIEW: tiers, active preferences, timelines and professional-care signs
// must be reviewed by a dermatology or esthetics professional before release.

import { checkScanForEscalation, type Escalation } from '../guardrails/escalation';
import type { UserContext } from '../intake/userContext';
import { CONDITION_LABELS } from '../llm/prompt';
import { displayProductName, isFaceCare, productKind, type ProductKind } from '../products/classify';
import {
  ACTIVES, SENSITIVITY_GROUPS, conflictsBetween, containsDrugIngredient, containsSensitivity, detectActives,
  type ActiveId, type RoutineTime,
} from '../products/ingredients';
import type { ProductRecord, ProductRepository } from '../products/types';
import type { AngleName, ConditionName, SessionSummary, Severity } from '../types/session';

export type Tier = 'gentle' | 'targeted' | 'refer';

export interface Finding {
  condition: ConditionName;
  label: string;
  severity: Severity;
  region: string | null;
  confidence: number;
  /** Low-confidence results must be described with hedging. */
  hedged: boolean;
  tier: Tier;
}

export type Role = 'treatment' | 'cleanser' | 'moisturizer' | 'sunscreen';

export interface PlannedProduct {
  /** Short reference the LLM uses ("P1"); mapped back to the barcode in code. */
  ref: string;
  role: Role;
  barcode: string;
  name: string;
  brand: string;
  kind: ProductKind;
  actives: ActiveId[];
  addresses: ConditionName[];
  time: Exclude<RoutineTime, 'AM_OR_PM'>;
  frequency: string;
  imageRef: string;
  imagePath: string | null;
}

export interface RoutineStepPlan {
  label: string;
  productRef: string | null;
}

export interface ResultsPlan {
  findings: Finding[];
  products: PlannedProduct[];
  routine: { am: RoutineStepPlan[]; pm: RoutineStepPlan[] };
  contributors: string[];
  cautions: string[];
  expectations: string[];
  professionalSigns: string[];
  escalation: Escalation | null;
  scanImageRefs: string[];
}

export const HEDGE_BELOW_CONFIDENCE = 0.7;

const TIER_BY_SEVERITY: Record<Severity, Tier> = { mild: 'gentle', moderate: 'targeted', severe: 'refer' };
const STRONG_ACTIVES: ActiveId[] = ['retinoid', 'aha', 'benzoyl_peroxide'];

/** Preferred actives per condition, best first. */
const PREFERRED_ACTIVES: Record<ConditionName, ActiveId[]> = {
  acne: ['salicylic_acid', 'niacinamide', 'azelaic_acid', 'benzoyl_peroxide', 'zinc_pca', 'tea_tree'],
  hyperpigmentation: ['niacinamide', 'vitamin_c', 'azelaic_acid', 'tranexamic_acid', 'arbutin', 'aha', 'retinoid'],
  redness: ['centella', 'niacinamide', 'azelaic_acid', 'panthenol', 'allantoin', 'ceramides'],
  dryness: ['ceramides', 'hyaluronic_acid', 'squalane', 'panthenol'],
  oily_skin: ['niacinamide', 'zinc_pca', 'salicylic_acid'],
  dark_circles: ['caffeine'],
};

const TIMELINES: Record<ConditionName, string> = {
  acne: 'Breakouts usually settle after six to eight weeks of steady use.',
  hyperpigmentation: 'Dark spots fade slowly, over two to three months.',
  redness: 'Redness often calms in two to four weeks as irritation settles.',
  dryness: 'Dryness usually improves in a few days to two weeks.',
  oily_skin: 'Shine usually balances out in two to four weeks.',
  dark_circles: 'Under-eye products work gradually over weeks, often modestly.',
};

/** Short forms of TIMELINES for the highlight visuals; keep the two in sync. */
export const TIMELINE_LABELS: Record<ConditionName, string> = {
  acne: '6–8 weeks',
  hyperpigmentation: '2–3 months',
  redness: '2–4 weeks',
  dryness: 'Up to 2 weeks',
  oily_skin: '2–4 weeks',
  dark_circles: 'A few weeks',
};

const PROFESSIONAL_SIGNS = [
  'a mole or spot that changes, bleeds or looks irregular',
  'redness that spreads, feels warm, or comes with pus or fever',
  'painful, deep or scarring breakouts',
  'swelling, blistering or a rash after using a product',
  'no improvement after three months of consistent care',
];

export interface PlanOptions {
  /** Prefer products whose image is available offline. */
  hasOfflineImage?: (barcode: string) => boolean;
  maxTreatments?: number;
}

function findings(summary: SessionSummary, context: UserContext): Finding[] {
  const list: Finding[] = [];
  for (const [condition, result] of Object.entries(summary.results) as [ConditionName, NonNullable<SessionSummary['results'][ConditionName]>][]) {
    if (!result?.present) continue;
    const severity = result.severity ?? 'mild';
    const confidence = result.confidence ?? 0;
    list.push({
      condition,
      label: CONDITION_LABELS[condition],
      severity,
      region: result.region ? result.region.replace(/_/g, ' ') : null,
      confidence,
      hedged: confidence < HEDGE_BELOW_CONFIDENCE,
      tier: TIER_BY_SEVERITY[severity],
    });
  }
  // The user's own priorities first, then by severity and confidence.
  const rank = { severe: 0, moderate: 1, mild: 2 };
  return list.sort(
    (a, b) =>
      Number(!context.concerns.includes(a.condition)) - Number(!context.concerns.includes(b.condition)) ||
      rank[a.severity] - rank[b.severity] ||
      b.confidence - a.confidence,
  );
}

/** Actives this user must not be recommended. */
function excludedActives(context: UserContext): Set<ActiveId> {
  const excluded = new Set<ActiveId>();
  for (const id of Object.keys(ACTIVES) as ActiveId[]) {
    const rule = ACTIVES[id];
    if (context.sensitivities.includes(id)) excluded.add(id);
    if (context.pregnancy === 'yes' && rule.pregnancy !== 'none') excluded.add(id);
    // Unknown or undisclosed pregnancy status: still leave out the "avoid" group.
    if (context.pregnancy !== 'no' && rule.pregnancy === 'avoid') excluded.add(id);
    if (context.skinType === 'sensitive' && STRONG_ACTIVES.includes(id)) excluded.add(id);
  }
  return excluded;
}

/** Deterministic reasons a database product must not be recommended to this user; empty when eligible. */
export function unsuitableReasons(product: ProductRecord, context: UserContext): string[] {
  const reasons: string[] = [];
  if (!isFaceCare(product.categories)) reasons.push('it is not a face care product');
  if (containsDrugIngredient(product.ingredients)) reasons.push('it contains a medicine ingredient');
  const matched = context.sensitivities.filter((s) => containsSensitivity(product.ingredients, s));
  if (matched.length) {
    reasons.push(`it contains ${matched.map((s) => (s in ACTIVES ? ACTIVES[s as ActiveId].name : s.replace('_', ' '))).join(' and ')}, which the user wants to avoid`);
  }
  const excluded = excludedActives(context);
  const blocked = detectActives(product.ingredients).filter((a) => excluded.has(a) && !context.sensitivities.includes(a));
  if (blocked.length) reasons.push(`it contains ${blocked.map((a) => ACTIVES[a].name).join(' and ')}, which is left out for this user`);
  return reasons;
}

export function isEligibleProduct(product: ProductRecord, context: UserContext): boolean {
  return unsuitableReasons(product, context).length === 0;
}

function scheduleTime(actives: ActiveId[], kind: ProductKind): PlannedProduct['time'] {
  if (kind === 'sunscreen') return 'AM';
  const times = actives.map((a) => ACTIVES[a].time);
  if (times.includes('PM')) return 'PM';
  if (times.includes('AM')) return 'AM';
  return 'PM';
}

export async function buildResultsPlan(
  summary: SessionSummary,
  context: UserContext,
  repository: ProductRepository,
  options: PlanOptions = {},
): Promise<ResultsPlan> {
  const { hasOfflineImage = () => false, maxTreatments = 2 } = options;
  const found = findings(summary, context);
  const excluded = excludedActives(context);
  const chosen: PlannedProduct[] = [];
  const used = new Set<string>();

  const pick = async (
    role: Role,
    kind: ProductKind,
    filter: { ingredientTerms?: string[]; categoryTerms?: string[] },
    accept: (actives: ActiveId[]) => boolean,
    addresses: ConditionName[],
  ) => {
    const pool = await repository.findFaceCare(filter, 200);
    const candidates = pool
      .filter((p) => !used.has(p.barcode) && productKind(p.categories, p.name) === kind && isEligibleProduct(p, context))
      .map((p) => ({ p, actives: detectActives(p.ingredients) }))
      .filter(({ actives }) => accept(actives))
      .sort((a, b) => Number(hasOfflineImage(b.p.barcode)) - Number(hasOfflineImage(a.p.barcode)));
    const hit = candidates[0];
    if (!hit) return null;
    used.add(hit.p.barcode);
    const frequencies = hit.actives.filter((a) => ACTIVES[a].concerns.length > 0).map((a) => ACTIVES[a].frequency);
    const planned: PlannedProduct = {
      ref: `P${chosen.length + 1}`,
      role,
      barcode: hit.p.barcode,
      name: displayProductName(hit.p.name, hit.p.brand),
      brand: hit.p.brand,
      kind,
      actives: hit.actives,
      addresses,
      time: scheduleTime(hit.actives, kind),
      frequency: frequencies[0] ?? (kind === 'sunscreen' ? ACTIVES.mineral_uv_filter.frequency : 'once or twice a day'),
      imageRef: `product:${hit.p.barcode}`,
      imagePath: hit.p.imagePath,
    };
    chosen.push(planned);
    return planned;
  };

  // Treatments: one per top condition, in priority order.
  for (const finding of found.slice(0, maxTreatments)) {
    const allowed = PREFERRED_ACTIVES[finding.condition].filter(
      (a) => !excluded.has(a) && !(finding.tier !== 'targeted' && STRONG_ACTIVES.includes(a)),
    );
    for (const active of allowed) {
      const filter = { ingredientTerms: ACTIVES[active].patterns };
      const planned =
        (await pick('treatment', 'treatment', filter, (a) => a.includes(active), [finding.condition])) ??
        (await pick('treatment', 'moisturizer', filter, (a) => a.includes(active), [finding.condition]));
      if (planned) break;
    }
  }

  const hasCondition = (c: ConditionName) => found.some((f) => f.condition === c);
  const noStrong = (a: ActiveId[]) => !a.some((x) => STRONG_ACTIVES.includes(x));
  await pick('cleanser', 'cleanser', { categoryTerms: ['cleans', 'wash', 'foam'] }, noStrong, []);
  await pick(
    'moisturizer',
    'moisturizer',
    hasCondition('dryness') ? { ingredientTerms: [...ACTIVES.ceramides.patterns, ...ACTIVES.hyaluronic_acid.patterns] } : { categoryTerms: ['moistur', 'cream'] },
    noStrong,
    hasCondition('dryness') ? ['dryness'] : [],
  );
  const preferMineral = context.skinType === 'sensitive' || context.sensitivities.includes('fragrance');
  await pick(
    'sunscreen',
    'sunscreen',
    { ingredientTerms: preferMineral ? ACTIVES.mineral_uv_filter.patterns : [...ACTIVES.mineral_uv_filter.patterns, ...ACTIVES.chemical_uv_filter.patterns] },
    (a) => a.includes('mineral_uv_filter') || (!preferMineral && a.includes('chemical_uv_filter')),
    [],
  );

  // A step with no eligible product still appears, without a product.
  const step = (label: string, role: Role): RoutineStepPlan => ({
    label,
    productRef: chosen.find((p) => p.role === role)?.ref ?? null,
  });
  const treat = (time: 'AM' | 'PM') =>
    chosen.filter((p) => p.role === 'treatment' && p.time === time).map((p) => ({ label: 'Treat', productRef: p.ref }));
  const routine = {
    am: [step('Cleanse', 'cleanser'), ...treat('AM'), step('Moisturize', 'moisturizer'), step('Protect with sunscreen', 'sunscreen')],
    pm: [step('Cleanse', 'cleanser'), ...treat('PM'), step('Moisturize', 'moisturizer')],
  };

  return {
    findings: found,
    products: chosen,
    routine,
    contributors: contributors(found, context),
    cautions: cautions(chosen, context),
    expectations: expectations(found, chosen),
    professionalSigns: PROFESSIONAL_SIGNS,
    escalation: checkScanForEscalation(summary),
    scanImageRefs: summary.angles_captured.map((angle: AngleName) => `scan:${angle}`),
  };
}

function contributors(found: Finding[], context: UserContext): string[] {
  const has = (c: ConditionName) => found.some((f) => f.condition === c);
  const uses = (s: UserContext['routineSteps'][number]) => context.routineSteps.includes(s);
  const out: string[] = [];
  if (has('hyperpigmentation') && !uses('sunscreen')) out.push('Sun without sunscreen can darken spots.');
  if (has('dryness') && uses('exfoliant')) out.push('Frequent exfoliating can dry skin out.');
  if (has('dryness') && !uses('moisturizer')) out.push('Skipping moisturizer can leave skin tight and dry.');
  if ((has('acne') || has('oily_skin')) && context.skinType === 'oily') out.push('Oily skin is more prone to clogged pores.');
  if (has('redness') && (uses('exfoliant') || context.currentActives.some((a) => STRONG_ACTIVES.includes(a)))) {
    out.push('Strong exfoliants or retinoids can increase redness.');
  }
  if (has('redness') && context.skinType === 'sensitive') out.push('Sensitive skin can react to harsh or fragranced products.');
  if (has('dark_circles')) out.push('Sleep, hydration and genetics affect under-eye darkness.');
  out.push('Sun, weather, sleep and stress also affect how skin looks.');
  return out;
}

function cautions(products: PlannedProduct[], context: UserContext): string[] {
  const out = [
    'Patch test new products on a small area for two days first.',
    'Add new products one at a time, a week apart.',
  ];
  const actives = [...new Set(products.flatMap((p) => p.actives))];
  const sunSensitizing = actives.filter((a) => ACTIVES[a].sunSensitizing);
  if (sunSensitizing.length) {
    out.push(`${sunSensitizing.map((a) => ACTIVES[a].name).join(' and ')} increase sun sensitivity, so wear sunscreen every morning.`);
  }
  for (const time of ['AM', 'PM'] as const) {
    const atTime = products.filter((p) => p.time === time).flatMap((p) => p.actives);
    out.push(...conflictsBetween(atTime, atTime));
  }
  out.push(...conflictsBetween(context.currentActives, actives).map((c) => `With what you already use: ${c}`));
  if (context.pregnancy === 'yes') {
    out.push("Retinoids and several acids were left out since you're pregnant or breastfeeding. Check new products with your healthcare provider.");
  } else if (context.pregnancy !== 'no') {
    out.push('If pregnant or breastfeeding, ask your healthcare provider before using retinoids or strong acids.');
  }
  const groups = context.sensitivities.filter((s) => s in SENSITIVITY_GROUPS);
  const activeSensitivities = context.sensitivities.filter((s) => s in ACTIVES).map((s) => ACTIVES[s as ActiveId].name);
  const avoided = [...groups.map((g) => g.replace('_', ' ')), ...activeSensitivities];
  if (avoided.length) out.push(`Products with ${avoided.join(', ')} were left out, as you asked.`);
  if (context.unrecognizedSensitivities > 0) {
    out.push("I can't check one ingredient you mentioned, so read labels carefully.");
  }
  return [...new Set(out)];
}

function expectations(found: Finding[], products: PlannedProduct[]): string[] {
  const out = found.map((f) => TIMELINES[f.condition]);
  const actives = products.flatMap((p) => p.actives);
  out.push('Mild tingling from a new active is normal at first.');
  if (actives.some((a) => a === 'salicylic_acid' || a === 'retinoid' || a === 'aha')) {
    out.push('A few extra breakouts in the first weeks are possible as skin adjusts.');
  }
  out.push('Burning, swelling, hives or a spreading rash are not normal. Stop the product.');
  return out;
}
