// src/components/RegionSelection.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDictionaryStore } from '../../app/data/useDictionaryStore';
import { syncDictionary } from '../../app/data/DictionaryService';

export default function RegionSelection() {
  const setRegion = useDictionaryStore(state => state.setRegion);

  const handleSelect = async (selectedRegion: string) => {
    await AsyncStorage.setItem('@user_region', selectedRegion);
    setRegion(selectedRegion);
    syncDictionary(selectedRegion); 
  };

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/images/icon.jpg')} style={styles.logo} />
      <Text style={styles.title}>Bộ Từ Vựng</Text>
      <Text style={styles.sub}>Vui lòng chọn ngôn ngữ ký hiệu bạn muốn sử dụng</Text>

      <TouchableOpacity style={styles.btnPrimary} onPress={() => handleSelect('hoa_de')}>
        <Text style={styles.btnText}>Hòa Đề (Cần Thơ)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnOutline} onPress={() => handleSelect('vsl')}>
        <Text style={styles.btnTextOutline}>VSL (Ngôn ngữ chuẩn)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#fff' },
  logo: { width: 100, height: 100, marginBottom: 20, borderRadius: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#000' },
  sub: { fontSize: 14, textAlign: 'center', marginBottom: 40, color: '#666' },
  btnPrimary: { width: '100%', padding: 18, borderRadius: 15, marginBottom: 15, alignItems: 'center', backgroundColor: '#00afef' },
  btnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  btnOutline: { width: '100%', padding: 18, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#00afef' },
  btnTextOutline: { color: '#00afef', fontSize: 16, fontWeight: 'bold' }
});