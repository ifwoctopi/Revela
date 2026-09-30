// Layer 1: scoped context. This is the only code that turns user, scan and
// product data into text the model sees. It takes the current user's context
// explicitly — there is no lookup by id — so other users' records are
// unreachable by construction. It never includes ids, barcodes, file paths,
// schema names, raw ingredient lists or the system prompt.

import type { RoutineStep, UserContext } from '../intake/userContext';
import { CONDITION_LABELS } from '../llm/prompt';
import { ACTIVES, type ActiveId, type SensitivityId } from '../products/ingredients';
import { mentionedActives } from '../products/mentions';
import type { PlannedProduct, ResultsPlan } from '../summary/plan';
import type { SectionId, SummarySection } from '../summary/schema';
import type { OutputPolicy } from './outputValidator';

export interface ScopedFacts {
  text: string;
  /** Products the model may mention, by reference. */
  products: Array<Pick<PlannedProduct, 'ref' | 'name' | 'brand'> & { barcode: string }>;
}

const STEP_NAMES: Record<RoutineStep, string> = {
  cleanser: 'cleanser', toner: 'toner', treatment: 'serum or treatment', exfoliant: 'exfoliant',
  moisturizer: 'moisturizer', sunscreen: 'sunscreen', eye_care: 'eye cream',
};
const KIND_NAMES: Record<PlannedProduct['kind'], string> = {
  cleanser: 'a cleanser', treatment: 'a treatment', moisturizer: 'a moisturizer', sunscreen: 'a sunscreen',
  eye_care: 'an eye product', other: 'a skin care product',
};

const activeName = (id: ActiveId) => ACTIVES[id].name;
const sensitivityName = (s: SensitivityId) => (s in ACTIVES ? activeName(s as ActiveId) : s.replace('_', ' '));
const list = (items: string[], empty: string) => (items.length ? items.join(', ') : empty);
const bullets = (items: string[]) => items.map((i) => `- ${i}`).join('\n');

export function describeUser(context: UserContext): string {
  const pregnancy = {
    yes: 'pregnant or breastfeeding',
    no: 'not pregnant or breastfeeding',
    prefer_not_to_say: 'preferred not to say whether pregnant or breastfeeding',
  };
  return bullets([
    `Wants to improve: ${list(context.concerns.map((c) => CONDITION_LABELS[c]), 'not specified')}`,
    `Current routine steps: ${list(context.routineSteps.map((s) => STEP_NAMES[s]), 'none mentioned')}`,
    `Actives already used: ${list(context.currentActives.map(activeName), 'none mentioned')}`,
    `Ingredients to avoid: ${list(context.sensitivities.map(sensitivityName), 'none mentioned')}`,
    `Pregnancy: ${context.pregnancy ? pregnancy[context.pregnancy] : 'not answered'}`,
    `Skin type: ${context.skinType ?? 'not sure'}`,
  ]);
}

function describeFindings(plan: ResultsPlan): string {
  if (plan.findings.length === 0) return '- Nothing noticeable was detected in this scan.';
  return bullets(
    plan.findings.map((f) => {
      const where = f.region ? `, around the ${f.region}` : '';
      const certainty = f.hedged ? 'the scan is not very confident, so describe this cautiously' : 'the scan is fairly confident';
      return `${f.label}: ${f.severity}${where} (${certainty})`;
    }),
  );
}

function describeProduct(p: PlannedProduct): string {
  const actives = p.actives.filter((a) => ACTIVES[a].concerns.length > 0 || p.kind === 'sunscreen');
  const withActives = actives.length ? ` with ${actives.map(activeName).join(' and ')}` : '';
  const forWhat = p.addresses.length ? `, chosen for ${p.addresses.map((c) => CONDITION_LABELS[c]).join(' and ')}` : '';
  const when = p.time === 'AM' ? 'in the morning' : 'in the evening';
  return `[${p.ref}] ${p.name}: ${KIND_NAMES[p.kind]}${withActives}${forWhat}. Use ${when}, ${p.frequency}.`;
}

const refOf = (p: PlannedProduct) => ({ ref: p.ref, name: p.name, brand: p.brand, barcode: p.barcode });

export function sectionFacts(id: SectionId, plan: ResultsPlan, context: UserContext): ScopedFacts {
  const productByRef = new Map(plan.products.map((p) => [p.ref, p]));
  const routineLine = (steps: ResultsPlan['routine']['am']) =>
    steps.map((s, i) => `${i + 1}. ${s.label}${s.productRef ? ` with [${s.productRef}] ${productByRef.get(s.productRef)?.name}` : ''}`).join('\n');
  const routineProducts = [...plan.routine.am, ...plan.routine.pm]
    .flatMap((s) => (s.productRef ? [productByRef.get(s.productRef)!] : []))
    .filter((p, i, all) => all.indexOf(p) === i);

  switch (id) {
    case 'overview':
      return {
        text: `Scan results from ${plan.scanImageRefs.length} face views:\n${describeFindings(plan)}\n\nAbout the user:\n${bullets([
          `Wants to improve: ${list(context.concerns.map((c) => CONDITION_LABELS[c]), 'not specified')}`,
        ])}`,
        products: [],
      };
    case 'contributing':
      return {
        text: `About the user:\n${describeUser(context)}\n\nPossible cosmetic contributors (use only these):\n${bullets(plan.contributors)}`,
        products: [],
      };
    case 'routine':
      return {
        text: `Morning routine, in order:\n${routineLine(plan.routine.am)}\n\nEvening routine, in order:\n${routineLine(plan.routine.pm)}\n\nSteps without a product can use any gentle product the user already has.`,
        products: routineProducts.map(refOf),
      };
    case 'products':
      return {
        text: plan.products.length
          ? `Recommended products (the only products you may mention):\n${plan.products.map(describeProduct).join('\n')}`
          : 'No suitable products were found in the database for this user.',
        products: plan.products.map(refOf),
      };
    case 'cautions':
      return { text: `Cautions (use only these):\n${bullets(plan.cautions)}`, products: [] };
    case 'expectations':
      return { text: `What to expect (use only these):\n${bullets(plan.expectations)}`, products: [] };
    case 'professional':
      return {
        text: `See a healthcare provider or dermatologist promptly for:\n${bullets(plan.professionalSigns)}${
          plan.escalation ? `\n\nImportant, say this clearly: ${plan.escalation.message}` : ''
        }`,
        products: [],
      };
  }
}

export interface RetrievedProduct {
  ref: string;
  barcode: string;
  name: string;
  brand: string;
  kind: PlannedProduct['kind'];
  actives: ActiveId[];
  /** Deterministic reasons it isn't suitable for this user; empty when suitable. */
  unsuitableBecause: string[];
}

export function chatFacts(
  context: UserContext,
  plan: ResultsPlan,
  sections: readonly SummarySection[],
  retrieved: readonly RetrievedProduct[],
  ingredientFacts: readonly string[],
): ScopedFacts {
  const presented = sections.filter((s) => !s.isFallback).map((s) => `${s.title}: ${s.displayText}`).join('\n');
  const retrievedLines = retrieved.map((r) => {
    const actives = r.actives.length ? ` with ${r.actives.map(activeName).join(' and ')}` : '';
    const suitability = r.unsuitableBecause.length ? ` Not suitable for this user: ${r.unsuitableBecause.join('; ')}.` : ' Suitable for this user.';
    return `[${r.ref}] ${r.name}: ${KIND_NAMES[r.kind]}${actives}.${suitability}`;
  });
  return {
    text: [
      `About the user:\n${describeUser(context)}`,
      `Scan results:\n${describeFindings(plan)}`,
      `Recommended products:\n${plan.products.map(describeProduct).join('\n') || '- none'}`,
      retrievedLines.length ? `Products found for this question:\n${retrievedLines.join('\n')}` : '',
      ingredientFacts.length ? `Ingredient facts:\n${bullets([...ingredientFacts])}` : '',
      `Summary already shown to the user:\n${presented}`,
    ].filter(Boolean).join('\n\n'),
    products: [...plan.products.map(refOf), ...retrieved.map((r) => ({ ref: r.ref, name: r.name, brand: r.brand, barcode: r.barcode }))],
  };
}

/** Builds the Layer 4 policy for output generated from these facts. */
export function policyFor(facts: ScopedFacts, knownBrands: readonly string[], maxChars: number, secretTexts: string[] = []): OutputPolicy {
  return {
    allowedProductRefs: new Set(facts.products.map((p) => p.ref)),
    allowedProductNames: facts.products.flatMap((p) => [p.name, p.brand]),
    // Only actives that the facts themselves mention may appear in the output.
    allowedActives: new Set(mentionedActives(facts.text)),
    knownBrands,
    maxChars,
    secretTexts,
  };
}
