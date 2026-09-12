export type ConditionName =
  | 'acne'
  | 'redness'
  | 'dryness'
  | 'hyperpigmentation'
  | 'dark_circles'
  | 'oily_skin';
export type Severity = 'mild' | 'moderate' | 'severe';
export type AngleName = 'front' | 'left_3q' | 'right_3q';

export interface ConditionResult {
  present: boolean;
  confidence?: number;
  region?: string;
  severity?: Severity;
}

export interface SessionSummary {
  session_id: string;
  timestamp: string;
  angles_captured: AngleName[];
  results: Partial<Record<ConditionName, ConditionResult>>;
}

export interface UserProfile {
  user_id: string;
  baseline: Partial<Record<ConditionName, number>>;
  preferences: {
    focus: ConditionName[];
    tone: 'casual' | 'gentle' | 'clinical';
  };
}
