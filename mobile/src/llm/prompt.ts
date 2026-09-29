// Builds the chat messages sent to the LLM. Shared by the on-device runtime
// (llama.rn) and the desktop prompt-tuning script (llm/scripts/try-prompt.ts,
// which runs against Ollama), so both see exactly the same prompt.
//
// Keep this file free of runtime imports (type-only imports are fine) so Node
// can load it directly for the Ollama script.

import type { ConditionName, SessionSummary, UserProfile } from '../types/session';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Keep in sync with llm/prompts/system_prompt.md (the script warns on drift).
export const SYSTEM_PROMPT = `You are an on-device beauty assistant for cosmetic skin feedback.

Provide short, descriptive, non-diagnostic language about skin appearance. Focus on tone, texture, hydration, brightness, clarity, and treatment fit. Avoid medical diagnosis or treatment claims. Keep the answer encouraging and practical.`;

const OUTPUT_FORMAT = `Reply in exactly this format, under 150 words total, with no other text:

Overview: <one or two sentences>
What stood out:
- <one bullet per noticeable area, most important first, max 3>
Try this week:
- <one practical cosmetic routine tip per bullet, max 3>`;

export const CONDITION_LABELS: Record<ConditionName, string> = {
  acne: 'breakouts',
  redness: 'redness',
  dryness: 'dryness',
  hyperpigmentation: 'uneven tone / dark spots',
  dark_circles: 'under-eye darkness',
  oily_skin: 'shine / oiliness',
};

const TONE_GUIDANCE: Record<UserProfile['preferences']['tone'], string> = {
  casual: 'Use a friendly, relaxed tone.',
  gentle: 'Use a soft, reassuring tone.',
  clinical: 'Use a precise, neutral tone (still cosmetic, never medical).',
};

// A change in confidence smaller than this is reported as "about the same".
const TREND_THRESHOLD = 0.1;

function describeTrend(current: number, baseline: number | undefined): string {
  if (baseline === undefined) return 'no baseline yet';
  const delta = current - baseline;
  if (delta > TREND_THRESHOLD) return 'more noticeable than usual';
  if (delta < -TREND_THRESHOLD) return 'less noticeable than usual';
  return 'about the same as usual';
}

function describeResults(summary: SessionSummary, profile: UserProfile): string {
  const lines = (Object.keys(summary.results) as ConditionName[]).map((condition) => {
    const result = summary.results[condition]!;
    const label = CONDITION_LABELS[condition];
    const trend = describeTrend(result.present ? result.confidence ?? 0 : 0, profile.baseline[condition]);

    if (!result.present) return `- ${label}: not noticeable (${trend})`;

    const details = [
      result.severity,
      result.region && `around the ${result.region.replace(/_/g, ' ')}`,
      result.confidence !== undefined && `confidence ${Math.round(result.confidence * 100)}%`,
    ].filter(Boolean);
    return `- ${label}: ${details.join(', ')} (${trend})`;
  });

  return lines.length > 0 ? lines.join('\n') : '- nothing noticeable in this scan';
}

export function buildFeedbackMessages(summary: SessionSummary, profile: UserProfile): ChatMessage[] {
  const focus = profile.preferences.focus.map((c) => CONDITION_LABELS[c]).join(', ') || 'none';

  const user = `Today's skin scan (${summary.angles_captured.length} angles):
${describeResults(summary, profile)}

The user most cares about: ${focus}.
${TONE_GUIDANCE[profile.preferences.tone]}

${OUTPUT_FORMAT}`;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
}
