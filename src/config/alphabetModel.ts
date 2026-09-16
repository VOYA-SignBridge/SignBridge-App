import { NativeModules, Platform } from 'react-native';

export type AlphabetModelConfig = {
  id: string;
  runtime: 'executorch';
  sequenceLength: number;
  featureDimension: number;
  classCount: number;
  normalizationVersion: 'featurewise_standardization_v1';
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
    throw new Error('The ASL alphabet model requires a rebuilt Android app with the ExecuTorch native module');
  }
  return module;
}

export function initializeAlphabetModel(): Promise<AlphabetModelConfig> {
  return nativeModel().initialize();
}

/** One raw MediaPipe hand (21 × xyz); Kotlin applies metadata mean/std exactly once. */
export function predictAlphabet(frame: number[]): Promise<AlphabetPrediction> {
  return nativeModel().predict(frame);
}
