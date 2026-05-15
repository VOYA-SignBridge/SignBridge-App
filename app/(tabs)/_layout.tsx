import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        
        tabBarActiveTintColor: colors.tabIconSelected, 
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.textInputBG,
        },
      }}
    >
      <Tabs.Screen
        name="translation"
        options={{
          title: t('tabs.translate'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="language-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="conversation"
        options={{
          title: t('tabs.chat'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dictionary"
        options={{
          title: t('tabs.dictionary'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="book-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings-outline" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}