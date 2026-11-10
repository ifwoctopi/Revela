import { requireOptionalNativeModule } from 'expo-modules-core';

export type RevelaVisionModule = {
  predict(uri: string): Promise<number[]>;
};

// Development builds run the skin model natively: Core ML on iOS, ONNX Runtime
// on Android (converted by tools/skin-model). Expo Go has no native module and
// falls back to prototype predictions in services/vision.ts.
export default requireOptionalNativeModule<RevelaVisionModule>('RevelaVision');
