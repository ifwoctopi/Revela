// Layer 4: validates every model output before it is shown or spoken.
// Anything that fails is replaced with FALLBACK_MESSAGE by the caller; the
// reason is for tests and never shown to the user.

import type { ActiveId } from '../products/ingredients';
import { mentionedActives } from '../products/mentions';
import { GUARDED_SYSTEM_PROMPT } from './systemPrompt';

export type BlockReason =
  | 'empty'
  | 'too_long'
  | 'internals'
  | 'prompt_leak'
  | 'other_user'
  | 'personal_data'
  | 'diagnosis'
  | 'prescription'
  | 'dosing'
  | 'unknown_product_ref'
  | 'ungrounded_product'
  | 'ungrounded_ingredient'
  | 'off_topic';

export type ValidationResult = { ok: true; text: string } | { ok: false; reason: BlockReason };

export interface OutputPolicy {
  /** Product references the output may use, e.g. "P1". */
  allowedProductRefs: ReadonlySet<string>;
  /** Names and brands of products the output may mention. */
  allowedProductNames: readonly string[];
  allowedActives: ReadonlySet<ActiveId>;
  /** Brands that, if mentioned, must be among the allowed products. */
  knownBrands: readonly string[];
  maxChars: number;
  /** Extra secret text (e.g. a section prompt) that must never be quoted. */
  secretTexts?: readonly string[];
}

/** Well-known brands the model may "remember"; always checked, whether or not they're in the DB. */
export const WELL_KNOWN_BRANDS = [
  'CeraVe', 'La Roche-Posay', 'The Ordinary', 'Neutrogena', 'Cetaphil', "Paula's Choice", 'Olay', 'Clinique', "Kiehl's",
  'Aveeno', 'Differin', 'Eucerin', 'Bioderma', 'Vichy', 'Avène', 'Avene', 'Garnier', "L'Oréal", "L'Oreal", 'Nivea',
  'Drunk Elephant', 'Glossier', 'Innisfree', 'COSRX', 'Murad', 'Obagi', 'SkinCeuticals', 'Tatcha', 'Sunday Riley',
  'First Aid Beauty', 'Mario Badescu', 'Clean & Clear', 'Proactiv', 'Supergoop', 'EltaMD', 'Aquaphor', 'Vaseline',
];

// Database brands that are ordinary words would block normal sentences.
const COMMON_WORDS = new Set([
  'simple', 'nature', 'natural', 'pure', 'clean', 'fresh', 'daily', 'gentle', 'organic', 'beauty', 'skin', 'care', 'glow',
  'basic', 'basics', 'essence', 'derma', 'face', 'body', 'sun', 'unknown brand', 'bio', 'aqua', 'rose', 'green', 'clear',
  'soft', 'good', 'true', 'bare', 'balance', 'botanics', 'home', 'garden', 'generic', 'none', 'unknown',
]);

/** Filters database brands down to ones distinctive enough to detect in text. */
export function distinctiveBrands(brands: Iterable<string>): string[] {
  return [...new Set([...brands].map((b) => b.trim()))].filter(
    (b) => b.length >= 4 && /[A-Z]/.test(b) && !COMMON_WORDS.has(b.toLowerCase()),
  );
}

const INTERNALS = [
  /```|<\/?[a-z][^>]*>|\{\s*"|=>|\bfunction\s*\(|\bimport\s+[\w{]|require\(|console\./i,
  /\b(select|insert|update|delete)\s+[\w*]+\s+(from|into|set)\b|\bcreate table\b/i,
  /[a-z]:\\|(^|\s)\/?(src|app|node_modules|assets|etc|usr|var|home|data)\/[\w./-]+|\.(tsx?|jsx?|json|db|sqlite|gguf|onnx|py)\b/i,
  /\bat \w+ \(|\b\w*(error|exception):|\bapi[_ -]?keys?\b|\bsk-[a-z0-9]{8,}|\beyJ[a-z0-9_-]{10,}/i,
  /\b(sync_state|image_path|last_modified|user_?id|usercontext|sessionsummary|productrepository|llama\.?rn|expo|react native|sqlite|supabase|ollama|gguf|system prompt|my instructions|my prompt)\b/i,
  /\b(llama|gpt|language model|llm|neural network|trained on)\b/i,
];

const OTHER_USER = /\b(other|another|different)\s+(users?|customers?|people'?s|person'?s|accounts?|patients?)\b|\buser[_ -]?\d+\b|\bsess(ion)?_\w+/i;
const PERSONAL_DATA = [/[\w.+-]+@[\w-]+\.[\w.]+/, /\+?\d[\d\s().-]{8,}\d/, /\d{6,}/];

const DISEASES = 'rosacea|eczema|psoriasis|dermatitis|melanoma|cancer|carcinoma|infection|lupus|melasma|folliculitis|seborrh\\w*|impetigo|ringworm|scabies|shingles|herpes|condition|disease|disorder|syndrome';
const DIAGNOSIS = [
  /\bdiagnos\w*/i,
  new RegExp(`\\byou\\s+(have|likely have|probably have|may have|might have|are suffering from|'ve got|suffer from)\\b[^.]{0,30}\\b(${DISEASES})\\b`, 'i'),
  new RegExp(`\\b(this|it|that)\\s+(is|looks like|could be|might be|may be|seems like|sounds like)\\b[^.]{0,20}\\b(${DISEASES})\\b`, 'i'),
];
// "This is not a diagnosis" is fine; remove negated mentions before checking.
const NEGATED_DIAGNOSIS = /\b(not|never|can'?t|cannot|unable to|isn'?t|don'?t|won'?t|no)\b[^.]{0,20}\bdiagnos\w*/gi;

const PRESCRIPTION = /\b(tretinoin|isotretinoin|accutane|adapalene|differin|clindamycin|doxycycline|minocycline|spironolactone|hydroquinone|metronidazole|ivermectin|tacrolimus|pimecrolimus|hydrocortisone|prednisone|antibiotics?|steroids?|corticosteroids?|finasteride)\b/i;
const DOSING = [/\b\d+(\.\d+)?\s?(mg|mcg|milligrams?|micrograms?|iu)\b/i, /\b(take|swallow)\b[^.]{0,20}\b(pills?|tablets?|capsules?|supplements?)\b/i, /\b(orally|by mouth)\b/i];

const SKIN_CARE_VOCABULARY = /\b(skin|face|facial|routine|cleans\w*|moistur\w*|sunscreen|product|ingredient|acne|breakouts?|pimples?|red(ness)?|dry\w*|oily|shine|pigment\w*|spots?|dark circles?|hydrat\w*|serum|patch test|dermatologist|healthcare provider|pores?|texture|tone|exfoli\w*|irritat\w*|sensitiv\w*|morning|evening|apply|scan)\b|\[P\d+\]/i;

const PRODUCT_REF = /\[?\bP(\d{1,2})\b\]?/g;

/** Deterministic cleanup before validation: markdown, emoji and extra whitespace. */
export function normalizeOutput(text: string): string {
  return text
    .replace(/\*\*|__|`|^#+\s*/gm, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function shingles(text: string, size: number): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + size <= words.length; i++) out.add(words.slice(i, i + size).join(' '));
  return out;
}

const SYSTEM_PROMPT_SHINGLES = shingles(GUARDED_SYSTEM_PROMPT, 6);

function quotesSecret(text: string, secrets: readonly string[]): boolean {
  const out = shingles(text, 6);
  const secretSets = [SYSTEM_PROMPT_SHINGLES, ...secrets.map((s) => shingles(s, 6))];
  return secretSets.some((set) => [...out].some((s) => set.has(s)));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function validateOutput(raw: string, policy: OutputPolicy): ValidationResult {
  const text = normalizeOutput(raw);
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length > policy.maxChars) return { ok: false, reason: 'too_long' };
  if (INTERNALS.some((p) => p.test(text))) return { ok: false, reason: 'internals' };
  if (quotesSecret(text, policy.secretTexts ?? [])) return { ok: false, reason: 'prompt_leak' };
  if (OTHER_USER.test(text)) return { ok: false, reason: 'other_user' };
  if (PERSONAL_DATA.some((p) => p.test(text))) return { ok: false, reason: 'personal_data' };
  const withoutNegations = text.replace(NEGATED_DIAGNOSIS, '');
  if (DIAGNOSIS.some((p) => p.test(withoutNegations))) return { ok: false, reason: 'diagnosis' };
  if (PRESCRIPTION.test(text)) return { ok: false, reason: 'prescription' };
  if (DOSING.some((p) => p.test(text))) return { ok: false, reason: 'dosing' };

  for (const match of text.matchAll(PRODUCT_REF)) {
    if (!policy.allowedProductRefs.has(`P${match[1]}`)) return { ok: false, reason: 'unknown_product_ref' };
  }
  const allowedNames = policy.allowedProductNames.map((n) => n.toLowerCase());
  const brands = [...new Set([...policy.knownBrands, ...WELL_KNOWN_BRANDS])].filter((b) => b.length >= 4);
  for (const brand of brands) {
    // Case-sensitive: brands are proper nouns ("Simple" the brand vs "a simple routine").
    if (new RegExp(`(^|[^\\w])${escapeRegExp(brand)}($|[^\\w])`).test(text) &&
        !allowedNames.some((n) => n.includes(brand.toLowerCase()))) {
      return { ok: false, reason: 'ungrounded_product' };
    }
  }
  if (mentionedActives(text).some((a) => !policy.allowedActives.has(a))) return { ok: false, reason: 'ungrounded_ingredient' };
  if (!SKIN_CARE_VOCABULARY.test(text)) return { ok: false, reason: 'off_topic' };
  return { ok: true, text };
}
