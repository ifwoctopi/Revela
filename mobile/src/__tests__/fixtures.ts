// Test fixtures. Synthetic data only: no real people, no PII.

import { emptyUserContext, type UserContext } from '../intake/userContext';
import type { CompletionRequest, LlmClient } from '../llm/client';
import { MemoryProductRepository } from '../products/memoryRepository';
import type { ProductRecord } from '../products/types';
import type { SessionSummary } from '../types/session';

const product = (barcode: string, name: string, categories: string, ingredients: string): ProductRecord => ({
  barcode, name, brand: 'Testbrand', categories, ingredients, imagePath: null, lastModified: Number(barcode.slice(-4)),
});

export const PRODUCTS: ProductRecord[] = [
  product('0000000001001', 'Clarifying Serum 30 ml', 'en:face,en:serums', 'Aqua, Glycerin, Salicylic Acid, Niacinamide, Panthenol'),
  product('0000000001002', 'Retinol Night Serum', 'en:face,en:serums', 'Aqua, Squalane, Retinol, Tocopherol'),
  product('0000000001003', 'Brightening Serum', 'en:face,en:serums', 'Aqua, Niacinamide, Ascorbyl Glucoside, Glycerin'),
  product('0000000001004', 'Calming Serum', 'en:face,en:serums', 'Aqua, Centella Asiatica Extract, Panthenol, Allantoin'),
  product('0000000001005', 'Gentle Foaming Cleanser', 'en:face,en:cleansers', 'Aqua, Glycerin, Coco-Glucoside, Panthenol'),
  product('0000000001006', 'Barrier Moisturizing Cream', 'en:face,en:moisturizers', 'Aqua, Glycerin, Ceramide NP, Sodium Hyaluronate, Squalane'),
  product('0000000001007', 'Mineral Sunscreen SPF 50', 'en:face,en:sunscreen', 'Zinc Oxide, Aqua, Glycerin'),
  product('0000000001008', 'Scented Glow Cream', 'en:face,en:moisturizers', 'Aqua, Glycerin, Parfum, Linalool'),
  product('0000000001009', 'Body Lotion', 'en:body,en:body-creams', 'Aqua, Glycerin, Salicylic Acid'),
];

export const repository = () => new MemoryProductRepository(PRODUCTS);

export const SCAN: SessionSummary = {
  session_id: 'test-session',
  timestamp: '2026-01-01T00:00:00.000Z',
  angles_captured: ['front', 'left_3q', 'right_3q'],
  results: {
    acne: { present: true, confidence: 0.87, region: 'chin', severity: 'moderate' },
    redness: { present: true, confidence: 0.62, region: 'left_cheek', severity: 'mild' },
    dryness: { present: false },
  },
};

export function context(overrides: Partial<UserContext> = {}): UserContext {
  return { ...emptyUserContext('test-user'), concerns: ['acne'], pregnancy: 'no', skinType: 'combination', ...overrides };
}

/** An LLM that returns scripted replies in order and records every request. */
export class ScriptedLlm implements LlmClient {
  readonly requests: CompletionRequest[] = [];
  constructor(private readonly replies: Array<string | ((req: CompletionRequest) => string)>) {}
  async complete(request: CompletionRequest) {
    this.requests.push(request);
    const next = this.replies[Math.min(this.requests.length - 1, this.replies.length - 1)];
    return typeof next === 'function' ? next(request) : next;
  }
}

export const sectionJson = (displayText: string, productRefs: string[] = []) => JSON.stringify({ displayText, productRefs });
