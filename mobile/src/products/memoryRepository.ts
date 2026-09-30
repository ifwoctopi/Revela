// In-memory ProductRepository with the same query semantics as the SQLite one.
// Used by tests and anywhere a fixed product set is needed.

import { FACE_CARE_SQL_TERMS } from './classify';
import type { FaceCareFilter, ProductRecord, ProductRepository } from './types';

export class MemoryProductRepository implements ProductRepository {
  private readonly products = new Map<string, ProductRecord>();
  private watermark = 0;

  constructor(records: ProductRecord[] = []) {
    records.forEach((r) => this.products.set(r.barcode, r));
  }

  async getByBarcode(barcode: string) {
    return this.products.get(barcode) ?? null;
  }

  async getByBarcodes(barcodes: string[]) {
    return barcodes.flatMap((b) => this.products.get(b) ?? []);
  }

  async findFaceCare({ ingredientTerms = [], categoryTerms = [] }: FaceCareFilter, limit: number) {
    const matchesAny = (text: string, terms: string[]) =>
      terms.length === 0 || terms.some((t) => text.toLowerCase().includes(t.toLowerCase()));
    return [...this.products.values()]
      .filter((p) => FACE_CARE_SQL_TERMS.some((t) => p.categories.includes(t)))
      .filter((p) => matchesAny(p.ingredients, ingredientTerms))
      .filter((p) => matchesAny(`${p.categories} ${p.name}`, categoryTerms))
      .sort((a, b) => b.lastModified - a.lastModified)
      .slice(0, limit);
  }

  async searchByName(query: string, limit: number) {
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1).slice(0, 6);
    if (words.length === 0) return [];
    return [...this.products.values()]
      .filter((p) => words.every((w) => `${p.name} ${p.brand}`.toLowerCase().includes(w)))
      .slice(0, limit);
  }

  async listBrands() {
    return [...new Set([...this.products.values()].map((p) => p.brand).filter(Boolean))];
  }

  async upsert(records: ProductRecord[]) {
    records.forEach((r) => this.products.set(r.barcode, r));
  }

  async getSyncWatermark() {
    return this.watermark;
  }

  async setSyncWatermark(value: number) {
    this.watermark = value;
  }
}
