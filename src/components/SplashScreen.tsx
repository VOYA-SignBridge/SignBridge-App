import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function SplashScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Image 
        source={require('../../assets/images/logo.png')} 
        style={styles.logo}
        resizeMode="contain"
      />

      <ActivityIndicator size="large" color={colors.primary} />

      <Text style={[styles.text, { color: colors.text }]}>
        Đang kiểm tra dữ liệu...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,          
    height: 200,          
    marginBottom: 30,   
    borderRadius: 25,
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: '500',
  },
});