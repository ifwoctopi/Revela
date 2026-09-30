// The only user information that flows downstream from the intake. Every
// field is an enum, a count, or an id; raw free text never leaves the intake.
// parseUserContext is the single gate: anything that doesn't fit is dropped.

import { ACTIVES, SENSITIVITY_GROUPS, type ActiveId, type SensitivityId } from '../products/ingredients';
import type { ConditionName } from '../types/session';

export const CONDITIONS: readonly ConditionName[] = ['acne', 'redness', 'dryness', 'hyperpigmentation', 'dark_circles', 'oily_skin'];
export const ROUTINE_STEPS = ['cleanser', 'toner', 'treatment', 'exfoliant', 'moisturizer', 'sunscreen', 'eye_care'] as const;
export const PREGNANCY_ANSWERS = ['yes', 'no', 'prefer_not_to_say'] as const;
export const SKIN_TYPES = ['oily', 'dry', 'combination', 'normal', 'sensitive'] as const;

export type RoutineStep = (typeof ROUTINE_STEPS)[number];
export type PregnancyAnswer = (typeof PREGNANCY_ANSWERS)[number];
export type SkinType = (typeof SKIN_TYPES)[number];

export interface UserContext {
  version: 1;
  userId: string;
  concerns: ConditionName[];
  routineSteps: RoutineStep[];
  /** Actives the user already uses (for conflict checks). */
  currentActives: ActiveId[];
  sensitivities: SensitivityId[];
  /** How many reported sensitivities could not be matched to a known group (text is not kept). */
  unrecognizedSensitivities: number;
  pregnancy: PregnancyAnswer | null;
  skinType: SkinType | null;
  updatedAt: string;
}

const ACTIVE_IDS = Object.keys(ACTIVES) as ActiveId[];
const SENSITIVITY_IDS: readonly SensitivityId[] = [...ACTIVE_IDS, ...(Object.keys(SENSITIVITY_GROUPS) as SensitivityId[])];
const USER_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function emptyUserContext(userId: string): UserContext {
  return {
    version: 1, userId, concerns: [], routineSteps: [], currentActives: [], sensitivities: [],
    unrecognizedSensitivities: 0, pregnancy: null, skinType: null, updatedAt: new Date(0).toISOString(),
  };
}

function enumArray<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is T => typeof v === 'string' && (allowed as readonly string[]).includes(v)))];
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * Validates untrusted input (LLM extraction output, stored JSON) against the
 * schema. Returns null when the identity fields are invalid; otherwise drops
 * every value that doesn't fit and keeps the rest.
 */
export function parseUserContext(input: unknown): UserContext | null {
  if (typeof input !== 'object' || input === null) return null;
  const raw = input as Record<string, unknown>;
  if (raw.version !== 1 || typeof raw.userId !== 'string' || !USER_ID.test(raw.userId)) return null;

  const count = raw.unrecognizedSensitivities;
  const updatedAt = typeof raw.updatedAt === 'string' && !Number.isNaN(Date.parse(raw.updatedAt))
    ? new Date(raw.updatedAt).toISOString()
    : new Date(0).toISOString();

  return {
    version: 1,
    userId: raw.userId,
    concerns: enumArray(raw.concerns, CONDITIONS),
    routineSteps: enumArray(raw.routineSteps, ROUTINE_STEPS),
    currentActives: enumArray(raw.currentActives, ACTIVE_IDS),
    sensitivities: enumArray(raw.sensitivities, SENSITIVITY_IDS),
    unrecognizedSensitivities: typeof count === 'number' && Number.isInteger(count) && count >= 0 ? Math.min(count, 20) : 0,
    pregnancy: enumValue(raw.pregnancy, PREGNANCY_ANSWERS),
    skinType: enumValue(raw.skinType, SKIN_TYPES),
    updatedAt,
  };
}
