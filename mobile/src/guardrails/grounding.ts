// Layer 3: retrieval grounding for chat. Product and ingredient facts come
// only from the product database and the rules table. When a question is
// about a product or ingredient we have no data for, the caller answers with
// the fallback instead of letting the model use its general knowledge.

import type { UserContext } from '../intake/userContext';
import { CONDITION_LABELS } from '../llm/prompt';
import { displayProductName, productKind } from '../products/classify';
import { ACTIVES, CONFLICTS, detectActives, type ActiveId } from '../products/ingredients';
import { mentionedActives, mentionsUnknownIngredient } from '../products/mentions';
import type { ProductRecord, ProductRepository } from '../products/types';
import { unsuitableReasons, type ResultsPlan } from '../summary/plan';
import type { RetrievedProduct } from './contextBuilder';
import { WELL_KNOWN_BRANDS } from './outputValidator';

export interface Retrieval {
  products: RetrievedProduct[];
  ingredientFacts: string[];
  /** The question is about a product that isn't in the database. */
  unknownProduct: boolean;
  /** The question is about an ingredient that isn't in the rules table. */
  unknownIngredient: boolean;
}

const MAX_RETRIEVED = 3;
const KIND_NOUNS = 'cleanser|face wash|serum|cream|moisturi[sz]er|sunscreen|sun cream|toner|lotion|gel|mask|balm|spf|exfoliant|peel';
const NAMED_PRODUCT = new RegExp(`\\b([A-Z][\\w'&.-]*(?:\\s+[A-Z0-9][\\w'&.-]*)*)\\s+(${KIND_NOUNS})\\b`);
const STOP_WORDS = new Set(['what', 'about', 'think', 'the', 'this', 'that', 'should', 'use', 'with', 'and', 'for', 'your', 'you', 'good', 'is', 'are', 'can', 'my', 'of', 'a', 'an', 'it', 'do', 'does', 'how', 'i']);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function significantWords(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

const QUESTION_WORDS = new Set([
  'what', 'which', 'should', 'is', 'are', 'can', 'do', 'does', 'how', 'a', 'the', 'my', 'your', 'any', 'best', 'good',
  'night', 'day', 'eye', 'face', 'i', 'would', 'could', 'will', 'recommend', 'new', 'this', 'that',
]);

/** A capitalized product name before a product noun ("Glow Lab serum"), ignoring question words ("What serum"). */
function namedProduct(question: string): string | null {
  const match = question.match(NAMED_PRODUCT);
  if (!match) return null;
  const nameWords = match[1].split(/\s+/);
  while (nameWords.length && QUESTION_WORDS.has(nameWords[0].toLowerCase())) nameWords.shift();
  return nameWords.length ? `${nameWords.join(' ')} ${match[2]}` : null;
}

export function ingredientFact(id: ActiveId, context: UserContext): string {
  const rule = ACTIVES[id];
  const helps = rule.concerns.length ? `can help with ${rule.concerns.map((c) => CONDITION_LABELS[c]).join(', ')}` : 'protects skin from the sun';
  const when = rule.time === 'AM' ? 'use in the morning' : rule.time === 'PM' ? 'use in the evening' : 'use morning or evening';
  const notes = [
    rule.sunSensitizing ? 'can make skin more sensitive to the sun' : '',
    rule.pregnancy === 'avoid' ? 'not used during pregnancy or breastfeeding' : '',
    rule.pregnancy === 'ask' ? 'check with a healthcare provider first if pregnant or breastfeeding' : '',
    context.sensitivities.includes(id) ? 'the user said they react to it' : '',
    ...CONFLICTS.filter(([a, b]) => a === id || b === id).map(([, , advice]) => advice),
  ].filter(Boolean);
  return `${rule.name}: ${helps}; ${when}, ${rule.frequency}${notes.length ? `; ${notes.join('; ')}` : ''}.`;
}

export async function retrieveForQuestion(
  question: string,
  repository: ProductRepository,
  context: UserContext,
  plan: ResultsPlan,
  knownBrands: readonly string[],
): Promise<Retrieval> {
  const actives = mentionedActives(question);
  const ingredientFacts = actives.map((a) => ingredientFact(a, context));
  const unknownIngredient = actives.length === 0 && mentionsUnknownIngredient(question);

  // Questions about the recommended products are answered from the plan.
  const words = significantWords(question);
  const aboutPlanProduct = plan.products.some(
    (p) => new RegExp(`\\b${p.ref}\\b`, 'i').test(question) || significantWords(p.name).filter((w) => words.includes(w)).length >= 2,
  );

  // Well-known brands match in any case ("cerave"). Database brands must match
  // their case, since many are ordinary words ("Benefit", "Life", "Target").
  const mentions = (brand: string, flags: string) => new RegExp(`(^|[^\\w])${escapeRegExp(brand)}($|[^\\w])`, flags).test(question);
  const mentionedBrands = [
    ...WELL_KNOWN_BRANDS.filter((b) => b.length >= 4 && mentions(b, 'i')),
    ...knownBrands.filter((b) => b.length >= 4 && !WELL_KNOWN_BRANDS.includes(b) && mentions(b, '')),
  ];
  const named = namedProduct(question);

  let found: ProductRecord[] = [];
  let unknownProduct = false;
  if (!aboutPlanProduct && (mentionedBrands.length > 0 || named)) {
    const byBrand = await Promise.all(mentionedBrands.slice(0, 2).map((b) => repository.searchByName(b, 25)));
    const byName = named ? await repository.searchByName(named, 10) : [];
    const score = (p: ProductRecord) => significantWords(`${p.name} ${p.brand}`).filter((w) => words.includes(w)).length;
    found = [...byName, ...byBrand.flat()]
      .filter((p, i, all) => all.findIndex((q) => q.barcode === p.barcode) === i)
      .sort((a, b) => score(b) - score(a))
      .slice(0, MAX_RETRIEVED);
    unknownProduct = found.length === 0;
  }

  const offset = plan.products.length;
  return {
    products: found.map((p, i) => ({
      ref: `P${offset + i + 1}`,
      barcode: p.barcode,
      name: displayProductName(p.name, p.brand),
      brand: p.brand,
      kind: productKind(p.categories, p.name),
      actives: detectActives(p.ingredients),
      unsuitableBecause: unsuitableReasons(p, context),
    })),
    ingredientFacts,
    unknownProduct,
    unknownIngredient,
  };
}
