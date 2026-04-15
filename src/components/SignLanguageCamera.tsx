// // import React, { useState, useEffect, useRef } from 'react';
// // import {
// //   View,
// //   Text,
// //   TouchableOpacity,
// //   ScrollView,
// //   StyleSheet,
// //   NativeEventEmitter,
// //   NativeModules,
// //   Dimensions,
// //   ActivityIndicator,
// //   TextInput,
// // } from 'react-native';
// // import {
// //   Camera,
// //   useCameraDevice,
// //   useCameraPermission,
// //   VisionCameraProxy,
// //   useCameraFormat,
// //   useFrameProcessor
// // } from 'react-native-vision-camera';
// // import { Ionicons } from '@expo/vector-icons';
// // import HandLandmarksCanvas from '@/components/HandLandmarksCanvas';
// // import { privateApi } from '@/api/privateApi';

// // const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// // const SEQ_LEN = 24;
// // const FRAME_SKIP = 2;
// // const MIN_CONFIDENCE = 0.55;

// // const { HandLandmarks } = NativeModules;
// // const eventEmitter = new NativeEventEmitter(HandLandmarks);
// // const plugin = VisionCameraProxy.initFrameProcessorPlugin('hands_landmark', {});

// // type LandmarkPoint = { x: number; y: number; z?: number };

// // interface SignLanguageCameraProps {
// //   onClose: () => void;
// //   onTranslationUpdate: (text: string) => void;
// //   theme: any;
// //   showTranslationBox?: boolean;
// //   autoFocusInput?: boolean;
// // }

// // export default function SignLanguageCamera({
// //   onClose,
// //   onTranslationUpdate,
// //   theme,
// //   showTranslationBox = true,
// //   autoFocusInput = true
// // }: SignLanguageCameraProps) {
// //   const [signTranslation, setSignTranslation] = useState('');
// //   const [isProcessing, setIsProcessing] = useState(false);
// //   const [isRecording, setIsRecording] = useState(false);
// //   const isRecordingRef = useRef(false);
// //   const [countdown, setCountdown] = useState(0);
// //   const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

// //   const [handLandmarks, setHandLandmarks] = useState<LandmarkPoint[][]>([]);
// //   const [statusMsg, setStatusMsg] = useState('Sẵn sàng');
// //   const [handCount, setHandCount] = useState(0);
// //   const keypointsBuffer = useRef<number[][]>([]);
// //   const isSending = useRef(false);
// //   const frameCounter = useRef(0);
// //   const lastEventTime = useRef(0);

// //   const hiddenInputRef = useRef<TextInput>(null);

// //   const device = useCameraDevice('back');
// //   const format = useCameraFormat(device, [
// //     { videoResolution: { width: 640, height: 480 } },
// //     { fps: 30 }
// //   ]);
// //   const { hasPermission } = useCameraPermission();

// //   useEffect(() => {
// //     try {
// //       if (HandLandmarks?.initModel) HandLandmarks.initModel();
// //     } catch (err) { 
// //       console.error(err); 
// //     }
// //   }, []);

// //   useEffect(() => {
// //     if (autoFocusInput) {
// //       const interval = setInterval(() => {
// //         if (!hiddenInputRef.current?.isFocused()) {
// //           hiddenInputRef.current?.focus();
// //         }
// //       }, 2000);
// //       return () => clearInterval(interval);
// //     }
// //   }, [autoFocusInput]);

// //   const startRecordingFlow = () => {
// //     if (isRecording || isProcessing || countdown > 0) return;
    
// //     if (handCount === 0) {
// //       setStatusMsg("Đưa tay vào trước khi bấm");
// //       return;
// //     }

// //     setCountdown(3);
// //     let count = 3;
// //     countdownTimer.current = setInterval(() => {
// //       count--;
// //       setCountdown(count);
// //       if (count === 0) {
// //         if (countdownTimer.current) clearInterval(countdownTimer.current);
// //         keypointsBuffer.current = [];
// //         isRecordingRef.current = true;
// //         setIsRecording(true);
// //       }
// //     }, 1000);
// //   };

// //   useEffect(() => {
// //     const sub = eventEmitter.addListener('onHandLandmarksDetected', (event) => {
// //       const now = Date.now();
// //       if (now - lastEventTime.current < 100) return;
// //       lastEventTime.current = now;

// //       if (!event.landmarks || event.landmarks.length === 0) {
// //         setHandLandmarks([]);
// //         setHandCount(0);
// //         setStatusMsg('Không thấy tay');
// //         return;
// //       }

// //       try {
// //         const handsDetected = event.landmarks.slice(0, 2);
// //         setHandLandmarks(handsDetected);
// //         setHandCount(handsDetected.length);

// //         if (handsDetected.length > 0) {
// //           setStatusMsg(isRecordingRef.current
// //             ? `Đang ghi (${keypointsBuffer.current.length}/${SEQ_LEN})`
// //             : countdown > 0 
// //               ? `Chuẩn bị ${countdown}` 
// //               : `Sẵn sàng`);
// //         }

// //         if (!isRecordingRef.current) return;

// //         let frameVector = new Array(126).fill(0);
// //         handsDetected.forEach((hand: any[], handIndex: number) => {
// //           const offset = handIndex * 63;
// //           hand.slice(0, 21).forEach((lm: any, lmIndex: number) => {
// //             const basePos = offset + lmIndex * 3;
// //             frameVector[basePos] = Math.round(lm.x * 100) / 100;
// //             frameVector[basePos + 1] = Math.round(lm.y * 100) / 100;
// //             frameVector[basePos + 2] = Math.round((lm.z ?? 0) * 100) / 100;
// //           });
// //         });

// //         const currentBuffer = keypointsBuffer.current;
// //         currentBuffer.push(frameVector);
// //         if (currentBuffer.length > SEQ_LEN) currentBuffer.shift();

// //         if (currentBuffer.length === SEQ_LEN && !isSending.current) {
// //           sendToBackend([...currentBuffer]);
// //         }
// //       } catch (error) { 
// //         console.error(error); 
// //       }
// //     });
// //     return () => sub.remove();
// //   }, [countdown]);

// //   const sendToBackend = async (frames: number[][]) => {
// //     if (isSending.current) return;
// //     isSending.current = true;
// //     setIsProcessing(true);
// //     try {
// //       const res = await privateApi.post('/ai/tcn-recognize', { frames });
// //       const data = res.data;
// //       if (data.label && data.probability >= MIN_CONFIDENCE) {
// //         const newTranslation = signTranslation 
// //           ? `${signTranslation} ${data.label}` 
// //           : data.label;
        
// //         const words = signTranslation.trim().split(' ');
// //         if (words[words.length - 1] !== data.label) {
// //           setSignTranslation(newTranslation);
// //           onTranslationUpdate(newTranslation);
// //         }
// //       }
// //     } catch (e) { 
// //       console.error(e); 
// //     } finally {
// //       keypointsBuffer.current = [];
// //       isRecordingRef.current = false;
// //       setIsRecording(false);
// //       setTimeout(() => {
// //         isSending.current = false;
// //         setIsProcessing(false);
// //         if (autoFocusInput) {
// //           hiddenInputRef.current?.focus();
// //         }
// //       }, 200);
// //     }
// //   };

// //   const frameProcessor = useFrameProcessor((frame) => {
// //     'worklet';
// //     frameCounter.current++;
// //     if (frameCounter.current % FRAME_SKIP !== 0) return;
// //     if (plugin != null) plugin.call(frame);
// //   }, []);

// //   const handleClearTranslation = () => {
// //     setSignTranslation('');
// //     onTranslationUpdate('');
// //   };

// //   if (!hasPermission || !device) {
// //     return (
// //       <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
// //         <ActivityIndicator size="large" color={theme.primary} />
// //         <Text style={{ color: theme.text, marginTop: 10 }}>Đang khởi tạo Camera...</Text>
// //       </View>
// //     );
// //   }

// //   return (
// //     <View style={styles.cameraContainer}>
// //       {autoFocusInput && (
// //         <TextInput
// //           ref={hiddenInputRef}
// //           style={styles.hiddenInput}
// //           autoFocus={true}
// //           showSoftInputOnFocus={false}
// //           onSubmitEditing={() => startRecordingFlow()}
// //           onChangeText={(t) => {
// //             if(t.length > 0) {
// //                 startRecordingFlow();
// //                 hiddenInputRef.current?.clear();
// //             }
// //           }}
// //           onKeyPress={({ nativeEvent }) => {
// //             if (nativeEvent.key === ' ' || nativeEvent.key === 'Enter') {
// //               startRecordingFlow();
// //             }
// //           }}
// //         />
// //       )}

// //       <Camera
// //         style={StyleSheet.absoluteFill}
// //         device={device}
// //         format={format}
// //         fps={30}
// //         isActive={true}
// //         frameProcessor={frameProcessor}
// //         pixelFormat="yuv"
// //         resizeMode="cover"
// //       />

// //       <HandLandmarksCanvas 
// //         landmarks={handLandmarks} 
// //         width={SCREEN_WIDTH} 
// //         height={SCREEN_HEIGHT} 
// //       />

// //       <View style={styles.cameraHeader}>
// //         <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
// //           <Ionicons name="close" size={28} color={theme.white} />
// //         </TouchableOpacity>
// //         <View style={styles.cameraStatusTag}>
// //           <Text style={styles.cameraStatusText}>{statusMsg}</Text>
// //         </View>
// //       </View>

// //       {countdown > 0 && (
// //         <View style={styles.countdownOverlay}>
// //           <Text style={[styles.countdownText, { color: theme.primary }]}>
// //             {countdown}
// //           </Text>
// //         </View>
// //       )}

// //       <View style={styles.cameraBottomControls}>
// //         {showTranslationBox && (
// //           <View style={[styles.translationResultBox, { borderLeftColor: theme.primary }]}>
// //             <Text style={[styles.resultLabel, { color: theme.primary }]}>DỊCH:</Text>
// //             <ScrollView horizontal showsHorizontalScrollIndicator={false}>
// //               <Text style={styles.resultText}>{signTranslation || "..."}</Text>
// //             </ScrollView>
// //             <TouchableOpacity 
// //               onPress={handleClearTranslation} 
// //               style={{ alignSelf: 'flex-end' }}
// //             >
// //               <Text style={{ color: theme.primary, fontSize: 12 }}>Xóa</Text>
// //             </TouchableOpacity>
// //           </View>
// //         )}

// //         <TouchableOpacity
// //           onPress={startRecordingFlow}
// //           disabled={isProcessing || isRecording || countdown > 0}
// //           style={[
// //             styles.recordBtn,
// //             { backgroundColor: theme.primary },
// //             (isRecording || countdown > 0) && styles.recordingActive,
// //             handCount === 0 && styles.recordDisabled
// //           ]}
// //         >
// //           {isProcessing ? (
// //             <ActivityIndicator color={theme.white} />
// //           ) : (
// //             <Ionicons 
// //               name={isRecording ? "stop" : "videocam"} 
// //               size={32} 
// //               color={theme.white} 
// //             />
// //           )}
// //         </TouchableOpacity>
// //       </View>
// //     </View>
// //   );
// // }

// // const styles = StyleSheet.create({
// //   cameraContainer: {
// //     flex: 1,
// //     backgroundColor: 'black'
// //   },
// //   centerContainer: {
// //     flex: 1,
// //     justifyContent: 'center',
// //     alignItems: 'center'
// //   },
// //   hiddenInput: {
// //     position: 'absolute',
// //     opacity: 0,
// //     width: 1,
// //     height: 1,
// //     zIndex: -1
// //   },
// //   cameraHeader: {
// //     position: 'absolute',
// //     top: 50,
// //     left: 20,
// //     right: 20,
// //     flexDirection: 'row',
// //     justifyContent: 'space-between',
// //     alignItems: 'center',
// //     zIndex: 10
// //   },
// //   closeBtn: {
// //     width: 40,
// //     height: 40,
// //     borderRadius: 20,
// //     backgroundColor: 'rgba(0,0,0,0.5)',
// //     justifyContent: 'center',
// //     alignItems: 'center'
// //   },
// //   cameraStatusTag: {
// //     paddingHorizontal: 12,
// //     paddingVertical: 6,
// //     backgroundColor: 'rgba(0,0,0,0.5)',
// //     borderRadius: 8
// //   },
// //   cameraStatusText: {
// //     color: 'white',
// //     fontWeight: 'bold'
// //   },
// //   cameraBottomControls: {
// //     position: 'absolute',
// //     bottom: 40,
// //     left: 0,
// //     right: 0,
// //     alignItems: 'center',
// //     paddingHorizontal: 20
// //   },
// //   translationResultBox: {
// //     width: '100%',
// //     backgroundColor: 'rgba(65,65,65,0.85)',
// //     padding: 16,
// //     borderRadius: 16,
// //     marginBottom: 20,
// //     borderLeftWidth: 4
// //   },
// //   resultLabel: {
// //     fontSize: 12,
// //     fontWeight: 'bold'
// //   },
// //   resultText: {
// //     color: 'white',
// //     fontSize: 20,
// //     fontWeight: 'bold',
// //     marginVertical: 4
// //   },
// //   recordBtn: {
// //     width: 72,
// //     height: 72,
// //     borderRadius: 36,
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //     borderWidth: 4,
// //     borderColor: 'rgba(255,255,255,0.3)'
// //   },
// //   recordingActive: {
// //     backgroundColor: '#ff4757',
// //     borderColor: 'white'
// //   },
// //   recordDisabled: {
// //     backgroundColor: '#ccc',
// //     borderColor: '#999'
// //   },
// //   countdownOverlay: {
// //     ...StyleSheet.absoluteFillObject,
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //     backgroundColor: 'rgba(0,0,0,0.4)',
// //     zIndex: 20
// //   },
// //   countdownText: {
// //     fontSize: 100,
// //     fontWeight: 'bold'
// //   }
// // });
// import React, { useState, useEffect, useRef } from 'react';
// import {
//   View,
//   Text,
//   TouchableOpacity,
//   ScrollView,
//   StyleSheet,
//   NativeEventEmitter,
//   NativeModules,
//   Dimensions,
//   ActivityIndicator,
//   TextInput,
// } from 'react-native';
// import {
//   Camera,
//   useCameraDevice,
//   useCameraPermission,
//   VisionCameraProxy,
//   useCameraFormat,
//   useFrameProcessor,
// } from 'react-native-vision-camera';
// import { Ionicons } from '@expo/vector-icons';
// import HandLandmarksCanvas from '@/components/HandLandmarksCanvas';
// import { privateApi } from '@/api/privateApi';

// const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// const SEQ_LEN = 24;
// const FRAME_SKIP = 2;
// const MIN_CONFIDENCE = 0.55;

// const handLandmarksModule = NativeModules.HandLandmarks;
// const eventEmitter = handLandmarksModule
//   ? new NativeEventEmitter(handLandmarksModule)
//   : null;
// const plugin = VisionCameraProxy.initFrameProcessorPlugin('hands_landmark', {});

// type LandmarkPoint = { x: number; y: number; z?: number };

// interface SignLanguageCameraProps {
//   onClose: () => void;
//   onTranslationUpdate: (text: string) => void;
//   theme: any;
//   showTranslationBox?: boolean;
//   autoFocusInput?: boolean;
// }

// export default function SignLanguageCamera({
//   onClose,
//   onTranslationUpdate,
//   theme,
//   showTranslationBox = true,
//   autoFocusInput = true
// }: SignLanguageCameraProps) {
//   const [signTranslation, setSignTranslation] = useState('');
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [isRecording, setIsRecording] = useState(false);
//   const isRecordingRef = useRef(false);
//   const [countdown, setCountdown] = useState(0);
//   const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

//   const [handLandmarks, setHandLandmarks] = useState<LandmarkPoint[][]>([]);
//   const [statusMsg, setStatusMsg] = useState('Sẵn sàng');
//   const [handCount, setHandCount] = useState(0);
//   const keypointsBuffer = useRef<number[][]>([]);
//   const isSending = useRef(false);
//   const frameCounter = useRef(0);
//   const lastEventTime = useRef(0);

//   const hiddenInputRef = useRef<TextInput>(null);

//   // ========== FIX: Thêm state để track initialization ==========
//   const [isInitializing, setIsInitializing] = useState(true);
//   const [initError, setInitError] = useState<string | null>(null);
//   const [cameraDevicesReady, setCameraDevicesReady] = useState(false);

//   const backDevice = useCameraDevice('back');
//   const frontDevice = useCameraDevice('front');
  
//   // Thử dùng camera  trước, nếu không có thì dùng camera sau
//   const device = frontDevice ?? backDevice;
  
//   const format = useCameraFormat(device, [
//     { videoResolution: { width: 640, height: 480 } },
//     { fps: 30 }
//   ]);
//   const { hasPermission, requestPermission } = useCameraPermission();

//   // ========== FIX: Effect để xử lý initialization ==========
//   useEffect(() => {
//   let isMounted = true;

//   const initCamera = async () => {
//     try {
//       console.log('=== Camera Init Start ===');
//       console.log('hasPermission:', hasPermission);

//       // 1. Nếu chưa xin quyền bao giờ hoặc bị từ chối
//       if (hasPermission === false) {
//         console.log('Requesting permission...');
//         const granted = await requestPermission();
//         console.log('Permission granted:', granted);

//         if (!granted && isMounted) {
//           setInitError('permission-denied');
//           setIsInitializing(false);
//           return;
//         }

//         // Sau khi xin quyền xong, hook hasPermission sẽ đổi sang true
//         // lần render tiếp theo initCamera sẽ chạy lại với hasPermission === true
//         return;
//       }

//       // 2. Nếu đã có quyền
//       if (hasPermission === true) {
//         console.log('Permission OK, waiting for device from hook...');
//         // Lúc này cứ để `useCameraDevice` lo phần device
//         if (device) {
//           console.log('Device ready!');
//           if (isMounted) {
//             setIsInitializing(false);
//             setInitError(null);
//           }
//         } else {
//           console.log('Device is null, but permission is granted. Waiting...');
//           // Nếu muốn hard-timeout (vd 3s) thì setTimeout ở đây cũng được
//           setTimeout(() => {
//             if (isMounted && !device) {
//               setInitError('device-not-found');
//               setIsInitializing(false);
//             }
//           }, 3000);
//         }
//       }
//     } catch (error) {
//       console.error('Camera init error:', error);
//       if (isMounted) {
//         setInitError('init-failed');
//         setIsInitializing(false);
//       }
//     }
//   };

//   initCamera();

//   return () => {
//     isMounted = false;
//   };
//   }, [hasPermission, device, requestPermission]);


//   useEffect(() => {
//   if (hasPermission !== true) {
//     // Chưa có quyền thì KHÔNG đụng tới Camera.getAvailableCameraDevices
//     return;
//   }

//   const logCameras = async () => {
//     try {
//       const devices = await Camera.getAvailableCameraDevices();
//       console.log('Available cameras:', devices.length);

//       devices.forEach((d, i) => {
//         console.log(`Camera ${i}:`, {
//           position: d.position,
//           name: d.name,
//           hasFlash: d.hasFlash,
//           hasTorch: d.hasTorch,
//         });
//       });

//       if (devices.length > 0) {
//         setCameraDevicesReady(true);
//       } else {
//         // Nếu đã có permission mà vẫn 0 devices -> có thể là emulator không có camera
//         console.log('No camera devices found even after permission granted');
//       }
//     } catch (err) {
//       console.error('Error getting cameras:', err);
//     }
//   };

//   logCameras();

//   // Nếu muốn retry cũng chỉ retry SAU khi có permission
//   const retryTimer = setTimeout(() => {
//     logCameras();
//   }, 1000);

//   return () => clearTimeout(retryTimer);
// }, [hasPermission]);


//   useEffect(() => {
//     if (autoFocusInput) {
//       const interval = setInterval(() => {
//         if (!hiddenInputRef.current?.isFocused()) {
//           hiddenInputRef.current?.focus();
//         }
//       }, 2000);
//       return () => clearInterval(interval);
//     }
//   }, [autoFocusInput]);

//   const startRecordingFlow = () => {
//     if (isRecording || isProcessing || countdown > 0) return;
    
//     if (handCount === 0) {
//       setStatusMsg("Đưa tay vào trước khi bấm");
//       return;
//     }

//     setCountdown(3);
//     let count = 3;
//     countdownTimer.current = setInterval(() => {
//       count--;
//       setCountdown(count);
//       if (count === 0) {
//         if (countdownTimer.current) clearInterval(countdownTimer.current);
//         keypointsBuffer.current = [];
//         isRecordingRef.current = true;
//         setIsRecording(true);
//       }
//     }, 1000);
//   };

//   useEffect(() => {
//     if (!eventEmitter) {
//     console.warn('[HandLandmarks] Native module not found');
//     return;
//   }
//     const sub = eventEmitter.addListener('onHandLandmarksDetected', (event) => {
//       const now = Date.now();
//       if (now - lastEventTime.current < 100) return;
//       lastEventTime.current = now;

//       if (!event.landmarks || event.landmarks.length === 0) {
//         setHandLandmarks([]);
//         setHandCount(0);
//         setStatusMsg('Không thấy tay');
//         return;
//       }

//       try {
//         const handsDetected = event.landmarks.slice(0, 2);
//         setHandLandmarks(handsDetected);
//         setHandCount(handsDetected.length);

//         if (handsDetected.length > 0) {
//           setStatusMsg(isRecordingRef.current
//             ? `Đang ghi (${keypointsBuffer.current.length}/${SEQ_LEN})`
//             : countdown > 0 
//               ? `Chuẩn bị ${countdown}` 
//               : `Sẵn sàng`);
//         }

//         if (!isRecordingRef.current) return;

//         let frameVector = new Array(126).fill(0);
//         handsDetected.forEach((hand: any[], handIndex: number) => {
//           const offset = handIndex * 63;
//           hand.slice(0, 21).forEach((lm: any, lmIndex: number) => {
//             const basePos = offset + lmIndex * 3;
//             frameVector[basePos] = Math.round(lm.x * 100) / 100;
//             frameVector[basePos + 1] = Math.round(lm.y * 100) / 100;
//             frameVector[basePos + 2] = Math.round((lm.z ?? 0) * 100) / 100;
//           });
//         });

//         const currentBuffer = keypointsBuffer.current;
//         currentBuffer.push(frameVector);
//         if (currentBuffer.length > SEQ_LEN) currentBuffer.shift();

//         if (currentBuffer.length === SEQ_LEN && !isSending.current) {
//           sendToBackend([...currentBuffer]);
//         }
//       } catch (error) { 
//         console.error(error); 
//       }
//     });
//     return () => sub.remove();
//   }, [countdown]);

//   const sendToBackend = async (frames: number[][]) => {
//     if (isSending.current) return;
//     isSending.current = true;
//     setIsProcessing(true);
//     try {
//       const res = await privateApi.post('/ai/tcn-recognize', { frames });
//       const data = res.data;
//       if (data.label && data.probability >= MIN_CONFIDENCE) {
//         const newTranslation = signTranslation 
//           ? `${signTranslation} ${data.label}` 
//           : data.label;
        
//         const words = signTranslation.trim().split(' ');
//         if (words[words.length - 1] !== data.label) {
//           setSignTranslation(newTranslation);
//           onTranslationUpdate(newTranslation);
//         }
//       }
//     } catch (e) { 
//       console.error(e); 
//     } finally {
//       keypointsBuffer.current = [];
//       isRecordingRef.current = false;
//       setIsRecording(false);
//       setTimeout(() => {
//         isSending.current = false;
//         setIsProcessing(false);
//         if (autoFocusInput) {
//           hiddenInputRef.current?.focus();
//         }
//       }, 200);
//     }
//   };

//   const frameProcessor = useFrameProcessor((frame) => {
//     'worklet';
//     frameCounter.current++;
//     if (frameCounter.current % FRAME_SKIP !== 0) return;
//     if (plugin != null) plugin.call(frame);
//   }, []);

//   const handleClearTranslation = () => {
//     setSignTranslation('');
//     onTranslationUpdate('');
//   };

//   const handleRetry = () => {
//     setIsInitializing(true);
//     setInitError(null);
//   };

//   // ========== FIX: Render các trạng thái lỗi cụ thể ==========
//   if (initError === 'permission-denied') {
//     return (
//       <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
//         <Ionicons name="camera-outline" size={64} color={theme.text} style={{ opacity: 0.5 }} />
//         <Text style={[styles.errorTitle, { color: theme.text }]}>
//           Cần quyền truy cập camera
//         </Text>
//         <Text style={[styles.errorSubtitle, { color: theme.textSecondary }]}>
//           Vui lòng cấp quyền camera để sử dụng tính năng này
//         </Text>
//         <TouchableOpacity 
//           onPress={async () => {
//             setInitError(null);
//             setIsInitializing(true);
//             await requestPermission();
//           }}
//           style={[styles.retryButton, { backgroundColor: theme.primary }]}
//         >
//           <Text style={styles.retryButtonText}>Cấp quyền</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   if (initError === 'device-not-found' || initError === 'init-failed') {
//     return (
//       <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
//         <Ionicons name="alert-circle" size={64} color={theme.primary} style={{ opacity: 0.5 }} />
//         <Text style={[styles.errorTitle, { color: theme.text }]}>
//           Không thể khởi tạo camera
//         </Text>
//         <Text style={[styles.errorSubtitle, { color: theme.textSecondary }]}>
//           {initError === 'device-not-found' 
//             ? 'Không tìm thấy thiết bị camera' 
//             : 'Có lỗi xảy ra khi khởi tạo'}
//         </Text>
//         <TouchableOpacity 
//           onPress={handleRetry}
//           style={[styles.retryButton, { backgroundColor: theme.primary }]}
//         >
//           <Text style={styles.retryButtonText}>Thử lại</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   // ========== FIX: Hiển thị loading khi đang init ==========
//   if (isInitializing) {
//     return (
//       <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
//         <ActivityIndicator size="large" color={theme.primary} />
//         <Text style={{ color: theme.text, marginTop: 10 }}>
//           Đang khởi tạo Camera...
//         </Text>
//         <Text style={{ color: theme.textSecondary, marginTop: 4, fontSize: 12 }}>
//           {hasPermission === undefined && 'Đang kiểm tra quyền...'}
//           {hasPermission === false && 'Đang yêu cầu quyền...'}
//           {hasPermission === true && !device && 'Đang tìm thiết bị camera...'}
//         </Text>
//       </View>
//     );
//   }

//   // Kiểm tra lại lần cuối trước khi render camera
//   if (!device || hasPermission !== true) {
//     return (
//       <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
//         <Ionicons name="alert-circle" size={64} color={theme.primary} style={{ opacity: 0.5 }} />
//         <Text style={[styles.errorTitle, { color: theme.text }]}>
//           Không thể khởi động camera
//         </Text>
//         <Text style={[styles.errorSubtitle, { color: theme.textSecondary }]}>
//           {!device && 'Không tìm thấy camera trên thiết bị'}
//           {device && hasPermission !== true && 'Chưa có quyền truy cập'}
//         </Text>
//         <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 8 }}>
//           Debug: back={backDevice ? '✓' : '✗'} front={frontDevice ? '✓' : '✗'}
//         </Text>
//         <TouchableOpacity 
//           onPress={handleRetry}
//           style={[styles.retryButton, { backgroundColor: theme.primary }]}
//         >
//           <Text style={styles.retryButtonText}>Thử lại</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   return (
//     <View style={styles.cameraContainer}>
//       {autoFocusInput && (
//         <TextInput
//           ref={hiddenInputRef}
//           style={styles.hiddenInput}
//           autoFocus={true}
//           showSoftInputOnFocus={false}
//           onSubmitEditing={() => startRecordingFlow()}
//           onChangeText={(t) => {
//             if(t.length > 0) {
//                 startRecordingFlow();
//                 hiddenInputRef.current?.clear();
//             }
//           }}
//           onKeyPress={({ nativeEvent }) => {
//             if (nativeEvent.key === ' ' || nativeEvent.key === 'Enter') {
//               startRecordingFlow();
//             }
//           }}
//         />
//       )}

//       <Camera
//         style={StyleSheet.absoluteFill}
//         device={device}
//         format={format}
//         fps={30}
//         isActive={true}
//         frameProcessor={frameProcessor}
//         pixelFormat="yuv"
//         resizeMode="cover"
//       />

//       <HandLandmarksCanvas 
//         landmarks={handLandmarks} 
//         width={SCREEN_WIDTH} 
//         height={SCREEN_HEIGHT} 
//       />

//       <View style={styles.cameraHeader}>
//         <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
//           <Ionicons name="close" size={28} color={theme.white} />
//         </TouchableOpacity>
//         <View style={styles.cameraStatusTag}>
//           <Text style={styles.cameraStatusText}>{statusMsg}</Text>
//         </View>
//       </View>

//       {countdown > 0 && (
//         <View style={styles.countdownOverlay}>
//           <Text style={[styles.countdownText, { color: theme.primary }]}>
//             {countdown}
//           </Text>
//         </View>
//       )}

//       <View style={styles.cameraBottomControls}>
//         {showTranslationBox && (
//           <View style={[styles.translationResultBox, { borderLeftColor: theme.primary }]}>
//             <Text style={[styles.resultLabel, { color: theme.primary }]}>DỊCH:</Text>
//             <ScrollView horizontal showsHorizontalScrollIndicator={false}>
//               <Text style={styles.resultText}>{signTranslation || "..."}</Text>
//             </ScrollView>
//             <TouchableOpacity 
//               onPress={handleClearTranslation} 
//               style={{ alignSelf: 'flex-end' }}
//             >
//               <Text style={{ color: theme.primary, fontSize: 12 }}>Xóa</Text>
//             </TouchableOpacity>
//           </View>
//         )}

//         <TouchableOpacity
//           onPress={startRecordingFlow}
//           disabled={isProcessing || isRecording || countdown > 0}
//           style={[
//             styles.recordBtn,
//             { backgroundColor: theme.primary },
//             (isRecording || countdown > 0) && styles.recordingActive,
//             handCount === 0 && styles.recordDisabled
//           ]}
//         >
//           {isProcessing ? (
//             <ActivityIndicator color={theme.white} />
//           ) : (
//             <Ionicons 
//               name={isRecording ? "stop" : "videocam"} 
//               size={32} 
//               color={theme.white} 
//             />
//           )}
//         </TouchableOpacity>
//       </View>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   cameraContainer: {
//     flex: 1,
//     backgroundColor: 'black'
//   },
//   centerContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingHorizontal: 40
//   },
//   errorTitle: {
//     fontSize: 18,
//     fontWeight: 'bold',
//     marginTop: 20,
//     textAlign: 'center'
//   },
//   errorSubtitle: {
//     fontSize: 14,
//     marginTop: 8,
//     textAlign: 'center',
//     lineHeight: 20
//   },
//   retryButton: {
//     marginTop: 24,
//     paddingHorizontal: 32,
//     paddingVertical: 12,
//     borderRadius: 8
//   },
//   retryButtonText: {
//     color: 'white',
//     fontWeight: 'bold',
//     fontSize: 16
//   },
//   hiddenInput: {
//     position: 'absolute',
//     opacity: 0,
//     width: 1,
//     height: 1,
//     zIndex: -1
//   },
//   cameraHeader: {
//     position: 'absolute',
//     top: 50,
//     left: 20,
//     right: 20,
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     zIndex: 10
//   },
//   closeBtn: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     justifyContent: 'center',
//     alignItems: 'center'
//   },
//   cameraStatusTag: {
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     borderRadius: 8
//   },
//   cameraStatusText: {
//     color: 'white',
//     fontWeight: 'bold'
//   },
//   cameraBottomControls: {
//     position: 'absolute',
//     bottom: 40,
//     left: 0,
//     right: 0,
//     alignItems: 'center',
//     paddingHorizontal: 20
//   },
//   translationResultBox: {
//     width: '100%',
//     backgroundColor: 'rgba(65,65,65,0.85)',
//     padding: 16,
//     borderRadius: 16,
//     marginBottom: 20,
//     borderLeftWidth: 4
//   },
//   resultLabel: {
//     fontSize: 12,
//     fontWeight: 'bold'
//   },
//   resultText: {
//     color: 'white',
//     fontSize: 20,
//     fontWeight: 'bold',
//     marginVertical: 4
//   },
//   recordBtn: {
//     width: 72,
//     height: 72,
//     borderRadius: 36,
//     justifyContent: 'center',
//     alignItems: 'center',
//     borderWidth: 4,
//     borderColor: 'rgba(255,255,255,0.3)'
//   },
//   recordingActive: {
//     backgroundColor: '#ff4757',
//     borderColor: 'white'
//   },
//   recordDisabled: {
//     backgroundColor: '#ccc',
//     borderColor: '#999'
//   },
//   countdownOverlay: {
//     ...StyleSheet.absoluteFillObject,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: 'rgba(0,0,0,0.4)',
//     zIndex: 20
//   },
//   countdownText: {
//     fontSize: 100,
//     fontWeight: 'bold'
//   }
// });
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Dimensions,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  VisionCameraProxy,
  useFrameProcessor,
  runAtTargetFps
} from 'react-native-vision-camera';
import { NativeModules, NativeEventEmitter } from 'react-native';
import HandLandmarksCanvas from '@/components/HandLandmarksCanvas';

const { HandLandmarks } = NativeModules;
const eventEmitter = HandLandmarks
  ? new NativeEventEmitter(HandLandmarks)
  : null;

const plugin = VisionCameraProxy.initFrameProcessorPlugin(
  'hands_landmark',
  {}
);
const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

type LandmarkPoint = { x: number; y: number; z?: number };

export default function SignLanguageCamera() {
  const { hasPermission, requestPermission } = useCameraPermission();

  // 🔑 luôn ưu tiên front → fallback back
  const front = useCameraDevice('front');
  const back = useCameraDevice('back');
  const device = front ?? back;

  const [handLandmarks, setHandLandmarks] = useState<LandmarkPoint[][]>([]);
  const [ready, setReady] = useState(false);

  const appState = useRef<AppStateStatus>(AppState.currentState);

  /* ========= Permission flow ========= */
  useEffect(() => {
    if (hasPermission === false) {
      requestPermission();
    }
  }, [hasPermission]);


  
  /* ========= Android FIX: wait for resume ========= */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (
        appState.current.match(/inactive|background/) &&
        next === 'active'
      ) {
        // khi user bấm Allow → app resume → VisionCamera mới có device
        setReady(false);
        setTimeout(() => setReady(true), 100);
      }
      appState.current = next;
    });

    return () => sub.remove();
  }, []);

  /* ========= Init native model ========= */
  useEffect(() => {
    try {
      HandLandmarks?.initModel?.();
    } catch {}
  }, []);

  /* ========= Listen landmarks ========= */
  useEffect(() => {
    if (!eventEmitter) return;

    const sub = eventEmitter.addListener(
      'onHandLandmarksDetected',
      (event) => {
        setHandLandmarks(event?.landmarks ?? []);
      }
    );

    return () => sub.remove();
  }, []);

  /* ========= Frame processor ========= */
 const frameProcessor = useFrameProcessor((frame) => {
  'worklet';

  runAtTargetFps(5, () => {
    if (!plugin) return;

    const landmarks = plugin.call(frame);
    // landmarks: LandmarkPoint[][]
  });
}, []);


  /* ========= Loading states ========= */
  if (hasPermission !== true) {
    return (
      <Loading text="Đang xin quyền camera..." />
    );
  }

  if (!device) {
    return (
      <Loading text="Đang khởi tạo camera..." />
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
        resizeMode="cover"
        isMirrored={false}
      />

      <HandLandmarksCanvas
        landmarks={handLandmarks}
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
      />
    </View>
  );
}

/* ========= UI ========= */
function Loading({ text }: { text: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#00afef" />
      <Text style={{ marginTop: 12 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  full: {
    width: '100%',
    height: '100%',
  },
});
