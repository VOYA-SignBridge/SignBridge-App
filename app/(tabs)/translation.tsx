// import React, { useState, useEffect, useRef } from 'react';
// import {
//   StyleSheet,
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   SafeAreaView,
//   Platform,
//   Alert,
//   Keyboard,
//   TouchableWithoutFeedback,
//   KeyboardAvoidingView,
//   ScrollView,
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { LinearGradient } from 'expo-linear-gradient';
// import { useTheme } from '../../contexts/ThemeContext';
// import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';

// export default function TranslationScreen() {
//   const [textToTranslate, setTextToTranslate] = useState('');
//   const [signTranslation, setSignTranslation] = useState('');
//   const { colors } = useTheme();

//   const [permission, requestPermission] = useCameraPermissions();
//   const [showCamera, setShowCamera] = useState(false);
//   const [cameraFacing, setCameraFacing] = useState<CameraType>('back');

//   const cameraRef = useRef(null);

//   const styles = getStyles(colors);

//   useEffect(() => {
//     if (!permission) return;
//     if (!permission.granted) requestPermission();
//   }, [permission]);

//   if (!permission) return <View style={styles.container} />;

//   if (!permission.granted) {
//     return (
//       <View style={styles.container}>
//         <TouchableOpacity onPress={requestPermission}>
//           <Text style={styles.textInput}>Grant Camera Permission</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   const handleCameraInput = () => setShowCamera(true);
//   const closeCamera = () => setShowCamera(false);
//   const flipCamera = () => setCameraFacing((prev: CameraType) => (prev === 'back' ? 'front' : 'back'));

//   if (showCamera) {
//     return (
//       <View style={{ flex: 1, backgroundColor: 'black' }}>
//         <CameraView style={{ flex: 1 }} ref={cameraRef} facing={cameraFacing} />

//         <View
//           style={{
//             position: 'absolute',
//             bottom: 30,
//             left: 20,
//             right: 20,
//             backgroundColor: '#0007',
//             padding: 20,
//             borderRadius: 12,
//             maxHeight: 150,
//           }}
//         >
//           <ScrollView>
//             <Text style={{ color: 'white', fontSize: 16 }}>
//               {signTranslation}
//             </Text>
//           </ScrollView>
//         </View>

//         <TouchableOpacity
//           onPress={closeCamera}
//           style={{
//             position: 'absolute',
//             top: 40,
//             right: 20,
//             backgroundColor: '#0008',
//             padding: 5,
//             borderRadius: 30,
//           }}
//         >
//           <Ionicons name="close" size={34} color="#fff" />
//         </TouchableOpacity>

//         <TouchableOpacity
//           onPress={flipCamera}
//           style={{
//             position: 'absolute',
//             top: 40,
//             left: 20,
//             backgroundColor: '#0008',
//             padding: 5,
//             borderRadius: 30,
//           }}
//         >
//           <Ionicons name="camera-reverse-outline" size={40} color="#fff" />
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   const handleVoiceInput = () => {
//     Alert.alert(
//       'Voice Input',
//       'Chức năng nhập liệu giọng nói sẽ được tích hợp.'
//     );
//   };

//   return (
//     <KeyboardAvoidingView
//       behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//       style={styles.flexContainer}
//     >
//       <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
//         <LinearGradient
//           colors={[colors.background, colors.background]}
//           style={styles.container}
//         >
//           <SafeAreaView style={styles.safeArea}>
//             <View style={styles.centerContent}>
//               <View style={styles.threeDModelPlaceholder}>
//                 <Text style={styles.threeDText}>3D Avatar Placeholder</Text>
//               </View>
//             </View>

//             <View style={styles.inputContainer}>
//               <TextInput
//                 style={styles.textInput}
//                 placeholder='Type to translate'
//                 placeholderTextColor={colors.mediumGray}
//                 value={textToTranslate}
//                 onChangeText={setTextToTranslate}
//               />

//               <TouchableOpacity
//                 onPress={handleCameraInput}
//                 style={styles.iconButton}
//               >
//                 <Ionicons
//                   name='camera-outline'
//                   size={28}
//                   color={colors.primary}
//                 />
//               </TouchableOpacity>

//               <TouchableOpacity
//                 onPress={handleVoiceInput}
//                 style={styles.iconButton}
//               >
//                 <Ionicons
//                   name='mic-outline'
//                   size={28}
//                   color={colors.primary}
//                 />
//               </TouchableOpacity>
//             </View>
//           </SafeAreaView>
//         </LinearGradient>
//       </TouchableWithoutFeedback>
//     </KeyboardAvoidingView>
//   );
// }

// const getStyles = (colors: any) =>
//   StyleSheet.create({
//     flexContainer: { flex: 1 },
//     container: { flex: 1 },
//     safeArea: {
//       flex: 1,
//       paddingTop: Platform.OS === 'android' ? 30 : 0,
//     },
//     centerContent: {
//       flex: 1,
//       justifyContent: 'center',
//       alignItems: 'center',
//     },
//     threeDModelPlaceholder: {
//       width: '80%',
//       height: '60%',
//       backgroundColor: colors.controlBG,
//       borderRadius: 10,
//       justifyContent: 'center',
//       alignItems: 'center',
//     },
//     threeDText: {
//       color: colors.text,
//       fontSize: 22,
//       fontWeight: 'bold',
//       textAlign: 'center',
//     },
//     inputContainer: {
//       flexDirection: 'row',
//       alignItems: 'center',
//       backgroundColor: colors.background,
//       paddingHorizontal: 15,
//       paddingVertical: 10,
//       borderTopWidth: 1,
//       borderTopColor: colors.textInputBG,
//       paddingBottom: Platform.OS === 'ios' ? 20 : 10,
//     },
//     textInput: {
//       flex: 1,
//       backgroundColor: colors.textInputBG,
//       borderRadius: 25,
//       paddingHorizontal: 20,
//       paddingVertical: 12,
//       fontSize: 16,
//       color: colors.text,
//       marginRight: 10,
//     },

//     iconButton: {
//       padding: 8,
//       borderRadius: 20,
//     },
//   });

// import React, { useState, useEffect, useRef } from 'react';
// import { 
//   View, 
//   Text, 
//   TouchableOpacity, 
//   ScrollView, 
//   StyleSheet, 
//   NativeEventEmitter, 
//   NativeModules,
//   Alert
// } from 'react-native';
// import { 
//   Camera, 
//   useCameraDevice, 
//   useCameraPermission, 
//   useFrameProcessor, 
//   VisionCameraProxy,
//   useCameraFormat
// } from 'react-native-vision-camera';
// import { privateApi } from '@/api/privateApi';
// import { HandStatus } from '@/components/HandOverlay';


// const SEQ_LEN = 30;
// const FRAME_SKIP = 2; // Chỉ xử lý 1 frame trong 3 frames (10 FPS nếu camera 30 FPS)

// const { HandLandmarks } = NativeModules;
// const eventEmitter = new NativeEventEmitter(HandLandmarks);
// const plugin = VisionCameraProxy.initFrameProcessorPlugin('hands_landmark', {});

// export default function TranslationScreen() {
//   const [showCamera, setShowCamera] = useState(false);
//   const [signTranslation, setSignTranslation] = useState('');
//   const [isProcessing, setIsProcessing] = useState(false);

//   // ⭐ NEW: ghi 1 đoạn 30 frames
//   const [isRecording, setIsRecording] = useState(false);
//   const isRecordingRef = useRef(false);      // để dùng trong listener

//   const device = useCameraDevice('back') || useCameraDevice('front');
//   const format = useCameraFormat(device, [{ fps: 30 }]);
//   const { hasPermission, requestPermission } = useCameraPermission();

//   const keypointsBuffer = useRef<number[][]>([]); 
//   const isSending = useRef(false);
//   const frameCounter = useRef(0);
//   const lastEventTime = useRef(0);

//   // ⭐ trạng thái overlay
//   const [handStatus, setHandStatus] = useState<HandStatus>('none');
//   const [statusMsg, setStatusMsg] = useState('Đưa tay vào khung hình');

//   useEffect(() => {
//     try {
//       if (HandLandmarks && HandLandmarks.initModel) {
//         HandLandmarks.initModel();
//         console.log("Model initialized signal sent");
//       } else {
//         console.error("HandLandmarks module not found!");
//         Alert.alert("Lỗi", "Không tìm thấy module nhận diện tay.");
//       }
//     } catch (err) {
//       console.error("Error init model:", err);
//     }
//   }, []);

//   useEffect(() => {
//   const sub = eventEmitter.addListener('onHandLandmarksDetected', (event) => {
//     const now = Date.now();
//     if (now - lastEventTime.current < 100) return;
//     lastEventTime.current = now;

//     if (!event.landmarks || event.landmarks.length === 0) {
//       setHandStatus('none');
//       setStatusMsg('Không thấy tay – đưa tay vào khung');
//       return;
//     }

//     try {
//       // Tối đa 2 tay
//       const handsDetected = event.landmarks.slice(0, 2);

//       // ==== TÍNH VÙNG AN TOÀN ====
//       let minX = 1, maxX = 0, minY = 1, maxY = 0;
//       handsDetected.forEach((hand: any[]) => {
//         hand.forEach((lm: any) => {
//           const x = lm.x ?? 0;
//           const y = lm.y ?? 0;
//           if (x < minX) minX = x;
//           if (x > maxX) maxX = x;
//           if (y < minY) minY = y;
//           if (y > maxY) maxY = y;
//         });
//       });

//       const SAFE_MIN = 0.2;
//       const SAFE_MAX = 0.8;
//       const inSafeArea =
//         minX > SAFE_MIN &&
//         maxX < SAFE_MAX &&
//         minY > SAFE_MIN &&
//         maxY < SAFE_MAX;

//       if (!inSafeArea) {
//         setHandStatus('bad');
//         setStatusMsg('Đưa tay vào giữa khung để nhận diện chính xác');
//       } else {
//         setHandStatus('ok');
//         setStatusMsg(
//           isRecordingRef.current
//             ? '✅ Đang ghi – giữ tay trong khung'
//             : handsDetected.length === 2
//             ? '✅ Đã thấy 2 tay – sẵn sàng ghi'
//             : '✅ Tay trong vùng an toàn – có thể bấm ghi'
//         );
//       }

//       // Nếu chưa bấm Ghi thì chỉ hiển thị overlay, không thu frame
//       if (!isRecordingRef.current) return;

//       // ==== BUILD VECTOR 126 CHIỀU ====
//       let frameVector = new Array(126).fill(0);
//       handsDetected.forEach((hand: any[], handIndex: number) => {
//         const offset = handIndex * 63;
//         hand.slice(0, 21).forEach((lm: any, lmIndex: number) => {
//           const basePos = offset + lmIndex * 3;
//           frameVector[basePos] = lm.x ?? 0;
//           frameVector[basePos + 1] = lm.y ?? 0;
//           frameVector[basePos + 2] = lm.z ?? 0;
//         });
//       });

//       if (handsDetected.length > 0 && inSafeArea) {
//         const currentBuffer = keypointsBuffer.current;
//         currentBuffer.push(frameVector);
//         if (currentBuffer.length > SEQ_LEN) currentBuffer.shift();

//         if (currentBuffer.length === SEQ_LEN && !isSending.current) {
//           sendToBackend([...currentBuffer]);
//         }
//       }
//     } catch (error) {
//       console.error('Error processing landmarks:', error);
//     }
//   });

//   return () => sub.remove();
// }, []);


//   const sendToBackend = async (frames: number[][]) => {
//     if (isSending.current) return;
    
//     isSending.current = true;
//     setIsProcessing(true);

//     try {
//       const res = await privateApi.post('/ai/tcn-recognize', { frames });
//       console.log("Response from backend:", res.data.label);
//       const data = res.data;

//       if (data.label) {
//         console.log("Kết quả:", data.label, " (confidence:", data.probability, ")");
//         if(data.probability < 0.5){
//           console.log("Độ tin cậy thấp, bỏ qua.");
//           return;
//         }
//         setSignTranslation(prev => {
//           const words = prev.trim().split(' ');
//           const lastWord = words[words.length - 1];
//           if (lastWord === data.label) return prev;
//           return prev ? `${prev} ${data.label}` : data.label;
//         });
//       }
//     } catch (e) {
//       console.log('Lỗi kết nối:', e);
//     } finally {
//       // Sau khi gửi xong 1 đoạn → reset
//       keypointsBuffer.current = [];
//       isRecordingRef.current = false;
//       setIsRecording(false);          // B: dừng ghi sau 1 đoạn

//       setTimeout(() => {
//         isSending.current = false;
//         setIsProcessing(false);
//       }, 500);
//     }
//   };

//   const frameProcessor = useFrameProcessor((frame) => {
//     'worklet';
//     frameCounter.current++;
//     if (frameCounter.current % FRAME_SKIP !== 0) {
//       return;
//     }

//     if (plugin != null) {
//       try {
//         plugin.call(frame); 
//       } catch (error) {
//         console.log('Frame processing error:', error);
//       }
//     }
//   }, []);

//   if (!hasPermission) {
//     return (
//       <View style={styles.centerContainer}>
//         <Text style={styles.textInfo}>Cần quyền truy cập Camera</Text>
//         <TouchableOpacity onPress={requestPermission} style={styles.buttonPrimary}>
//           <Text style={styles.buttonText}>Cấp quyền</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   if (device == null) {
//     return (
//       <View style={styles.centerContainer}>
//         <Text style={styles.textError}>Không tìm thấy Camera!</Text>
//       </View>
//     );
//   }

//   if (showCamera) {
//     return (
//       <View style={styles.container}>
//         <Camera
//           style={StyleSheet.absoluteFill}
//           device={device}
//           format={format}
//           fps={format?.maxFps ?? 30}
//           isActive={true}
//           frameProcessor={frameProcessor}
//           pixelFormat="yuv"
//         />
        
        
//         {/* Đóng camera */}
//         <TouchableOpacity 
//           onPress={() => {
//             setShowCamera(false);
//             keypointsBuffer.current = [];
//             frameCounter.current = 0;
//             isRecordingRef.current = false;
//             setIsRecording(false);
//           }} 
//           style={styles.closeButton}
//         >
//           <Text style={styles.closeButtonText}>✕</Text>
//         </TouchableOpacity>

//         {/* Nút GHI 1 ĐOẠN */}
//         <View style={styles.recordContainer}>
//           <TouchableOpacity
//             disabled={(isProcessing || isRecording) }
//             onPress={() => {
//               // C: chỉ bắt đầu thu khi bấm nút
//               keypointsBuffer.current = [];
//               isRecordingRef.current = true;
//               setIsRecording(true);
//             }}
//             style={[
//               styles.recordButton,
//               (isProcessing || isRecording) && styles.recordButtonDisabled,
//             ]}
//           >
//             <Text style={styles.recordButtonText}>
//               {isRecording ? 'ĐANG GHI 30 FRAMES...' : '🎬 GHI 1 ĐOẠN (30 FRAMES)'}
//             </Text>
//           </TouchableOpacity>
//           <Text style={styles.recordHint}>
//             Đưa tay vào khung hình sau khi bấm ghi
//           </Text>
//         </View>

//         {/* Processing indicator */}
//         {isProcessing && (
//           <View style={styles.processingIndicator}>
//             <Text style={styles.processingText}>🤖 Đang xử lý...</Text>
//           </View>
//         )}

//         {/* Buffer indicator */}
//         {isRecording && (
//           <View style={styles.bufferIndicator}>
//             <View style={styles.bufferBar}>
//               <View 
//                 style={[
//                   styles.bufferFill, 
//                   { width: `${(keypointsBuffer.current.length / SEQ_LEN) * 100}%` }
//                 ]} 
//               />
//             </View>
//             <Text style={styles.bufferText}>
//               {keypointsBuffer.current.length}/{SEQ_LEN} frames
//             </Text>
//           </View>
//         )}

//         <View style={styles.translationBox}>
//           <Text style={styles.translationLabel}>AI Đang dịch:</Text>
//           <ScrollView horizontal showsHorizontalScrollIndicator={false}>
//             <Text style={styles.translationText}>
//               {signTranslation || "Bấm ghi và đưa tay vào khung hình..."}
//             </Text>
//           </ScrollView>
//           <TouchableOpacity 
//             onPress={() => {
//               setSignTranslation('');
//               keypointsBuffer.current = [];
//             }} 
//             style={{alignSelf: 'flex-end', marginTop: 5}}
//           >
//              <Text style={{color: '#4dabf7', fontSize: 13}}>Xóa tất cả</Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//     );
//   }

//   return (
//     <View style={styles.centerContainer}>
//       <Text style={styles.title}>Dịch Ngôn Ngữ Ký Hiệu</Text>
      
//       <TouchableOpacity 
//         onPress={() => setShowCamera(true)} 
//         style={styles.bigButton}
//       >
//         <Text style={styles.bigButtonText}>📷 BẮT ĐẦU</Text>
//       </TouchableOpacity>

//       <Text style={styles.guideText}>
//          Vào camera, bấm "Ghi 1 đoạn (30 frames)" để thu ký hiệu
//       </Text>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: 'black' },
//   centerContainer: {
//     flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white',
//   },
//   title: { fontSize: 24, fontWeight: 'bold', marginBottom: 40, color: '#333' },
//   textInfo: { fontSize: 18, marginBottom: 20, color: '#333' },
//   textError: { fontSize: 18, color: 'red' },
//   guideText: { marginTop: 20, color: '#666', fontSize: 16 },
//   buttonPrimary: {
//     backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8,
//   },
//   buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
//   bigButton: {
//     width: 180, height: 180, backgroundColor: '#007AFF', borderRadius: 90,
//     justifyContent: 'center', alignItems: 'center', elevation: 10,
//     shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.3, shadowRadius: 5,
//   },
//   bigButtonText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
//   closeButton: {
//     position: 'absolute', top: 50, right: 20,
//     backgroundColor: 'rgba(0,0,0,0.7)', width: 40, height: 40,
//     borderRadius: 20, justifyContent: 'center', alignItems: 'center', zIndex: 10,
//   },
//   closeButtonText: { color: 'white', fontWeight: 'bold', fontSize: 20 },

//   // ⭐ NEW styles
//   recordContainer: {
//     position: 'absolute',
//     bottom: 140,
//     left: 20,
//     right: 20,
//     alignItems: 'center',
//   },
//   recordButton: {
//     backgroundColor: '#ff4d4f',
//     paddingVertical: 12,
//     paddingHorizontal: 24,
//     borderRadius: 30,
//   },
//   recordButtonDisabled: {
//     opacity: 0.6,
//   },
//   recordButtonText: {
//     color: 'white',
//     fontSize: 16,
//     fontWeight: '700',
//   },
//   recordHint: {
//     marginTop: 6,
//     color: '#eee',
//     fontSize: 12,
//   },

//   processingIndicator: {
//     position: 'absolute',
//     top: 50,
//     left: 20,
//     backgroundColor: 'rgba(0,122,255,0.9)',
//     paddingVertical: 8,
//     paddingHorizontal: 16,
//     borderRadius: 20,
//     zIndex: 10,
//   },
//   processingText: { color: 'white', fontSize: 14, fontWeight: '600' },
//   bufferIndicator: {
//     position: 'absolute',
//     top: 100,
//     left: 20,
//     right: 20,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     padding: 10,
//     borderRadius: 10,
//     zIndex: 10,
//   },
//   bufferBar: {
//     height: 4,
//     backgroundColor: 'rgba(255,255,255,0.3)',
//     borderRadius: 2,
//     overflow: 'hidden',
//   },
//   bufferFill: { height: '100%', backgroundColor: '#4dabf7' },
//   bufferText: { color: 'white', fontSize: 12, marginTop: 5, textAlign: 'center' },
//   translationBox: {
//     position: 'absolute',
//     bottom: 30,
//     left: 20,
//     right: 20,
//     backgroundColor: 'rgba(0, 0, 0, 0.8)',
//     padding: 20,
//     borderRadius: 16,
//     borderWidth: 1,
//     borderColor: '#333',
//   },
//   translationLabel: {
//     color: '#aaa',
//     fontSize: 12,
//     marginBottom: 5,
//     textTransform: 'uppercase',
//   },
//   translationText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
// });
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  NativeEventEmitter, 
  NativeModules,
  Alert,
  Dimensions
} from 'react-native';
import { 
  Camera, 
  useCameraDevice, 
  useCameraPermission, 
  useFrameProcessor, 
  VisionCameraProxy,
  useCameraFormat
} from 'react-native-vision-camera';
import { privateApi } from '@/api/privateApi';
import HandLandmarksCanvas from '@/components/HandLandmarksCanvas';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SEQ_LEN = 24;
const FRAME_SKIP = 2;
const MIN_CONFIDENCE = 0.55; // Giảm ngưỡng để dễ nhận hơn

const { HandLandmarks } = NativeModules;
const eventEmitter = new NativeEventEmitter(HandLandmarks);
const plugin = VisionCameraProxy.initFrameProcessorPlugin('hands_landmark', {});

type LandmarkPoint = { x: number; y: number; z?: number };

export default function TranslationScreen() {
  const [showCamera, setShowCamera] = useState(false);
  const [signTranslation, setSignTranslation] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);

  // ⭐ State cho vẽ landmarks
  const [handLandmarks, setHandLandmarks] = useState<LandmarkPoint[][]>([]);

  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    { videoResolution: { width: 640, height: 480 } },
    { fps: 20 }
  ]);
  
  const { hasPermission, requestPermission } = useCameraPermission();

  const keypointsBuffer = useRef<number[][]>([]); 
  const isSending = useRef(false);
  const frameCounter = useRef(0);
  const lastEventTime = useRef(0);

  // ⭐ BỎ HẾT quality check phức tạp - chỉ giữ status đơn giản
  const [statusMsg, setStatusMsg] = useState('Sẵn sàng ghi');
  const [handCount, setHandCount] = useState(0);

  useEffect(() => {
    try {
      if (HandLandmarks && HandLandmarks.initModel) {
        HandLandmarks.initModel();
      }
    } catch (err) {
      console.error("Error init model:", err);
    }
  }, []);

  useEffect(() => {
    const sub = eventEmitter.addListener('onHandLandmarksDetected', (event) => {
      const now = Date.now();
      if (now - lastEventTime.current < 100) return; // Giảm throttle
      lastEventTime.current = now;

      if (!event.landmarks || event.landmarks.length === 0) {
        setHandLandmarks([]);
        setHandCount(0);
        setStatusMsg('Không thấy tay');
        return;
      }

      try {
        const handsDetected = event.landmarks.slice(0, 2);
        
        // ⭐ CẬP NHẬT landmarks để vẽ
        setHandLandmarks(handsDetected);
        setHandCount(handsDetected.length);

        // ⭐ BỎ HẾT quality check - chỉ cần thấy tay là OK
        if (handsDetected.length > 0) {
          setStatusMsg(
            isRecordingRef.current 
              ? `✅ Đang ghi (${keypointsBuffer.current.length}/${SEQ_LEN})`
              : `✅ Thấy ${handsDetected.length} tay - Bấm GHI`
          );
        }

        // ⭐ CHỈ GHI khi user bấm nút
        if (!isRecordingRef.current) return;

        // Build vector đơn giản - BỎ chuẩn hóa phức tạp
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
        if (currentBuffer.length > SEQ_LEN) currentBuffer.shift();

        if (currentBuffer.length === SEQ_LEN && !isSending.current) {
          sendToBackend([...currentBuffer]);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    });

    return () => sub.remove();
  }, []);

  const sendToBackend = async (frames: number[][]) => {
    if (isSending.current) return;
    
    isSending.current = true;
    setIsProcessing(true);

    try {
      const res = await privateApi.post('/ai/tcn-recognize', { frames });
      const data = res.data;
      
      console.log("📊", data.label, data.probability);

      if (data.label && data.probability >= MIN_CONFIDENCE) {
        setSignTranslation(prev => {
          const words = prev.trim().split(' ');
          if (words[words.length - 1] === data.label) return prev;
          return prev ? `${prev} ${data.label}` : data.label;
        });
      }
    } catch (e) {
      console.error('Lỗi:', e);
    } finally {
      keypointsBuffer.current = [];
      isRecordingRef.current = false;
      setIsRecording(false);

      setTimeout(() => {
        isSending.current = false;
        setIsProcessing(false);
      }, 200);
    }
  };

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    frameCounter.current++;
    if (frameCounter.current % FRAME_SKIP !== 0) return;

    if (plugin != null) {
      try {
        plugin.call(frame); 
      } catch (error) {
        console.log('Frame error');
      }
    }
  }, []);

  if (!hasPermission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.textInfo}>Cần quyền Camera</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.buttonPrimary}>
          <Text style={styles.buttonText}>Cấp quyền</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.textError}>Không tìm thấy Camera</Text>
      </View>
    );
  }

  if (showCamera) {
    return (
      <View style={styles.container}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          fps={20}
          isActive={true}
          frameProcessor={frameProcessor}
          pixelFormat="yuv"
        />
        
        {/* ⭐ VẼ LANDMARKS LÊN TAY */}
        <HandLandmarksCanvas 
          landmarks={handLandmarks}
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
        />

        {/* ⭐ STATUS ĐƠN GIẢN */}
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            👁️ {handCount} tay | {statusMsg}
          </Text>
        </View>
        
        <TouchableOpacity 
          onPress={() => {
            setShowCamera(false);
            keypointsBuffer.current = [];
            setHandLandmarks([]);
            isRecordingRef.current = false;
            setIsRecording(false);
          }} 
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        {/* ⭐ NÚT GHI ĐƠN GIẢN */}
        <View style={styles.recordContainer}>
          <TouchableOpacity
            disabled={isProcessing || isRecording || handCount === 0}
            onPress={() => {
              keypointsBuffer.current = [];
              isRecordingRef.current = true;
              setIsRecording(true);
            }}
            style={[
              styles.recordButton,
              (isProcessing || isRecording || handCount === 0) && styles.recordButtonDisabled,
            ]}
          >
            <Text style={styles.recordButtonText}>
              {isRecording 
                ? `⏺ GHI ${keypointsBuffer.current.length}/${SEQ_LEN}` 
                : handCount === 0
                ? '⏸ Chờ thấy tay...'
                : '🎬 GHI KÝ HIỆU'}
            </Text>
          </TouchableOpacity>
        </View>

        {isProcessing && (
          <View style={styles.processingIndicator}>
            <Text style={styles.processingText}>🤖 Đang xử lý...</Text>
          </View>
        )}

        <View style={styles.translationBox}>
          <Text style={styles.translationLabel}>KẾT QUẢ:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={styles.translationText}>
              {signTranslation || "..."}
            </Text>
          </ScrollView>
          <TouchableOpacity 
            onPress={() => {
              setSignTranslation('');
              keypointsBuffer.current = [];
            }}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>Xóa</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.centerContainer}>
      <Text style={styles.title}>Dịch Ngôn Ngữ Ký Hiệu</Text>
      
      <TouchableOpacity 
        onPress={() => setShowCamera(true)} 
        style={styles.bigButton}
      >
        <Text style={styles.bigButtonText}>📷 BẮT ĐẦU</Text>
      </TouchableOpacity>

      <View style={styles.instructionBox}>
        <Text style={styles.instructionTitle}>✨ Cải tiến mới:</Text>
        <Text style={styles.instructionText}>• Vẽ landmarks trực quan lên tay</Text>
        <Text style={styles.instructionText}>• Bỏ quality check khắt khe</Text>
        <Text style={styles.instructionText}>• Giảm lag tối đa</Text>
        <Text style={styles.instructionText}>• Linh hoạt với vùng an toàn</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  centerContainer: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'white', 
    padding: 20,
  },
  title: { 
    fontSize: 26, 
    fontWeight: 'bold', 
    marginBottom: 30, 
    color: '#333',
    textAlign: 'center',
  },
  textInfo: { fontSize: 18, marginBottom: 20, color: '#333' },
  textError: { fontSize: 18, color: 'red' },
  buttonPrimary: {
    backgroundColor: '#007AFF', 
    paddingVertical: 12, 
    paddingHorizontal: 24, 
    borderRadius: 8,
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  bigButton: {
    width: 180, 
    height: 180, 
    backgroundColor: '#007AFF', 
    borderRadius: 90,
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 10,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, 
    shadowRadius: 5, 
    marginBottom: 30,
  },
  bigButtonText: { 
    color: 'white', 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  
  instructionBox: {
    backgroundColor: '#f0f9ff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    width: '100%',
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 5,
  },

  closeButton: {
    position: 'absolute', 
    top: 50, 
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)', 
    width: 44, 
    height: 44,
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 10,
  },
  closeButtonText: { 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 20 
  },

  statusBar: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  recordContainer: {
    position: 'absolute',
    bottom: 140,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  recordButton: {
    backgroundColor: '#ff4d4f',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    minWidth: 220,
  },
  recordButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#666',
  },
  recordButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },

  processingIndicator: {
    position: 'absolute',
    top: 110,
    left: 20,
    backgroundColor: 'rgba(0,122,255,0.9)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  processingText: { 
    color: 'white', 
    fontSize: 14, 
    fontWeight: '600' 
  },

  translationBox: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#4dabf7',
  },
  translationLabel: {
    color: '#4dabf7',
    fontSize: 12,
    marginBottom: 5,
    fontWeight: '700',
  },
  translationText: { 
    color: 'white', 
    fontSize: 20, 
    fontWeight: 'bold',
    minHeight: 28,
  },
  clearButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  clearButtonText: {
    color: '#4dabf7',
    fontSize: 13,
    fontWeight: '600',
  },
});
