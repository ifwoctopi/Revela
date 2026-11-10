// Vetted skin care guidance synced from Supabase (ingredients_and_conditions
// and cosmetic_qa) into an on-device SQLite database. Chat retrieves from the
// local copy, so answering a question never touches the network.

export interface KnowledgeRule {
  rowId: string;
  skinType: string;
  skinSubtype: string;
  sensitivity: string;
  concern: string;
  ingredients: string;
  concentrations: string;
  effects: string;
  evidenceLevel: string;
  recommendation: string;
  regulatoryStatusUs: string;
  pregnancyNotes: string;
  otherNotes: string;
}

export interface KnowledgeQa {
  id: string;
  category: string;
  question: string;
  altPhrasings: string;
  answer: string;
  safetyFlags: string;
  /** Row_IDs of the rules this answer is based on, comma or semicolon separated. */
  rowIds: string;
}

export interface KnowledgeRepository {
  /** Candidate rules containing any of `words` (lowercase). Ranking is done by the caller. */
  findRules(words: string[], limit: number): Promise<KnowledgeRule[]>;
  findQa(words: string[], limit: number): Promise<KnowledgeQa[]>;
  getRules(rowIds: string[]): Promise<KnowledgeRule[]>;
  /** Every rule; the table is small enough to read whole when planning products. */
  listRules(): Promise<KnowledgeRule[]>;
  /** Replaces the whole local copy atomically. */
  replaceAll(rules: KnowledgeRule[], qa: KnowledgeQa[]): Promise<void>;
  getSyncedAt(): Promise<number>;
}
