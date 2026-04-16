import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Switch,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Dropdown } from 'react-native-element-dropdown';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDictionaryStore } from '../data/useDictionaryStore';
import { syncDictionary } from '../data/DictionaryService';
import { APP_LANGUAGES, SIGN_LANGUAGES } from '../data/languages';
import { supabase } from '../../db/supabase';

type User = {
  email: string;
  full_name: string;
};

export default function AccountScreen() {
  const {
    theme,
    toggleTheme,
    colors
  } = useTheme();
  
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const setRegion = useDictionaryStore(state => state.setRegion);
  const currentRegion = useDictionaryStore(state => state.region);
  const [appLangValue, setAppLangValue] = useState('Vietnamese');

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
      Alert.alert("Thành công", "Đã chuyển sang bộ từ điển " + item.label);
    } catch (error) {
      console.log("Loi khi thay doi vung mien: " + error);
      Alert.alert("Lỗi", "Không thể tải bộ từ điển mới");
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
          <View style={styles.loadingBox}>
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />
            <Text style={styles.loadingText}>Đang tải dữ liệu ký hiệu...</Text>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandHeader}>
            <Text style={[
              styles.brandTitle,
              {
                color: colors.text2
              }
            ]}>SignBridge</Text>
            <Text style={styles.brandSubtitle}>by CTU & CSIRO</Text>
        </View>

        <View style={styles.profileSection}>
          <Image 
            source={require('../../assets/images/default.jpg')} 
            style={[
              styles.avatar,
              {
                borderColor: colors.primary
              }
            ]}
          />
          <Text style={[
            styles.profileName,
            {
              color: colors.text
            }
          ]}>
            {user?.full_name}
          </Text>
          <Text style={[
            styles.profileEmail,
            {
              color: colors.icon
            }
          ]}>
            {user?.email}
          </Text>
        </View>

        <View style={[
          styles.settingsGroup,
          {
            backgroundColor: theme === 'dark' ? colors.controlBG : '#fff'
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
                  backgroundColor: theme === 'dark' ? '#333' : '#F5F5F5'
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
              ]}>Ngôn ngữ ứng dụng</Text>
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
              placeholder="Chọn..."
              placeholderStyle={{
                color: colors.icon,
                fontSize: 14,
                textAlign: 'right',
                marginRight: 8
              }}
              value={appLangValue}
              onChange={item => setAppLangValue(item.value)}
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
                  backgroundColor: theme === 'dark' ? '#333' : '#F5F5F5'
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
              ]}>Ngôn ngữ ký hiệu</Text>
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
              placeholder="Chọn..."
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
                  backgroundColor: theme === 'dark' ? '#333' : '#F5F5F5'
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
              ]}>Giao diện tối</Text>
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
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>

        <Text style={[
          styles.versionText,
          {
            color: colors.icon
          }
        ]}>Phiên bản 1.0.0</Text>
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
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 15,
    alignItems: 'center',
    width: '80%'
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 25,
    marginTop: 40
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800'
  },
  brandSubtitle: {
    fontSize: 18,
    color: '#888',
    fontWeight: '600',
    marginLeft: 8
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 20
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    marginBottom: 12
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4
  },
  profileEmail: {
    fontSize: 15,
    marginBottom: 8
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600'
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    marginLeft: 10,
    opacity: 0.6
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