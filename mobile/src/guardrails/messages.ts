// Every fixed user-facing guardrail message lives here, so they are easy to
// review and localize. Never vary or elaborate on FALLBACK_MESSAGE, and never
// say which rule triggered it.

export const FALLBACK_MESSAGE =
  "I don't have reliable information on that, so I'd rather not guess. For your safety, please check with a healthcare provider or a dermatologist.";

/** FALLBACK_MESSAGE for a summary section, naming the section's fixed topic instead of "that". */
export const sectionFallbackMessage = (topic: string) =>
  `I don't have reliable information on ${topic}, so I'd rather not guess. For your safety, please check with a healthcare provider or a dermatologist.`;

export const ESCALATION_MESSAGES = {
  emergency:
    'This could be a serious allergic reaction. Please call your local emergency number or go to the nearest emergency department now.',
  prompt:
    "What you've described should be checked by a healthcare provider or dermatologist soon. Please book an appointment promptly rather than relying on this app.",
  seriousDiseaseQuestion:
    "I can't tell whether something is cancer or a serious disease. Please see a healthcare provider or dermatologist promptly so they can examine it.",
  uncertainScan:
    "Part of your scan showed a strong result that the app isn't confident about. Please have a healthcare provider or dermatologist look at your skin rather than relying on this result.",
} as const;

export const LIMIT_MESSAGES = {
  tooLong: (max: number) => `Please keep your message under ${max} characters.`,
  turnLimit: "You've reached the question limit for this session. You can start a new scan any time.",
} as const;
