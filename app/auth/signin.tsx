import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { privateApi } from '@/api/privateApi';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function SignInScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isFormValid = email.trim() !== '' && password !== '';

  const handleSignIn = async () => {
    if (!isFormValid) {
      Alert.alert(t('auth.missingInfo'), t('auth.missingInfoMsg'));
      return;
    }

    setIsLoading(true);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Không thể kết nối tới máy chủ. Kiểm tra lại mạng và thử lại.')), 15_000)
      );
      const { data, error } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        timeout,
      ]) as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;

      if (error || !data.session) {
        Alert.alert(t('auth.loginFailed'), error?.message || t('auth.loginFailedMsg'));
        return;
      }

      await AsyncStorage.setItem('access_token', data.session.access_token);
      router.replace('/(tabs)/translation');

      privateApi.get('/auth/me')
        .then(res => AsyncStorage.setItem('user_info', JSON.stringify(res.data)))
        .catch(() => {});
    } catch (e: any) {
      Alert.alert(t('auth.loginFailed'), e?.message || t('auth.loginFailedMsg'));
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = [styles.input, { borderColor: colors.primary, color: colors.text, backgroundColor: colors.textInputBG }];

  return (
    <KeyboardAvoidingView
      style={[styles.outer, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image source={require('../../assets/images/logo.png')} style={styles.logo} />

        <Text style={[styles.subtitle, { color: colors.mediumGray }]}>
          {t('auth.loginSubtitle')}
        </Text>

        <TextInput
          placeholder={t('auth.email')}
          style={inputStyle}
          placeholderTextColor={colors.mediumGray}
          selectionColor={colors.primary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!isLoading}
        />

        <View style={[styles.passwordWrapper, { borderColor: colors.primary, backgroundColor: colors.textInputBG }]}>
          <TextInput
            placeholder={t('auth.password')}
            style={[styles.passwordInput, { color: colors.text }]}
            placeholderTextColor={colors.mediumGray}
            selectionColor={colors.primary}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            editable={!isLoading}
          />
          <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
            <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.mediumGray} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: isFormValid && !isLoading ? colors.primary : colors.mediumGray }]}
          onPress={handleSignIn}
          disabled={!isFormValid || isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{t('auth.signIn')}</Text>
          }
        </TouchableOpacity>

        <Link href="/auth/signup" asChild>
          <TouchableOpacity disabled={isLoading}>
            <Text style={[styles.link, { color: colors.primary }]}>
              {t('auth.noAccount')} <Text style={styles.boldText}>{t('auth.signUp')}</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { height: 200, width: 200, marginBottom: 3 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 23 },
  input: { width: '100%', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15 },
  passwordWrapper: { width: '100%', borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 12 },
  passwordInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  eyeBtn: { padding: 4 },
  button: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', width: '100%', marginTop: 8, height: 48, justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link: { marginTop: 16 },
  boldText: { fontWeight: 'bold' },
});
