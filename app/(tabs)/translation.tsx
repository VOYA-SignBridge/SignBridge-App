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
  Keyboard,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import SignLanguageCamera from '@/components/SignLanguageCamera';
import WordMode from '@/components/translation/WordMode';
import AlphabetMode from '@/components/translation/AlphabetMode';
import { useDictionaryStore } from '../data/useDictionaryStore';
import { getSignVideoUrl } from '../utils/CloudinaryHelper';

export default function TranslationScreen() {
  const { colors: theme } = useTheme();
  const { t } = useTranslation();

  const [showCamera, setShowCamera] = useState(false);
  const [mode, setMode] = useState<'word' | 'letter'>('word');
  const [textInput, setTextInput] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const findWord = useDictionaryStore((state) => state.findWord);

  useEffect(() => {
    setTranslatedText('');
  }, [showCamera, mode]);

  const handleWordResult = (newWord: string) => {
    setTranslatedText(newWord);
  };

  const handleLetterResult = (newChar: string) => {
    setTranslatedText((prev) => prev + newChar);
  };

  const closeCamera = () => {
    setShowCamera(false);
    setTranslatedText('');
  };

  function translateTextToVideo() {
    if (!textInput.trim()) return;
    Keyboard.dismiss();

    const publicId = findWord(textInput);

    if (publicId) {
      setVideoUrl(getSignVideoUrl(publicId));
    } else {
      Alert.alert(t('translation.noData'), t('translation.noDataMsg', { word: textInput }));
      setVideoUrl(null);
    }
  }

  const hasText = textInput.trim().length > 0;
  const inputBg = theme.textInputBG;

  // ── Camera view ──────────────────────────────────────────────
  if (showCamera) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        <SignLanguageCamera />

        <TouchableOpacity style={styles.closeBtn} onPress={closeCamera}>
          <Ionicons name="close" size={28} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.modeSwitchContainer}>
          <View style={styles.modeSwitchBackground}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'word' && { backgroundColor: theme.primary }]}
              onPress={() => setMode('word')}
            >
              <Text style={[styles.modeText, mode === 'word' && styles.modeTextActive]}>
                {t('translation.wordMode')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'letter' && { backgroundColor: theme.primary }]}
              onPress={() => setMode('letter')}
            >
              <Text style={[styles.modeText, mode === 'letter' && styles.modeTextActive]}>
                {t('translation.alphabetMode')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {mode === 'word' && (
          <View style={[styles.cameraResultBox, { borderColor: 'rgba(255,255,255,0.1)' }]}>
            <Text style={[styles.cameraResultLabel, { color: theme.primary }]}>
              {t('translation.translationResult')}
            </Text>
            <Text style={styles.cameraResultText}>{translatedText || '...'}</Text>
            {translatedText.length > 0 && (
              <TouchableOpacity onPress={() => setTranslatedText('')} style={styles.clearBtn}>
                <Text style={[styles.clearBtnText, { color: theme.error }]}>
                  {t('translation.clear')}
                </Text>
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

  // ── Main view ─────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: theme.background }]}>

      {/* ── Content (fills space above bottom bar) ── */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.body}>
          {videoUrl ? (
            /* Video card */
            <View style={[styles.videoCard, { backgroundColor: theme.cardBG }]}>
              <VideoSection url={videoUrl} />
              <TouchableOpacity
                style={styles.videoCloseBtn}
                onPress={() => { setVideoUrl(null); setTextInput(''); }}
              >
                <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            </View>
          ) : (
            /* Placeholder card */
            <View style={[styles.placeholder, { backgroundColor: theme.cardBG, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.borderColor }]}>
              <Text style={[styles.placeholderTitle, { color: theme.text }]}>
                {t('translation.greeting')}
              </Text>
              <Text style={[styles.placeholderSub, { color: theme.mediumGray }]}>
                {t('translation.greetingSubtitle')}
              </Text>
              <View style={styles.hintRow}>
                <View style={[styles.hintChip, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '40' }]}>
                  <Ionicons name="camera-outline" size={14} color={theme.primary} />
                  <Text style={[styles.hintText, { color: theme.primary }]}>Camera</Text>
                </View>
                <View style={[styles.hintChip, { backgroundColor: theme.success + '15', borderColor: theme.success + '40' }]}>
                  <Ionicons name="text-outline" size={14} color={theme.success} />
                  <Text style={[styles.hintText, { color: theme.success }]}>
                    {t('translation.typeHint')}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* ── Bottom bar — KAV chỉ bọc bar này, không bọc toàn bộ layout ── */}
      {/* Android: adjustResize trong manifest tự co window → behavior=undefined */}
      {/* iOS: behavior='padding' để đẩy bar lên trên keyboard */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.bottomBarContainer, { backgroundColor: theme.background, borderTopColor: 'transparent' }]}>
          <TouchableOpacity onPress={() => setShowCamera(true)} style={styles.iconBtnOutside}>
            <Ionicons name="camera" size={22} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtnOutside}>
            <Ionicons name="mic" size={22} color={theme.primary} />
          </TouchableOpacity>

          <View style={[styles.inputWrapper, { backgroundColor: inputBg }]}>
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder={t('translation.enterContent')}
              placeholderTextColor={theme.icon}
              value={textInput}
              onChangeText={setTextInput}
              onSubmitEditing={translateTextToVideo}
              returnKeyType="send"
              autoCorrect={false}
              spellCheck={false}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            onPress={translateTextToVideo}
            disabled={!hasText}
            style={[
              styles.sendButton,
              {
                backgroundColor: hasText ? theme.primary : inputBg,
                elevation: hasText ? 5 : 0,
              },
            ]}
          >
            <Ionicons
              name="send"
              size={20}
              color={hasText ? theme.white : theme.icon}
              style={{ marginLeft: hasText ? 2 : 0 }}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

function VideoSection({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <VideoView
      style={styles.videoPlayer}
      player={player}
      contentFit="contain"
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Body
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  // Placeholder
  placeholder: {
    flex: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholderSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  hintRow: {
    flexDirection: 'row',
    gap: 10,
  },
  hintChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  hintText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Video card
  videoCard: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  videoPlayer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  videoCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
  },

  // Bottom bar (giữ nguyên)
  bottomBarContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  iconBtnOutside: {
    padding: 6,
    marginRight: 2,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    marginRight: 8,
    marginLeft: 4,
    borderWidth: 0,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  // Camera overlay styles (giữ nguyên)
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
    borderColor: 'rgba(255,255,255,0.3)',
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
    borderColor: 'rgba(255,255,255,0.1)',
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
    fontWeight: 'bold',
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
    padding: 5,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
