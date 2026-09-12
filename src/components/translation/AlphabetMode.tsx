import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, NativeEventEmitter, NativeModules, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  getTfliteModelConfig,
  predictWithTfliteModel,
  TFLITE_MODES,
  type TfliteModelConfig,
} from '@/config/tfliteModels';

const THROTTLE_MS = 120;
const MIN_CONFIDENCE = 0.65;
const SOURCE_WINDOW_SIZE = 20;
const REQUIRED_STABLE_PREDICTIONS = 2;

const ALPHABET_LABELS = new Set([
  'A', 'Ă', 'Â', 'B', 'C', 'D', 'Đ', 'E', 'Ê', 'G',
  'H', 'I', 'K', 'L', 'M', 'N', 'O', 'Ô', 'Ơ', 'P',
  'Q', 'R', 'S', 'T', 'U', 'Ư', 'V', 'X', 'Y', 'Z',
]);

function resampleFrames(frames: number[][], targetLength: number): number[][] {
  if (frames.length === 0 || targetLength <= 0) return [];

  return Array.from({ length: targetLength }, (_, index) => {
    const sourceIndex = Math.min(
      frames.length - 1,
      Math.floor((index * frames.length) / targetLength),
    );
    return frames[sourceIndex];
  });
}

const { HandLandmarks } = NativeModules;
const eventEmitter = new NativeEventEmitter(HandLandmarks);

type Props = {
  onResult: (text: string) => void;
  theme: any;
};

export default function AlphabetMode({ onResult, theme }: Props) {
  const { t } = useTranslation();
  const [statusMsg, setStatusMsg] = useState('');
  const [detectedChar, setDetectedChar] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasHand, setHasHand] = useState(false);

  const frameBuffer = useRef<number[][]>([]);
  const isPredicting = useRef(false);
  const lastEventTime = useRef(0);
  const lastPredictionTime = useRef(0);
  const modelConfig = useRef<TfliteModelConfig | null>(null);
  const candidateLabel = useRef('');
  const candidateCount = useRef(0);
  const lastCommittedLabel = useRef('');
  const sequenceGeneration = useRef(0);


  useEffect(() => {
    let mounted = true;
    getTfliteModelConfig(TFLITE_MODES.alphabet)
      .then((config) => {
        if (mounted) modelConfig.current = config;
      })
      .catch(() => {
        if (mounted) setStatusMsg(t('camera.networkError'));
      });

    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    const sub = eventEmitter.addListener('onHandLandmarksDetected', (event) => {
      if (!event.landmarks || event.landmarks.length === 0) {
        setHasHand(false);
        setDetectedChar('');
        setStatusMsg('');
        frameBuffer.current = [];
        candidateLabel.current = '';
        candidateCount.current = 0;
        lastCommittedLabel.current = '';
        sequenceGeneration.current += 1;
        return;
      }

      setHasHand(true);
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = eventEmitter.addListener('onHandFrame126', (event) => {
      const now = Date.now();
      if (now - lastEventTime.current < 50) return;
      lastEventTime.current = now;

      const config = modelConfig.current;
      if (!config) return;

      const frameVector = Array.from(event.frame ?? []) as number[];
      if (frameVector.length !== config.featureDimension) return;

      frameBuffer.current.push(frameVector);
      if (frameBuffer.current.length > SOURCE_WINDOW_SIZE) frameBuffer.current.shift();

      if (
        frameBuffer.current.length === SOURCE_WINDOW_SIZE &&
        !isPredicting.current &&
        now - lastPredictionTime.current >= THROTTLE_MS
      ) {
        const frames = resampleFrames(frameBuffer.current, config.sequenceLength);
        predictLocal(frames, sequenceGeneration.current);
      }
    });

    return () => sub.remove();
  }, []);

  const predictLocal = async (frames: number[][], generation: number) => {
    if (isPredicting.current) return;
    isPredicting.current = true;
    setIsProcessing(true);

    try {
      const data = await predictWithTfliteModel(frames, TFLITE_MODES.alphabet);
      const label = String(data?.label ?? '')
        .trim()
        .toLocaleUpperCase('vi-VN');
      const confidence = Number(data?.confidence ?? 0);

      // Ignore a prediction that completed after the hand disappeared and the
      // active sequence was reset.
      if (generation !== sequenceGeneration.current) return;

      if (ALPHABET_LABELS.has(label) && confidence >= MIN_CONFIDENCE) {
        if (candidateLabel.current === label) {
          candidateCount.current += 1;
        } else {
          candidateLabel.current = label;
          candidateCount.current = 1;
        }

        if (candidateCount.current >= REQUIRED_STABLE_PREDICTIONS) {
          setDetectedChar(label);
          setStatusMsg(`${(confidence * 100).toFixed(0)}%`);

          if (lastCommittedLabel.current !== label) {
            lastCommittedLabel.current = label;
            onResult(label);
          }
        }
      } else {
        candidateLabel.current = '';
        candidateCount.current = 0;
      }
    } catch (e) {
      setStatusMsg(t('camera.networkError'));
    } finally {
      lastPredictionTime.current = Date.now();
      isPredicting.current = false;
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.statusBox, !hasHand && styles.statusBoxWarning]}>
        {!hasHand ? (
          <Text style={styles.statusText}>{t('camera.noHand')}</Text>
        ) : (
          <View style={styles.resultContainer}>
            {detectedChar ? (
              <Text style={[styles.largeChar, { color: theme.primary }]}>{detectedChar}</Text>
            ) : (
              <ActivityIndicator size="small" color={theme.primary} />
            )}
            <View style={styles.infoColumn}>
              <Text style={styles.modeTitle}>{t('camera.alphabetModeTitle')}</Text>
              <Text style={styles.subText}>
                {detectedChar ? statusMsg : t('camera.analyzing')}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    alignItems: 'center',
    width: '100%',
    zIndex: 10,
  },
  statusBox: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBoxWarning: {
    borderColor: '#F87171',
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
  },
  statusText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  resultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  largeChar: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  infoColumn: {
    justifyContent: 'center',
  },
  modeTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  subText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
});
