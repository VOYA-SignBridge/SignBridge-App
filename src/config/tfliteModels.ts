import { NativeModules } from 'react-native';

const { HandLandmarks } = NativeModules;

export const TFLITE_MODES = {
  alphabet: 'alphabet',
  word: 'word',
} as const;

export type TfliteMode = (typeof TFLITE_MODES)[keyof typeof TFLITE_MODES];

export type TfliteModelConfig = {
  id: string;
  displayName: string;
  sequenceLength: number;
  featureDimension: number;
  classCount: number;
  mirrorInput: boolean;
  normalizationVersion: 'hands126_v1' | 'alphabet_hands126_v1';
  sampleFps?: number;
};

const configCache = new Map<string, TfliteModelConfig>();

export async function getTfliteModelConfig(
  modelOrMode: TfliteMode | string,
): Promise<TfliteModelConfig> {
  const cached = configCache.get(modelOrMode);
  if (cached) return cached;

  if (!HandLandmarks?.getTcnModelConfig) {
    throw new Error('TFLite native module is not available');
  }

  const config = (await HandLandmarks.getTcnModelConfig(modelOrMode)) as TfliteModelConfig;
  configCache.set(modelOrMode, config);
  return config;
}

export async function predictWithTfliteModel(
  frames: number[][],
  modelOrMode: TfliteMode | string,
) {
  if (!HandLandmarks?.predictTcnForModel) {
    throw new Error('TFLite native module is not available');
  }

  return HandLandmarks.predictTcnForModel(frames, modelOrMode);
}
