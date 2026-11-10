import { buildResultsPlan, type SelectionSlot } from '../summary/plan';
import { createLlmSelector, parseSelection, type SelectionTrace } from '../summary/selection';
import { RULES, SCAN, ScriptedLlm, context, repository } from './fixtures';

const acneOnly = { ...SCAN, results: { acne: SCAN.results.acne } };
const reply = (choices: object[]) => JSON.stringify({ choices });

describe('LLM product selection', () => {
  it('offers only eligible candidates and honors a valid pick', async () => {
    let offered: SelectionSlot[] = [];
    const plan = await buildResultsPlan(acneOnly, context({ sensitivities: ['fragrance'] }), repository(), {
      rules: RULES,
      selector: async (slots) => {
        offered = slots;
        return { 'treatment:acne': '0000000001003' }; // niacinamide serum instead of the default salicylic one
      },
    });
    const ids = offered.flatMap((s) => s.options.map((o) => o.id));
    expect(ids).not.toContain('0000000001008'); // fragranced cream, user avoids fragrance
    expect(ids).not.toContain('0000000001009'); // body lotion
    expect(plan.products.find((p) => p.role === 'treatment')?.barcode).toBe('0000000001003');
  });

  it('ignores a pick that was not offered and keeps the default ranking', async () => {
    const withDefault = await buildResultsPlan(acneOnly, context(), repository(), { rules: RULES });
    const plan = await buildResultsPlan(acneOnly, context(), repository(), {
      rules: RULES,
      selector: async () => ({ 'treatment:acne': '9999999999999', cleanser: 'not-a-product' }),
    });
    expect(plan.products.map((p) => p.barcode)).toEqual(withDefault.products.map((p) => p.barcode));
  });

  it('falls back to the default ranking when the selector fails', async () => {
    const withDefault = await buildResultsPlan(acneOnly, context(), repository(), { rules: RULES });
    const plan = await buildResultsPlan(acneOnly, context(), repository(), {
      rules: RULES,
      selector: async () => {
        throw new Error('model unavailable');
      },
    });
    expect(plan.products.map((p) => p.barcode)).toEqual(withDefault.products.map((p) => p.barcode));
  });
});

describe('createLlmSelector', () => {
  const slots: SelectionSlot[] = [
    {
      slot: 'treatment:acne', role: 'treatment', condition: 'acne', label: 'Treatment for breakouts',
      options: [
        { id: 'A', name: 'Serum A', brand: 'x', ingredients: 'Aqua', evidence: [] },
        { id: 'B', name: 'Serum B', brand: 'x', ingredients: 'Aqua', evidence: [] },
      ],
    },
  ];

  it('parses valid picks and drops unknown slots and ids', () => {
    const picks = parseSelection(reply([{ slot: 'treatment:acne', id: 'B', reason: 'gentler' }, { slot: 'nope', id: 'A', reason: '' }, { slot: 'treatment:acne', id: 'Z', reason: '' }]), slots);
    expect(Object.keys(picks)).toEqual(['treatment:acne']);
    expect(picks['treatment:acne']).toMatchObject({ id: 'B', reason: 'gentler' });
  });

  it('retries once on an unusable reply, then reports a trace', async () => {
    const traces: SelectionTrace[] = [];
    const llm = new ScriptedLlm(['not json', reply([{ slot: 'treatment:acne', id: 'A', reason: 'evidence' }])]);
    const result = await createLlmSelector(llm, context(), (t) => traces.push(t))(slots);
    expect(result).toEqual({ 'treatment:acne': 'A' });
    expect(llm.requests).toHaveLength(2);
    expect(traces[0]).toMatchObject({ fallback: false, defaulted: [] });
  });

  it('returns null and flags a fallback when the model never answers validly', async () => {
    const traces: SelectionTrace[] = [];
    const result = await createLlmSelector(new ScriptedLlm(['nope']), context(), (t) => traces.push(t))(slots);
    expect(result).toBeNull();
    expect(traces[0].fallback).toBe(true);
  });
});
