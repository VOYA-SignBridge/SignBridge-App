import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, NativeEventEmitter, NativeModules, ActivityIndicator } from 'react-native';
import { privateApi } from '@/api/privateApi';
import { Ionicons } from '@expo/vector-icons';

const SEQ_LEN = 48;
const MIN_CONFIDENCE = 0.55;

const { HandLandmarks } = NativeModules;
const eventEmitter = new NativeEventEmitter(HandLandmarks);

type Props = {
  onResult: (text: string) => void;
  theme: any; 
};

export default function WordMode({ onResult, theme }: Props) {
  const [statusMsg, setStatusMsg] = useState('Nhấn để bắt đầu');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [hasHand, setHasHand] = useState(false);

  const keypointsBuffer = useRef<number[][]>([]);
  const isSending = useRef(false);
  const lastEventTime = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handlePressRecord = () => {
    if (isRecording || isProcessing || countdown > 0) return;
    setCountdown(3); 
    setStatusMsg(""); 
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
    setIsRecording(true);
    setStatusMsg(`Đang thu: 0/${SEQ_LEN}`);
  };

  useEffect(() => {
    const sub = eventEmitter.addListener('onHandLandmarksDetected', (event) => {
      const now = Date.now();
      if (now - lastEventTime.current < 30) return;
      lastEventTime.current = now;

      if (!event.landmarks || event.landmarks.length === 0) {
        setHasHand(false);
        return;
      }
      setHasHand(true);

      if (!isRecording) return;

      try {
        const handsDetected = event.landmarks.slice(0, 2);
        let frameVector = new Array(126).fill(0);
        handsDetected.forEach((hand: any[], handIndex: number) => {
          const offset = handIndex * 63;
          hand.slice(0, 21).forEach((lm: any, lmIndex: number) => {
            const basePos = offset + lmIndex * 3;
            frameVector[basePos] = Math.round(lm.x * 100) / 100;
            frameVector[basePos + 1] = Math.round(lm.y * 100) / 100;
            frameVector[basePos + 2] = Math.round((lm.z ?? 0) * 100) / 100;
          });
        });

        const currentBuffer = keypointsBuffer.current;
        currentBuffer.push(frameVector);

        setStatusMsg(`Đang thu: ${currentBuffer.length}/${SEQ_LEN}`);

        if (currentBuffer.length >= SEQ_LEN) {
            setIsRecording(false);
            const framesToSend = currentBuffer.slice(0, SEQ_LEN);
            sendToBackend(framesToSend);
            keypointsBuffer.current = [];
        }

      } catch (error) { console.error(error); }
    });

    return () => {
      sub.remove();
    };
  }, [isRecording]);

  const sendToBackend = async (frames: number[][]) => {
    if (isSending.current) return;
    isSending.current = true;
    setIsProcessing(true);
    setStatusMsg("Đang dịch...");

    try {
      const res = await privateApi.post('/ai/tcn-recognize', { frames });
      const data = res.data;
      if (data.label && data.probability >= MIN_CONFIDENCE) {
        onResult(data.label);
        setStatusMsg(`Xong!`);
      } else {
        setStatusMsg("Không rõ");
      }
    } catch (e) {
      setStatusMsg("Lỗi mạng");
    } finally {
      isSending.current = false;
      setIsProcessing(false);
      setTimeout(() => {
          if (!isRecording && countdown === 0) setStatusMsg('Nhấn để bắt đầu');
      }, 1500);
    }
  };

  return (
    <View style={styles.container}>
      {!hasHand && (
          <View style={styles.warningBox}>
              <Text style={styles.warningText}>⚠️ Không thấy tay</Text>
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
            { 
                borderColor: 'rgba(255,255,255,0.8)',
                backgroundColor: theme.primary 
            },
            (isRecording || countdown > 0) && styles.recordingBtn 
        ]}
        onPress={handlePressRecord}
        disabled={isRecording || isProcessing || countdown > 0}
      >
        {isProcessing ? (
            <ActivityIndicator color="white" size="large" />
        ) : (
            <Ionicons name={isRecording ? "stop" : "videocam"} size={32} color="white" />
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
      fontSize: 12
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  recordingBtn: {
    backgroundColor: '#EF4444', 
    borderColor: '#FCA5A5'
  },
  statusText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: -1, height: 1},
    textShadowRadius: 10
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
      textShadowOffset: { width: 2, height: 2 }
  }
});