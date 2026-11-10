// Deterministic results planning. Everything the summary states as fact —
// which conditions to address, recommendation tiers, which products, the
// routine order, cautions, timelines — is decided here, in code. The LLM only
// explains and personalizes this plan.
//
// REVIEW: tiers, active preferences, timelines and professional-care signs
// must be reviewed by a dermatology or esthetics professional before release.

import { checkScanForEscalation, type Escalation } from '../guardrails/escalation';
import type { UserContext } from '../intake/userContext';
import { avoidTerms, evidenceFor, hasAnyTerm, targetsFor, type IngredientTarget, type ProductEvidence } from '../knowledge/recommend';
import type { KnowledgeRule } from '../knowledge/types';
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
  /** Why the synced ingredient rules back this product; empty when chosen by the built-in rules. */
  evidence?: ProductEvidence[];
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

/** One eligible product a selector may choose. All safety filtering has already happened. */
export interface SelectionOption {
  /** The product barcode; a selector must answer with one of these. */
  id: string;
  name: string;
  brand: string;
  /** Start of the ingredient list. */
  ingredients: string;
  /** Synced-rule evidence lines for this product, e.g. "Salicylic acid (0.5-2%; FDA OTC monograph)". */
  evidence: string[];
}

/** One routine step a selector chooses a product for. */
export interface SelectionSlot {
  /** "treatment:<condition>", "cleanser", "moisturizer" or "sunscreen". */
  slot: string;
  role: Role;
  condition: ConditionName | null;
  label: string;
  options: SelectionOption[];
}

/** Maps slot to chosen option id. Returns null to keep the default ranking. */
export type ProductSelector = (slots: SelectionSlot[]) => Promise<Record<string, string> | null>;

const MAX_OPTIONS = 5;
const MAX_INGREDIENT_CHARS = 160;

export interface PlanOptions {
  /** Lets a model pick among eligible candidates; picks outside the candidates are ignored. */
  selector?: ProductSelector;
  /** Prefer products whose image is available offline. */
  hasOfflineImage?: (barcode: string) => boolean;
  maxTreatments?: number;
  /** Synced ingredients_and_conditions rules. They steer which products are picked and are cited as evidence. */
  rules?: readonly KnowledgeRule[];
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
  const { hasOfflineImage = () => false, maxTreatments = 2, rules = [] } = options;
  const found = findings(summary, context);
  const chosen: PlannedProduct[] = [];
  const used = new Set<string>();
  const avoid = avoidTerms(rules, context, found.map((f) => f.condition));
  const allTargets = found.flatMap((f) => targetsFor(f.condition, rules, context));

  type Filter = { ingredientTerms?: string[]; categoryTerms?: string[] };
  type Accept = (actives: ActiveId[], product: ProductRecord) => boolean;

  // Wash-off cleansers and sunscreens aren't judged on treatment ingredients.
  const targetsForRole = (role: Role) => (role === 'treatment' || role === 'moisturizer' ? allTargets : []);

  /** Eligible products for a step, best first by the default ranking. */
  const candidatesFor = async (role: Role, kind: ProductKind, filter: Filter, accept: Accept) => {
    const pool = await repository.findFaceCare(filter, 200);
    const evidenceTargets = targetsForRole(role);
    const evidenceCount = (p: ProductRecord) => evidenceFor(p.ingredients, evidenceTargets).length;
    return pool
      .filter((p) => !used.has(p.barcode) && productKind(p.categories, p.name) === kind && isEligibleProduct(p, context))
      // Irritants from the synced "avoid" rules, for sensitive or redness-prone skin.
      .filter((p) => avoid.length === 0 || !hasAnyTerm(p.ingredients, avoid))
      .map((p) => ({ p, kind, actives: detectActives(p.ingredients) }))
      .filter(({ actives, p }) => accept(actives, p))
      .sort(
        (a, b) =>
          evidenceCount(b.p) - evidenceCount(a.p) ||
          Number(hasOfflineImage(b.p.barcode)) - Number(hasOfflineImage(a.p.barcode)),
      );
  };
  type Candidate = Awaited<ReturnType<typeof candidatesFor>>[number];

  /** Plans a product for a step: the preferred barcode if it is a valid candidate, else the top-ranked one. */
  const pick = async (
    role: Role,
    kind: ProductKind,
    filter: Filter,
    accept: Accept,
    addresses: ConditionName[],
    preferred?: string,
  ) => {
    const candidates = await candidatesFor(role, kind, filter, accept);
    const hit = candidates.find((c) => c.p.barcode === preferred) ?? candidates[0];
    if (!hit) return null;
    used.add(hit.p.barcode);
    const evidenceTargets = targetsForRole(role);
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
      evidence: evidenceTargets.length ? evidenceFor(hit.p.ingredients, evidenceTargets) : [],
    };
    chosen.push(planned);
    return planned;
  };

  // Treatment ingredients come only from the synced ingredients_and_conditions
  // rules (no built-in fallback): none matching means no treatment is picked.
  const treatmentTargets = (finding: Finding): IngredientTarget[] =>
    targetsFor(finding.condition, rules, context).filter(
      (t) => finding.tier === 'targeted' || !/retin|adapalene|benzoyl/i.test(t.name),
    );
  const treatmentCandidates = async (finding: Finding): Promise<Candidate[]> => {
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const target of treatmentTargets(finding)) {
      const filter = { ingredientTerms: target.terms };
      const has = (_: ActiveId[], p: ProductRecord) => hasAnyTerm(p.ingredients, target.terms);
      for (const kind of ['treatment', 'moisturizer'] as const) {
        for (const c of await candidatesFor('treatment', kind, filter, has)) {
          if (!seen.has(c.p.barcode)) {
            seen.add(c.p.barcode);
            out.push(c);
          }
        }
      }
    }
    return out;
  };

  const hasCondition = (c: ConditionName) => found.some((f) => f.condition === c);
  const noStrong = (a: ActiveId[]) => !a.some((x) => STRONG_ACTIVES.includes(x));
  const preferMineral = context.skinType === 'sensitive' || context.sensitivities.includes('fragrance');
  const baseSteps: { slot: string; label: string; role: Role; filter: Filter; accept: Accept; addresses: ConditionName[] }[] = [
    { slot: 'cleanser', label: 'Cleanser', role: 'cleanser', filter: { categoryTerms: ['cleans', 'wash', 'foam'] }, accept: noStrong, addresses: [] },
    {
      slot: 'moisturizer',
      label: 'Moisturizer',
      role: 'moisturizer',
      filter: hasCondition('dryness') ? { ingredientTerms: [...ACTIVES.ceramides.patterns, ...ACTIVES.hyaluronic_acid.patterns] } : { categoryTerms: ['moistur', 'cream'] },
      accept: noStrong,
      addresses: hasCondition('dryness') ? ['dryness'] : [],
    },
    {
      slot: 'sunscreen',
      label: 'Sunscreen',
      role: 'sunscreen',
      filter: { ingredientTerms: preferMineral ? ACTIVES.mineral_uv_filter.patterns : [...ACTIVES.mineral_uv_filter.patterns, ...ACTIVES.chemical_uv_filter.patterns] },
      accept: (a) => a.includes('mineral_uv_filter') || (!preferMineral && a.includes('chemical_uv_filter')),
      addresses: [],
    },
  ];

  // Optionally let a model choose among the eligible candidates of each step.
  const treatedFindings = found.slice(0, maxTreatments);
  const treatmentPools = new Map<string, Candidate[]>();
  let choices: Record<string, string> | null = null;
  if (options.selector) {
    const slots: SelectionSlot[] = [];
    const toOption = (c: Candidate, role: Role): SelectionOption => ({
      id: c.p.barcode,
      name: displayProductName(c.p.name, c.p.brand),
      brand: c.p.brand,
      ingredients: c.p.ingredients.slice(0, MAX_INGREDIENT_CHARS),
      evidence: evidenceFor(c.p.ingredients, targetsForRole(role)).map((e) => `${e.ingredient} (${e.strength}; ${e.evidenceLevel})`),
    });
    for (const finding of treatedFindings) {
      const pool = await treatmentCandidates(finding);
      treatmentPools.set(finding.condition, pool);
      if (pool.length) {
        slots.push({
          slot: `treatment:${finding.condition}`, role: 'treatment', condition: finding.condition, label: `Treatment for ${finding.label}`,
          options: pool.slice(0, MAX_OPTIONS).map((c) => toOption(c, 'treatment')),
        });
      }
    }
    for (const step of baseSteps) {
      const pool = await candidatesFor(step.role, step.role, step.filter, step.accept);
      if (pool.length) {
        slots.push({ slot: step.slot, role: step.role, condition: null, label: step.label, options: pool.slice(0, MAX_OPTIONS).map((c) => toOption(c, step.role)) });
      }
    }
    choices = slots.some((s) => s.options.length > 1) ? await options.selector(slots).catch(() => null) : null;
  }

  // Treatments: one per top condition, in priority order.
  for (const finding of treatedFindings) {
    const preferred = choices?.[`treatment:${finding.condition}`];
    const chosenCandidate = preferred ? (treatmentPools.get(finding.condition) ?? []).find((c) => c.p.barcode === preferred) : undefined;
    if (chosenCandidate) {
      const terms = treatmentTargets(finding).flatMap((t) => t.terms);
      const done = await pick('treatment', chosenCandidate.kind, { ingredientTerms: terms }, (_, p) => hasAnyTerm(p.ingredients, terms), [finding.condition], preferred);
      if (done) continue;
    }
    for (const target of treatmentTargets(finding)) {
      const filter = { ingredientTerms: target.terms };
      const has = (_: ActiveId[], p: ProductRecord) => hasAnyTerm(p.ingredients, target.terms);
      const planned =
        (await pick('treatment', 'treatment', filter, has, [finding.condition])) ??
        (await pick('treatment', 'moisturizer', filter, has, [finding.condition]));
      if (planned) break;
    }
  }

  for (const step of baseSteps) {
    await pick(step.role, step.role, step.filter, step.accept, step.addresses, choices?.[step.slot]);
  }

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