// In-memory KnowledgeRepository for tests.

import type { KnowledgeQa, KnowledgeRepository, KnowledgeRule } from './types';

const searchText = (parts: string[]) => parts.join(' ').toLowerCase();

export class MemoryKnowledgeRepository implements KnowledgeRepository {
  private syncedAt = 0;

  constructor(private rules: KnowledgeRule[] = [], private qa: KnowledgeQa[] = []) {}

  async findRules(words: string[], limit: number) {
    return this.rules
      .filter((r) => words.some((w) => searchText([r.ingredients, r.concern, r.skinType, r.effects]).includes(w)))
      .slice(0, limit);
  }

  async findQa(words: string[], limit: number) {
    return this.qa
      .filter((q) => words.some((w) => searchText([q.question, q.altPhrasings, q.category]).includes(w)))
      .slice(0, limit);
  }

  async getRules(rowIds: string[]) {
    return this.rules.filter((r) => rowIds.includes(r.rowId));
  }

  async listRules() {
    return [...this.rules];
  }

  async replaceAll(rules: KnowledgeRule[], qa: KnowledgeQa[]) {
    this.rules = rules;
    this.qa = qa;
    this.syncedAt = Date.now();
  }

  async getSyncedAt() {
    return this.syncedAt;
  }
}
