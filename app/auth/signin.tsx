import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { supabase } from '../db/supabase';
import AsyncStorage  from '@react-native-async-storage/async-storage';
export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    const { data,error } = await supabase.auth.signInWithPassword({ email, password });
    await AsyncStorage.setItem("access_token", data.session?.access_token || "");
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      console.log("data", data.session?.access_token)
      router.replace('/translation');
    }
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
