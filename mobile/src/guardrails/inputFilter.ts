// Deterministic checks on user input before it reaches the model. User text
// is always treated as data; these rules short-circuit requests that should
// never be sent to the model at all.

export const MAX_USER_MESSAGE_CHARS = 400;
export const MAX_CHAT_TURNS = 20;

export type InputVerdict =
  | { kind: 'ok'; text: string }
  | { kind: 'too_long' }
  | { kind: 'turn_limit' }
  | { kind: 'blocked' };

const BLOCK_PATTERNS: RegExp[] = [
  // Instruction override / role play.
  /\b(ignore|disregard|forget|override|bypass)\b.{0,40}\b(instructions?|rules?|prompts?|guidelines|guardrails|restrictions|above|previous|prior)\b/,
  /\byou are now\b|\bact as\b|\bpretend (to be|you)\b|\brole ?play\b|\bfrom now on you\b|\bnew (persona|role|instructions)\b/,
  /\b(jailbreak|dan mode|developer mode|debug mode|admin mode|god mode|sudo)\b/,
  /\b(i am|i'm|im|this is) (the |a |your )?(developer|admin|administrator|engineer|creator|owner|openai|anthropic|root)\b/,
  // Probing the system.
  /\b(system|initial|hidden|original)\s+(prompt|message|instructions?)\b/,
  /\b(your|the)\s+(prompt|instructions|rules|guidelines|configuration|config)\b/,
  /\b(source code|codebase|code base|database|schema|tables?|sql|api keys?|env(ironment)? var\w*|config files?|file ?system|stack trace|model weights|which model|what model)\b/,
  /\b(print|show|reveal|repeat|output|dump|display|leak|tell me)\b.{0,30}\b(prompt|instructions|code|schema|database|config|secrets?|keys?|tokens?)\b/,
  // Other people's data.
  /\b(other|another|different|all|every)\s+(users?|customers?|accounts?|patients?)\b/,
  /\b(other people|everyone|everybody|someone else|somebody else|anyone else)('s)?\b.{0,40}\b(scans?|results?|data|history|records?|photos?|images?|profiles?|names?|emails?|information|info)\b/,
  // Prescriptions and dosing: never advised on.
  /\b(stop|quit|pause|skip|replace|switch|come off|reduce|increase|double)\b.{0,40}\b(prescri\w*|medication|medicine|meds|antibiotics?|pills?|accutane|isotretinoin|tretinoin|steroids?|doctor'?s cream)\b/,
  /\b(prescri\w*|medication|medicine|meds|antibiotics?|pills?)\b.{0,40}\b(stop|quit|dose|dosage|how much|how many|mg)\b/,
  /\b(dose|dosage|milligrams?|\d+\s?mg)\b/,
];

export function screenUserInput(text: string, turnsSoFar: number): InputVerdict {
  if (turnsSoFar >= MAX_CHAT_TURNS) return { kind: 'turn_limit' };
  const trimmed = text.trim();
  if (trimmed.length > MAX_USER_MESSAGE_CHARS) return { kind: 'too_long' };
  const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
  if (BLOCK_PATTERNS.some((p) => p.test(normalized))) return { kind: 'blocked' };
  return { kind: 'ok', text: trimmed };
}
