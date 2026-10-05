// Captions-only playback for when the voice engine isn't available (for
// example in Expo Go). Each utterance "plays" for about as long as it would
// take to say, so the highlights still advance in step with their captions.

import type { PreparedSpeech, SpeechEngine } from './narrator';
import { wordCount } from '../summary/speech';

const WORDS_PER_SECOND = 2.6;
const MIN_DURATION_MS = 1800;

export function silentDurationMs(text: string): number {
  return Math.max(MIN_DURATION_MS, Math.round((wordCount(text) / WORDS_PER_SECOND) * 1000));
}

export function silentSpeech(text: string): PreparedSpeech {
  let remaining = silentDurationMs(text);
  let startedAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let onDone: (() => void) | null = null;

  const schedule = () => {
    startedAt = Date.now();
    timer = setTimeout(() => {
      timer = null;
      const done = onDone;
      onDone = null;
      done?.();
    }, remaining);
  };
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return {
    play(onFinished) {
      if (onDone) return;
      onDone = onFinished;
      schedule();
    },
    pause() {
      if (!timer) return;
      clear();
      remaining = Math.max(0, remaining - (Date.now() - startedAt));
    },
    resume() {
      if (onDone && !timer) schedule();
    },
    release() {
      clear();
      onDone = null;
    },
  };
}

/**
 * Uses the real engine, switching to captions-only playback for the rest of
 * the session once it fails, so one missing voice doesn't stall the narration.
 */
export function withSilentFallback(engine: SpeechEngine, onFallback?: () => void): SpeechEngine {
  let silent = false;
  return {
    async prepare(text) {
      if (silent) return silentSpeech(text);
      try {
        return await engine.prepare(text);
      } catch {
        if (!silent) {
          silent = true;
          onFallback?.();
        }
        return silentSpeech(text);
      }
    },
  };
}
