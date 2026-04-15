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
// import React, { useState, useEffect, useRef } from 'react';
// import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
// import { privateApi } from '@/api/privateApi';
// import { Ionicons } from '@expo/vector-icons';
// import { NativeEventEmitter, NativeModules } from 'react-native';

// const { HandLandmarks } = NativeModules;
// const eventEmitter = new NativeEventEmitter(HandLandmarks);

// const SEQ_LEN = 60;               // ← Nên đồng bộ với window lúc train (48 hoặc 60 là tốt)
// const MIN_FRAMES_TO_PREDICT = 20; // giống Python: max(8, window//3)
// const EMA_ALPHA = 0.7;            // giống Python smoothing ~0.7
// const THROTTLE_MS = 100;          // tránh gửi request quá dày

// type Props = {
//   onResult: (text: string) => void;
//   theme: any;
// };

// export default function RealtimeSignMode({ onResult, theme }: Props) {
//   const [statusMsg, setStatusMsg] = useState('Đang theo dõi...');
//   const [isActive, setIsActive] = useState(true); // bật/tắt theo dõi
//   const [hasHand, setHasHand] = useState(false);
//   const [currentLabel, setCurrentLabel] = useState('');
//   const [currentConf, setCurrentConf] = useState(0);

//   const buffer = useRef<number[][]>([]);           // buffer trượt
//   const emaProbs = useRef<number[] | null>(null);  // lưu EMA logits/probs
//   const lastSendTime = useRef(0);
//   const isSending = useRef(false);

//   // Xử lý frame từ native module
//   useEffect(() => {
//     const sub = eventEmitter.addListener('onHandFrame126', (event) => {
//       if (!isActive || !event?.frame || event.frame.length !== 126) return;

//       const frame: number[] = event.frame;
//       const handCount = event.handCount ?? 0;

//       if (handCount === 0) {
//         buffer.current = []; // ← Quan trọng: clear buffer khi mất tay (giống Python)
//         setHasHand(false);
//         setCurrentLabel('');
//         setCurrentConf(0);
//         return;
//       }

//       setHasHand(true);

//       // Thêm frame mới nhất vào buffer
//       buffer.current.push(frame);

//       // Giữ độ dài tối đa SEQ_LEN
//       if (buffer.current.length > SEQ_LEN) {
//         buffer.current.shift();
//       }

//       // Chỉ predict khi đủ frame tối thiểu & không spam request
//       const now = Date.now();
//       if (
//         buffer.current.length >= MIN_FRAMES_TO_PREDICT &&
//         now - lastSendTime.current >= THROTTLE_MS &&
//         !isSending.current
//       ) {
//         lastSendTime.current = now;
//         predictNow();
//       }

//       setStatusMsg(`Đang theo dõi: ${buffer.current.length}/${SEQ_LEN}`);
//     });

//     return () => sub.remove();
//   }, [isActive]);

//   const predictNow = async () => {
//     if (isSending.current) return;
//     isSending.current = true;

//     try {
//       // Chuẩn bị dữ liệu gửi lên backend (giống Python realtime)
//       const framesToSend = buffer.current.slice(-SEQ_LEN); // lấy các frame mới nhất

//       const res = await privateApi.post('/ai/tcn-recognize', { frames: framesToSend });
//       const { label, probability, raw_probs } = res.data;

//       // EMA smoothing giống Python demo
//       let finalProbs = raw_probs;
//       if (emaProbs.current) {
//         finalProbs = emaProbs.current.map((p, i) => 
//           EMA_ALPHA * p + (1 - EMA_ALPHA) * raw_probs[i]
//         );
//       }
//       emaProbs.current = finalProbs;

//       const maxIdx = finalProbs.indexOf(Math.max(...finalProbs));
//       const conf = finalProbs[maxIdx];

//       if (conf >= 0.55) {
//         setCurrentLabel(label);
//         setCurrentConf(conf);
//         onResult(label); // callback cho component cha
//       } else {
//         setCurrentLabel('');
//         setCurrentConf(0);
//       }
//     } catch (e) {
//       console.error('Predict error:', e);
//       setCurrentLabel('Lỗi');
//     } finally {
//       isSending.current = false;
//     }
//   };

//   return (
//     <View style={styles.container}>
//       {!hasHand && (
//         <View style={styles.warningBox}>
//           <Text style={styles.warningText}>⚠️ Không thấy tay</Text>
//         </View>
//       )}

//       <View style={styles.statusContainer}>
//         {currentLabel ? (
//           <Text style={[styles.resultText, { color: theme.primary }]}>
//             {currentLabel} ({(currentConf * 100).toFixed(0)}%)
//           </Text>
//         ) : (
//           <Text style={styles.statusText}>{statusMsg}</Text>
//         )}
//       </View>

//       <TouchableOpacity
//         style={[
//           styles.toggleBtn,
//           { backgroundColor: isActive ? '#EF4444' : theme.primary },
//         ]}
//         onPress={() => setIsActive(!isActive)}
//       >
//         {isActive ? (
//           <Ionicons name="pause" size={28} color="white" />
//         ) : (
//           <Ionicons name="play" size={28} color="white" />
//         )}
//       </TouchableOpacity>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     position: 'absolute',
//     bottom: 40,
//     alignSelf: 'center',
//     alignItems: 'center',
//     width: '100%',
//     zIndex: 10,
//   },
//   warningBox: {
//     position: 'absolute',
//     top: -40,
//     backgroundColor: 'rgba(239, 68, 68, 0.85)',
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderRadius: 12,
//   },
//   warningText: {
//     color: 'white',
//     fontWeight: 'bold',
//     fontSize: 14,
//   },
//   statusContainer: {
//     marginBottom: 12,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//     borderRadius: 12,
//   },
//   statusText: {
//     color: 'white',
//     fontSize: 15,
//     fontWeight: '600',
//   },
//   resultText: {
//     fontSize: 22,
//     fontWeight: 'bold',
//   },
//   toggleBtn: {
//     width: 64,
//     height: 64,
//     borderRadius: 32,
//     justifyContent: 'center',
//     alignItems: 'center',
//     elevation: 6,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.3,
//     shadowRadius: 5,
//   },
// });