// Detects which known actives a piece of free text mentions (user input or
// model output), using INCI patterns plus everyday names.

import { ACTIVES, type ActiveId } from './ingredients';

const ACTIVE_SYNONYMS: Partial<Record<ActiveId, RegExp>> = {
  retinoid: /\b(retin\w*|vitamin a)\b/,
  // A bare "acids" (common in "I react to acids") means both exfoliating-acid groups.
  aha: /\b(aha|ahas|glycolic|lactic|mandelic|exfoliating acids?|acids)\b/,
  salicylic_acid: /\b(bha|salicylic|acids)\b/,
  vitamin_c: /\b(vitamin c|vit c|ascorbic)\b/,
  benzoyl_peroxide: /\b(benzoyl|bpo)\b/,
  hyaluronic_acid: /\bhyaluronic\b/,
  tea_tree: /\btea tree\b/,
  azelaic_acid: /\bazelaic\b/,
  niacinamide: /\b(niacinamide|vitamin b3)\b/,
  ceramides: /\bceramides?\b/,
  mineral_uv_filter: /\b(zinc oxide|titanium dioxide|mineral sunscreen)\b/,
  tranexamic_acid: /\btranexamic\b/,
  // Not plain "zinc": that would also match zinc oxide in sunscreens.
  zinc_pca: /\bzinc (pca|gluconate)\b/,
};

export function mentionedActives(text: string): ActiveId[] {
  const lower = text.toLowerCase();
  return (Object.keys(ACTIVES) as ActiveId[]).filter(
    (id) => ACTIVES[id].patterns.some((p) => lower.includes(p)) || ACTIVE_SYNONYMS[id]?.test(lower),
  );
}

/** Ingredient-like phrases (e.g. "snail mucin", "copper peptides") in a question. */
const INGREDIENT_LIKE = /\b([a-z]+ )?(acids?|extracts?|oils?|mucin|peptides?|ferment|collagen|retinoate|enzymes?|probiotics?)\b|\b(bakuchiol|snail|copper|sulfur|sulphur|hydroquinone|kojic|glutathione|peptide)\b/;

/**
 * True when the text asks about an ingredient that isn't in the rules table,
 * i.e. something we have no vetted data for.
 */
export function mentionsUnknownIngredient(text: string): boolean {
  const lower = text.toLowerCase();
  const match = lower.match(INGREDIENT_LIKE);
  if (!match) return false;
  return mentionedActives(match[0]).length === 0;
}
