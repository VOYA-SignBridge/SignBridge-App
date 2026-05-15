import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, NativeEventEmitter, NativeModules, ActivityIndicator } from 'react-native';
import { privateApi } from '@/api/privateApi';
import { useTranslation } from 'react-i18next';

const THROTTLE_MS = 500;
const RATE_LIMIT_COOLDOWN_MS = 8000;
const MIN_CONFIDENCE = 0.5;

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

  const isSending = useRef(false);
  const lastEventTime = useRef(0);
  const lastApiCall = useRef(0);
  const rateLimitUntil = useRef(0); // timestamp until which we pause sending after 429

  useEffect(() => {
    const sub = eventEmitter.addListener('onHandLandmarksDetected', (event) => {
      const now = Date.now();
      if (now - lastEventTime.current < 50) return;
      lastEventTime.current = now;

      if (!event.landmarks || event.landmarks.length === 0) {
        setHasHand(false);
        setDetectedChar('');
        return;
      }

      setHasHand(true);

      // Skip sending during 429 cooldown
      if (now < rateLimitUntil.current) return;

      if (!isSending.current && (now - lastApiCall.current > THROTTLE_MS)) {
        const handsDetected = event.landmarks.slice(0, 2);
        if (handsDetected.length === 0) return;

        const hand = handsDetected[0];
        const singleFramePoints: number[][] = [];

        hand.slice(0, 21).forEach((lm: any) => {
          const x = Math.round(lm.x * 1000) / 1000;
          const y = Math.round(lm.y * 1000) / 1000;
          const z = Math.round((lm.z ?? 0) * 1000) / 1000;
          singleFramePoints.push([x, y, z]);
        });

        if (singleFramePoints.length === 21) {
          lastApiCall.current = now;
          sendToBackend([singleFramePoints]);
        }
      }
    });

    return () => sub.remove();
  }, []);

  const sendToBackend = async (frames: number[][][]) => {
    if (isSending.current) return;
    isSending.current = true;
    setIsProcessing(true);

    try {
      const res = await privateApi.post('/ai/alphabet', { frames });
      const data = res.data;
      if (data && data.label && data.confidence >= MIN_CONFIDENCE) {
        onResult(data.label);
        setDetectedChar(data.label);
        setStatusMsg(`${(data.confidence * 100).toFixed(0)}%`);
      }
    } catch (e: any) {
      if (e?.response?.status === 429) {
        rateLimitUntil.current = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        setStatusMsg(t('camera.rateLimited') ?? 'Đang chờ...');
        setTimeout(() => setStatusMsg(''), RATE_LIMIT_COOLDOWN_MS);
      }
    } finally {
      isSending.current = false;
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
