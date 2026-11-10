// Narration voice speed, chosen in Settings and read by services/tts.ts each
// time it synthesizes a sentence, so a change applies to the next one.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';

export type SpeechPace = 'slow' | 'normal' | 'fast';

/** Piper speed multipliers: below 1 is slower than the voice's native pace. */
export const SPEECH_SPEED_BY_PACE: Record<SpeechPace, number> = { slow: 0.7, normal: 0.8, fast: 1.0 };
export const SPEECH_PACES: readonly SpeechPace[] = ['slow', 'normal', 'fast'];

const KEY = '@revela/speech_pace';
const listeners = new Set<(pace: SpeechPace) => void>();
let current: SpeechPace = 'normal';
let loaded: Promise<void> | null = null;

function load(): Promise<void> {
  loaded ??= AsyncStorage.getItem(KEY).then(
    (raw) => {
      if (raw && (SPEECH_PACES as readonly string[]).includes(raw)) current = raw as SpeechPace;
    },
    () => undefined,
  );
  return loaded;
}

export async function getSpeechSpeed(): Promise<number> {
  await load();
  return SPEECH_SPEED_BY_PACE[current];
}

export async function setSpeechPace(pace: SpeechPace): Promise<void> {
  await load();
  current = pace;
  listeners.forEach((l) => l(pace));
  await AsyncStorage.setItem(KEY, pace).catch(() => undefined);
}

export function useSpeechPace(): [SpeechPace, (pace: SpeechPace) => void] {
  const [pace, setPace] = React.useState(current);
  React.useEffect(() => {
    let active = true;
    listeners.add(setPace);
    load().then(() => active && setPace(current));
    return () => {
      active = false;
      listeners.delete(setPace);
    };
  }, []);
  return [pace, React.useCallback((value: SpeechPace) => void setSpeechPace(value), [])];
}
