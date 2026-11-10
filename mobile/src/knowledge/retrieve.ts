// Picks the few knowledge rows relevant to a chat question and renders them as
// short fact lines for the scoped context. Pure apart from repository reads.

import type { UserContext } from '../intake/userContext';
import type { KnowledgeQa, KnowledgeRepository, KnowledgeRule } from './types';

export interface KnowledgeFacts {
  lines: string[];
}

const MAX_QA = 2;
const MAX_RULES = 3;
const CANDIDATES = 150;
const MAX_LINE_CHARS = 320;

// Words too common in skin care questions to say anything about relevance.
const STOP_WORDS = new Set([
  'what', 'about', 'think', 'the', 'this', 'that', 'should', 'use', 'with', 'and', 'for', 'your', 'you', 'good', 'are',
  'can', 'my', 'does', 'how', 'any', 'best', 'skin', 'face', 'product', 'products', 'routine', 'help', 'helps',
  'will', 'would', 'could', 'get', 'have', 'need', 'make', 'when', 'why', 'which', 'there', 'they', 'from', 'than',
]);

/** Lowercase content words with a trailing plural "s" removed ("acids" -> "acid"). */
export function queryWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
  return [...new Set(words)].slice(0, 8);
}

const has = (haystack: string, word: string) => haystack.toLowerCase().includes(word);
const hits = (haystack: string, words: string[]) => words.filter((w) => has(haystack, w)).length;
const clip = (text: string) => (text.length > MAX_LINE_CHARS ? `${text.slice(0, MAX_LINE_CHARS - 1).trimEnd()}…` : text);
const sentence = (label: string, value: string) => (value ? ` ${label}: ${value.replace(/\.$/, '')}.` : '');

function scoreQa(q: KnowledgeQa, words: string[]): number {
  const matched = hits(`${q.question} ${q.altPhrasings}`, words);
  // Most of the question's words must line up, not just one common word.
  return matched >= Math.min(2, words.length) && matched / words.length >= 0.5 ? matched : 0;
}

function scoreRule(r: KnowledgeRule, words: string[], context: UserContext): number {
  // A rule is only relevant if the question names its ingredient or concern.
  const named = hits(r.ingredients, words) * 3 + hits(r.concern, words) * 2;
  if (named === 0) return 0;
  const sameSkin = context.skinType && has(r.skinType, context.skinType) ? 1 : 0;
  return named + hits(`${r.effects} ${r.skinType} ${r.sensitivity}`, words) + sameSkin;
}

function ruleLine(r: KnowledgeRule): string {
  const subject = r.ingredients || r.concern;
  const forWhom = [r.concern && r.ingredients ? `for ${r.concern}` : '', r.skinType ? `${r.skinType} skin` : '']
    .filter(Boolean)
    .join(', ');
  return clip(
    `${subject}${forWhom ? ` (${forWhom})` : ''}:` +
      sentence('Effects', r.effects) +
      sentence('Advice', r.recommendation) +
      sentence('Typical strength', r.concentrations) +
      sentence('Pregnancy', r.pregnancyNotes) +
      sentence('Evidence', r.evidenceLevel),
  );
}

function qaLine(q: KnowledgeQa): string {
  return clip(`${q.answer.replace(/\s+/g, ' ')}${sentence('Safety', q.safetyFlags)}`);
}

export async function retrieveKnowledge(
  question: string,
  repository: KnowledgeRepository,
  context: UserContext,
): Promise<KnowledgeFacts> {
  const words = queryWords(question);
  if (words.length === 0) return { lines: [] };

  const [qaCandidates, ruleCandidates] = await Promise.all([
    repository.findQa(words, CANDIDATES),
    repository.findRules(words, CANDIDATES),
  ]);

  const qa = qaCandidates
    .map((q) => ({ q, score: scoreQa(q, words) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_QA)
    .map((x) => x.q);

  const ranked = ruleCandidates
    .map((r) => ({ r, score: scoreRule(r, words, context) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);

  // Rules the matched answers were written from come first, then the best direct matches.
  const linkedIds = qa.flatMap((q) => q.rowIds.split(/[,;|]/).map((id) => id.trim()).filter(Boolean));
  const linked = await repository.getRules(linkedIds.slice(0, MAX_RULES));
  const rules = [...linked, ...ranked].filter((r, i, all) => all.findIndex((x) => x.rowId === r.rowId) === i).slice(0, MAX_RULES);

  return { lines: [...qa.map(qaLine), ...rules.map(ruleLine)] };
}
