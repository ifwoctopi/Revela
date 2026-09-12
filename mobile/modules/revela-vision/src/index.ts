import { requireNativeModule } from 'expo-modules-core';

export type RevelaVisionModule = {
  predict(uri: string): Promise<number[]>;
};

export default requireNativeModule<RevelaVisionModule>('RevelaVision');
