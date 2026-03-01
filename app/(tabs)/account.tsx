import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Switch, TouchableOpacity, Image, ScrollView, SafeAreaView } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Dropdown } from 'react-native-element-dropdown';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

type User = {
  created_at: string;
  email: string;
  full_name: string;
  hashed_password?: string;
  id: number;
  role: string;
  supabase_id: string;
};

export default function AccountScreen() {
  const { theme, toggleTheme, colors } = useTheme();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const [appLangValue, setAppLangValue] = useState(null);
  const [signLangValue, setSignLangValue] = useState(null);

  const app_language = [
    { label: 'Tiếng Việt', value: 'Vietnamese' },
    { label: 'English', value: 'English' },
    { label: 'Spanish', value: 'Spanish' },
    { label: 'French', value: 'French' },
  ];

  const sign_language = [
    { label: 'VSL (Hà Nội)', value: 'Ha Noi' },
    { label: 'ASL (Mỹ)', value: 'American' },
    { label: 'SSL (Tây Ban Nha)', value: 'Spanish' },
    { label: 'FSL (Pháp)', value: 'French' },
  ];

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem("user_info");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    })();
  }, []);

  const handleLogout = () => {
    AsyncStorage.clear();
    router.replace('/auth/signin');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.brandHeader}>
            <Text style={[styles.brandTitle, { color: colors.text2 }]}>SignBridge</Text>
            <Text style={styles.brandSubtitle}>by CTU & CSIRO</Text>
        </View>

        <View style={styles.profileSection}>
          <Image 
            source={require('../../assets/images/default.jpg')} 
            style={[styles.avatar, { borderColor: colors.primary }]}
          />
          <Text style={[styles.profileName, { color: colors.text }]}>
            {user?.full_name || "User Name"}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.icon }]}>
            {user?.email || "email@example.com"}
          </Text>
          {/* <View style={[styles.roleBadge, { backgroundColor: colors.lightGray }]}>
             <Text style={[styles.roleText, { color: colors.mediumGray }]}>{user?.role || "Member"}</Text>
          </View> */}
        </View>

        <View style={[styles.settingsGroup, { backgroundColor: theme === 'dark' ? colors.controlBG : '#fff' }]}>
          
          <View style={[styles.settingRow, { borderBottomColor: colors.lightGray }]}>
            <View style={styles.rowLabel}>
              <View style={[styles.iconBox, { backgroundColor: theme === 'dark' ? '#333' : '#F5F5F5' }]}>
                <Ionicons name="language" size={20} color={colors.text} />
              </View>
              <Text style={[styles.rowText, { color: colors.text }]}>Ngôn ngữ ứng dụng</Text>
            </View>
            <Dropdown
              style={styles.dropdown}
              selectedTextStyle={[styles.selectedTextStyle, { color: colors.text }]}
              data={app_language}
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder="Chọn..."
              placeholderStyle={{ color: colors.icon, fontSize: 14, textAlign: 'right', marginRight: 8 }}
              value={appLangValue}
              onChange={item => setAppLangValue(item.value)}
              renderRightIcon={() => <Ionicons name="chevron-forward" size={18} color={colors.icon} />}
            />
          </View>

          <View style={[styles.settingRow, { borderBottomColor: colors.lightGray }]}>
            <View style={styles.rowLabel}>
              <View style={[styles.iconBox, { backgroundColor: theme === 'dark' ? '#333' : '#F5F5F5' }]}>
                <Ionicons name="hand-right" size={20} color={colors.text} />
              </View>
              <Text style={[styles.rowText, { color: colors.text }]}>Ngôn ngữ ký hiệu</Text>
            </View>
            <Dropdown
              style={styles.dropdown}
              selectedTextStyle={[styles.selectedTextStyle, { color: colors.text }]}
              data={sign_language}
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder="Chọn..."
              placeholderStyle={{ color: colors.icon, fontSize: 14, textAlign: 'right', marginRight: 8 }}
              value={signLangValue}
              onChange={item => setSignLangValue(item.value)}
              renderRightIcon={() => <Ionicons name="chevron-forward" size={18} color={colors.icon} />}
            />
          </View>

           <View style={styles.settingRow}>
            <View style={styles.rowLabel}>
              <View style={[styles.iconBox, { backgroundColor: theme === 'dark' ? '#333' : '#F5F5F5' }]}>
                <Ionicons name={theme === 'dark' ? "moon" : "sunny"} size={20} color={colors.text} />
              </View>
              <Text style={[styles.rowText, { color: colors.text }]}>Giao diện tối</Text>
            </View>
            <Switch
              trackColor={{ false: '#e0e0e0', true: colors.primary }}
              thumbColor={'#fff'}
              onValueChange={toggleTheme}
              value={theme === 'dark'}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.7}
          style={[styles.logoutButton, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>

        <Text style={[styles.versionText, { color: colors.icon }]}>Phiên bản 1.0.0</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 25,
    marginTop: 40,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  brandSubtitle: {
    fontSize: 18,
    color: '#888',
    fontWeight: '600',
    marginLeft: 8,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    marginBottom: 12,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 15,
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    marginLeft: 10,
    opacity: 0.6,
  },
  settingsGroup: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  rowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowText: {
    fontSize: 16,
    fontWeight: '500',
  },
  dropdown: {
    width: 130,
    height: 30,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  selectedTextStyle: {
    fontSize: 15,
    textAlign: 'right',
    marginRight: 8,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 30,
    marginBottom: 15,
    marginTop: 10,
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
  },
});