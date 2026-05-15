// app/_layout.tsx
import '../src/i18n';
import React from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ThemedRoot />
      </LanguageProvider>
    </ThemeProvider>
  );
}

function ThemedRoot() {
  const { theme } = useTheme(); 

  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        {/* index sẽ tự động được render đầu tiên */}
        <Stack.Screen name="index" /> 
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
      </Stack>
    </>
  );
}