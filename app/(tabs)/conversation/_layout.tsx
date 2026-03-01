import { Stack } from "expo-router";
import { useTheme } from "contexts/ThemeContext";
export default function ConversationLayout() {
  const { colors: theme } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false}}>
      <Stack.Screen name="index" />
      <Stack.Screen name="room/[code]" />
    </Stack>
  );
}
