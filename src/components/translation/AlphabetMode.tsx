import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, NativeEventEmitter, NativeModules, ActivityIndicator } from 'react-native';
import { privateApi } from '@/api/privateApi';

const THROTTLE_MS = 800; 

const { HandLandmarks } = NativeModules;
const eventEmitter = new NativeEventEmitter(HandLandmarks);

type Props = {
  onResult: (text: string) => void;
  theme: any;
};

export default function AlphabetMode({ onResult, theme }: Props) {
  const [statusMsg, setStatusMsg] = useState('Đang quét...');
  const [detectedChar, setDetectedChar] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasHand, setHasHand] = useState(false);

  const isSending = useRef(false);
  const lastEventTime = useRef(0);
  const lastApiCall = useRef(0);

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
            const payload3D = [singleFramePoints];
            sendToBackend(payload3D);
        }
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  const sendToBackend = async (frames: number[][][]) => {
    if (isSending.current) return;
    isSending.current = true;
    setIsProcessing(true);

    try {
      const res = await privateApi.post('/ai/alphabet', { 
          frames: frames 
      });
      
      const data = res.data;
      if (data && data.label) {
        onResult(data.label);
        setDetectedChar(data.label);
        setStatusMsg(`Độ tin cậy: ${(data.confidence * 100).toFixed(0)}%`);
      }
    } catch (e: any) {
       // console.log("Err");
    } finally {
      isSending.current = false;
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.statusBox, !hasHand && styles.statusBoxWarning]}>
          {!hasHand ? (
              <Text style={styles.statusText}>⚠️ Không thấy tay</Text>
          ) : (
              <View style={styles.resultContainer}>
                  {detectedChar ? (
                      <Text style={[styles.largeChar, { color: theme.primary }]}>{detectedChar}</Text>
                  ) : (
                      <ActivityIndicator size="small" color={theme.primary} />
                  )}
                  
                  <View style={styles.infoColumn}>
                      <Text style={styles.modeTitle}>Chế độ Chữ cái</Text>
                      <Text style={styles.subText}>
                          {detectedChar ? statusMsg : "Đang phân tích..."}
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
    justifyContent: 'center'
  },
  statusBoxWarning: {
      borderColor: '#F87171',
      backgroundColor: 'rgba(239, 68, 68, 0.4)'
  },
  statusText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  resultContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16
  },
  largeChar: {
      fontSize: 36,
      fontWeight: 'bold',
  },
  infoColumn: {
      justifyContent: 'center'
  },
  modeTitle: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 14
  },
  subText: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 12,
      marginTop: 2
  }
});