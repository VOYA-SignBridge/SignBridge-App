// app/index.tsx
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../app/db/supabase'; 
import { useDictionaryStore } from '../app/data/useDictionaryStore';
import { syncDictionary } from '../app/data/DictionaryService';

import SplashScreen from '../src/components/SplashScreen';
import RegionSelection from '../src/components/RegionSelection';

export default function EntryScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true); 
  const { isReady, region, setRegion } = useDictionaryStore();
  const [isDictLoading, setIsDictLoading] = useState(true);

  // KIỂM TRA ĐĂNG NHẬP
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthLoading(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  // KIỂM TRA DỮ LIỆU & VÙNG MIỀN
  useEffect(() => {
    const initDict = async () => {
      // Uncomment dòng dưới để test luồng như máy mới hoàn toàn
      // await AsyncStorage.clear(); 

      const savedRegion = await AsyncStorage.getItem('@user_region');
      if (savedRegion) {
        setRegion(savedRegion);
        await syncDictionary(savedRegion); 
      }
      setIsDictLoading(false); 
    };
    initDict();
  }, []);

  // --- TRẠM KIỂM SOÁT LUỒNG ---

  // Trạm 1: Đang check Auth hoặc đang check Ổ cứng -> Hiện Splash
  if (isAuthLoading || isDictLoading) {
    return <SplashScreen />;
  }

  // Trạm 2: Đã xong bước 1 mà region vẫn null (Người dùng mới) -> Hiện Chọn vùng
  if (!region) {
    return <RegionSelection />;
  }

  // Trạm 3: Đã chọn vùng nhưng syncDictionary đang tải JSON chưa xong -> Hiện Splash
  if (!isReady) {
    return <SplashScreen />;
  }

  // Trạm 4: Đã có Region + JSON xong rồi, nhưng chưa Login -> Đẩy sang Sign In
  if (!session) {
    return <Redirect href="/auth/signin" />;
  }

  // Trạm 5: Thành công toàn tập -> Vào App
  return <Redirect href="/(tabs)/translation" />;
}