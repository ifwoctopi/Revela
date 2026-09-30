import { importDatabaseFromAssetAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { FACE_CARE_SQL_TERMS } from './classify';
import type { FaceCareFilter, ProductRecord, ProductRepository } from './types';

const DATABASE_NAME = 'products.db';

interface Row {
  barcode: string;
  name: string;
  brand: string;
  ingredients: string;
  categories: string;
  image_path: string | null;
  last_modified: number;
}

const toRecord = (row: Row): ProductRecord => ({
  barcode: row.barcode,
  name: row.name,
  brand: row.brand,
  ingredients: row.ingredients,
  categories: row.categories,
  imagePath: row.image_path,
  lastModified: row.last_modified,
});

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export class SQLiteProductRepository implements ProductRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async getByBarcode(barcode: string) {
    const row = await this.db.getFirstAsync<Row>('SELECT * FROM products WHERE barcode = ?', barcode);
    return row ? toRecord(row) : null;
  }

  async getByBarcodes(barcodes: string[]) {
    if (barcodes.length === 0) return [];
    const rows = await this.db.getAllAsync<Row>(
      `SELECT * FROM products WHERE barcode IN (${barcodes.map(() => '?').join(',')})`,
      barcodes,
    );
    return rows.map(toRecord);
  }

  async findFaceCare({ ingredientTerms = [], categoryTerms = [] }: FaceCareFilter, limit: number) {
    const anyLike = (column: string, terms: string[]) =>
      `(${terms.map(() => `${column} LIKE ? ESCAPE '\\'`).join(' OR ')})`;
    const clauses = [anyLike('categories', FACE_CARE_SQL_TERMS)];
    const params: (string | number)[] = FACE_CARE_SQL_TERMS.map((t) => `%${escapeLike(t)}%`);
    for (const [column, terms] of [['LOWER(ingredients)', ingredientTerms], ["LOWER(categories || ' ' || name)", categoryTerms]] as const) {
      if (terms.length === 0) continue;
      clauses.push(anyLike(column, terms));
      params.push(...terms.map((t) => `%${escapeLike(t.toLowerCase())}%`));
    }
    const rows = await this.db.getAllAsync<Row>(
      `SELECT * FROM products WHERE ${clauses.join(' AND ')} ORDER BY last_modified DESC LIMIT ?`,
      [...params, limit],
    );
    return rows.map(toRecord);
  }

  async searchByName(query: string, limit: number) {
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1).slice(0, 6);
    if (words.length === 0) return [];
    const clause = words.map(() => "LOWER(name || ' ' || brand) LIKE ? ESCAPE '\\'").join(' AND ');
    const rows = await this.db.getAllAsync<Row>(`SELECT * FROM products WHERE ${clause} LIMIT ?`, [
      ...words.map((w) => `%${escapeLike(w)}%`),
      limit,
    ]);
    return rows.map(toRecord);
  }

  async listBrands() {
    const rows = await this.db.getAllAsync<{ brand: string }>("SELECT DISTINCT brand FROM products WHERE brand != ''");
    return rows.map((r) => r.brand);
  }

  async upsert(records: ProductRecord[]) {
    await this.db.withTransactionAsync(async () => {
      for (const r of records) {
        await this.db.runAsync(
          'INSERT OR REPLACE INTO products VALUES (?, ?, ?, ?, ?, ?, ?)',
          [r.barcode, r.name, r.brand, r.ingredients, r.categories, r.imagePath, r.lastModified],
        );
      }
    });
  }

  async getSyncWatermark() {
    const row = await this.db.getFirstAsync<{ value: string }>("SELECT value FROM sync_state WHERE key = 'last_modified'");
    return row ? Number(row.value) || 0 : 0;
  }

  async setSyncWatermark(value: number) {
    await this.db.runAsync("INSERT OR REPLACE INTO sync_state VALUES ('last_modified', ?)", String(value));
  }
}

let repositoryPromise: Promise<ProductRepository> | null = null;

/** Opens the product DB, copying the bundled snapshot on first launch only. */
export function getProductRepository(): Promise<ProductRepository> {
  if (!repositoryPromise) {
    repositoryPromise = (async () => {
      await importDatabaseFromAssetAsync(DATABASE_NAME, { assetId: require('../../assets/db/products.db') });
      return new SQLiteProductRepository(await openDatabaseAsync(DATABASE_NAME));
    })().catch((error: unknown) => {
      repositoryPromise = null;
      throw error;
    });
  }
  return repositoryPromise;
}
