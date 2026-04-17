import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { supabase } from '../../db/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { privateApi } from '@/api/privateApi';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isFormValid = email.trim() !== '' && password !== '';

  const handleSignIn = async () => {
    if (!isFormValid) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập email và mật khẩu.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      console.log("Sign-in error:", error);
      Alert.alert("Đăng nhập thất bại", error?.message || "Không thể đăng nhập");
      return;
    }

    const accessToken = data.session.access_token;
    console.log("Supabase access_token:", accessToken);

    await AsyncStorage.setItem("access_token", accessToken);
    router.replace("/(tabs)/translation");

    try {
      const res = await privateApi.get("/auth/me");
      console.log("User from backend:", res.data);
      await AsyncStorage.setItem("user_info", JSON.stringify(res.data));
    } catch (e) {
      console.log("Error calling /auth/me:", e);
    }
  };

  return (
    <LinearGradient colors={['#ffffff', '#ffffff']} style={styles.container}>
      <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
      
      <Text style={styles.subtitle}>
        Vui lòng đăng nhập để tiếp tục
      </Text>

      <TextInput
        placeholder="Email"
        style={styles.input}
        placeholderTextColor="#ccc"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      
      <TextInput
        placeholder="Mật khẩu"
        style={styles.input}
        placeholderTextColor="#ccc"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity 
        style={[styles.button, !isFormValid && styles.buttonDisabled]} 
        onPress={handleSignIn}
        disabled={!isFormValid}
      >
        <Text style={styles.buttonText}>Đăng nhập</Text>
      </TouchableOpacity>

      <Link href="/auth/signup" asChild>
        <TouchableOpacity>
          <Text style={styles.link}>
            Bạn chưa có tài khoản? <Text style={styles.boldText}>Đăng ký</Text>
          </Text>
        </TouchableOpacity>
      </Link>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  logo: {
    height: 200,
    width: 200,
    marginBottom: 3
  },
  subtitle: {
    color: 'grey',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 23
  },
  input: {
    width: '100%',
    borderColor: '#00afef',
    borderWidth: 1,
    borderRadius: 10,
    color: '#00afef',
    padding: 12,
    marginBottom: 12
  },
  button: {
    backgroundColor: '#1f5ca9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
    marginTop: 8
  },
  buttonDisabled: {
    backgroundColor: '#a0bce0'
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  link: {
    color: '#00afef',
    marginTop: 16
  },
  boldText: {
    fontWeight: 'bold'
  }
});