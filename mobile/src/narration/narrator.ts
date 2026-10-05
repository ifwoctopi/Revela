// Plays summary sections as a guided walkthrough. The Piper engine only
// reports when an utterance finishes, so each sentence is its own utterance:
// sentence-level sync comes from real playback events, with no timers. The
// next sentence is synthesized while the current one plays to avoid gaps.

import type { SummarySection } from '../summary/schema';
import { splitSentences } from '../summary/speech';

export interface PreparedSpeech {
  play(onFinished: () => void): void;
  pause(): void;
  resume(): void;
  release(): void;
}

export interface SpeechEngine {
  prepare(text: string): Promise<PreparedSpeech>;
}

/** 'sectionEnded': a section finished and, without auto-advance, the narrator waits for next(). */
export type NarratorStatus =
  | 'idle' | 'preparing' | 'playing' | 'paused' | 'waiting' | 'sectionEnded' | 'finished' | 'stopped' | 'error';

export interface NarratorState {
  status: NarratorStatus;
  sectionIndex: number;
  sentenceIndex: number;
}

export interface NarratorListener {
  onChange(state: NarratorState): void;
  /** Fired when a section's first sentence actually starts playing. */
  onSectionStart?(sectionIndex: number): void;
  onSentenceStart?(sectionIndex: number, sentenceIndex: number): void;
}

export interface NarratorOptions {
  /** Move on to the next section when one finishes. Default true; false lets the user step through. */
  autoAdvance?: boolean;
}

interface Utterance {
  key: string;
  speech: PreparedSpeech;
  started: boolean;
}

export class Narrator {
  private readonly sections: (SummarySection | null)[];
  private state: NarratorState = { status: 'idle', sectionIndex: 0, sentenceIndex: 0 };
  /** Bumped on every jump/stop so callbacks from earlier playback are ignored. */
  private run = 0;
  private current: Utterance | null = null;
  private prefetched: { key: string; promise: Promise<PreparedSpeech> } | null = null;
  /** True while the current run is waiting for an utterance to be synthesized. */
  private preparing = false;

  constructor(
    private readonly engine: SpeechEngine,
    sectionCount: number,
    private listener: NarratorListener | null,
    private readonly options: NarratorOptions = {},
  ) {
    this.sections = Array.from({ length: sectionCount }, () => null);
  }

  getState(): NarratorState {
    return this.state;
  }

  /** Called as each validated section arrives; resumes narration if it was waiting for it. */
  setSection(index: number, section: SummarySection): void {
    this.sections[index] = section;
    if (this.state.status === 'waiting' && this.state.sectionIndex === index) {
      void this.playFrom(index, 0, this.run);
    }
  }

  play(): void {
    if (this.state.status === 'paused') return this.resume();
    if (this.state.status === 'playing' || this.state.status === 'preparing') return;
    const start = this.state.status === 'finished' ? 0 : this.state.sectionIndex;
    this.jumpTo(start);
  }

  pause(): void {
    if (this.state.status !== 'playing' && this.state.status !== 'preparing') return;
    if (this.current?.started) this.current.speech.pause();
    this.update({ status: 'paused' });
  }

  resume(): void {
    if (this.state.status !== 'paused') return;
    const current = this.current;
    if (!current) {
      // Paused before the utterance was ready: let the in-flight prepare start
      // it, or prepare it again if that already finished.
      this.update({ status: 'preparing' });
      if (!this.preparing) void this.playFrom(this.state.sectionIndex, this.state.sentenceIndex, this.run);
      return;
    }
    this.update({ status: 'playing' });
    if (current.started) current.speech.resume();
    else this.start(current, this.run);
  }

  next(): void {
    this.jumpTo(Math.min(this.state.sectionIndex + 1, this.sections.length - 1));
  }

  previous(): void {
    // Like a music player: restart the section unless we're at its start.
    const target = this.state.sentenceIndex > 0 ? this.state.sectionIndex : Math.max(this.state.sectionIndex - 1, 0);
    this.jumpTo(target);
  }

  replay(): void {
    this.jumpTo(0);
  }

  jumpTo(sectionIndex: number): void {
    this.releaseAudio();
    const run = ++this.run;
    void this.playFrom(sectionIndex, 0, run);
  }

  stop(): void {
    this.run++;
    this.releaseAudio();
    this.update({ status: 'stopped' });
  }

  /** Stops playback, frees all audio, and detaches the listener. */
  dispose(): void {
    this.stop();
    this.listener = null;
  }

  private sentencesOf(index: number): string[] | null {
    const section = this.sections[index];
    return section ? splitSentences(section.spokenText) : null;
  }

  private async playFrom(sectionIndex: number, sentenceIndex: number, run: number): Promise<void> {
    if (run !== this.run) return;
    if (sectionIndex >= this.sections.length) {
      this.update({ status: 'finished', sectionIndex: this.sections.length - 1, sentenceIndex: 0 });
      return;
    }
    const sentences = this.sentencesOf(sectionIndex);
    if (!sentences) {
      this.update({ status: 'waiting', sectionIndex, sentenceIndex: 0 });
      return;
    }
    if (sentenceIndex >= sentences.length) {
      if (this.options.autoAdvance === false) {
        // Keep sentenceIndex on the last sentence so its caption stays up.
        this.update({ status: 'sectionEnded' });
        return;
      }
      return this.playFrom(sectionIndex + 1, 0, run);
    }

    const paused = this.state.status === 'paused';
    this.update({ status: paused ? 'paused' : 'preparing', sectionIndex, sentenceIndex });
    const key = `${sectionIndex}:${sentenceIndex}`;
    let speech: PreparedSpeech;
    this.preparing = true;
    try {
      speech = await this.take(key, sentences[sentenceIndex]);
    } catch {
      if (run === this.run) this.update({ status: 'error' });
      return;
    } finally {
      if (run === this.run) this.preparing = false;
    }
    if (run !== this.run) {
      speech.release();
      return;
    }
    this.current = { key, speech, started: false };
    if (this.state.status === 'paused') return; // resume() will start it
    this.start(this.current, run);
  }

  private start(utterance: Utterance, run: number): void {
    const { sectionIndex, sentenceIndex } = this.state;
    utterance.started = true;
    this.update({ status: 'playing' });
    if (sentenceIndex === 0) this.listener?.onSectionStart?.(sectionIndex);
    this.listener?.onSentenceStart?.(sectionIndex, sentenceIndex);
    utterance.speech.play(() => {
      if (run !== this.run) return;
      this.current = null;
      void this.playFrom(sectionIndex, sentenceIndex + 1, run);
    });
    this.prefetchAfter(sectionIndex, sentenceIndex);
  }

  private take(key: string, text: string): Promise<PreparedSpeech> {
    if (this.prefetched?.key === key) {
      const { promise } = this.prefetched;
      this.prefetched = null;
      return promise;
    }
    return this.engine.prepare(text);
  }

  private prefetchAfter(sectionIndex: number, sentenceIndex: number): void {
    const sentences = this.sentencesOf(sectionIndex) ?? [];
    // Without auto-advance the user may go either way, so the next section is only a guess; it's prefetched anyway.
    const [nextSection, nextSentence] =
      sentenceIndex + 1 < sentences.length ? [sectionIndex, sentenceIndex + 1] : [sectionIndex + 1, 0];
    const text = this.sentencesOf(nextSection)?.[nextSentence];
    if (!text) return;
    const promise = this.engine.prepare(text);
    promise.catch(() => undefined); // surfaced when taken
    this.prefetched = { key: `${nextSection}:${nextSentence}`, promise };
  }

  private releaseAudio(): void {
    this.preparing = false;
    this.current?.speech.release();
    this.current = null;
    const pending = this.prefetched;
    this.prefetched = null;
    pending?.promise.then((s) => s.release(), () => undefined);
  }

  private update(patch: Partial<NarratorState>): void {
    this.state = { ...this.state, ...patch };
    this.listener?.onChange(this.state);
  }
}
