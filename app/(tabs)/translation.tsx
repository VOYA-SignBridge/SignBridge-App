import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';

export default function TranslationScreen() {
  const [textToTranslate, setTextToTranslate] = useState('');
  const [signTranslation, setSignTranslation] = useState('');
  const { colors } = useTheme();

  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('back');

  const cameraRef = useRef(null);

  const styles = getStyles(colors);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
  }, [permission]);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={requestPermission}>
          <Text style={styles.textInput}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCameraInput = () => setShowCamera(true);
  const closeCamera = () => setShowCamera(false);
  const flipCamera = () => setCameraFacing((prev: CameraType) => (prev === 'back' ? 'front' : 'back'));

  if (showCamera) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        <CameraView style={{ flex: 1 }} ref={cameraRef} facing={cameraFacing} />

        <View
          style={{
            position: 'absolute',
            bottom: 30,
            left: 20,
            right: 20,
            backgroundColor: '#0007',
            padding: 20,
            borderRadius: 12,
            maxHeight: 150,
          }}
        >
          <ScrollView>
            <Text style={{ color: 'white', fontSize: 16 }}>
              {signTranslation}
            </Text>
          </ScrollView>
        </View>

        <TouchableOpacity
          onPress={closeCamera}
          style={{
            position: 'absolute',
            top: 40,
            right: 20,
            backgroundColor: '#0008',
            padding: 5,
            borderRadius: 30,
          }}
        >
          <Ionicons name="close" size={34} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={flipCamera}
          style={{
            position: 'absolute',
            top: 40,
            left: 20,
            backgroundColor: '#0008',
            padding: 5,
            borderRadius: 30,
          }}
        >
          <Ionicons name="camera-reverse-outline" size={40} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  const handleVoiceInput = () => {
    Alert.alert(
      'Voice Input',
      'Chức năng nhập liệu giọng nói sẽ được tích hợp.'
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flexContainer}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <LinearGradient
          colors={[colors.background, colors.background]}
          style={styles.container}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.centerContent}>
              <View style={styles.threeDModelPlaceholder}>
                <Text style={styles.threeDText}>3D Avatar Placeholder</Text>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder='Type to translate'
                placeholderTextColor={colors.mediumGray}
                value={textToTranslate}
                onChangeText={setTextToTranslate}
              />

              <TouchableOpacity
                onPress={handleCameraInput}
                style={styles.iconButton}
              >
                <Ionicons
                  name='camera-outline'
                  size={28}
                  color={colors.primary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleVoiceInput}
                style={styles.iconButton}
              >
                <Ionicons
                  name='mic-outline'
                  size={28}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    flexContainer: { flex: 1 },
    container: { flex: 1 },
    safeArea: {
      flex: 1,
      paddingTop: Platform.OS === 'android' ? 30 : 0,
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    threeDModelPlaceholder: {
      width: '80%',
      height: '60%',
      backgroundColor: colors.controlBG,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    threeDText: {
      color: colors.text,
      fontSize: 22,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.textInputBG,
      paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    },
    textInput: {
      flex: 1,
      backgroundColor: colors.textInputBG,
      borderRadius: 25,
      paddingHorizontal: 20,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      marginRight: 10,
    },

    iconButton: {
      padding: 8,
      borderRadius: 20,
    },
  });