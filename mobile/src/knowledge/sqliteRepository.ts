import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { KnowledgeQa, KnowledgeRepository, KnowledgeRule } from './types';

const DATABASE_NAME = 'knowledge.db';

interface RuleRow {
  row_id: string; skin_type: string; skin_subtype: string; sensitivity: string; concern: string;
  ingredients: string; concentrations: string; effects: string; evidence_level: string;
  recommendation: string; regulatory_status_us: string; pregnancy_notes: string; other_notes: string;
}
interface QaRow {
  id: string; category: string; question: string; alt_phrasings: string; answer: string; safety_flags: string; row_ids: string;
}

const toRule = (r: RuleRow): KnowledgeRule => ({
  rowId: r.row_id, skinType: r.skin_type, skinSubtype: r.skin_subtype, sensitivity: r.sensitivity,
  concern: r.concern, ingredients: r.ingredients, concentrations: r.concentrations, effects: r.effects,
  evidenceLevel: r.evidence_level, recommendation: r.recommendation, regulatoryStatusUs: r.regulatory_status_us,
  pregnancyNotes: r.pregnancy_notes, otherNotes: r.other_notes,
});
const toQa = (r: QaRow): KnowledgeQa => ({
  id: r.id, category: r.category, question: r.question, altPhrasings: r.alt_phrasings,
  answer: r.answer, safetyFlags: r.safety_flags, rowIds: r.row_ids,
});

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);
const anyLike = (words: string[]) => words.map(() => "search LIKE ? ESCAPE '\\'").join(' OR ');
const likeParams = (words: string[]) => words.map((w) => `%${escapeLike(w)}%`);

export class SQLiteKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async findRules(words: string[], limit: number) {
    if (words.length === 0) return [];
    const rows = await this.db.getAllAsync<RuleRow>(
      `SELECT * FROM rules WHERE ${anyLike(words)} LIMIT ?`,
      [...likeParams(words), limit],
    );
    return rows.map(toRule);
  }

  async findQa(words: string[], limit: number) {
    if (words.length === 0) return [];
    const rows = await this.db.getAllAsync<QaRow>(
      `SELECT * FROM qa WHERE ${anyLike(words)} LIMIT ?`,
      [...likeParams(words), limit],
    );
    return rows.map(toQa);
  }

  async getRules(rowIds: string[]) {
    if (rowIds.length === 0) return [];
    const rows = await this.db.getAllAsync<RuleRow>(
      `SELECT * FROM rules WHERE row_id IN (${rowIds.map(() => '?').join(',')})`,
      rowIds,
    );
    return rows.map(toRule);
  }

  async listRules() {
    return (await this.db.getAllAsync<RuleRow>('SELECT * FROM rules')).map(toRule);
  }

  async replaceAll(rules: KnowledgeRule[], qa: KnowledgeQa[]) {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM rules');
      await this.db.runAsync('DELETE FROM qa');
      for (const r of rules) {
        await this.db.runAsync(
          'INSERT OR REPLACE INTO rules VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            r.rowId, r.skinType, r.skinSubtype, r.sensitivity, r.concern, r.ingredients, r.concentrations,
            r.effects, r.evidenceLevel, r.recommendation, r.regulatoryStatusUs, r.pregnancyNotes, r.otherNotes,
            [r.ingredients, r.concern, r.skinType, r.effects].join(' ').toLowerCase(),
          ],
        );
      }
      for (const q of qa) {
        await this.db.runAsync(
          'INSERT OR REPLACE INTO qa VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [q.id, q.category, q.question, q.altPhrasings, q.answer, q.safetyFlags, q.rowIds, [q.question, q.altPhrasings, q.category].join(' ').toLowerCase()],
        );
      }
      await this.db.runAsync("INSERT OR REPLACE INTO meta VALUES ('synced_at', ?)", String(Date.now()));
    });
  }

  async getSyncedAt() {
    const row = await this.db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'synced_at'");
    return row ? Number(row.value) || 0 : 0;
  }
}

let repositoryPromise: Promise<KnowledgeRepository> | null = null;

/** Opens (creating on first launch) the local copy of the knowledge tables. */
export function getKnowledgeRepository(): Promise<KnowledgeRepository> {
  if (!repositoryPromise) {
    repositoryPromise = (async () => {
      const db = await openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS rules (
          row_id TEXT PRIMARY KEY, skin_type TEXT, skin_subtype TEXT, sensitivity TEXT, concern TEXT,
          ingredients TEXT, concentrations TEXT, effects TEXT, evidence_level TEXT, recommendation TEXT,
          regulatory_status_us TEXT, pregnancy_notes TEXT, other_notes TEXT, search TEXT
        );
        CREATE TABLE IF NOT EXISTS qa (
          id TEXT PRIMARY KEY, category TEXT, question TEXT, alt_phrasings TEXT, answer TEXT,
          safety_flags TEXT, row_ids TEXT, search TEXT
        );
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
      `);
      return new SQLiteKnowledgeRepository(db);
    })().catch((error: unknown) => {
      repositoryPromise = null;
      throw error;
    });
  }
  return repositoryPromise;
}
