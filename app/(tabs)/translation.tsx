import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Keyboard,
  Alert
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import SignLanguageCamera from '@/components/SignLanguageCamera';
import { privateApi } from '@/api/privateApi';

import WordMode from '@/components/translation/WordMode';
import AlphabetMode from '@/components/translation/AlphabetMode';

export default function TranslationScreen() {
  const { colors: theme } = useTheme();

  const [showCamera, setShowCamera] = useState(false);
  const [mode, setMode] = useState<'word' | 'letter'>('word');
  
  const [textInput, setTextInput] = useState("");
  const [translatedText, setTranslatedText] = useState(""); 

  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = false;
    if (videoUrl) player.play();
  });

  useEffect(() => {
    if (videoUrl && player) player.play();
  }, [videoUrl, player]);

  useEffect(() => {
      setTranslatedText("");
  }, [showCamera, mode]);

  const handleWordResult = (newWord: string) => {
    setTranslatedText(newWord);
  };

  const handleLetterResult = (newChar: string) => {
    setTranslatedText(prev => prev + newChar);
  };

  const closeCamera = () => {
      setShowCamera(false);
      setTranslatedText("");
  };

  async function translateTextToVideo() {
    if (!textInput.trim()) return;
    Keyboard.dismiss();
    try {
      let response = await privateApi.post('/sign-video/translate', {
        text: textInput.trim()
      });
      if (response?.data.videos && response?.data?.videos.length > 0) {
        setVideoUrl(response?.data?.videos[0].mp4_url);
      }
    } catch (err) { Alert.alert("Error", "Network error."); }
  }

  const hasText = textInput.trim().length > 0;
  const inputBackgroundColor = theme.background === '#000000' ? '#1c1c1e' : '#F2F2F7';

  if (showCamera) {
    return (
        <View style={{flex: 1, backgroundColor: 'black'}}>
            <SignLanguageCamera theme={theme} />
            
            <TouchableOpacity 
                onPress={closeCamera} 
                style={styles.closeBtn}
                hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
            >
                <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>

            <View style={styles.modeSwitchContainer}>
                <View style={styles.modeSwitchBackground}>
                    <TouchableOpacity 
                        style={[
                            styles.modeBtn, 
                            mode === 'word' && { backgroundColor: theme.primary }
                        ]}
                        onPress={() => setMode('word')}
                    >
                        <Text style={[
                            styles.modeText, 
                            mode === 'word' && styles.modeTextActive
                        ]}>Từ vựng</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[
                            styles.modeBtn, 
                            mode === 'letter' && { backgroundColor: theme.primary }
                        ]}
                        onPress={() => setMode('letter')}
                    >
                        <Text style={[
                            styles.modeText, 
                            mode === 'letter' && styles.modeTextActive
                        ]}>Chữ cái</Text>
                    </TouchableOpacity>
                </View>
            </View>
            {mode === 'word' && (
                <View style={[styles.cameraResultBox, { borderColor: 'rgba(255,255,255,0.1)' }]}>
                    <Text style={[styles.cameraResultLabel, { color: theme.primary }]}>Kết quả dịch:</Text>
                    <Text style={styles.cameraResultText}>
                        {translatedText || "..."}
                    </Text>
                    {translatedText.length > 0 && (
                        <TouchableOpacity onPress={() => setTranslatedText("")} style={styles.clearBtn}>
                            <Text style={styles.clearBtnText}>Xóa</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
            <View style={styles.controlLayer}>
                {mode === 'word' ? (
                    <WordMode onResult={handleWordResult} theme={theme} />
                ) : (
                    <AlphabetMode onResult={handleLetterResult} theme={theme} />
                )}
            </View>
        </View>
    );
  }
  return (
    <SafeAreaView style={[styles.mainContainer, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.contentContainer}>
            {videoUrl ? (
              <View style={styles.mediaContainer}>
                <VideoView style={styles.videoPlayer} player={player} contentFit="contain" allowsPictureInPicture />
              </View>
            ) : (
              <View style={[styles.mediaContainer, styles.placeholderBox, { borderColor: theme.lightGray, backgroundColor: theme.controlBG }]}>
                <Ionicons name="videocam-outline" size={48} color={theme.icon} style={{ opacity: 0.5, marginBottom: 16 }} />
                <Text style={[styles.welcomeText, { color: theme.text }]}>Xin chào!</Text>
                <Text style={[styles.subText, { color: theme.icon }]}>{"Nhập văn bản để tôi dịch sang\nngôn ngữ ký hiệu nhé."}</Text>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>

        <View style={[styles.bottomBarContainer, { backgroundColor: theme.background, borderTopColor: 'transparent' }]}>
          <TouchableOpacity onPress={() => setShowCamera(true)} style={styles.iconBtnOutside}>
            <Ionicons name="camera" size={22} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtnOutside}>
            <Ionicons name="mic" size={22} color={theme.primary} />
          </TouchableOpacity>
          <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: 'transparent' }]}>
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Nhập nội dung..."
              placeholderTextColor={theme.icon}
              value={textInput}
              onChangeText={setTextInput}
              onSubmitEditing={translateTextToVideo}
              returnKeyType="send"
            />
          </View>
          <TouchableOpacity onPress={translateTextToVideo} disabled={!hasText} style={[styles.sendButton, { backgroundColor: hasText ? theme.primary : inputBackgroundColor, elevation: hasText ? 5 : 0 }]}>
            <Ionicons name="send" size={20} color={hasText ? theme.white : theme.icon} style={{ marginLeft: hasText ? 2 : 0 }} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  contentContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  mediaContainer: { width: '90%', aspectRatio: 3 / 4, justifyContent: 'center', alignItems: 'center' },
  videoPlayer: { width: '100%', height: '100%', backgroundColor: 'transparent' },
  placeholderBox: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 20, justifyContent: 'center', alignItems: 'center', padding: 24 },
  welcomeText: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  subText: { fontSize: 15, textAlign: 'center' },
  bottomBarContainer: { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: Platform.OS === 'ios' ? 20 : 12 },
  iconBtnOutside: { padding: 6, marginRight: 2 },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 22, paddingHorizontal: 16, marginRight: 8, marginLeft: 4, borderWidth: 0 },
  textInput: { flex: 1, fontSize: 16, height: '100%' },
  sendButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4 },

  closeBtn: {
      position: 'absolute',
      top: 50, 
      left: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100, 
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)'
  },

  modeSwitchContainer: {
      position: 'absolute',
      top: 60, 
      width: '100%',
      alignItems: 'center',
      zIndex: 20, 
  },
  modeSwitchBackground: {
      flexDirection: 'row',
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 25,
      padding: 4,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)'
  },
  modeBtn: {
      paddingVertical: 8,
      paddingHorizontal: 24,
      borderRadius: 20,
  },

  modeText: {
      color: 'rgba(255,255,255,0.7)',
      fontWeight: '600',
      fontSize: 14,
  },
  modeTextActive: {
      color: 'white',
      fontWeight: 'bold'
  },
  controlLayer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '40%', 
      justifyContent: 'flex-end',
      paddingBottom: 40,
      zIndex: 10,
  },
  cameraResultBox: {
      position: 'absolute',
      top: 130, 
      left: 20,
      right: 20,
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: 16,
      borderRadius: 12,
      zIndex: 15,
      borderWidth: 1,
  },
  cameraResultLabel: {
      fontSize: 12,
      fontWeight: 'bold',
      marginBottom: 4,
  },
  cameraResultText: {
      color: 'white',
      fontSize: 20,
      fontWeight: '700',
  },
  clearBtn: {
      position: 'absolute',
      right: 10,
      top: 10,
      padding: 5
  },
  clearBtnText: {
      color: '#F87171',
      fontSize: 12,
      fontWeight: 'bold'
  },
});