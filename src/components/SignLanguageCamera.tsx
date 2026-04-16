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

  // luôn ưu tiên front -> fallback back
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
