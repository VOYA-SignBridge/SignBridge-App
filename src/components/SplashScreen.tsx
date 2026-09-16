import React from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function SplashScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Image
        source={require('../../assets/images/CTU_logo.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Logo Đại học Cần Thơ"
      />
      <Text style={[styles.appName, { color: colors.text }]}>CTU.SignBridge</Text>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.text, { color: colors.mediumGray }]}>
        Vui lòng chờ...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { width: 140, height: 140, marginBottom: 6 },
  appName: { fontSize: 24, fontWeight: '700', marginBottom: 10 },
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  text: {
    fontSize: 15,
    fontWeight: '500',
  },
});
