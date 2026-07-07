import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, NativeEventEmitter, NativeModules, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';

const THROTTLE_MS = 500;
const SEQ_LEN = 60;
const FEATURE_DIM = 126;
const MIN_CONFIDENCE = 0.2;

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

  useEffect(() => {
    const sub = eventEmitter.addListener('onHandLandmarksDetected', (event) => {
      if (!event.landmarks || event.landmarks.length === 0) {
        setHasHand(false);
        setDetectedChar('');
        frameBuffer.current = [];
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

      const frameVector = Array.from(event.frame ?? []) as number[];
      if (frameVector.length !== FEATURE_DIM) return;

      frameBuffer.current.push(frameVector);
      if (frameBuffer.current.length > SEQ_LEN) frameBuffer.current.shift();

      if (
        frameBuffer.current.length === SEQ_LEN &&
        !isPredicting.current &&
        now - lastPredictionTime.current > THROTTLE_MS
      ) {
        predictLocal(frameBuffer.current.slice());
      }
    });

    return () => sub.remove();
  }, []);

  const predictLocal = async (frames: number[][]) => {
    if (isPredicting.current) return;
    isPredicting.current = true;
    setIsProcessing(true);

    try {
      const data = await HandLandmarks.predictTcn(frames);
      const label = String(data?.label ?? '');

      if (/^[A-Z]$/.test(label) && data.confidence >= MIN_CONFIDENCE) {
        onResult(label);
        setDetectedChar(label);
        setStatusMsg(`${(data.confidence * 100).toFixed(0)}%`);
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
