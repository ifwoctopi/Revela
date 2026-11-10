// Copies the two Supabase knowledge tables into the local database. This is
// the only network call the knowledge feature makes, and it sends no user
// data: just an authenticated read of shared reference content. RLS limits
// the read to signed-in users (see docs/supabase-knowledge-rls.sql).

import { isSupabaseConfigured, supabase } from '../../services/supabase';
import { getKnowledgeRepository } from './sqliteRepository';
import type { KnowledgeQa, KnowledgeRule } from './types';

const PAGE = 1000;
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

type Raw = Record<string, string | null>;
const s = (value: string | null | undefined) => (value ?? '').trim();

async function fetchAll(table: string, key: string): Promise<Raw[]> {
  const rows: Raw[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').order(key).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data as Raw[]));
    if (data.length < PAGE) return rows;
  }
}

export const toRule = (r: Raw): KnowledgeRule => ({
  rowId: s(r.Row_ID), skinType: s(r.Skin_Type), skinSubtype: s(r.Skin_Subtype), sensitivity: s(r.Sensitivity),
  concern: s(r.Concern), ingredients: s(r.Ingredients), concentrations: s(r.Concentrations), effects: s(r.Effects),
  evidenceLevel: s(r.Evidence_Level), recommendation: s(r.Recommendation), regulatoryStatusUs: s(r.Regulatory_Status_US),
  pregnancyNotes: s(r.Pregnancy_Notes), otherNotes: s(r.Other_Notes),
});

export const toQa = (r: Raw): KnowledgeQa => ({
  id: s(r.id), category: s(r.category), question: s(r.question), altPhrasings: s(r.alt_phrasings),
  answer: s(r.answer), safetyFlags: s(r.safety_flags), rowIds: s(r.row_ids),
});

/**
 * Refreshes the local copy when it is missing or older than a day. Never
 * throws: chat keeps working from whatever copy is already on the device.
 */
export async function syncKnowledge({ force = false }: { force?: boolean } = {}): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const repository = await getKnowledgeRepository();
    if (!force && Date.now() - (await repository.getSyncedAt()) < REFRESH_AFTER_MS) return false;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return false;

    const [rules, qa] = await Promise.all([fetchAll('ingredients_and_conditions', 'Row_ID'), fetchAll('cosmetic_qa', 'id')]);
    await repository.replaceAll(rules.map(toRule).filter((r) => r.rowId), qa.map(toQa).filter((q) => q.id && q.answer));
    return true;
  } catch {
    return false;
  }
}
