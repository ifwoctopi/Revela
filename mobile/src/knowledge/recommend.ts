// Turns the synced ingredients_and_conditions rules into product-matching
// inputs: which ingredients to look for per condition, which to avoid, and what
// evidence backs each one. Pure and deterministic. Existing safety exclusions
// in summary/plan.ts (pregnancy, sensitivities, drug ingredients) still apply
// on top of this; the rules add targeting and evidence, they never relax them.

import type { UserContext } from '../intake/userContext';
import type { ConditionName } from '../types/session';
import type { KnowledgeRule } from './types';

/** Which rule Concern text covers each scan condition. Dark circles have no rule yet. */
const CONCERN_PATTERNS: Record<ConditionName, RegExp | null> = {
  acne: /breakout|blackhead|whitehead/i,
  oily_skin: /\boil|shine/i,
  dryness: /dryness/i,
  redness: /redness/i,
  hyperpigmentation: /discolou?ration|dark spots|uneven tone/i,
  dark_circles: null,
};

/** INCI spellings for rule ingredients whose label name differs from the product label. */
const ALIASES: Record<string, string[]> = {
  'hyaluronic acid': ['hyaluronic acid', 'sodium hyaluronate'],
  'jojoba oil': ['jojoba', 'simmondsia chinensis'],
  'l-ascorbic acid': ['ascorbic acid'],
  'vitamin c': ['ascorbic acid'],
  alcohol: ['alcohol denat', 'sd alcohol', 'ethanol', 'isopropyl alcohol'],
  fragrance: ['fragrance', 'parfum'],
  'sodium lauryl sulfate': ['sodium lauryl sulfate', 'sodium lauryl sulphate'],
  // Generic entries with no single INCI name; the plan's sunscreen step handles these.
  'broad-spectrum sunscreen': [],
};

export interface IngredientTarget {
  /** Display name from the rule, e.g. "Niacinamide". */
  name: string;
  /** Lowercase INCI fragments to find in a product's ingredient list. */
  terms: string[];
  rule: KnowledgeRule;
}

export interface ProductEvidence {
  ingredient: string;
  concern: string;
  strength: string;
  evidenceLevel: string;
  recommendation: string;
}

const splitIngredients = (text: string) => text.split(/[;]/).map((s) => s.trim()).filter(Boolean);

function termsFor(name: string): string[] {
  const lower = name.toLowerCase();
  const base = lower.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const bracket = lower.match(/\((.*?)\)/)?.[1];
  const keys = [lower, base, ...(bracket ? [bracket] : [])];
  for (const key of keys) if (key in ALIASES) return ALIASES[key];
  return [base];
}

/** Higher is better supported; 'Use' beats 'Use (caution)'. */
function strength(rule: KnowledgeRule): number {
  const level = rule.evidenceLevel.toLowerCase();
  let score = 0;
  if (/strong|fda|monograph/.test(level)) score += 3;
  else if (/professional society|clinical review/.test(level)) score += 2;
  else if (/rct/.test(level)) score += 1;
  if (/caution/i.test(rule.recommendation)) score -= 1;
  return score;
}

const matchesSkinType = (rule: KnowledgeRule, context: UserContext) =>
  !context.skinType || /any|all/i.test(rule.skinType) || rule.skinType.toLowerCase().includes(context.skinType);

/** Rules that must not be used as a target for this user. */
function ruledOut(rule: KnowledgeRule, context: UserContext): boolean {
  if (/^avoid/i.test(rule.recommendation)) return true;
  // Mirrors the plan's rule: an undisclosed pregnancy status gets the cautious answer.
  if (context.pregnancy !== 'no' && /^avoid/i.test(rule.pregnancyNotes)) return true;
  if (context.skinType === 'sensitive' && /caution/i.test(rule.sensitivity)) return true;
  return false;
}

/** Ingredients to look for to address a condition, best-supported first. */
export function targetsFor(condition: ConditionName, rules: readonly KnowledgeRule[], context: UserContext): IngredientTarget[] {
  const pattern = CONCERN_PATTERNS[condition];
  if (!pattern) return [];
  const seen = new Set<string>();
  return rules
    .filter((r) => pattern.test(r.concern) && matchesSkinType(r, context) && !ruledOut(r, context))
    .sort((a, b) => strength(b) - strength(a))
    .flatMap((rule) =>
      splitIngredients(rule.ingredients).map((name) => ({ name, terms: termsFor(name), rule })),
    )
    .filter((t) => t.terms.length > 0 && !seen.has(t.name.toLowerCase()) && !!seen.add(t.name.toLowerCase()));
}

/**
 * Ingredients the "avoid" rules list for easily irritated skin. Applied only
 * when the user's skin is sensitive or a redness finding is being treated.
 */
export function avoidTerms(rules: readonly KnowledgeRule[], context: UserContext, conditions: readonly ConditionName[]): string[] {
  if (context.skinType !== 'sensitive' && !conditions.includes('redness')) return [];
  return rules
    .filter((r) => /^avoid/i.test(r.recommendation) && /sensitive|irritat|redness/i.test(`${r.sensitivity} ${r.concern} ${r.skinSubtype}`))
    .flatMap((r) => splitIngredients(r.ingredients).flatMap(termsFor));
}

/** One short, grounded sentence about why the rules back a product; empty when none do. */
export function describeEvidence(evidence: readonly ProductEvidence[]): string {
  return evidence
    .slice(0, 2)
    .map((e) => {
      const strength = e.strength && !/not specified/i.test(e.strength) ? `, typically ${e.strength}` : '';
      return `${e.ingredient} is listed for ${e.concern.toLowerCase()}${strength}`;
    })
    .join('; ');
}

export const hasAnyTerm = (ingredients: string, terms: readonly string[]) => {
  const lower = ingredients.toLowerCase();
  return terms.some((t) => lower.includes(t));
};

/** Which of `targets` a product contains, as evidence lines. */
export function evidenceFor(ingredients: string, targets: readonly IngredientTarget[]): ProductEvidence[] {
  return targets
    .filter((t) => hasAnyTerm(ingredients, t.terms))
    .map((t) => ({
      ingredient: t.name,
      concern: t.rule.concern,
      strength: t.rule.concentrations,
      evidenceLevel: t.rule.evidenceLevel,
      recommendation: t.rule.recommendation,
    }));
}
