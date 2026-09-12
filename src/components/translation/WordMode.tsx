import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, NativeEventEmitter, NativeModules, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  getTfliteModelConfig,
  predictWithTfliteModel,
  TFLITE_MODES,
  type TfliteModelConfig,
} from '@/config/tfliteModels';

const { HandLandmarks } = NativeModules;
const eventEmitter = new NativeEventEmitter(HandLandmarks);

type Props = {
  onResult: (text: string) => void;
  theme: any;
};

export default function WordMode({ onResult, theme }: Props) {
  const { t } = useTranslation();
  const [statusMsg, setStatusMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [hasHand, setHasHand] = useState(false);

  const keypointsBuffer = useRef<number[][]>([]);
  const isPredicting = useRef(false);
  const lastEventTime = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modelConfigRef = useRef<TfliteModelConfig | null>(null);
  const [modelConfig, setModelConfig] = useState<TfliteModelConfig | null>(null);
  // Sync ref: listener checks this directly — no stale closure, no listener gap when isRecording toggles
  const isRecordingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    getTfliteModelConfig(TFLITE_MODES.word)
      .then((config) => {
        if (!mounted) return;
        modelConfigRef.current = config;
        setModelConfig(config);
      })
      .catch(() => {
        if (mounted) setStatusMsg(t('camera.networkError'));
      });

    return () => {
      mounted = false;
    };
  }, [t]);

  const handlePressRecord = () => {
    if (!modelConfigRef.current || isRecordingRef.current || isProcessing || countdown > 0) return;
    setCountdown(3);
    setStatusMsg('');
  };

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            startRecordingNow();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [countdown === 3]);

  const startRecordingNow = () => {
    keypointsBuffer.current = [];
    isRecordingRef.current = true;
    setIsRecording(true);
    setStatusMsg(t('camera.recording', {
      current: 0,
      total: modelConfigRef.current?.sequenceLength ?? 0,
    }));
  };

  // Empty deps: single subscription for component lifetime, no listener gap on recording toggle
  useEffect(() => {
    const sub = eventEmitter.addListener('onHandLandmarksDetected', (event) => {
      setHasHand(!!event.landmarks && event.landmarks.length > 0);
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = eventEmitter.addListener('onHandFrame126', (event) => {
      const now = Date.now();
      if (now - lastEventTime.current < 30) return;
      lastEventTime.current = now;

      if (!isRecordingRef.current) return;

      try {
        const config = modelConfigRef.current;
        if (!config) return;

        const frameVector = Array.from(event.frame ?? []) as number[];
        if (frameVector.length !== config.featureDimension) return;

        const currentBuffer = keypointsBuffer.current;
        currentBuffer.push(frameVector);
        setStatusMsg(t('camera.recording', {
          current: currentBuffer.length,
          total: config.sequenceLength,
        }));

        if (currentBuffer.length >= config.sequenceLength) {
          isRecordingRef.current = false;
          setIsRecording(false);
          const framesToSend = currentBuffer.slice(0, config.sequenceLength);
          predictLocal(framesToSend);
          keypointsBuffer.current = [];
        }
      } catch (error) { console.error(error); }
    });

    return () => sub.remove();
  }, []);

  const predictLocal = async (frames: number[][]) => {
    if (isPredicting.current) return;
    isPredicting.current = true;
    setIsProcessing(true);
    setStatusMsg(t('camera.translating'));

    try {
      const data = await predictWithTfliteModel(frames, TFLITE_MODES.word);
      if (data?.label) {
        onResult(data.label);
        setStatusMsg(t('camera.done'));
      } else {
        setStatusMsg(t('translation.noData'));
      }
    } catch (e) {
      setStatusMsg(t('camera.networkError'));
    } finally {
      isPredicting.current = false;
      setIsProcessing(false);
      setTimeout(() => {
        if (!isRecordingRef.current) setStatusMsg(t('camera.pressToStart'));
      }, 1500);
    }
  };

  return (
    <View style={styles.container}>
      {!hasHand && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>{t('camera.noHand')}</Text>
        </View>
      )}

      {countdown > 0 && (
        <View style={styles.countdownOverlay}>
          <Text style={[styles.countdownText, { color: theme.primary }]}>{countdown}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.recordBtn,
          { borderColor: 'rgba(255,255,255,0.8)', backgroundColor: theme.primary },
          (isRecording || countdown > 0) && styles.recordingBtn,
        ]}
        onPress={handlePressRecord}
        disabled={isProcessing || !modelConfig}
      >
        {isProcessing ? (
          <ActivityIndicator color="white" size="large" />
        ) : (
          <Ionicons name={isRecording ? 'stop' : 'videocam'} size={32} color="white" />
        )}
      </TouchableOpacity>

      {!!statusMsg && <Text style={styles.statusText}>{statusMsg}</Text>}
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
  warningBox: {
    position: 'absolute',
    top: -40,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  warningText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  recordBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    marginBottom: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  recordingBtn: {
    backgroundColor: '#EF4444',
    borderColor: '#FCA5A5',
  },
  statusText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  countdownOverlay: {
    position: 'absolute',
    top: -250,
    alignSelf: 'center',
  },
  countdownText: {
    fontSize: 100,
    fontWeight: 'bold',
    textShadowColor: 'black',
    textShadowRadius: 10,
    textShadowOffset: { width: 2, height: 2 },
  },
});
