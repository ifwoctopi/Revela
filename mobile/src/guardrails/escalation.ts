// Rule-based escalation triggers (never model-based). Run on every piece of
// user input (intake answers and chat) and on the scan results.
//
// REVIEW: trigger patterns must be reviewed by a dermatology or esthetics
// professional before release. They err toward escalating: a negated mention
// ("no fever") still escalates.

import type { SessionSummary } from '../types/session';
import { ESCALATION_MESSAGES } from './messages';

/** Below this, a model result is "not confident" (see docs/model-integration.md). */
export const SCAN_CONFIDENCE_THRESHOLD = 0.5;

export type EscalationTrigger =
  | 'allergic_emergency'
  | 'changing_mole'
  | 'infection'
  | 'severe_symptoms'
  | 'serious_disease_question'
  | 'uncertain_severe_scan';

export interface Escalation {
  trigger: EscalationTrigger;
  level: 'emergency' | 'prompt';
  message: string;
}

const TEXT_RULES: ReadonlyArray<{ trigger: EscalationTrigger; level: Escalation['level']; message: string; patterns: RegExp[] }> = [
  {
    trigger: 'allergic_emergency',
    level: 'emergency',
    message: ESCALATION_MESSAGES.emergency,
    patterns: [
      /\b(swell\w*|swollen|puff\w*)\b.{0,40}\b(face|lips?|tongue|throat|eyes?|mouth)\b/,
      /\b(face|lips?|tongue|throat|eyes?|mouth)\b.{0,40}\b(swell\w*|swollen)\b/,
      /\b(trouble|difficulty|hard|struggling|can'?t|cannot|unable to)\s+(to\s+)?breath/,
      /\bshort(ness)?\s+of\s+breath\b/,
      /\banaphyla\w*/,
      /\bthroat\b.{0,20}\b(closing|tight)/,
    ],
  },
  {
    trigger: 'changing_mole',
    level: 'prompt',
    message: ESCALATION_MESSAGES.prompt,
    patterns: [
      // "Spots" alone is common for acne, so "new spots" does not escalate; changing or bleeding ones do.
      /\b(moles?|spots?|freckles?|lesions?|growths?|birthmarks?|lumps?)\b.{0,50}\b(chang\w*|bleed\w*|irregular|grow\w*|getting bigger|itch\w*|crust\w*|dark(er|ening))\b/,
      /\b(chang\w*|bleed\w*|irregular|grow\w*|new)\b.{0,30}\b(moles?|lesions?|growths?|lumps?)\b/,
    ],
  },
  {
    trigger: 'infection',
    level: 'prompt',
    message: ESCALATION_MESSAGES.prompt,
    patterns: [
      /\bpus\b/, /\booz\w*/, /\bfever\w*/, /\binfect\w*/, /\bred streaks?\b/,
      /\bspreading\s+redness\b/, /\bredness\b.{0,20}\bspread\w*/,
      /\b(warm|hot)\s+(to\s+the\s+touch|and\s+swollen)\b/, /\babscess\w*/,
    ],
  },
  {
    trigger: 'severe_symptoms',
    level: 'prompt',
    message: ESCALATION_MESSAGES.prompt,
    patterns: [
      /\b(severe|intense|extreme|unbearable|really bad)\s+(pain|burning|swelling)\b/,
      /\bblister\w*/,
      /\b(spread\w*)\s+(fast|quickly|rapidly)\b/, /\brapid\w*\s+spread\w*/,
      /\bopen\s+(wound|sore)s?\b/,
    ],
  },
  {
    trigger: 'serious_disease_question',
    level: 'prompt',
    message: ESCALATION_MESSAGES.seriousDiseaseQuestion,
    patterns: [
      /\b(cancer\w*|melanoma|carcinoma|malignan\w*|tumou?rs?)\b/,
      /\bserious\s+(disease|illness|condition|problem)\b/,
      /\bskin\s+disease\b/,
    ],
  },
];

const PRIORITY: Record<Escalation['level'], number> = { emergency: 0, prompt: 1 };

/** Returns the most urgent escalation triggered by the text, or null. */
export function checkTextForEscalation(text: string): Escalation | null {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ');
  const hits = TEXT_RULES.filter((rule) => rule.patterns.some((p) => p.test(normalized)));
  if (hits.length === 0) return null;
  const [top] = [...hits].sort((a, b) => PRIORITY[a.level] - PRIORITY[b.level]);
  return { trigger: top.trigger, level: top.level, message: top.message };
}

/** A high-severity result the model isn't confident about. */
export function checkScanForEscalation(summary: SessionSummary): Escalation | null {
  const uncertainSevere = Object.values(summary.results).some(
    (r) => r && r.severity === 'severe' && (r.confidence ?? 0) < SCAN_CONFIDENCE_THRESHOLD,
  );
  return uncertainSevere
    ? { trigger: 'uncertain_severe_scan', level: 'prompt', message: ESCALATION_MESSAGES.uncertainScan }
    : null;
}
