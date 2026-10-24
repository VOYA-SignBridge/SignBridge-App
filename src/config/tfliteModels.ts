import { NativeModules } from 'react-native';

const { HandLandmarks } = NativeModules;

export const TFLITE_MODES = {
  alphabet: 'alphabet',
  word: 'word',
  // Alias trong registry Android; HandGCN vẫn cần asset và native hỗ trợ trước khi chạy thật.
  alphabetHandgcn: 'alphabetHandgcn',
} as const;

export type TfliteMode = (typeof TFLITE_MODES)[keyof typeof TFLITE_MODES];

export type AlphabetPreprocessingProfile = 'handgcn_lite_hands126_v1';

export type TfliteModelConfig = {
  id: string;
  displayName: string;
  sequenceLength: number;
  featureDimension: number;
  classCount: number;
  mirrorInput: boolean;
  normalizationVersion: 'hands126_v1' | 'alphabet_hands126_v1';
  // Để optional vì bridge/model cũ chưa trả profile; normalizationVersion vẫn theo metadata huấn luyện.
  preprocessingProfile?: AlphabetPreprocessingProfile;
  sampleFps?: number;
};

// Kiểm tra payload native lúc chạy: ép kiểu TypeScript không ngăn cấu hình Word hoặc model thiếu thông tin.
export function assertAlphabetModelConfig(
  value: unknown,
): asserts value is TfliteModelConfig & { sampleFps: 30 } {
  if (value === null || typeof value !== 'object') {
    throw new Error('Invalid Alphabet model configuration');
  }
  const config = value as Record<string, unknown>;
  const validShape = config.sequenceLength === 60 && config.featureDimension === 126 &&
    config.classCount === 30 && config.sampleFps === 30;
  const existingAlphabet = config.normalizationVersion === 'alphabet_hands126_v1' &&
    config.preprocessingProfile === undefined;
  const handgcnAlphabet = config.normalizationVersion === 'hands126_v1' &&
    config.preprocessingProfile === 'handgcn_lite_hands126_v1';
  if (
    typeof config.id !== 'string' || !config.id.trim() ||
    typeof config.displayName !== 'string' || typeof config.mirrorInput !== 'boolean' ||
    !validShape || (!existingAlphabet && !handgcnAlphabet)
  ) {
    throw new Error('Alphabet model sampling/preprocessing contract mismatch');
  }
}

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
