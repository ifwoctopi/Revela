// A row of the on-device product database (assets/db/products.db), built from
// the Open Beauty Facts export by etl/build-products-db.mjs.
export interface ProductRecord {
  barcode: string;
  name: string;
  brand: string;
  ingredients: string;
  categories: string;
  /** Path relative to https://images.openbeautyfacts.org, or null. */
  imagePath: string | null;
  lastModified: number;
}

export interface FaceCareFilter {
  ingredientTerms?: string[];
  categoryTerms?: string[];
}

export interface ProductRepository {
  getByBarcode(barcode: string): Promise<ProductRecord | null>;
  getByBarcodes(barcodes: string[]): Promise<ProductRecord[]>;
  /**
   * Face-care products matching any ingredient term (if given) and any
   * category term (if given). A coarse prefilter: callers apply the exact
   * rules in ingredients.ts and classify.ts.
   */
  findFaceCare(filter: FaceCareFilter, limit: number): Promise<ProductRecord[]>;
  /** Products whose name or brand contains every word of `query`. */
  searchByName(query: string, limit: number): Promise<ProductRecord[]>;
  listBrands(): Promise<string[]>;
  upsert(records: ProductRecord[]): Promise<void>;
  getSyncWatermark(): Promise<number>;
  setSyncWatermark(value: number): Promise<void>;
}
