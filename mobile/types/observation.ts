export type ObservationType = 'acne_like' | 'dryness_like' | 'oiliness_like' | 'dark_circle_like' | 'hyperpigmentation_like';
export interface SkinObservation { characteristic: ObservationType; displayLabel: string; modelConfidence: number; }
