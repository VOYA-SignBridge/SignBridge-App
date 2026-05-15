import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

const LANG_STORAGE_KEY = 'user_lang';

type AppLang = 'vi' | 'en';

interface LanguageContextType {
  appLang: AppLang;
  switchLanguage: (lang: AppLang) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [appLang, setAppLang] = useState<AppLang>('vi');

  useEffect(() => {
    AsyncStorage.getItem(LANG_STORAGE_KEY).then((saved) => {
      if (saved === 'vi' || saved === 'en') {
        setAppLang(saved);
        i18n.changeLanguage(saved);
      }
    });
  }, []);

  const switchLanguage = (lang: AppLang) => {
    setAppLang(lang);
    i18n.changeLanguage(lang);
    AsyncStorage.setItem(LANG_STORAGE_KEY, lang);
  };

  return (
    <LanguageContext.Provider value={{ appLang, switchLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
};
