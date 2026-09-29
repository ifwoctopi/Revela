// Turns text into clean speech for the TTS engine, and splits it into the
// sentences the narrator plays one at a time.

const REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bSPF\b/g, 'S P F'],
  [/\bUVA\b/g, 'U V A'],
  [/\bUVB\b/g, 'U V B'],
  [/\bUV\b/g, 'U V'],
  [/\bAHAs?\b/g, 'exfoliating acids'],
  [/\bBHA\b/g, 'salicylic acid'],
  [/\bAM\b/g, 'in the morning'],
  [/\bPM\b/g, 'in the evening'],
  [/\be\.g\.,?/gi, 'for example'],
  [/\bi\.e\.,?/gi, 'that is'],
  [/\bvs\.?\b/gi, 'versus'],
  [/\betc\.?/gi, 'and so on'],
  [/\bapprox\.?\b/gi, 'about'],
  [/(\d)\s?%/g, '$1 percent'],
  [/&/g, ' and '],
  [/\s+[-–—]\s+/g, ', '],
];

/** Deterministic cleanup; the section validator then rejects anything still unspeakable. */
export function toSpeakable(text: string): string {
  let out = text
    .replace(/\[?\bP\d{1,2}\b\]?/g, '')
    .replace(/[*_#`>|~[\]{}]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/^\s*[-•]\s*/gm, '');
  for (const [pattern, replacement] of REPLACEMENTS) out = out.replace(pattern, replacement);
  return out.replace(/\s+([,.!?])/g, '$1').replace(/\s+/g, ' ').trim();
}

/** Things the TTS engine would read badly, or that must never be spoken. */
const UNSPEAKABLE = [
  /[*_#`>|~[\]{}]/, /\p{Extended_Pictographic}/u, /https?:|www\./i, /\d{5,}/, /\bP\d{1,2}\b/,
  /\b(SPF|AM|PM|AHA|BHA|UV[AB]?)\b/, /\be\.g\.|\bi\.e\.|\betc\b/i,
];

export function isSpeakable(text: string): boolean {
  return !UNSPEAKABLE.some((p) => p.test(text));
}

export function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
