import { FALLBACK_MESSAGE } from '../guardrails/messages';
import { generateSummary, MAX_SECTION_RETRIES } from '../summary/generate';
import { buildResultsPlan } from '../summary/plan';
import { SECTION_IDS, type SummarySection } from '../summary/schema';
import { SCAN, ScriptedLlm, context, repository, sectionJson } from './fixtures';

async function collect(gen: AsyncGenerator<SummarySection>) {
  const out: SummarySection[] = [];
  for await (const s of gen) out.push(s);
  return out;
}

describe('deterministic results plan', () => {
  it('recommends only eligible face-care products from the database', async () => {
    const plan = await buildResultsPlan(SCAN, context({ sensitivities: ['fragrance'] }), repository());
    const barcodes = plan.products.map((p) => p.barcode);
    expect(barcodes).toContain('0000000001001'); // salicylic serum for acne
    expect(barcodes).not.toContain('0000000001008'); // fragranced cream, user is sensitive
    expect(barcodes).not.toContain('0000000001009'); // body lotion, not face care
    expect(plan.products.find((p) => p.role === 'sunscreen')?.barcode).toBe('0000000001007');
    expect(plan.cautions.join(' ')).toMatch(/fragrance were left out/);
  });

  it('excludes retinoids and "ask" actives when pregnant, and says so', async () => {
    const plan = await buildResultsPlan(
      { ...SCAN, results: { hyperpigmentation: { present: true, confidence: 0.9, severity: 'moderate' } } },
      context({ pregnancy: 'yes', concerns: ['hyperpigmentation'] }),
      repository(),
    );
    const actives = plan.products.flatMap((p) => p.actives);
    expect(actives).not.toContain('retinoid');
    expect(actives).not.toContain('salicylic_acid');
    expect(plan.cautions.join(' ')).toMatch(/pregnant or breastfeeding/);
  });

  it('maps grades to tiers and hedges low-confidence findings', async () => {
    const plan = await buildResultsPlan(SCAN, context(), repository());
    expect(plan.findings.find((f) => f.condition === 'acne')).toMatchObject({ tier: 'targeted', hedged: false });
    expect(plan.findings.find((f) => f.condition === 'redness')).toMatchObject({ tier: 'gentle', hedged: true });
  });

  it('flags conflicts with actives the user already uses', async () => {
    const plan = await buildResultsPlan(SCAN, context({ currentActives: ['retinoid'] }), repository());
    expect(plan.cautions.some((c) => c.startsWith('With what you already use'))).toBe(true);
  });
});

describe('section generation', () => {
  it('produces all seven sections from templates when no model is installed', async () => {
    const plan = await buildResultsPlan(SCAN, context(), repository());
    const sections = await collect(generateSummary(plan, context(), { llm: null, repository: repository(), knownBrands: [] }));
    expect(sections.map((s) => s.id)).toEqual([...SECTION_IDS]);
    expect(sections.filter((s) => s.isFallback)).toEqual([]);
    expect(sections.find((s) => s.id === 'products')!.productIds.length).toBeGreaterThan(0);
  });

  it('regenerates when a product id does not exist, then falls back after 2 retries', async () => {
    const plan = await buildResultsPlan(SCAN, context(), repository());
    const bad = sectionJson(
      'Try this great serum for your breakouts in the evening.',
      'Try this great serum for your breakouts. Use it in the evening, a few times a week, and see how your skin feels.',
      ['P9'],
    );
    const llm = new ScriptedLlm([bad]);
    const gen = generateSummary(plan, context(), { llm, repository: repository(), knownBrands: [] });
    const sections = await collect(gen);
    const products = sections.find((s) => s.id === 'products')!;
    expect(products.isFallback).toBe(true);
    expect(products.displayText).toBe(FALLBACK_MESSAGE);
    expect(products.spokenText).toBe(FALLBACK_MESSAGE);
    const productCalls = llm.requests.filter((r) => r.messages[1].content.includes('"Products for you"'));
    expect(productCalls).toHaveLength(1 + MAX_SECTION_RETRIES);
  });

  it('accepts a regenerated section once the ids are valid', async () => {
    const plan = await buildResultsPlan(SCAN, context(), repository());
    const serum = plan.products.find((p) => p.barcode === '0000000001001')!;
    const text = `${serum.name} has salicylic acid for your breakouts. Use it in the evening, two or three times a week to start.`;
    let productAttempts = 0;
    const llm = new ScriptedLlm([
      (req) => {
        if (!req.messages[1].content.includes('"Products for you"')) return 'not json';
        productAttempts++;
        return productAttempts === 1 ? sectionJson(text, text, ['P42']) : sectionJson(text, text, [serum.ref]);
      },
    ]);
    const sections = await collect(generateSummary(plan, context(), { llm, repository: repository(), knownBrands: [] }));
    const products = sections.find((s) => s.id === 'products')!;
    expect(productAttempts).toBe(2);
    expect(products.isFallback).toBeUndefined();
    expect(products.productIds).toEqual([serum.barcode]);
  });

  it('falls back when a planned product has disappeared from the database', async () => {
    const plan = await buildResultsPlan(SCAN, context(), repository());
    const emptyRepo = repository();
    jest.spyOn(emptyRepo, 'getByBarcodes').mockResolvedValue([]);
    const sections = await collect(generateSummary(plan, context(), { llm: null, repository: emptyRepo, knownBrands: [] }));
    expect(sections.find((s) => s.id === 'products')!.isFallback).toBe(true);
  });

  it('never lets unsafe model text into a section', async () => {
    const plan = await buildResultsPlan(SCAN, context(), repository());
    const unsafe = 'You have rosacea and should take 100 mg of doxycycline every morning for your skin.';
    const llm = new ScriptedLlm([sectionJson(unsafe, unsafe)]);
    const sections = await collect(generateSummary(plan, context(), { llm, repository: repository(), knownBrands: [] }));
    for (const s of sections) {
      expect(s.displayText).not.toMatch(/rosacea|doxycycline|mg/);
      expect(s.spokenText).not.toMatch(/rosacea|doxycycline|mg/);
    }
  });
});
