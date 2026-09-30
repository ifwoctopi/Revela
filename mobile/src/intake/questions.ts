// Pre-scan intake. Five questions, one at a time, each skippable. Only fields
// the results summary actually uses are collected (no budget question: the
// product database has no prices).

export type IntakeField = 'concerns' | 'routine' | 'sensitivities' | 'pregnancy' | 'skinType';

export interface IntakeQuestion {
  field: IntakeField;
  prompt: string;
  hint: string;
  /** Quick replies shown as chips; typed answers are also accepted. */
  quickReplies: string[];
}

export const MAX_INTAKE_ANSWER_CHARS = 300;

export const INTAKE_QUESTIONS: readonly IntakeQuestion[] = [
  {
    field: 'concerns',
    prompt: 'What would you most like to improve about your skin right now?',
    hint: 'For example breakouts, redness, dryness, dark spots, shine or under-eye circles.',
    quickReplies: ['Breakouts', 'Dark spots', 'Dryness', 'Redness', 'Shine'],
  },
  {
    field: 'routine',
    prompt: 'What does your current routine look like?',
    hint: 'List the steps or products you use, like cleanser, moisturizer, sunscreen or retinol.',
    quickReplies: ['Cleanser and moisturizer', 'Cleanser, moisturizer and sunscreen', 'Nothing yet'],
  },
  {
    field: 'sensitivities',
    prompt: 'Are there any skincare ingredients that irritate your skin or that you react to?',
    hint: 'For example fragrance, essential oils, retinol or acids.',
    quickReplies: ['Fragrance', 'Essential oils', 'None that I know of'],
  },
  {
    field: 'pregnancy',
    prompt: 'Are you currently pregnant or breastfeeding? This changes which ingredients are suitable.',
    hint: 'You can also choose not to say.',
    quickReplies: ['No', 'Yes', 'Prefer not to say'],
  },
  {
    field: 'skinType',
    prompt: 'Last one. Do you know your skin type?',
    hint: 'Oily, dry, combination, normal or sensitive.',
    quickReplies: ['Oily', 'Dry', 'Combination', 'Normal', 'Sensitive', 'Not sure'],
  },
];
