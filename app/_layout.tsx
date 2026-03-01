import { Stack } from 'expo-router';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext'; // <-- Import
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  );
}

function ThemedRoot() {
  
  const { theme } = useTheme(); 
  
  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
      </Stack>
    </>
  );
}