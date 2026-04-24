import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { supabase } from '../db/supabase';

export default function SignUpScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const isFormValid = fullName.trim() !== '' && email.trim() !== '' && password !== '' && confirm !== '';

  const handleSignUp = async () => {
    if (!isFormValid) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ các trường.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Mật khẩu không khớp');
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      Alert.alert('Lỗi', error.message);
    } else {
      Alert.alert('Thành công', 'Tài khoản đã được tạo! Vui lòng đăng nhập.');
      router.replace('/auth/signin');
    }
  };

  return (
    <LinearGradient colors={['#fff', '#fff']} style={styles.container}>
      <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
      <Text style={styles.subtitle}>Vui lòng điền đầy đủ thông tin</Text>

      <TextInput
        placeholder="Họ và tên"
        placeholderTextColor="#ccc"
        style={styles.input}
        value={fullName}
        onChangeText={setFullName}
      />

      <TextInput
        placeholder="Email"
        placeholderTextColor="#ccc"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Mật khẩu"
        placeholderTextColor="#ccc"
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        placeholder="Xác nhận mật khẩu"
        placeholderTextColor="#ccc"
        style={styles.input}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
      />

      <TouchableOpacity 
        style={[styles.button, !isFormValid && styles.buttonDisabled]} 
        onPress={handleSignUp}
        disabled={!isFormValid}
      >
        <Text style={styles.buttonText}>Đăng ký</Text>
      </TouchableOpacity>

      <Link href="/auth/signin" asChild>
        <TouchableOpacity>
          <Text style={styles.link}>
            Bạn đã có tài khoản? <Text style={styles.boldText}>Đăng nhập</Text>
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
    marginTop: 16,
    fontSize: 14,
  },
  boldText: {
    fontWeight: 'bold'
  }
});