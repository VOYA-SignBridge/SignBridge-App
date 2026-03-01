import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { supabase } from '../../db/supabase';
import AsyncStorage  from '@react-native-async-storage/async-storage';
import { privateApi } from '@/api/privateApi';
export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

const handleSignIn = async () => {
  if (!email || !password) {
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

  // 1. Lưu token cho các request sau
  await AsyncStorage.setItem("access_token", accessToken);
  router.replace("/translation");

  try {
    // 2. Gọi BE để get_or_create user
    const res = await privateApi.get("/auth/me");
    console.log("User from backend:", res.data);
    await AsyncStorage.setItem("user_info", JSON.stringify(res.data));
    // Ở đây bạn có thể lưu user info vào context / store nếu muốn
  } catch (e) {
    console.log("Error calling /auth/me:", e);
    // tuỳ bạn: có thể Alert, nhưng thường vẫn cho vào app để retry sau
  }

  // 3. Điều hướng vào app
};


  return (
    <LinearGradient colors={['#ffffff', '#ffffff']} style={styles.container}>
      <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
      <Text style={styles.subtitle}>An AI-based Sign Language Translator</Text>

      <TextInput
        placeholder="Email"
        style={styles.input}
        placeholderTextColor="#ccc"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        style={styles.input}
        placeholderTextColor="#ccc"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleSignIn}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>

      <Link href="/auth/signup" asChild>
        <TouchableOpacity>
          <Text style={styles.link}>Don’t have an account? Sign Up</Text>
        </TouchableOpacity>
      </Link>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { height: 180, width: 180, marginBottom: 16 },
  subtitle: {
    color: '#00afef',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    width: '100%',
    borderColor: '#00afef',
    borderWidth: 1,
    borderRadius: 10,
    color: '#00afef',
    padding: 12,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#1f5ca9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link: { color: '#00afef', marginTop: 16 },
});
