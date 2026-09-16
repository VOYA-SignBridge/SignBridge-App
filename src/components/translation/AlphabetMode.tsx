import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, NativeEventEmitter, NativeModules, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  initializeAlphabetModel,
  predictAlphabet,
  type AlphabetModelConfig,
} from '@/config/alphabetModel';
import type { AlphabetHandsEvent } from '@/utils/alphabet/types';

const THROTTLE_MS = 60;
const MIN_CONFIDENCE = 0.65;
const REQUIRED_STABLE_PREDICTIONS = 2;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown ExecuTorch error';
}

const ALPHABET_LABELS = new Set([
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z',
]);

function toStaticHandFrame(event: AlphabetHandsEvent): number[] | null {
  const hand = [...(event.hands ?? [])]
    .filter(({ landmarks }) => Array.isArray(landmarks) && landmarks.length === 21)
    .sort((a, b) => b.score - a.score)[0];
  if (!hand) return null;

  const frame = new Array<number>(63);
  for (let point = 0; point < 21; point += 1) {
    const landmark = hand.landmarks[point];
    const base = point * 3;
    frame[base] = Number(landmark.x);
    frame[base + 1] = Number(landmark.y);
    frame[base + 2] = Number(landmark.z);
  }
  return frame.every(Number.isFinite) ? frame : null;
}

const { HandLandmarks } = NativeModules;

type Props = {
  onResult: (text: string) => void;
  theme: any;
};

export default function AlphabetMode({ onResult, theme }: Props) {
  const { t } = useTranslation();
  const [statusMsg, setStatusMsg] = useState('');
  const [detectedChar, setDetectedChar] = useState('');
  const [modelError, setModelError] = useState('');
  const [hasHand, setHasHand] = useState(false);

  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    let mounted = true;
    let config: AlphabetModelConfig | null = null;
    let predicting = false;
    let lastPredictionTime = 0;
    let generation = 0;
    let candidateLabel = '';
    let candidateCount = 0;
    let lastCommittedLabel = '';
    setModelError('');

    const resetRecognition = () => {
      candidateLabel = '';
      candidateCount = 0;
      lastCommittedLabel = '';
      generation += 1;
      setDetectedChar('');
      setStatusMsg('');
    };

    const predictLocal = async (frame: number[], requestGeneration: number) => {
      predicting = true;
      try {
        const data = await predictAlphabet(frame);
        // Ignore results after unmount, hand loss or a camera gap.
        if (!mounted || requestGeneration !== generation) return;
        const label = String(data?.label ?? '').trim().toLocaleUpperCase('vi-VN');
        const confidence = Number(data?.confidence ?? 0);
        if (ALPHABET_LABELS.has(label) && confidence >= MIN_CONFIDENCE) {
          if (candidateLabel === label) {
            candidateCount += 1;
          } else {
            candidateLabel = label;
            candidateCount = 1;
          }

          if (candidateCount >= REQUIRED_STABLE_PREDICTIONS) {
            setDetectedChar(label);
            setStatusMsg(`${(confidence * 100).toFixed(0)}%`);
            if (lastCommittedLabel !== label) {
              lastCommittedLabel = label;
              onResultRef.current(label);
            }
          }
        } else {
          candidateLabel = '';
          candidateCount = 0;
          setStatusMsg(
            ALPHABET_LABELS.has(label)
              ? t('camera.lowConfidence', {
                  label,
                  confidence: (confidence * 100).toFixed(0),
                  minimum: MIN_CONFIDENCE * 100,
                })
              : t('camera.invalidLabel', { label: label || '(empty)' }),
          );
        }
      } catch (error: unknown) {
        if (!mounted || requestGeneration !== generation) return;
        console.error('Alphabet ExecuTorch prediction failed:', error);
        config = null; // Stop retrying a broken native runtime every camera frame.
        resetRecognition();
        setModelError(t('camera.modelError', { message: getErrorMessage(error) }));
      } finally {
        lastPredictionTime = Date.now();
        predicting = false;
      }
    };

    // Promise chain also catches a missing native module thrown synchronously.
    Promise.resolve().then(initializeAlphabetModel).then((loaded) => {
      if (mounted) config = loaded;
    }).catch((error: unknown) => {
      if (mounted) setModelError(t('camera.modelError', { message: getErrorMessage(error) }));
    });

    if (!HandLandmarks) return () => { mounted = false; };
    const emitter = new NativeEventEmitter(HandLandmarks);
    const presenceSub = emitter.addListener('onHandLandmarksDetected', (event) => {
      const present = Boolean(event.landmarks?.length);
      setHasHand(present);
      if (!present) resetRecognition();
    });
    const framesSub = emitter.addListener('onAlphabetHands', (event: AlphabetHandsEvent) => {
      if (!config || predicting || Date.now() - lastPredictionTime < THROTTLE_MS) return;
      const frame = toStaticHandFrame(event);
      if (frame?.length === config.featureDimension) {
        void predictLocal(frame, generation);
      }
    });

    return () => {
      mounted = false;
      generation += 1;
      presenceSub.remove();
      framesSub.remove();
    };
  }, [t]);

  return (
    <View style={styles.container}>
      <View style={[styles.statusBox, !hasHand && styles.statusBoxWarning]}>
        {modelError ? (
          <Text style={styles.statusText}>{modelError}</Text>
        ) : !hasHand ? (
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
                {statusMsg || t('camera.analyzing')}
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
