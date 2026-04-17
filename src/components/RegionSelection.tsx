import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../contexts/ThemeContext';
import { useDictionaryStore } from '../../app/data/useDictionaryStore';
import { syncDictionary } from '../../app/data/DictionaryService';
import { SIGN_LANGUAGES } from '../../app/data/languages';

export default function RegionSelection() {
  const { colors } = useTheme();
  const setRegion = useDictionaryStore((state) => state.setRegion);
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelect = async (selectedRegion: string) => {
    setLoading(selectedRegion);
    console.log("BAT DAU CHON VUNG: " + selectedRegion);

    try {
      await AsyncStorage.setItem('@user_region', selectedRegion);
      setRegion(selectedRegion);
      
      console.log("DANG TAI DU LIEU CHO VUNG: " + selectedRegion);
      await syncDictionary(selectedRegion);
      
      console.log("HOAN TAT CHON VUNG MIEN");
    } catch (error) {
      console.log("LOI TRONG QUA TRINH CHON VUNG: " + error);
      setLoading(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Image
        source={require('../../assets/images/logo.png')}
        style={styles.logo}
      />

      <View style={styles.headerContainer}>
        <Text style={[styles.title, { color: colors.text }]}>
          Bắt đầu trải nghiệm
        </Text>
        <Text style={[styles.sub, { color: colors.icon }]}>
          Vui lòng chọn ngôn ngữ ký hiệu
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        {SIGN_LANGUAGES.map((item) => {
          const isLoading = loading === item.value;
          
          return (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.button,
                isLoading && { backgroundColor: 'rgba(0, 175, 239, 0.1)' }
              ]}
              onPress={() => handleSelect(item.value)}
              disabled={loading !== null}
              activeOpacity={0.6}
            >
              {isLoading ? (
                <ActivityIndicator color="#00afef" />
              ) : (
                <Text style={styles.buttonText}>{item.label}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  logo: {
    width: 220,
    height: 220,
    marginBottom: 10,
    resizeMode: 'contain'
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
  },
  buttonContainer: {
    width: '100%',
    gap: 12
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00afef',
    // backgroundColor: 'transparent',
    // borderWidth: 2,
    // borderColor: '#00afef',
  },
  buttonText: {
    // color: '#00afef',
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3
  }
});