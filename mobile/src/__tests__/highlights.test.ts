import { silentDurationMs, silentSpeech, withSilentFallback } from '../narration/silentSpeech';
import { highlightScene } from '../summary/highlights';
import { buildResultsPlan } from '../summary/plan';
import { SECTION_IDS } from '../summary/schema';
import { SECTION_TITLES, templateSection } from '../summary/sections';
import { MAX_UTTERANCE_WORDS, isSpeakable, splitSentences, spokenFor, wordCount } from '../summary/speech';
import { SCAN, context, repository } from './fixtures';

describe('highlight scenes', () => {
  it('takes every number from the plan', async () => {
    const plan = await buildResultsPlan(SCAN, context(), repository());
    expect(highlightScene('overview', plan).stats[0].value).toBe(plan.findings.length);
    expect(highlightScene('routine', plan).stats.map((s) => s.value)).toEqual([plan.routine.am.length, plan.routine.pm.length]);
    expect(highlightScene('products', plan).imageRefs).toEqual(plan.products.map((p) => p.imageRef));
  });

  it('has a scene for every section', async () => {
    const plan = await buildResultsPlan(SCAN, context(), repository());
    for (const id of SECTION_IDS) expect(highlightScene(id, plan).headline).toBeTruthy();
  });

  it('reads every section in full, title first, and speakably', async () => {
    const plan = await buildResultsPlan(SCAN, context(), repository());
    for (const id of SECTION_IDS) {
      const spoken = spokenFor(SECTION_TITLES[id], templateSection(id, plan).displayText);
      expect(spoken.startsWith(`${SECTION_TITLES[id]}.`)).toBe(true);
      expect(isSpeakable(spoken)).toBe(true);
      for (const utterance of splitSentences(spoken)) expect(wordCount(utterance)).toBeLessThanOrEqual(MAX_UTTERANCE_WORDS);
    }
  });

  it('speaks a long sentence in comma-separated pieces', () => {
    const long = `See someone if you notice ${Array.from({ length: 8 }, (_, i) => `sign number ${i} appears`).join(', ')}.`;
    const pieces = splitSentences(long);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.join(' ')).toBe(long);
    for (const piece of pieces) expect(wordCount(piece)).toBeLessThanOrEqual(MAX_UTTERANCE_WORDS);
  });

  it('reads lists as one caption per line', () => {
    const spoken = spokenFor('Your routine', 'Morning:\n1. Cleanse\n2. Moisturize with Testbrand Cream SPF 30\n\nEvening:\n- Cleanse');
    expect(splitSentences(spoken)).toEqual([
      'Your routine.', 'Morning.', 'Step 1: Cleanse.', 'Step 2: Moisturize with Testbrand Cream S P F 30.', 'Evening.', 'Cleanse.',
    ]);
  });
});

describe('captions-only speech', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('finishes after about the time it takes to say, and pausing holds it', () => {
    const text = 'One two three four five six seven eight nine ten eleven twelve thirteen.';
    const done = jest.fn();
    const speech = silentSpeech(text);
    speech.play(done);
    jest.advanceTimersByTime(1000);
    speech.pause();
    jest.advanceTimersByTime(60_000);
    expect(done).not.toHaveBeenCalled();
    speech.resume();
    jest.advanceTimersByTime(silentDurationMs(text) - 1000);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('switches to captions only once the voice fails, and says so once', async () => {
    const onFallback = jest.fn();
    const failing = { prepare: jest.fn().mockRejectedValue(new Error('no voice')) };
    const engine = withSilentFallback(failing, onFallback);
    await engine.prepare('First line here.');
    await engine.prepare('Second line here.');
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(failing.prepare).toHaveBeenCalledTimes(1);
  });
});
