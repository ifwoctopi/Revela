// Deterministic ingredient rules. Every ingredient fact the app states (which
// actives a product contains, pregnancy cautions, conflicts, sun sensitivity,
// when and how often to use) comes from this table — never from the LLM.
//
// REVIEW: these rules must be checked by a dermatology or esthetics
// professional before release. They are deliberately conservative.

import type { ConditionName } from '../types/session';

export type ActiveId =
  | 'salicylic_acid'
  | 'benzoyl_peroxide'
  | 'niacinamide'
  | 'azelaic_acid'
  | 'retinoid'
  | 'aha'
  | 'vitamin_c'
  | 'hyaluronic_acid'
  | 'ceramides'
  | 'squalane'
  | 'panthenol'
  | 'centella'
  | 'allantoin'
  | 'mineral_uv_filter'
  | 'chemical_uv_filter'
  | 'tranexamic_acid'
  | 'arbutin'
  | 'caffeine'
  | 'zinc_pca'
  | 'tea_tree';

/** 'avoid': excluded when pregnant. 'ask': also excluded when pregnant, plus a caution. */
export type PregnancyFlag = 'none' | 'ask' | 'avoid';
export type RoutineTime = 'AM' | 'PM' | 'AM_OR_PM';

export interface ActiveRule {
  id: ActiveId;
  /** Plain-language name, safe to display and speak. */
  name: string;
  /** Lowercase substrings matched against a single INCI ingredient. */
  patterns: string[];
  /** Only counts when listed within the first N ingredients (filters trace amounts, e.g. lactic acid as a pH adjuster). */
  maxPosition?: number;
  concerns: ConditionName[];
  pregnancy: PregnancyFlag;
  sunSensitizing: boolean;
  time: RoutineTime;
  frequency: string;
}

export const ACTIVES: Record<ActiveId, ActiveRule> = {
  salicylic_acid: {
    id: 'salicylic_acid', name: 'salicylic acid', patterns: ['salicylic acid'],
    concerns: ['acne', 'oily_skin'], pregnancy: 'ask', sunSensitizing: false, time: 'AM_OR_PM',
    frequency: 'start two or three times a week, then build up to daily if your skin is comfortable',
  },
  benzoyl_peroxide: {
    id: 'benzoyl_peroxide', name: 'benzoyl peroxide', patterns: ['benzoyl peroxide'],
    concerns: ['acne'], pregnancy: 'ask', sunSensitizing: false, time: 'AM_OR_PM',
    frequency: 'once a day to start, as a thin layer',
  },
  niacinamide: {
    id: 'niacinamide', name: 'niacinamide', patterns: ['niacinamide'],
    concerns: ['acne', 'oily_skin', 'hyperpigmentation', 'redness'], pregnancy: 'none', sunSensitizing: false,
    time: 'AM_OR_PM', frequency: 'once or twice a day',
  },
  azelaic_acid: {
    id: 'azelaic_acid', name: 'azelaic acid', patterns: ['azelaic acid'],
    concerns: ['acne', 'redness', 'hyperpigmentation'], pregnancy: 'ask', sunSensitizing: false,
    time: 'AM_OR_PM', frequency: 'once a day to start',
  },
  retinoid: {
    id: 'retinoid', name: 'a retinoid', patterns: ['retinol', 'retinal', 'retinaldehyde', 'retinyl'],
    concerns: ['acne', 'hyperpigmentation'], pregnancy: 'avoid', sunSensitizing: true, time: 'PM',
    frequency: 'two or three evenings a week to start',
  },
  aha: {
    id: 'aha', name: 'an exfoliating acid', patterns: ['glycolic acid', 'lactic acid', 'mandelic acid'],
    maxPosition: 12, concerns: ['hyperpigmentation', 'dryness'], pregnancy: 'none', sunSensitizing: true,
    time: 'PM', frequency: 'once or twice a week',
  },
  vitamin_c: {
    id: 'vitamin_c', name: 'vitamin C',
    patterns: ['ascorbic acid', 'ascorbyl glucoside', 'sodium ascorbyl phosphate', 'magnesium ascorbyl phosphate', 'ethyl ascorbic acid', 'tetrahexyldecyl ascorbate'],
    concerns: ['hyperpigmentation'], pregnancy: 'none', sunSensitizing: false, time: 'AM', frequency: 'once a day in the morning',
  },
  hyaluronic_acid: {
    id: 'hyaluronic_acid', name: 'hyaluronic acid', patterns: ['hyaluronic acid', 'sodium hyaluronate', 'hydrolyzed hyaluronic'],
    concerns: ['dryness'], pregnancy: 'none', sunSensitizing: false, time: 'AM_OR_PM', frequency: 'once or twice a day',
  },
  ceramides: {
    id: 'ceramides', name: 'ceramides', patterns: ['ceramide'],
    concerns: ['dryness', 'redness'], pregnancy: 'none', sunSensitizing: false, time: 'AM_OR_PM', frequency: 'once or twice a day',
  },
  squalane: {
    id: 'squalane', name: 'squalane', patterns: ['squalane'],
    concerns: ['dryness'], pregnancy: 'none', sunSensitizing: false, time: 'AM_OR_PM', frequency: 'once or twice a day',
  },
  panthenol: {
    id: 'panthenol', name: 'panthenol', patterns: ['panthenol'],
    concerns: ['dryness', 'redness'], pregnancy: 'none', sunSensitizing: false, time: 'AM_OR_PM', frequency: 'once or twice a day',
  },
  centella: {
    id: 'centella', name: 'centella', patterns: ['centella asiatica', 'madecassoside', 'asiaticoside'],
    concerns: ['redness'], pregnancy: 'none', sunSensitizing: false, time: 'AM_OR_PM', frequency: 'once or twice a day',
  },
  allantoin: {
    id: 'allantoin', name: 'allantoin', patterns: ['allantoin'],
    concerns: ['redness', 'dryness'], pregnancy: 'none', sunSensitizing: false, time: 'AM_OR_PM', frequency: 'once or twice a day',
  },
  mineral_uv_filter: {
    id: 'mineral_uv_filter', name: 'mineral sunscreen filters', patterns: ['zinc oxide', 'titanium dioxide'],
    concerns: [], pregnancy: 'none', sunSensitizing: false, time: 'AM', frequency: 'every morning, reapplied through the day when outdoors',
  },
  chemical_uv_filter: {
    id: 'chemical_uv_filter', name: 'sunscreen filters',
    patterns: ['butyl methoxydibenzoylmethane', 'avobenzone', 'octocrylene', 'homosalate', 'ethylhexyl methoxycinnamate', 'ethylhexyl salicylate', 'bis-ethylhexyloxyphenol methoxyphenyl triazine', 'ethylhexyl triazone'],
    concerns: [], pregnancy: 'none', sunSensitizing: false, time: 'AM', frequency: 'every morning, reapplied through the day when outdoors',
  },
  tranexamic_acid: {
    id: 'tranexamic_acid', name: 'tranexamic acid', patterns: ['tranexamic acid'],
    concerns: ['hyperpigmentation'], pregnancy: 'ask', sunSensitizing: false, time: 'AM_OR_PM', frequency: 'once or twice a day',
  },
  arbutin: {
    id: 'arbutin', name: 'arbutin', patterns: ['arbutin'],
    concerns: ['hyperpigmentation'], pregnancy: 'ask', sunSensitizing: false, time: 'AM_OR_PM', frequency: 'once or twice a day',
  },
  caffeine: {
    id: 'caffeine', name: 'caffeine', patterns: ['caffeine'],
    concerns: ['dark_circles'], pregnancy: 'none', sunSensitizing: false, time: 'AM_OR_PM', frequency: 'once or twice a day around the eyes',
  },
  zinc_pca: {
    id: 'zinc_pca', name: 'zinc', patterns: ['zinc pca', 'zinc gluconate'],
    concerns: ['oily_skin', 'acne'], pregnancy: 'none', sunSensitizing: false, time: 'AM_OR_PM', frequency: 'once or twice a day',
  },
  tea_tree: {
    id: 'tea_tree', name: 'tea tree oil', patterns: ['melaleuca alternifolia', 'tea tree'],
    concerns: ['acne'], pregnancy: 'ask', sunSensitizing: false, time: 'AM_OR_PM', frequency: 'once a day, as a spot treatment',
  },
};

/** Pairs that should not be layered in the same routine (AM or PM). */
export const CONFLICTS: ReadonlyArray<readonly [ActiveId, ActiveId, string]> = [
  ['retinoid', 'aha', 'Use a retinoid and an exfoliating acid on different evenings to avoid irritation.'],
  ['retinoid', 'salicylic_acid', 'Use a retinoid and salicylic acid at different times of day, or on different days.'],
  ['retinoid', 'benzoyl_peroxide', 'Use a retinoid and benzoyl peroxide at different times of day.'],
  ['retinoid', 'vitamin_c', 'Keep vitamin C in the morning and the retinoid at night.'],
  ['benzoyl_peroxide', 'vitamin_c', 'Benzoyl peroxide can make vitamin C less effective, so use them at different times of day.'],
  ['aha', 'salicylic_acid', 'Using two exfoliating acids together can over-exfoliate, so alternate days.'],
];

/**
 * Ingredient groups a user can report sensitivity to. Values are ActiveIds
 * plus groups that are not actives. Anything else the user types is counted
 * as "unrecognized" and never passed downstream.
 */
export const SENSITIVITY_GROUPS = {
  fragrance: ['parfum', 'fragrance', 'aroma'],
  essential_oils: ['limonene', 'linalool', 'citral', 'geraniol', 'eugenol', 'citronellol', 'coumarin'],
  sulfates: ['sodium lauryl sulfate', 'sodium laureth sulfate', 'ammonium lauryl sulfate'],
  alcohol: ['alcohol denat', 'denatured alcohol', 'sd alcohol'],
  lanolin: ['lanolin'],
  parabens: ['paraben'],
} as const;
export type SensitivityGroup = keyof typeof SENSITIVITY_GROUPS;
export type SensitivityId = ActiveId | SensitivityGroup;

/** Drug ingredients: any product containing one is never recommended. */
const DRUG_PATTERNS = ['hydroquinone', 'tretinoin', 'adapalene', 'clindamycin', 'hydrocortisone', 'erythromycin', 'metronidazole'];

export function splitIngredients(ingredients: string): string[] {
  return ingredients
    .toLowerCase()
    .split(/[,;]|\.\s|\s-\s|\n/)
    .map((part) => part.replace(/\(.*?\)|\*|\[.*?\]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function detectActives(ingredients: string): ActiveId[] {
  const parts = splitIngredients(ingredients);
  return (Object.values(ACTIVES) as ActiveRule[])
    .filter((rule) =>
      parts.some((part, index) =>
        (rule.maxPosition === undefined || index < rule.maxPosition) && rule.patterns.some((p) => part.includes(p)),
      ),
    )
    .map((rule) => rule.id);
}

export function containsSensitivity(ingredients: string, sensitivity: SensitivityId): boolean {
  if (sensitivity in ACTIVES) {
    // Ignore position limits here: a trace amount still matters to a sensitive user.
    const rule = ACTIVES[sensitivity as ActiveId];
    return splitIngredients(ingredients).some((part) => rule.patterns.some((p) => part.includes(p)));
  }
  const text = ` ${ingredients.toLowerCase()} `;
  return SENSITIVITY_GROUPS[sensitivity as SensitivityGroup].some((p) => text.includes(p));
}

export function containsDrugIngredient(ingredients: string): boolean {
  const text = ingredients.toLowerCase();
  return DRUG_PATTERNS.some((p) => text.includes(p));
}

export function conflictsBetween(a: ActiveId[], b: ActiveId[]): string[] {
  return CONFLICTS.filter(([x, y]) => (a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x))).map(
    ([, , advice]) => advice,
  );
}
