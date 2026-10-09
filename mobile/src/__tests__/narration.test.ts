import { AutoScrollController } from '../narration/autoScroll';
import { Narrator, type NarratorListener, type NarratorOptions, type NarratorState, type PreparedSpeech, type SpeechEngine } from '../narration/narrator';
import type { SummarySection } from '../summary/schema';

class FakeSpeech implements PreparedSpeech {
  played = false;
  paused = false;
  released = false;
  private onFinished: (() => void) | null = null;
  constructor(readonly text: string) {}
  play(onFinished: () => void) { this.played = true; this.onFinished = onFinished; }
  pause() { this.paused = true; }
  resume() { this.paused = false; }
  release() { this.released = true; }
  finish() { const done = this.onFinished; this.onFinished = null; done?.(); }
}

class FakeEngine implements SpeechEngine {
  readonly prepared: FakeSpeech[] = [];
  async prepare(text: string) {
    const speech = new FakeSpeech(text);
    this.prepared.push(speech);
    return speech;
  }
  playing(): FakeSpeech {
    return this.prepared.filter((s) => s.played && !s.released).at(-1)!;
  }
}

const section = (id: SummarySection['id'], spokenText: string): SummarySection => ({
  id, title: id, spokenText, displayText: spokenText, imageRefs: [], productIds: [],
});
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(sectionCount = 3, options?: NarratorOptions) {
  const engine = new FakeEngine();
  const events: string[] = [];
  const states: NarratorState[] = [];
  const listener: NarratorListener = {
    onChange: (s) => states.push(s),
    onSectionStart: (i) => events.push(`section:${i}`),
    onSentenceStart: (i, j) => events.push(`sentence:${i}.${j}`),
  };
  const narrator = new Narrator(engine, sectionCount, listener, options);
  return { engine, events, states, narrator };
}

describe('Narrator sync with TTS playback events', () => {
  it('fires section and sentence starts from real playback, in order', async () => {
    const { engine, events, narrator } = setup(2);
    narrator.setSection(0, section('overview', 'First sentence. Second sentence.'));
    narrator.setSection(1, section('contributing', 'Third sentence.'));
    narrator.play();
    await flush();
    expect(events).toEqual(['section:0', 'sentence:0.0']);
    engine.playing().finish();
    await flush();
    engine.playing().finish();
    await flush();
    expect(events).toEqual(['section:0', 'sentence:0.0', 'sentence:0.1', 'section:1', 'sentence:1.0']);
    engine.playing().finish();
    await flush();
    expect(narrator.getState().status).toBe('finished');
  });

  it('prefetches the next sentence while the current one plays', async () => {
    const { engine, narrator } = setup(1);
    narrator.setSection(0, section('overview', 'One. Two.'));
    narrator.play();
    await flush();
    expect(engine.prepared.map((s) => s.text)).toEqual(['One.', 'Two.']);
  });

  it('starts narrating section 1 while later sections are pending, then waits', async () => {
    const { engine, events, narrator } = setup(2);
    narrator.setSection(0, section('overview', 'Only sentence.'));
    narrator.play();
    await flush();
    engine.playing().finish();
    await flush();
    expect(narrator.getState()).toMatchObject({ status: 'waiting', sectionIndex: 1 });
    narrator.setSection(1, section('contributing', 'Arrived later.'));
    await flush();
    expect(events.at(-2)).toBe('section:1');
    expect(narrator.getState().status).toBe('playing');
  });

  it('pauses and resumes the playing utterance', async () => {
    const { engine, narrator } = setup(1);
    narrator.setSection(0, section('overview', 'Hello there.'));
    narrator.play();
    await flush();
    narrator.pause();
    expect(engine.playing().paused).toBe(true);
    expect(narrator.getState().status).toBe('paused');
    narrator.resume();
    expect(engine.playing().paused).toBe(false);
    expect(narrator.getState().status).toBe('playing');
  });

  it('pausing while a sentence is still being prepared plays it once on resume', async () => {
    const { engine, narrator } = setup(1);
    narrator.setSection(0, section('overview', 'Hello there.'));
    narrator.play();
    narrator.pause(); // before the prepare promise resolves
    await flush();
    expect(engine.prepared[0].played).toBe(false);
    narrator.resume();
    await flush();
    expect(engine.prepared.filter((s) => s.text === 'Hello there.' && s.played)).toHaveLength(1);
  });

  it('skips forward and back by section, releasing the interrupted audio', async () => {
    const { engine, events, narrator } = setup(3);
    ['overview', 'contributing', 'routine'].forEach((id, i) => narrator.setSection(i, section(id as SummarySection['id'], `Section ${i} text.`)));
    narrator.play();
    await flush();
    const first = engine.playing();
    narrator.next();
    await flush();
    expect(first.released).toBe(true);
    expect(narrator.getState().sectionIndex).toBe(1);
    narrator.previous();
    await flush();
    expect(narrator.getState().sectionIndex).toBe(0);
    expect(events.filter((e) => e.startsWith('section:'))).toEqual(['section:0', 'section:1', 'section:0']);
  });

  it('ignores finish callbacks from audio that was skipped', async () => {
    const { engine, events, narrator } = setup(2);
    narrator.setSection(0, section('overview', 'A.'));
    narrator.setSection(1, section('contributing', 'B.'));
    narrator.play();
    await flush();
    const stale = engine.playing();
    narrator.jumpTo(1);
    await flush();
    stale.finish();
    await flush();
    expect(events.filter((e) => e === 'section:1')).toHaveLength(1);
  });

  it('stop and dispose release all TTS resources (interruptions)', async () => {
    const { engine, narrator } = setup(1);
    narrator.setSection(0, section('overview', 'One. Two.'));
    narrator.play();
    await flush();
    narrator.dispose();
    await flush();
    expect(engine.prepared.every((s) => s.released)).toBe(true);
    expect(narrator.getState().status).toBe('stopped');
  });

  it('replays from the first section', async () => {
    const { engine, narrator } = setup(1);
    narrator.setSection(0, section('overview', 'Only.'));
    narrator.play();
    await flush();
    engine.playing().finish();
    await flush();
    narrator.replay();
    await flush();
    expect(narrator.getState()).toMatchObject({ status: 'playing', sectionIndex: 0 });
  });

  it('without auto-advance, waits at the end of each section until the user moves on', async () => {
    const { engine, events, narrator } = setup(2, { autoAdvance: false });
    narrator.setSection(0, section('overview', 'First. Second.'));
    narrator.setSection(1, section('contributing', 'Third.'));
    narrator.play();
    await flush();
    engine.playing().finish();
    await flush();
    engine.playing().finish();
    await flush();
    expect(narrator.getState()).toMatchObject({ status: 'sectionEnded', sectionIndex: 0, sentenceIndex: 1 });
    expect(events).not.toContain('section:1');
    narrator.jumpTo(1);
    await flush();
    expect(events.at(-1)).toBe('sentence:1.0');
    narrator.jumpTo(0);
    await flush();
    expect(events.slice(-2)).toEqual(['section:0', 'sentence:0.0']);
  });
});

describe('AutoScrollController', () => {
  function controller(reduceMotion = false) {
    const scrolls: Array<[number, boolean]> = [];
    const following: boolean[] = [];
    const c = new AutoScrollController((y, animated) => scrolls.push([y, animated]), () => reduceMotion, (f) => following.push(f));
    c.setSectionOffset(0, 0);
    c.setSectionOffset(1, 400);
    c.setSectionOffset(2, 900);
    return { c, scrolls, following };
  }

  it('scrolls to each section as narration reaches it', () => {
    const { c, scrolls } = controller();
    c.onSectionStart(1);
    c.onSectionStart(2);
    expect(scrolls).toEqual([[384, true], [884, true]]);
  });

  it('stops following after a manual scroll, and resumes on request', () => {
    const { c, scrolls, following } = controller();
    c.onUserScroll();
    c.onSectionStart(2);
    expect(scrolls).toEqual([]);
    expect(following).toEqual([false]);
    c.resumeFollowing();
    expect(scrolls).toEqual([[884, true]]);
    expect(following).toEqual([false, true]);
  });

  it('narrator section starts drive the scroll to the matching section', async () => {
    const { c, scrolls } = controller();
    const engine = new FakeEngine();
    const narrator = new Narrator(engine, 3, { onChange: () => undefined, onSectionStart: (i) => c.onSectionStart(i) });
    ['overview', 'contributing', 'routine'].forEach((id, i) => narrator.setSection(i, section(id as SummarySection['id'], `Section ${i}.`)));
    narrator.play();
    await flush();
    engine.playing().finish();
    await flush();
    narrator.jumpTo(2);
    await flush();
    expect(scrolls).toEqual([[0, true], [384, true], [884, true]]);
  });

  it('jumps without animation when reduced motion is on', () => {
    const { c, scrolls } = controller(true);
    c.onSectionStart(1);
    expect(scrolls).toEqual([[384, false]]);
  });
});
