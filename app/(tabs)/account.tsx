import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Switch,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import { Dropdown } from 'react-native-element-dropdown';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDictionaryStore } from '../data/useDictionaryStore';
import { syncDictionary } from '../data/DictionaryService';
import { APP_LANGUAGES, SIGN_LANGUAGES } from '../data/languages';
import { supabase } from '../db/supabase';
import {
  formatPronounPreference,
  PRONOUN_PRESETS,
  PronounPresetId,
  usePronouns,
} from '@/contexts/PronounContext';

type User = {
  email: string;
  full_name: string;
};

export default function AccountScreen() {
  const { theme, toggleTheme, colors } = useTheme();
  const { appLang, switchLanguage } = useLanguage();
  const { t } = useTranslation();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showCustomPronouns, setShowCustomPronouns] = useState(false);
  const [customSpeaker, setCustomSpeaker] = useState('');
  const [customListener, setCustomListener] = useState('');
  const { preference, setPreset, setCustomPronouns } = usePronouns();

  const setRegion = useDictionaryStore(state => state.setRegion);
  const currentRegion = useDictionaryStore(state => state.region);

  const pronounOptions = [
    ...PRONOUN_PRESETS.map((preset) => ({
      label: preset.addSubject
        ? formatPronounPreference(preset)
        : t('settings.noAutomaticSubject'),
      value: preset.presetId,
    })),
    {
      label: preference.presetId === 'custom'
        ? `${t('settings.customPronouns')}: ${formatPronounPreference(preference)}`
        : t('settings.customPronouns'),
      value: 'custom' as PronounPresetId,
    },
  ];

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: authUser }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.log("Loi lay thong tin user: " + error.message);
        return;
      }

      if (authUser) {
        setUser({
          full_name: authUser.user_metadata?.full_name || "Người dùng",
          email: authUser.email || ""
        });
      }
    };

    fetchUser();
  }, []);

  const handleSignLangChange = async (item: { label: string, value: string }) => {
    console.log("--- BAT DAU THAY DOI VUNG MIEN ---");
    console.log("Vung moi chon: " + item.value);

    setIsDownloading(true);

    try {
      await AsyncStorage.setItem('@user_region', item.value);
      setRegion(item.value);
      
      console.log("Dang goi syncDictionary cho vung: " + item.value);
      await syncDictionary(item.value);
      
      console.log("Thay doi vung mien va tai du lieu thanh cong");
      Alert.alert(t('settings.success'), t('settings.dictChanged', { lang: item.label }));
    } catch (error) {
      console.log("Loi khi thay doi vung mien: " + error);
      Alert.alert(t('settings.error'), t('settings.dictError'));
    } finally {
      setIsDownloading(false);
    }
    console.log("--- KET THUC THAY DOI VUNG MIEN ---");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    await AsyncStorage.clear();
    router.replace('/auth/signin');
  };

  const handlePronounChange = (presetId: PronounPresetId) => {
    if (presetId !== 'custom') {
      setPreset(presetId);
      return;
    }

    setCustomSpeaker(preference.presetId === 'custom' ? preference.speakerPronoun : '');
    setCustomListener(preference.presetId === 'custom' ? preference.listenerPronoun : '');
    setShowCustomPronouns(true);
  };

  const saveCustomPronouns = () => {
    if (!customSpeaker.trim() || !customListener.trim()) return;
    setCustomPronouns(customSpeaker, customListener);
    setShowCustomPronouns(false);
  };

  return (
    <SafeAreaView style={[
      styles.container,
      {
        backgroundColor: colors.background
      }
    ]}>
      <Modal
        transparent={true}
        animationType="fade"
        visible={isDownloading}
      >
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingBox, { backgroundColor: colors.cardBG }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>{t('settings.loadingDict')}</Text>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={showCustomPronouns}
        onRequestClose={() => setShowCustomPronouns(false)}
      >
        <View style={styles.customModalOverlay}>
          <View style={[styles.customModalCard, { backgroundColor: colors.cardBG }]}>
            <Text style={[styles.customModalTitle, { color: colors.text }]}>
              {t('settings.customPronounsTitle')}
            </Text>
            <Text style={[styles.customModalDescription, { color: colors.icon }]}>
              {t('settings.customPronounsDescription')}
            </Text>

            <Text style={[styles.customInputLabel, { color: colors.text }]}>
              {t('settings.speakerPronoun')}
            </Text>
            <TextInput
              style={[
                styles.customInput,
                { color: colors.text, backgroundColor: colors.textInputBG, borderColor: colors.borderColor },
              ]}
              value={customSpeaker}
              onChangeText={setCustomSpeaker}
              placeholder={t('settings.speakerPronounPlaceholder')}
              placeholderTextColor={colors.icon}
              autoCapitalize="none"
            />

            <Text style={[styles.customInputLabel, { color: colors.text }]}>
              {t('settings.listenerPronoun')}
            </Text>
            <TextInput
              style={[
                styles.customInput,
                { color: colors.text, backgroundColor: colors.textInputBG, borderColor: colors.borderColor },
              ]}
              value={customListener}
              onChangeText={setCustomListener}
              placeholder={t('settings.listenerPronounPlaceholder')}
              placeholderTextColor={colors.icon}
              autoCapitalize="none"
            />

            <View style={styles.customModalActions}>
              <TouchableOpacity onPress={() => setShowCustomPronouns(false)} style={styles.customModalButton}>
                <Text style={[styles.customModalButtonText, { color: colors.icon }]}>
                  {t('settings.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveCustomPronouns}
                disabled={!customSpeaker.trim() || !customListener.trim()}
                style={[
                  styles.customModalButton,
                  styles.customModalSaveButton,
                  { backgroundColor: colors.primary },
                  (!customSpeaker.trim() || !customListener.trim()) && styles.disabledButton,
                ]}
              >
                <Text style={[styles.customModalButtonText, { color: '#fff' }]}>
                  {t('settings.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandHeader}>
          <Text style={[styles.brandTitle, { color: colors.text2 }]}>SignBridge</Text>
          <Text style={[styles.brandSubtitle, { color: colors.mediumGray }]}>by CTU & CSIRO</Text>
        </View>

        <View style={styles.profileCard}>
          <Image
            source={require('../../assets/images/default.jpg')}
            style={[styles.avatar, { borderColor: colors.primary }]}
          />
          <Text style={[styles.profileName, { color: colors.text }]}>
            {user?.full_name}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.icon }]}>
            {user?.email}
          </Text>
        </View>

        <View style={[
          styles.settingsGroup,
          {
            backgroundColor: colors.controlBG
          }
        ]}>
          <View style={[
            styles.settingRow,
            {
              borderBottomColor: colors.lightGray
            }
          ]}>
            <View style={styles.rowLabel}>
              <View style={[
                styles.iconBox,
                {
                  backgroundColor: colors.cardBG
                }
              ]}>
                <Ionicons
                  name="language"
                  size={20}
                  color={colors.text}
                />
              </View>
              <Text style={[
                styles.rowText,
                {
                  color: colors.text
                }
              ]}>{t('settings.appLanguage')}</Text>
            </View>
            <Dropdown
              style={styles.dropdown}
              selectedTextStyle={[
                styles.selectedTextStyle,
                {
                  color: colors.text
                }
              ]}
              data={APP_LANGUAGES}
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder={t('settings.select')}
              placeholderStyle={{
                color: colors.icon,
                fontSize: 14,
                textAlign: 'right',
                marginRight: 8
              }}
              value={appLang}
              onChange={item => switchLanguage(item.value as 'vi' | 'en')}
              renderRightIcon={() => (
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.icon}
                />
              )}
            />
          </View>

          <View style={[
            styles.settingRow,
            {
              borderBottomColor: colors.lightGray
            }
          ]}>
            <View style={styles.rowLabel}>
              <View style={[
                styles.iconBox,
                {
                  backgroundColor: colors.cardBG
                }
              ]}>
                <Ionicons
                  name="hand-right"
                  size={20}
                  color={colors.text}
                />
              </View>
              <Text style={[
                styles.rowText,
                {
                  color: colors.text
                }
              ]}>{t('settings.signLanguage')}</Text>
            </View>
            <Dropdown
              style={styles.dropdown}
              selectedTextStyle={[
                styles.selectedTextStyle,
                {
                  color: colors.text
                }
              ]}
              data={SIGN_LANGUAGES}
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder={t('settings.select')}
              placeholderStyle={{
                color: colors.icon,
                fontSize: 14,
                textAlign: 'right',
                marginRight: 8
              }}
              value={currentRegion}
              onChange={handleSignLangChange}
              renderRightIcon={() => (
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.icon}
                />
              )}
            />
          </View>

          <View style={[
            styles.settingRow,
            { borderBottomColor: colors.lightGray },
          ]}>
            <View style={[styles.rowLabel, styles.pronounRowLabel]}>
              <View style={[styles.iconBox, { backgroundColor: colors.cardBG }]}>
                <Ionicons name="people-outline" size={20} color={colors.text} />
              </View>
              <Text style={[styles.rowText, styles.pronounRowText, { color: colors.text }]}>
                {t('settings.pronouns')}
              </Text>
            </View>
            <Dropdown
              style={styles.pronounDropdown}
              selectedTextStyle={[styles.selectedTextStyle, { color: colors.text }]}
              data={pronounOptions}
              maxHeight={360}
              labelField="label"
              valueField="value"
              value={preference.presetId}
              onChange={(item) => handlePronounChange(item.value as PronounPresetId)}
              renderRightIcon={() => (
                <Ionicons name="chevron-forward" size={18} color={colors.icon} />
              )}
            />
          </View>

           <View style={styles.settingRow}>
            <View style={styles.rowLabel}>
              <View style={[
                styles.iconBox,
                {
                  backgroundColor: colors.cardBG
                }
              ]}>
                <Ionicons
                  name={theme === 'dark' ? "moon" : "sunny"}
                  size={20}
                  color={colors.text}
                />
              </View>
              <Text style={[
                styles.rowText,
                {
                  color: colors.text
                }
              ]}>{t('settings.darkMode')}</Text>
            </View>
            <Switch
              trackColor={{
                false: '#e0e0e0',
                true: colors.primary
              }}
              thumbColor={'#fff'}
              onValueChange={toggleTheme}
              value={theme === 'dark'}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.7}
          style={[
            styles.logoutButton,
            {
              backgroundColor: colors.primary
            }
          ]}
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color="#fff"
          />
          <Text style={styles.logoutText}>{t('settings.logout')}</Text>
        </TouchableOpacity>

        <Text style={[
          styles.versionText,
          {
            color: colors.icon
          }
        ]}>{t('settings.version')}</Text>
        <View style={{
          height: 40
        }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    padding: 20
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingBox: {
    padding: 25,
    borderRadius: 15,
    alignItems: 'center',
    width: '80%',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 36,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  brandSubtitle: {
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 8,
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2.5,
    marginBottom: 14,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  settingsGroup: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent'
  },
  rowLabel: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  rowText: {
    fontSize: 16,
    fontWeight: '500'
  },
  dropdown: {
    width: 150,
    height: 30,
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  selectedTextStyle: {
    fontSize: 14,
    textAlign: 'right',
    marginRight: 8,
    fontWeight: '500'
  },
  pronounDropdown: {
    width: 140,
    minHeight: 34,
  },
  pronounRowLabel: {
    flex: 1,
    minWidth: 0,
  },
  pronounRowText: {
    flexShrink: 1,
  },
  customModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  customModalCard: {
    borderRadius: 18,
    padding: 20,
  },
  customModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  customModalDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 18,
  },
  customInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  customInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 14,
  },
  customModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  customModalButton: {
    minWidth: 80,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  customModalSaveButton: {
    minWidth: 90,
  },
  customModalButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.45,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 30,
    marginBottom: 15,
    marginTop: 10
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12
  }
});
