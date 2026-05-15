import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function SignUpScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isFormValid = fullName.trim() !== '' && email.trim() !== '' && password !== '' && confirm !== '';

  const handleSignUp = async () => {
    if (!isFormValid) {
      Alert.alert(t('auth.missingInfo'), t('auth.missingInfoMsgReg'));
      return;
    }
    if (password !== confirm) {
      Alert.alert(t('auth.passwordMismatch'));
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      Alert.alert(t('auth.error'), error.message);
    } else {
      Alert.alert(t('auth.success'), t('auth.registerSuccess'));
      router.replace('/auth/signin');
    }
  };

  const inputStyle = [styles.input, { borderColor: colors.primary, color: colors.text, backgroundColor: colors.textInputBG }];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
      <Text style={[styles.subtitle, { color: colors.mediumGray }]}>{t('auth.registerSubtitle')}</Text>

      <TextInput
        placeholder={t('auth.fullName')}
        placeholderTextColor={colors.mediumGray}
        selectionColor={colors.primary}
        style={inputStyle}
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        placeholder={t('auth.email')}
        placeholderTextColor={colors.mediumGray}
        selectionColor={colors.primary}
        style={inputStyle}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />

      <View style={[styles.passwordWrapper, { borderColor: colors.primary, backgroundColor: colors.textInputBG }]}>
        <TextInput
          placeholder={t('auth.password')}
          placeholderTextColor={colors.mediumGray}
          selectionColor={colors.primary}
          style={[styles.passwordInput, { color: colors.text }]}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
          <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.mediumGray} />
        </TouchableOpacity>
      </View>

      <View style={[styles.passwordWrapper, { borderColor: colors.primary, backgroundColor: colors.textInputBG }]}>
        <TextInput
          placeholder={t('auth.confirmPassword')}
          placeholderTextColor={colors.mediumGray}
          selectionColor={colors.primary}
          style={[styles.passwordInput, { color: colors.text }]}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry={!showConfirm}
        />
        <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
          <Ionicons name={showConfirm ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.mediumGray} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: isFormValid ? colors.primary : colors.avatarBG }]}
        onPress={handleSignUp}
        disabled={!isFormValid}
      >
        <Text style={styles.buttonText}>{t('auth.signUp')}</Text>
      </TouchableOpacity>

      <Link href="/auth/signin" asChild>
        <TouchableOpacity>
          <Text style={[styles.link, { color: colors.primary }]}>
            {t('auth.haveAccount')} <Text style={styles.boldText}>{t('auth.signIn')}</Text>
          </Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    height: 200,
    width: 200,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 23,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    fontSize: 15,
  },
  passwordWrapper: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  eyeBtn: {
    padding: 4,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  link: {
    marginTop: 16,
    fontSize: 14,
  },
  boldText: {
    fontWeight: 'bold',
  },
});
