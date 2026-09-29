import { isSpeakable, wordCount } from './speech';

export const SECTION_IDS = [
  'overview', 'contributing', 'routine', 'products', 'cautions', 'expectations', 'professional',
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface SummarySection {
  id: SectionId;
  title: string;
  /** Plain sentences for TTS: no markdown, emoji, raw ids, or abbreviations. */
  spokenText: string;
  /** Text shown on screen (always visible, so the screen works with sound off). */
  displayText: string;
  /** Ids from the scan image registry ("scan:front") or product records ("product:<barcode>"). Never URLs. */
  imageRefs: string[];
  /** Barcodes of database products. */
  productIds: string[];
  /** True when this section is the guardrail fallback rather than generated content. */
  isFallback?: boolean;
}

export interface SectionConstraints {
  expectedId: SectionId;
  allowedImageRefs: ReadonlySet<string>;
  /** Barcodes confirmed to exist in the product database right now. */
  existingProductIds: ReadonlySet<string>;
  /** Barcodes this section was allowed to recommend. */
  offeredProductIds: ReadonlySet<string>;
  /** When true, at least one product id is required. */
  requiresProducts: boolean;
}

export type SectionIssue =
  | 'shape'
  | 'wrong_id'
  | 'title'
  | 'display_length'
  | 'spoken_length'
  | 'unspeakable'
  | 'image_ref'
  | 'missing_product'
  | 'unoffered_product'
  | 'no_products';

/** ~12–130 words is roughly 5–45 seconds of speech; prompts aim for 15–40 seconds. */
export const SPOKEN_WORDS = { min: 12, max: 130 } as const;
export const MAX_DISPLAY_CHARS = 1200;

export function validateSection(
  input: unknown,
  c: SectionConstraints,
): { ok: true; section: SummarySection } | { ok: false; issue: SectionIssue } {
  if (typeof input !== 'object' || input === null) return { ok: false, issue: 'shape' };
  const s = input as Record<string, unknown>;
  const strings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
  if (typeof s.title !== 'string' || typeof s.spokenText !== 'string' || typeof s.displayText !== 'string' ||
      !strings(s.imageRefs) || !strings(s.productIds)) {
    return { ok: false, issue: 'shape' };
  }
  if (s.id !== c.expectedId) return { ok: false, issue: 'wrong_id' };
  if (!s.title.trim() || s.title.length > 60) return { ok: false, issue: 'title' };
  if (s.displayText.trim().length < 10 || s.displayText.length > MAX_DISPLAY_CHARS) return { ok: false, issue: 'display_length' };
  const words = wordCount(s.spokenText);
  if (words < SPOKEN_WORDS.min || words > SPOKEN_WORDS.max) return { ok: false, issue: 'spoken_length' };
  if (!isSpeakable(s.spokenText)) return { ok: false, issue: 'unspeakable' };

  const imageRefs = s.imageRefs as string[];
  if (imageRefs.some((ref) => !c.allowedImageRefs.has(ref) || /:\/\//.test(ref))) return { ok: false, issue: 'image_ref' };

  const productIds = s.productIds as string[];
  if (productIds.some((id) => !c.existingProductIds.has(id))) return { ok: false, issue: 'missing_product' };
  if (productIds.some((id) => !c.offeredProductIds.has(id))) return { ok: false, issue: 'unoffered_product' };
  if (c.requiresProducts && productIds.length === 0) return { ok: false, issue: 'no_products' };

  return {
    ok: true,
    section: {
      id: c.expectedId,
      title: s.title.trim(),
      spokenText: s.spokenText.trim(),
      displayText: s.displayText.trim(),
      imageRefs,
      productIds: [...new Set(productIds)],
    },
  };
}
