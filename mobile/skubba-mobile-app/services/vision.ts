import { SessionSummary } from '../../src/types/session';
import NativeVision from '../../modules/revela-vision/src';

export type CapturedAngle = 'front' | 'left_3q' | 'right_3q';

export type CapturedFrame = {
  angle: CapturedAngle;
  uri: string;
};

export type VisionInference = (frames: CapturedFrame[]) => Promise<SessionSummary>;

const modelClasses = ['Acne', 'Dark_Circles', 'Dry_Skin', 'Oily_Skin', 'Post-Inflammatory_hyperpigmentation'] as const;

function toConditionName(modelClass: (typeof modelClasses)[number]) {
  const names = {
    Acne: 'acne',
    Dark_Circles: 'dark_circles',
    Dry_Skin: 'dryness',
    Oily_Skin: 'oily_skin',
    'Post-Inflammatory_hyperpigmentation': 'hyperpigmentation',
  } as const;
  return names[modelClass];
}

export const runVisionInference: VisionInference = async (frames) => {
  if (frames.length !== 3) throw new Error('Three captured views are required for analysis.');

  const predictions = await Promise.all(frames.map((frame) => NativeVision.predict(frame.uri)));
  const confidenceByClass = modelClasses.map((_, classIndex) =>
    Math.max(...predictions.map((prediction) => prediction[classIndex] ?? 0)),
  );

  return {
    session_id: `session_${Date.now()}`,
    timestamp: new Date().toISOString(),
    angles_captured: frames.map((frame) => frame.angle),
    results: Object.fromEntries(
      modelClasses.map((modelClass, index) => {
        const confidence = confidenceByClass[index];
        return [toConditionName(modelClass), { present: confidence >= 0.5, confidence }];
      }),
    ),
  };
};
