import type { SessionSummary, UserProfile } from '../types/session';

export const sampleSessionSummary: SessionSummary = {
  session_id: 'sess_2026_09_01_001',
  timestamp: '2026-09-01T09:30:00.000Z',
  angles_captured: ['front', 'left_3q', 'right_3q'],
  results: {
    acne: {
      present: true,
      confidence: 0.87,
      region: 'chin',
      severity: 'moderate',
    },
    redness: {
      present: true,
      confidence: 0.65,
      region: 'left_cheek',
      severity: 'mild',
    },
    dryness: {
      present: false,
    },
    hyperpigmentation: {
      present: true,
      confidence: 0.72,
      region: 'forehead',
      severity: 'moderate',
    },
  },
};

export const sampleUserProfile: UserProfile = {
  user_id: 'user_001',
  baseline: {
    acne: 0.3,
    redness: 0.2,
    dryness: 0.1,
    hyperpigmentation: 0.25,
  },
  preferences: {
    focus: ['acne', 'redness'],
    tone: 'casual',
  },
};
