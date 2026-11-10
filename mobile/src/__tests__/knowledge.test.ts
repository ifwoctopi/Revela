import { answerQuestion, type ChatDeps } from '../guardrails/pipeline';
import { MemoryKnowledgeRepository } from '../knowledge/memoryRepository';
import { avoidTerms, targetsFor } from '../knowledge/recommend';
import { queryWords, retrieveKnowledge } from '../knowledge/retrieve';
import type { KnowledgeQa, KnowledgeRule } from '../knowledge/types';
import { buildResultsPlan } from '../summary/plan';
import { SCAN, ScriptedLlm, context, repository } from './fixtures';

const rule = (overrides: Partial<KnowledgeRule>): KnowledgeRule => ({
  rowId: 'R1', skinType: '', skinSubtype: '', sensitivity: '', concern: '', ingredients: '', concentrations: '',
  effects: '', evidenceLevel: '', recommendation: '', regulatoryStatusUs: '', pregnancyNotes: '', otherNotes: '',
  ...overrides,
});
const qa = (overrides: Partial<KnowledgeQa>): KnowledgeQa => ({
  id: 'Q1', category: '', question: '', altPhrasings: '', answer: '', safetyFlags: '', rowIds: '', ...overrides,
});

const BAKUCHIOL = rule({
  rowId: 'R7', ingredients: 'Bakuchiol', concern: 'Fine lines', skinType: 'Sensitive',
  effects: 'Gentle retinol alternative', recommendation: 'Use once or twice a day', pregnancyNotes: 'Limited data',
  evidenceLevel: 'Moderate',
});
const BAKUCHIOL_QA = qa({
  id: 'Q9', question: 'Is bakuchiol a good retinol alternative?', altPhrasings: 'bakuchiol instead of retinol',
  answer: 'Bakuchiol is a gentler plant-derived option.', safetyFlags: 'pregnancy: ask a provider', rowIds: 'R7',
});

const knowledge = () => new MemoryKnowledgeRepository([BAKUCHIOL, rule({ rowId: 'R8', ingredients: 'Glycerin' })], [BAKUCHIOL_QA]);

describe('queryWords', () => {
  it('drops filler words and plural s', () => {
    expect(queryWords('What do acids do for my skin?')).toEqual(['acid']);
  });
});

describe('retrieveKnowledge', () => {
  it('returns the matching answer and linked rule, with the safety note', async () => {
    const { lines } = await retrieveKnowledge('Is bakuchiol a good alternative?', knowledge(), context());
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('gentler plant-derived');
    expect(lines[0]).toContain('Safety: pregnancy: ask a provider');
    expect(lines[1]).toContain('Bakuchiol (for Fine lines, Sensitive skin)');
    expect(lines[1]).toContain('Pregnancy: Limited data');
  });

  it('returns nothing for unrelated questions', async () => {
    expect((await retrieveKnowledge('How do I braid my hair?', knowledge(), context())).lines).toEqual([]);
  });

  it('does not match on a single generic word', async () => {
    const { lines } = await retrieveKnowledge('good retinol cream?', knowledge(), context());
    expect(lines.some((l) => l.includes('Bakuchiol is a gentler'))).toBe(false);
  });
});

describe('chat with synced knowledge', () => {
  async function deps(llm: ScriptedLlm, repo: MemoryKnowledgeRepository | null): Promise<ChatDeps> {
    const ctx = context();
    return { llm, repository: repository(), knowledge: repo, knownBrands: [], context: ctx, plan: await buildResultsPlan(SCAN, ctx, repository()), sections: [] };
  }

  it('answers an ingredient missing from the rules table when the synced guidance covers it', async () => {
    const llm = new ScriptedLlm(['Bakuchiol is a gentler plant-derived option for your skin, but ask a provider if pregnant.']);
    const reply = await answerQuestion('Is bakuchiol a good alternative?', [], await deps(llm, knowledge()));
    expect(reply.kind).toBe('answer');
    expect(llm.requests[0].messages[0].content).toContain('Reference notes');
  });

  it('still falls back for that ingredient without synced guidance', async () => {
    const llm = new ScriptedLlm(['unused']);
    const reply = await answerQuestion('Is bakuchiol a good alternative?', [], await deps(llm, null));
    expect(reply.kind).toBe('fallback');
    expect(llm.requests).toHaveLength(0);
  });
});

describe('rule-driven product targeting', () => {
  const rules = [
    rule({ rowId: 'A', concern: 'Breakouts', ingredients: 'Salicylic acid', skinType: 'Any', recommendation: 'Use', evidenceLevel: 'FDA OTC monograph + guideline - strong', pregnancyNotes: 'Low concern' }),
    rule({ rowId: 'B', concern: 'Breakouts', ingredients: 'Adapalene', skinType: 'Any', recommendation: 'Use (caution)', pregnancyNotes: 'Avoid: topical retinoids' }),
    rule({ rowId: 'C', concern: 'Breakouts', ingredients: 'Sulfur', skinType: 'Any', recommendation: 'Use', evidenceLevel: 'Single RCT' }),
    rule({ rowId: 'D', concern: 'Redness / irritation', ingredients: 'Alcohol; fragrance', skinType: 'Any', recommendation: 'Avoid', sensitivity: 'Sensitive' }),
  ];

  it('orders targets by evidence and drops pregnancy-avoid rules for undisclosed status', () => {
    const names = targetsFor('acne', rules, context({ pregnancy: null })).map((t) => t.name);
    expect(names).toEqual(['Salicylic acid', 'Sulfur']);
    expect(targetsFor('acne', rules, context({ pregnancy: 'no' })).map((t) => t.name)).toContain('Adapalene');
  });

  it('only applies the avoid list to sensitive or redness-prone skin', () => {
    expect(avoidTerms(rules, context(), ['acne'])).toEqual([]);
    expect(avoidTerms(rules, context({ skinType: 'sensitive' }), ['acne'])).toEqual(expect.arrayContaining(['alcohol denat', 'fragrance', 'parfum']));
  });

  it('puts the cited evidence on the planned product', async () => {
    const plan = await buildResultsPlan(SCAN, context(), repository(), { rules });
    const cited = plan.products.flatMap((p) => p.evidence ?? []);
    expect(cited.length).toBeGreaterThan(0);
    expect(cited[0].ingredient).toBe('Salicylic acid');
  });
});
