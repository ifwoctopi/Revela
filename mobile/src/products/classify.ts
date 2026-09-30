// Classifies database products by category tags and name. Deterministic.

export type ProductKind = 'cleanser' | 'treatment' | 'moisturizer' | 'sunscreen' | 'eye_care' | 'other';

// Keep in sync with FACE_CARE_CATEGORY in etl/build-products-db.mjs.
export const FACE_CARE_SQL_TERMS = [
  'skin', 'face', 'facial', 'moistur', 'cleans', 'serum', 'sunscreen', 'sun-protection', 'toner', 'acne', 'eye-cream', 'exfoli',
];
const FACE_CARE = new RegExp(FACE_CARE_SQL_TERMS.join('|'));
const NOT_FACE = /hand-cream|body|hair|lip|deodorant|toothpaste|shampoo|baby|foot|feet|shaving|shower|soap|makeup/;

export function isFaceCare(categories: string): boolean {
  return FACE_CARE.test(categories) && !NOT_FACE.test(categories);
}

/** Product name for display and speech: brand-prefixed, without pack sizes like "50 ml". */
export function displayProductName(name: string, brand: string): string {
  const cleaned = name
    .replace(/\b\d+([.,]\d+)?\s?(ml|g|oz|fl\.?\s?oz|l|mg|gr)\b\.?/gi, '')
    .replace(/[()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const hasBrand = brand && cleaned.toLowerCase().includes(brand.toLowerCase());
  return hasBrand || !brand || brand === 'Unknown Brand' ? cleaned : `${brand} ${cleaned}`;
}

export function productKind(categories: string, name: string): ProductKind {
  const text = `${categories} ${name.toLowerCase()}`;
  if (/sunscreen|sun-protection|suncare|\bspf\b/.test(text)) return 'sunscreen';
  if (/cleans|wash|foam|micellar/.test(text)) return 'cleanser';
  if (/eye-cream|\beye\b/.test(text)) return 'eye_care';
  if (/serum|essence|treatment|toner|tonic|ampoule|peel|exfoli/.test(text)) return 'treatment';
  if (/moistur|cream|lotion|gel|hydrat|balm/.test(text)) return 'moisturizer';
  return 'other';
}
