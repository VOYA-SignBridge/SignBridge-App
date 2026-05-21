import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './db/supabase';
import { useDictionaryStore } from '../app/data/useDictionaryStore';
import { loadLocalDictionary, syncInBackground } from '../app/data/DictionaryService';

import SplashScreen from '../src/components/SplashScreen';
import RegionSelection from '../src/components/RegionSelection';

export default function EntryScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const { isReady, region, setRegion } = useDictionaryStore();
  const [isDictLoading, setIsDictLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => setSession(session))
      .catch((error) => {
        console.warn('[Auth] getSession failed', error);
      })
      .finally(() => setIsAuthLoading(false));

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const initDict = async () => {
      try {
        const savedRegion = await AsyncStorage.getItem('@user_region');
        if (savedRegion) {
          setRegion(savedRegion);
          await loadLocalDictionary(savedRegion);
          syncInBackground(savedRegion);
        }
      } catch (error) {
        console.warn('[InitDict] Failed to initialize dictionary', error);
      } finally {
        setIsDictLoading(false);
      }
    };

    initDict();
  }, [setRegion]);

  if (isAuthLoading || isDictLoading) {
    return <SplashScreen />;
  }

  if (!region) {
    return <RegionSelection />;
  }

  if (!isReady) {
    return <SplashScreen />;
  }

  if (!session) {
    return <Redirect href="/auth/signin" />;
  }

  return <Redirect href="/(tabs)/translation" />;
}
