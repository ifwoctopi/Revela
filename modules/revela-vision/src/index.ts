import { requireOptionalNativeModule } from 'expo-modules-core';

export type RevelaVisionModule = {
  predict(uri: string): Promise<number[]>;
};

// iOS development builds can use the bundled Core ML module. Expo Go and
// Android currently fall back to prototype predictions in services/vision.ts.
export default requireOptionalNativeModule<RevelaVisionModule>('RevelaVision');
