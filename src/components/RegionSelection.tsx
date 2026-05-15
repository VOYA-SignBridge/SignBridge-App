import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { useDictionaryStore } from '../../app/data/useDictionaryStore';
import { syncDictionary } from '../../app/data/DictionaryService';
import { SIGN_LANGUAGES, REGION_META } from '../../app/data/languages';

export default function RegionSelection() {
  const { colors } = useTheme();
  const setRegion = useDictionaryStore((state) => state.setRegion);
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelect = async (selectedRegion: string) => {
    setLoading(selectedRegion);
    try {
      await AsyncStorage.setItem('@user_region', selectedRegion);
      setRegion(selectedRegion);
      await syncDictionary(selectedRegion);
    } catch {
      setLoading(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ── Brand ── */}
      <View style={styles.brand}>
        {/* <View style={[styles.logoWrap, { backgroundColor: colors.primary + '1A' }]}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View> */}
        <Text style={[styles.title, { color: colors.text }]}>Bắt đầu trải nghiệm</Text>
        <Text style={[styles.sub, { color: colors.mediumGray }]}>
          Chọn ngôn ngữ ký hiệu bạn muốn sử dụng
        </Text>
      </View>

      {/* ── Cards ── */}
      <View style={styles.cards}>
        {SIGN_LANGUAGES.map((item) => {
          const meta = REGION_META[item.value];
          const accent = meta ? colors[meta.color] : colors.primary;
          const isLoading = loading === item.value;
          const isDisabled = loading !== null;

          return (
            <TouchableOpacity
              key={item.value}
              activeOpacity={0.72}
              disabled={isDisabled}
              onPress={() => handleSelect(item.value)}
              style={[
                styles.card,
                {
                  backgroundColor: isLoading
                    ? accent + '20'
                    : colors.cardBG,
                  borderColor: isLoading ? accent : accent + '60',
                },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: accent + '20' }]}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={accent} />
                ) : (
                  <Ionicons
                    name={meta?.icon ?? 'language-outline'}
                    size={26}
                    color={accent}
                  />
                )}
              </View>

              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: isLoading ? accent : colors.text }]}>
                  {item.label}
                </Text>
                {meta?.sub && (
                  <Text style={[styles.cardSub, { color: colors.mediumGray }]}>
                    {meta.sub}
                  </Text>
                )}
              </View>

              {!isLoading && (
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={isDisabled ? colors.lightGray : accent}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },

  // Brand
  brand: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoWrap: {
    width: 140,
    height: 140,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 104,
    height: 104,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Cards
  cards: {
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 13,
    lineHeight: 18,
  },
});
