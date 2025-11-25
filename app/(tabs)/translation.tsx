// import React, { useState, useEffect } from 'react';
// import { 
//   View, 
//   Text, 
//   TouchableOpacity, 
//   ScrollView, 
//   StyleSheet, 
//   NativeEventEmitter, 
//   NativeModules,
//   Dimensions 
// } from 'react-native';
// import { 
//   Camera, 
//   useCameraDevice, 
//   useCameraPermission, 
//   useFrameProcessor, 
//   VisionCameraProxy 
// } from 'react-native-vision-camera';

// const { HandLandmarks } = NativeModules;
// const eventEmitter = new NativeEventEmitter(HandLandmarks);

// const plugin = VisionCameraProxy.initFrameProcessorPlugin('hands_landmark', {});

// export default function TranslationScreen() {
//   const [showCamera, setShowCamera] = useState(false);
//   const [signTranslation, setSignTranslation] = useState('');
  
//   const device = useCameraDevice('back') || useCameraDevice('front');
//   const { hasPermission, requestPermission } = useCameraPermission();

//   const SEQ_LEN = 30; 
//   const keypointsBuffer = React.useRef<number[][][]>([]); 

//   // --- INIT MODEL ---
//   useEffect(() => {
//     try {
//       if (HandLandmarks && HandLandmarks.initModel) {
//         HandLandmarks.initModel();
//         console.log("Model initialized signal sent");
//       } else {
//         console.error("HandLandmarks module not found!");
//       }
//     } catch (err) {
//       console.error("Error init model:", err);
//     }
//   }, []);

//   // --- LISTEN EVENTS ---
//   useEffect(() => {
//     const sub = eventEmitter.addListener('onHandLandmarksDetected', (event) => {
//       // console.log("Received landmarks:", event.landmarks?.length); 

//       if (event.landmarks && event.landmarks.length > 0) {
//         const hand = event.landmarks[0];
//         const frameKeypoints = hand.map((lm: any) => [lm.x, lm.y, lm.z]);


//         const currentBuffer = keypointsBuffer.current;
//         currentBuffer.push(frameKeypoints);

//         if (currentBuffer.length > SEQ_LEN) {
//           currentBuffer.shift();
//         }

//         if (currentBuffer.length === SEQ_LEN) {
//           sendToBackend([...currentBuffer]);
//           // Tùy chọn: Clear buffer hoặc giữ lại trượt cửa sổ (Sliding Window)
//           // keypointsBuffer.current = []; 
//         }
//       }
//     });

//     return () => sub.remove();
//   }, []);

//   const sendToBackend = async (frames: any) => {
//     try {
//       // console.log("Sending to backend...");
//       const res = await fetch('http://192.168.1.21:8000/ai/tcn-recognize', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ frames })
//       });
//       const data = await res.json();
//       if (data.label) {
//         console.log("Prediction:", data.label);
//         setSignTranslation(prev => prev + data.label);
//       }
//     } catch (e) {
//       console.log('Backend error:', e);
//     }
//   };

//   // --- FRAME PROCESSOR ---
//   const frameProcessor = useFrameProcessor((frame) => {
//     'worklet';
//     if (plugin != null) {
//       // Gọi plugin native để xử lý frame
//       plugin.call(frame); 
//     }
//   }, []);

//   // --- RENDER ---

//   // 1. Chưa cấp quyền
//   if (!hasPermission) {
//     return (
//       <View style={styles.centerContainer}>
//         <Text style={styles.textInfo}>Cần quyền truy cập Camera</Text>
//         <TouchableOpacity onPress={requestPermission} style={styles.buttonPrimary}>
//           <Text style={styles.buttonText}>Cấp quyền Camera</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   // 2. Không tìm thấy Camera
//   if (device == null) {
//     return (
//       <View style={styles.centerContainer}>
//         <Text style={styles.textError}>Không tìm thấy Camera trên thiết bị này!</Text>
//       </View>
//     );
//   }

//   // 3. Màn hình Camera
//   if (showCamera) {
//     return (
//       <View style={styles.container}>
//         <Camera
//           style={StyleSheet.absoluteFill}
//           device={device}
//           isActive={true}
//           frameProcessor={frameProcessor}
//           pixelFormat="yuv" // Android Mediapipe thường thích YUV
//         />
        
//         {/* Nút Đóng Camera */}
//         <TouchableOpacity 
//           onPress={() => setShowCamera(false)} 
//           style={styles.closeButton}
//         >
//           <Text style={styles.closeButtonText}>Đóng</Text>
//         </TouchableOpacity>

//         {/* Khung hiển thị kết quả dịch */}
//         <View style={styles.translationBox}>
//           <Text style={styles.translationLabel}>Dịch:</Text>
//           <ScrollView horizontal>
//             <Text style={styles.translationText}>{signTranslation || "Đang chờ..."}</Text>
//           </ScrollView>
//         </View>
//       </View>
//     );
//   }

//   // 4. Màn hình Chính (Nút Mở Camera)
//   return (
//     <View style={styles.centerContainer}>
//       <Text style={styles.title}>Dịch Ngôn Ngữ Ký Hiệu</Text>
      
//       <TouchableOpacity 
//         onPress={() => setShowCamera(true)} 
//         style={styles.bigButton}
//       >
//         {/* Dùng Text thay vì Icon để chắc chắn hiển thị */}
//         <Text style={styles.bigButtonText}>📷 MỞ CAMERA</Text>
//       </TouchableOpacity>

//       <Text style={{marginTop: 20, color: '#666'}}>
//          Nhấn vào nút trên để bắt đầu
//       </Text>
//     </View>
//   );
// }

// // --- STYLES ---
// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: 'black',
//   },
//   centerContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: 'white', // Quan trọng: cần màu nền để thấy nút
//   },
//   title: {
//     fontSize: 24,
//     fontWeight: 'bold',
//     marginBottom: 40,
//     color: '#333',
//   },
//   textInfo: {
//     fontSize: 18,
//     marginBottom: 20,
//   },
//   textError: {
//     fontSize: 18,
//     color: 'red',
//   },
//   buttonPrimary: {
//     backgroundColor: '#007AFF',
//     paddingVertical: 12,
//     paddingHorizontal: 24,
//     borderRadius: 8,
//   },
//   buttonText: {
//     color: 'white',
//     fontSize: 16,
//     fontWeight: '600',
//   },
//   bigButton: {
//     width: 200,
//     height: 200,
//     backgroundColor: '#007AFF',
//     borderRadius: 100, // Hình tròn
//     justifyContent: 'center',
//     alignItems: 'center',
//     elevation: 5, // Shadow Android
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.25,
//     shadowRadius: 3.84,
//   },
//   bigButtonText: {
//     color: 'white',
//     fontSize: 20,
//     fontWeight: 'bold',
//   },
//   closeButton: {
//     position: 'absolute',
//     top: 50,
//     right: 20,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     padding: 10,
//     borderRadius: 20,
//     zIndex: 10,
//   },
//   closeButtonText: {
//     color: 'white',
//     fontWeight: 'bold',
//   },
//   translationBox: {
//     position: 'absolute',
//     bottom: 30,
//     left: 20,
//     right: 20,
//     backgroundColor: 'rgba(0, 0, 0, 0.7)',
//     padding: 15,
//     borderRadius: 12,
//   },
//   translationLabel: {
//     color: '#aaa',
//     fontSize: 12,
//     marginBottom: 5,
//   },
//   translationText: {
//     color: 'white',
//     fontSize: 22,
//     fontWeight: 'bold',
//   },
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
  Platform,
  Alert
} from 'react-native';
import { 
  Camera, 
  useCameraDevice, 
  useCameraPermission, 
  useFrameProcessor, 
  VisionCameraProxy 
} from 'react-native-vision-camera';

const BACKEND_URL = 'http://192.168.1.21:8000/ai/tcn-recognize';
const SEQ_LEN = 30;

const { HandLandmarks } = NativeModules;
const eventEmitter = new NativeEventEmitter(HandLandmarks);
const plugin = VisionCameraProxy.initFrameProcessorPlugin('hands_landmark', {});

export default function TranslationScreen() {
  const [showCamera, setShowCamera] = useState(false);
  const [signTranslation, setSignTranslation] = useState('');
  
const back = useCameraDevice('back');
const front = useCameraDevice('front');
const device = back ?? front;
  const { hasPermission, requestPermission } = useCameraPermission();

  const keypointsBuffer = useRef([]); 
  const isSending = useRef(false);

  useEffect(() => {
    try {
      if (HandLandmarks && HandLandmarks.initModel) {
        HandLandmarks.initModel();
        console.log("Model initialized signal sent");
      } else {
        console.error("HandLandmarks module not found!");
        Alert.alert("Lỗi", "Không tìm thấy module nhận diện tay.");
      }
    } catch (err) {
      console.error("Error init model:", err);
    }
  }, []);

  useEffect(() => {
    const sub = eventEmitter.addListener('onHandLandmarksDetected', (event) => {

      if (event.landmarks) {

        let frameVector = new Array(126).fill(0);

        const handsDetected = event.landmarks.slice(0, 2);
        
        handsDetected.forEach((hand, handIndex) => {
          const offset = handIndex * 63; 

          hand.forEach((lm, lmIndex) => {
            const basePos = offset + (lmIndex * 3);
            frameVector[basePos]     = lm.x;
            frameVector[basePos + 1] = lm.y;
            frameVector[basePos + 2] = lm.z;
          });
        });

        if (handsDetected.length > 0) {
          const currentBuffer = keypointsBuffer.current;
          currentBuffer.push(frameVector);

          if (currentBuffer.length > SEQ_LEN) {
            currentBuffer.shift();
          }

          if (currentBuffer.length === SEQ_LEN) {
            sendToBackend([...currentBuffer]);
          }
        }
      }
    });

    return () => sub.remove();
  }, []);


  const sendToBackend = async (frames) => {

    if (isSending.current) return;
    isSending.current = true;

    try {
      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames: frames }) 
      });

      const data = await res.json();

      if (!res.ok) {
        console.log("SERVER ERROR:", JSON.stringify(data, null, 2));
      } else if (data.label) {
        console.log("Kết quả:", data.label);
        setSignTranslation(prev => {
            if (prev.endsWith(data.label)) return prev;
            return prev + " " + data.label;
        });
        
      }
    } catch (e) {
      console.log('Lỗi kết nối:', e.message);
    } finally {
      isSending.current = false;
    }
  };


  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (plugin != null) {
      plugin.call(frame); 
    }
  }, []);

  if (!hasPermission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.textInfo}>Cần quyền truy cập Camera</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.buttonPrimary}>
          <Text style={styles.buttonText}>Cấp quyền</Text>
        </TouchableOpacity>
      </View>
    );
  }


  if (device == null) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.textError}>Không tìm thấy Camera!</Text>
      </View>
    );
  }


  if (showCamera) {
    return (
      <View style={styles.container}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          frameProcessor={frameProcessor}
          pixelFormat="yuv"
        />
        
        <TouchableOpacity 
          onPress={() => setShowCamera(false)} 
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>Đóng</Text>
        </TouchableOpacity>

        <View style={styles.translationBox}>
          <Text style={styles.translationLabel}>AI Đang dịch:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={styles.translationText}>
              {signTranslation || "..."}
            </Text>
          </ScrollView>
          <TouchableOpacity 
            onPress={() => setSignTranslation('')} 
            style={{alignSelf: 'flex-end', marginTop: 5}}
          >
             <Text style={{color: '#4dabf7', fontSize: 13}}>Xóa tất cả</Text>
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

      <Text style={styles.guideText}>
         Đưa tay vào khung hình để dịch
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#333',
  },
  textInfo: {
    fontSize: 18,
    marginBottom: 20,
    color: '#333',
  },
  textError: {
    fontSize: 18,
    color: 'red',
  },
  guideText: {
    marginTop: 20, 
    color: '#666',
    fontSize: 16
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
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
  },
  bigButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 20,
    zIndex: 10,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  translationBox: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333'
  },
  translationLabel: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 5,
    textTransform: 'uppercase'
  },
  translationText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
});