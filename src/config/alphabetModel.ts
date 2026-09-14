import { NativeModules, Platform } from 'react-native';

export type AlphabetModelConfig = {
  id: string;
  runtime: 'executorch';
  sequenceLength: number;
  featureDimension: number;
  classCount: number;
  normalizationVersion: 'hands126_v1';
};

export type AlphabetPrediction = {
  modelId: string;
  classIndex: number;
  label: string;
  label_key: string;
  confidence: number;
};

function nativeModel() {
  const module = NativeModules.AlphabetModel;
  if (Platform.OS !== 'android' || !module?.initialize || !module?.predict) {
    throw new Error('HandGCN requires a rebuilt Android app with the ExecuTorch native module');
  }
  return module;
}

export function initializeAlphabetModel(): Promise<AlphabetModelConfig> {
  return nativeModel().initialize();
}

/** Raw, unmirrored, anatomically slotted frames; Kotlin normalizes exactly once. */
export function predictAlphabet(frames: number[][]): Promise<AlphabetPrediction> {
  return nativeModel().predict(frames);
}
