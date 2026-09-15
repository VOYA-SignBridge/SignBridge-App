import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, NativeEventEmitter, NativeModules, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  getTfliteModelConfig,
  predictWithTfliteModel,
  TFLITE_MODES,
  type TfliteModelConfig,
} from '@/config/tfliteModels';
import { AlphabetSampler } from '@/utils/alphabetSampling';
import { AlphabetHandTracker, readAlphabetFrame, type AlphabetCapture, type AlphabetFrame } from '@/utils/alphabetCamera';
import AlphabetDiagnostics from './AlphabetDiagnostics';

const THROTTLE_MS = 60;
const MIN_CONFIDENCE = 0.65;
const REQUIRED_STABLE_PREDICTIONS = 2;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown TFLite error';
}

const ALPHABET_LABELS = new Set([
  'A', 'Ă', 'Â', 'B', 'C', 'D', 'Đ', 'E', 'Ê', 'G',
  'H', 'I', 'K', 'L', 'M', 'N', 'O', 'Ô', 'Ơ', 'P',
  'Q', 'R', 'S', 'T', 'U', 'Ư', 'V', 'X', 'Y', 'Z',
]);

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
  const [hasHand, setHasHand] = useState(false);
  const [captureError, setCaptureError] = useState('');
  const captureBlocked = useRef(false);

  const sampler = useRef<AlphabetSampler | null>(null);
  const mountedRef = useRef(false);
  const handPresent = useRef(false);
  const isPredicting = useRef(false);
  const lastPredictionTime = useRef(0);
  const modelConfig = useRef<TfliteModelConfig | null>(null);
  const candidateLabel = useRef('');
  const candidateCount = useRef(0);
  const lastCommittedLabel = useRef('');
  const sequenceGeneration = useRef(0);
  const handTracker = useRef(new AlphabetHandTracker());
  const recentEvents = useRef<AlphabetFrame[]>([]);
  const latestCapture = useRef<AlphabetCapture | null>(null);


  const predictLocal = useCallback(async (frames: number[][], generation: number, events: AlphabetFrame[]) => {
    if (isPredicting.current) return;
    isPredicting.current = true;

    try {
      const data = await predictWithTfliteModel(frames, TFLITE_MODES.alphabet);
      const label = String(data?.label ?? '')
        .trim()
        .toLocaleUpperCase('vi-VN');
      const confidence = Number(data?.confidence ?? 0);

      // Ignore a prediction that completed after the hand disappeared and the
      // active sequence was reset.
      if (!mountedRef.current || !handPresent.current || generation !== sequenceGeneration.current) return;
      latestCapture.current = {
        schemaVersion: 1, pipelineVersion: 'alphabet-camera-v2',
        capturedAt: new Date().toISOString(), frames, events, prediction: data,
      };

      if (ALPHABET_LABELS.has(label) && confidence >= MIN_CONFIDENCE) {
        if (candidateLabel.current === label) {
          candidateCount.current += 1;
        } else {
          candidateLabel.current = label;
          candidateCount.current = 1;
          setDetectedChar('');
          setStatusMsg(t('camera.analyzing'));
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
        setDetectedChar('');
        candidateLabel.current = '';
        candidateCount.current = 0;
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
      const message = getErrorMessage(error);
      console.error('Alphabet TFLite prediction failed:', error);
      if (mountedRef.current && generation === sequenceGeneration.current) setStatusMsg(t('camera.modelError', { message }));
    } finally {
      lastPredictionTime.current = Date.now();
      isPredicting.current = false;
    }
  }, [onResult, t]);

  useEffect(() => {
    let mounted = true;
    const tracker = handTracker.current;
    mountedRef.current = true;
    captureBlocked.current = false;
    setCaptureError('');
    getTfliteModelConfig(TFLITE_MODES.alphabet)
      .then((config) => {
        if (!mounted) return;
        if (config.normalizationVersion !== 'alphabet_hands126_v1' || config.sampleFps !== 30) {
          throw new Error('Alphabet model sampling/preprocessing contract mismatch');
        }
        modelConfig.current = config;
        sampler.current = new AlphabetSampler(config.sequenceLength, config.featureDimension, config.sampleFps);
        HandLandmarks.startAlphabetCapture();
      })
      .catch((error: unknown) => {
        const message = getErrorMessage(error);
        console.error('Failed to load alphabet TFLite config:', error);
        if (mounted) setCaptureError(t('camera.modelError', { message }));
      });

    return () => {
      mounted = false;
      mountedRef.current = false;
      sequenceGeneration.current += 1;
      HandLandmarks.stopAlphabetCapture();
      sampler.current = null;
      modelConfig.current = null;
      tracker.reset();
      recentEvents.current = [];
      latestCapture.current = null;
    };
  }, [t]);

  useEffect(() => {
    const sub = eventEmitter.addListener('onAlphabetFrame126', (payload: unknown) => {
      const config = modelConfig.current;
      const buffer = sampler.current;
      if (!config || !buffer || captureBlocked.current) return;
      const parsed = readAlphabetFrame(payload);
      if (!parsed.frame) {
        captureBlocked.current = true;
        sequenceGeneration.current += 1;
        handPresent.current = false;
        latestCapture.current = null;
        recentEvents.current = [];
        handTracker.current.reset();
        buffer.reset();
        candidateLabel.current = '';
        candidateCount.current = 0;
        lastCommittedLabel.current = '';
        setDetectedChar('');
        setHasHand(false);
        setCaptureError(parsed.error);
        HandLandmarks.stopAlphabetCapture();
        return;
      }
      const event = parsed.frame;
      const now = Number(event.timestampMs);
      if (!Number.isFinite(now) || (recentEvents.current.length && now <= recentEvents.current[recentEvents.current.length - 1].timestampMs)) return;
      const frame = handTracker.current.encode(event.detections, now);
      if (!frame) return;
      recentEvents.current = [...recentEvents.current, event].slice(-150);
      const previous = handPresent.current;
      const sample = buffer.append(frame, now);
      if (!sample.accepted) return;
      handPresent.current = Number(event.handCount) > 0;
      setHasHand(handPresent.current);
      if (sample.restarted) {
        sequenceGeneration.current += 1;
        latestCapture.current = null;
        candidateLabel.current = '';
        candidateCount.current = 0;
        setDetectedChar('');
      }
      if (!handPresent.current) {
        setHasHand(false);
        setDetectedChar('');
        setStatusMsg('');
        candidateLabel.current = '';
        candidateCount.current = 0;
        lastCommittedLabel.current = '';
        latestCapture.current = null;
        // Match Collector realtime: a new hand starts a fresh gesture window.
        buffer.reset();
        if (previous) sequenceGeneration.current += 1;
        return;
      }
      const frames = buffer.snapshot();
      if (
        frames &&
        !isPredicting.current &&
        Date.now() - lastPredictionTime.current >= THROTTLE_MS
      ) {
        predictLocal(frames, sequenceGeneration.current, recentEvents.current.slice());
      }
    });

    return () => sub.remove();
  }, [predictLocal]);


  return (
    <View style={styles.container}>
      <View style={[styles.statusBox, !hasHand && styles.statusBoxWarning]}>
        {captureError ? (
          <Text style={styles.captureError}>{captureError}</Text>
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
      <AlphabetDiagnostics snapshot={() => {
        const capture = latestCapture.current;
        return handPresent.current && capture && Date.now() - Date.parse(capture.capturedAt) < 2000 ? capture : null;
      }} />
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
  captureError: { color: '#fecaca', fontSize: 14, textAlign: 'center', maxWidth: '100%' },
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
