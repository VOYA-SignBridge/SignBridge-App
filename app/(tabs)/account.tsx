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
  Modal
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
import { supabase } from '@/lib/supabase';

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

  const setRegion = useDictionaryStore(state => state.setRegion);
  const currentRegion = useDictionaryStore(state => state.region);

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