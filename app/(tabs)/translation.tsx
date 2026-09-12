import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import SignLanguageCamera from '@/components/SignLanguageCamera';
import WordMode from '@/components/translation/WordMode';
import AlphabetMode from '@/components/translation/AlphabetMode';
import { buildSentence } from '@/llm/llmService';
import { useDictionaryStore } from '../data/useDictionaryStore';
import { getSignVideoUrl } from '../utils/CloudinaryHelper';
import {
  formatPronounPreference,
  PRONOUN_PRESETS,
  PronounPreference,
  usePronouns,
} from '@/contexts/PronounContext';

function parseRecognizedSigns(signs: string) {
  return signs
    .split(/[·,\n]/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export default function TranslationScreen() {
  const { colors: theme } = useTheme();
  const { t } = useTranslation();

  const [showCamera, setShowCamera] = useState(false);
  const [mode, setMode] = useState<'word' | 'letter'>('word');
  const [textInput, setTextInput] = useState('');
  const [recognizedTokens, setRecognizedTokens] = useState<string[]>([]);
  const [recognizedSignsText, setRecognizedSignsText] = useState('');
  const [completedSentence, setCompletedSentence] = useState('');
  const [isBuildingSentence, setIsBuildingSentence] = useState(false);
  const [sentenceError, setSentenceError] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showPronounPicker, setShowPronounPicker] = useState(false);
  const [pronounOverride, setPronounOverride] = useState<PronounPreference | null>(null);
  const [showRecognizedSignsEditor, setShowRecognizedSignsEditor] = useState(false);
  const recognizedTokensRef = useRef<string[]>([]);
  const recognizedSignsDraftRef = useRef('');
  const isEditingRecognizedSignsRef = useRef(false);
  const recognizedSignsEditorRef = useRef<TextInput>(null);
  const sentenceRequestRef = useRef(0);
  const { preference: defaultPronouns } = usePronouns();
  const effectivePronouns = pronounOverride ?? defaultPronouns;

  const findWord = useDictionaryStore((state) => state.findWord);

  // Keep one player alive for the whole screen, matching the fast path used by
  // branch `long`. useVideoPlayer updates the source when videoUrl changes.
  const player = useVideoPlayer(videoUrl, (videoPlayer) => {
    videoPlayer.loop = false;
    if (videoUrl) {
      videoPlayer.play();
    }
  });

  useEffect(() => {
    if (videoUrl) {
      player.play();
    }
  }, [player, videoUrl]);

  const createSentence = useCallback(async (tokens: string[]) => {
    const requestId = ++sentenceRequestRef.current;
    setIsBuildingSentence(true);
    setSentenceError('');

    try {
      const sentence = await buildSentence(tokens, {
        speakerPronoun: effectivePronouns.speakerPronoun,
        listenerPronoun: effectivePronouns.listenerPronoun,
        addSubject: effectivePronouns.addSubject,
      });
      if (requestId === sentenceRequestRef.current) {
        setCompletedSentence(sentence);
        setSentenceError('');
      }
    } catch (error) {
      console.warn('[LLM] Could not build a sentence:', error);
      if (requestId === sentenceRequestRef.current) {
        setCompletedSentence('');
        setSentenceError(t('translation.sentenceBuildError'));
      }
    } finally {
      if (requestId === sentenceRequestRef.current) {
        setIsBuildingSentence(false);
      }
    }
  }, [
    effectivePronouns.addSubject,
    effectivePronouns.listenerPronoun,
    effectivePronouns.speakerPronoun,
    t,
  ]);

  const resetTranslation = useCallback(() => {
    // Invalidate an in-flight LLM response so it cannot repopulate a cleared box.
    sentenceRequestRef.current += 1;
    recognizedTokensRef.current = [];
    recognizedSignsDraftRef.current = '';
    isEditingRecognizedSignsRef.current = false;
    setRecognizedTokens([]);
    setRecognizedSignsText('');
    setShowRecognizedSignsEditor(false);
    setCompletedSentence('');
    setSentenceError('');
    setIsBuildingSentence(false);
    recognizedSignsEditorRef.current?.blur();
  }, []);

  const openRecognizedSignsEditor = () => {
    recognizedSignsDraftRef.current = recognizedSignsText;
    isEditingRecognizedSignsRef.current = true;
    setShowRecognizedSignsEditor(true);
  };

  const confirmRecognizedSigns = () => {
    const tokens = parseRecognizedSigns(recognizedSignsDraftRef.current);
    const normalizedText = tokens.join(' · ');

    // Draft changes only reach the token list and LLM after confirmation.
    sentenceRequestRef.current += 1;
    setIsBuildingSentence(false);
    recognizedTokensRef.current = tokens;
    setRecognizedTokens(tokens);
    setRecognizedSignsText(normalizedText);
    recognizedSignsDraftRef.current = normalizedText;
    isEditingRecognizedSignsRef.current = false;
    setShowRecognizedSignsEditor(false);
    recognizedSignsEditorRef.current?.blur();
    Keyboard.dismiss();

    if (tokens.length > 0) {
      void createSentence(tokens);
    } else {
      setCompletedSentence('');
      setSentenceError('');
    }
  };

  const cancelRecognizedSignsEdit = () => {
    recognizedSignsDraftRef.current = recognizedSignsText;
    isEditingRecognizedSignsRef.current = false;
    setShowRecognizedSignsEditor(false);
    recognizedSignsEditorRef.current?.blur();
    Keyboard.dismiss();
  };

  const handleCompletedSentenceChange = useCallback((sentence: string) => {
    // A manual correction takes precedence over a response still in flight.
    sentenceRequestRef.current += 1;
    setIsBuildingSentence(false);
    setCompletedSentence(sentence);
    setSentenceError('');
  }, []);

  useEffect(() => {
    resetTranslation();
  }, [showCamera, mode, resetTranslation]);

  const handleWordResult = (newWord: string) => {
    const word = newWord.trim();
    if (!word) return;

    const baseTokens = isEditingRecognizedSignsRef.current
      ? parseRecognizedSigns(recognizedSignsDraftRef.current)
      : recognizedTokensRef.current;
    const nextTokens = [...baseTokens, word];
    const nextText = nextTokens.join(' · ');

    recognizedTokensRef.current = nextTokens;
    recognizedSignsDraftRef.current = nextText;
    isEditingRecognizedSignsRef.current = false;
    setRecognizedTokens(nextTokens);
    setRecognizedSignsText(nextText);
    setShowRecognizedSignsEditor(false);
    recognizedSignsEditorRef.current?.blur();
    Keyboard.dismiss();

    // Rebuild from the complete sign sequence whenever a new word is added.
    void createSentence(nextTokens);
  };

  const handleLetterResult = (newChar: string) => {
    setRecognizedTokens((tokens) => [...tokens, newChar]);
  };

  const closeCamera = () => {
    setShowPronounPicker(false);
    setShowCamera(false);
    resetTranslation();
  };

  const pronounPairLabel = effectivePronouns.addSubject
    ? formatPronounPreference(effectivePronouns)
    : t('translation.noAutomaticSubjectShort');

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

        <Modal
          transparent
          animationType="fade"
          visible={showPronounPicker}
          onRequestClose={() => setShowPronounPicker(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowPronounPicker(false)}>
            <View style={styles.pronounPickerOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.pronounPickerCard}>
                  <Text style={styles.pronounPickerTitle}>
                    {t('translation.choosePronouns')}
                  </Text>

                  <TouchableOpacity
                    style={[styles.pronounOption, pronounOverride === null && styles.pronounOptionSelected]}
                    onPress={() => {
                      setPronounOverride(null);
                      setShowPronounPicker(false);
                    }}
                  >
                    <Text style={styles.pronounOptionText}>
                      {t('translation.useDefaultPronouns')}
                    </Text>
                    <Text style={styles.pronounOptionSubtext}>
                      {defaultPronouns.addSubject
                        ? formatPronounPreference(defaultPronouns)
                        : t('translation.noAutomaticSubjectShort')}
                    </Text>
                  </TouchableOpacity>

                  {PRONOUN_PRESETS.map((preset) => {
                    const selected = pronounOverride?.presetId === preset.presetId;
                    return (
                      <TouchableOpacity
                        key={preset.presetId}
                        style={[styles.pronounOption, selected && styles.pronounOptionSelected]}
                        onPress={() => {
                          setPronounOverride(preset);
                          setShowPronounPicker(false);
                        }}
                      >
                        <Text style={styles.pronounOptionText}>
                          {preset.addSubject
                            ? formatPronounPreference(preset)
                            : t('translation.noAutomaticSubjectShort')}
                        </Text>
                        {selected && <Ionicons name="checkmark" size={20} color={theme.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <Modal
          transparent
          animationType="fade"
          visible={showRecognizedSignsEditor}
          onRequestClose={cancelRecognizedSignsEdit}
        >
          <KeyboardAvoidingView
            style={styles.recognizedEditorOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.recognizedEditorCard}>
              <Text style={styles.recognizedEditorTitle}>
                {t('translation.recognizedSignsEditorTitle')}
              </Text>
              <Text style={styles.recognizedEditorDescription}>
                {t('translation.recognizedSignsEditorDescription')}
              </Text>
              <TextInput
                ref={recognizedSignsEditorRef}
                style={styles.recognizedEditorInput}
                defaultValue={recognizedSignsText}
                onChangeText={(signs) => {
                  // Avoid React renders while the Android IME composes accents.
                  recognizedSignsDraftRef.current = signs;
                }}
                autoFocus
                multiline
                textAlignVertical="top"
                placeholder="..."
                placeholderTextColor="rgba(255,255,255,0.45)"
                selectionColor={theme.primary}
                accessibilityLabel={t('translation.recognizedSignsEditorTitle')}
              />
              <View style={styles.recognizedEditorActions}>
                <TouchableOpacity
                  onPress={cancelRecognizedSignsEdit}
                  style={styles.recognizedEditorActionButton}
                >
                  <Text style={styles.cancelRecognizedSignsText}>
                    {t('translation.cancelRecognizedSigns')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmRecognizedSigns}
                  style={[styles.recognizedEditorActionButton, { backgroundColor: theme.primary }]}
                >
                  <Ionicons name="checkmark" size={17} color="#fff" />
                  <Text style={styles.confirmRecognizedSignsText}>
                    {t('translation.confirmRecognizedSigns')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

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
          <View style={styles.cameraResultsContainer}>
            <TouchableOpacity
              style={styles.quickPronounButton}
              onPress={() => setShowPronounPicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`${t('translation.quickPronouns')}: ${pronounPairLabel}`}
            >
              <Ionicons name="people-outline" size={15} color="#fff" />
              <Text style={styles.quickPronounText} numberOfLines={1}>
                {t('translation.quickPronouns')}: {pronounPairLabel}
              </Text>
              <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.75)" />
            </TouchableOpacity>

            <View style={[styles.cameraResultBox, { borderColor: 'rgba(255,255,255,0.1)' }]}>
              <View style={styles.resultHeaderRow}>
                <Text style={[styles.cameraResultLabel, styles.resultHeaderLabel, { color: theme.primary }]}>
                  {t('translation.recognizedSigns')}
                </Text>
                {(recognizedTokens.length > 0 || completedSentence.length > 0) && (
                  <TouchableOpacity
                    onPress={resetTranslation}
                    style={styles.clearBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t('translation.clear')}
                  >
                    <Ionicons name="trash-outline" size={14} color={theme.error} />
                    <Text style={[styles.clearBtnText, { color: theme.error }]}>
                      {t('translation.clear')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.recognizedSignsValueButton}
                onPress={openRecognizedSignsEditor}
                accessibilityRole="button"
                accessibilityLabel={t('translation.recognizedSigns')}
                accessibilityHint={t('translation.editRecognizedSignsHint')}
              >
                <Text style={[styles.cameraResultText, styles.recognizedSignsValue]}>
                  {recognizedSignsText || '...'}
                </Text>
                <Ionicons name="pencil-outline" size={17} color="rgba(255,255,255,0.65)" />
              </TouchableOpacity>
              <Text style={styles.editRecognizedSignsHelper}>
                {t('translation.editRecognizedSignsHelper')}
              </Text>
            </View>

            <View style={[styles.cameraResultBox, { borderColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={[styles.cameraResultLabel, { color: theme.primary }]}>
                {t('translation.completedSentence')}
              </Text>
              <TextInput
                style={[styles.cameraResultText, styles.completedSentenceInput]}
                value={completedSentence}
                onChangeText={handleCompletedSentenceChange}
                placeholder="..."
                placeholderTextColor="rgba(255,255,255,0.65)"
                multiline
                textAlignVertical="top"
                accessibilityLabel={t('translation.completedSentence')}
                accessibilityHint={t('translation.editSentenceHint')}
              />
              {isBuildingSentence && (
                <Text style={styles.buildingSentenceText}>{t('translation.buildingSentence')}</Text>
              )}
              {!!sentenceError && (
                <View style={styles.sentenceErrorRow}>
                  <Text style={[styles.sentenceErrorText, { color: theme.error }]}>
                    {sentenceError}
                  </Text>
                  <TouchableOpacity
                    onPress={() => void createSentence([...recognizedTokensRef.current])}
                    disabled={recognizedTokensRef.current.length === 0 || isBuildingSentence}
                    style={styles.retrySentenceButton}
                  >
                    <Ionicons name="refresh" size={14} color={theme.primary} />
                    <Text style={[styles.retrySentenceText, { color: theme.primary }]}>
                      {t('translation.retrySentence')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

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
              <VideoView
                style={styles.videoPlayer}
                player={player}
                contentFit="contain"
                nativeControls
              />
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'position'}>
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
  cameraResultsContainer: {
    position: 'absolute',
    top: 130,
    left: 20,
    right: 20,
    zIndex: 15,
    gap: 8,
  },
  cameraResultBox: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 16,
    borderRadius: 12,
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
  resultHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  resultHeaderLabel: {
    marginBottom: 0,
  },
  quickPronounButton: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickPronounText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  pronounPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    padding: 24,
  },
  pronounPickerCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pronounPickerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  pronounOption: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pronounOptionSelected: {
    backgroundColor: 'rgba(69,200,194,0.14)',
  },
  pronounOptionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  pronounOptionSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  completedSentenceInput: {
    minHeight: 34,
    padding: 0,
  },
  recognizedSignsValueButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  recognizedSignsValue: {
    flex: 1,
  },
  editRecognizedSignsHelper: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 4,
  },
  recognizedEditorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 22,
  },
  recognizedEditorCard: {
    backgroundColor: '#242424',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 18,
  },
  recognizedEditorTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  recognizedEditorDescription: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    marginBottom: 14,
  },
  recognizedEditorInput: {
    minHeight: 110,
    maxHeight: 220,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '500',
  },
  recognizedEditorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  recognizedEditorActionButton: {
    minHeight: 38,
    paddingHorizontal: 15,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cancelRecognizedSignsText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
  },
  confirmRecognizedSignsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  buildingSentenceText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 6,
  },
  sentenceErrorRow: {
    marginTop: 8,
    gap: 8,
  },
  sentenceErrorText: {
    fontSize: 12,
    lineHeight: 17,
  },
  retrySentenceButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
  },
  retrySentenceText: {
    fontSize: 12,
    fontWeight: '700',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
