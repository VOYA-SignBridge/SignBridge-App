import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

const PRONOUN_STORAGE_KEY = '@translation_pronouns';

export type PronounPresetId =
  | 'toi_ban'
  | 'minh_ban'
  | 'to_cau'
  | 'toi_anh_chi'
  | 'em_anh_chi'
  | 'anh_chi_em'
  | 'none'
  | 'custom';

export type PronounPreference = {
  presetId: PronounPresetId;
  speakerPronoun: string;
  listenerPronoun: string;
  addSubject: boolean;
};

export const PRONOUN_PRESETS: PronounPreference[] = [
  { presetId: 'toi_ban', speakerPronoun: 'tôi', listenerPronoun: 'bạn', addSubject: true },
  { presetId: 'minh_ban', speakerPronoun: 'mình', listenerPronoun: 'bạn', addSubject: true },
  { presetId: 'to_cau', speakerPronoun: 'tớ', listenerPronoun: 'cậu', addSubject: true },
  { presetId: 'toi_anh_chi', speakerPronoun: 'tôi', listenerPronoun: 'anh/chị', addSubject: true },
  { presetId: 'em_anh_chi', speakerPronoun: 'em', listenerPronoun: 'anh/chị', addSubject: true },
  { presetId: 'anh_chi_em', speakerPronoun: 'anh/chị', listenerPronoun: 'em', addSubject: true },
  { presetId: 'none', speakerPronoun: '', listenerPronoun: '', addSubject: false },
];

const DEFAULT_PREFERENCE = PRONOUN_PRESETS[0];

type PronounContextType = {
  preference: PronounPreference;
  setPreset: (presetId: PronounPresetId) => void;
  setCustomPronouns: (speakerPronoun: string, listenerPronoun: string) => void;
};

const PronounContext = createContext<PronounContextType | undefined>(undefined);

function isStoredPreference(value: unknown): value is PronounPreference {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PronounPreference>;
  return (
    typeof candidate.presetId === 'string' &&
    typeof candidate.speakerPronoun === 'string' &&
    typeof candidate.listenerPronoun === 'string' &&
    typeof candidate.addSubject === 'boolean'
  );
}

export function formatPronounPreference(preference: PronounPreference) {
  if (!preference.addSubject) return '';
  return `${preference.speakerPronoun} – ${preference.listenerPronoun}`;
}

export const PronounProvider = ({ children }: { children: ReactNode }) => {
  const [preference, setPreference] = useState<PronounPreference>(DEFAULT_PREFERENCE);

  useEffect(() => {
    AsyncStorage.getItem(PRONOUN_STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        const parsed: unknown = JSON.parse(stored);
        if (isStoredPreference(parsed)) setPreference(parsed);
      })
      .catch((error) => console.warn('[Pronouns] Could not load preference:', error));
  }, []);

  const savePreference = (next: PronounPreference) => {
    setPreference(next);
    void AsyncStorage.setItem(PRONOUN_STORAGE_KEY, JSON.stringify(next));
  };

  const setPreset = (presetId: PronounPresetId) => {
    const preset = PRONOUN_PRESETS.find((item) => item.presetId === presetId);
    if (preset) savePreference(preset);
  };

  const setCustomPronouns = (speakerPronoun: string, listenerPronoun: string) => {
    const speaker = speakerPronoun.trim();
    const listener = listenerPronoun.trim();
    if (!speaker || !listener) return;

    savePreference({
      presetId: 'custom',
      speakerPronoun: speaker,
      listenerPronoun: listener,
      addSubject: true,
    });
  };

  return (
    <PronounContext.Provider value={{ preference, setPreset, setCustomPronouns }}>
      {children}
    </PronounContext.Provider>
  );
};

export const usePronouns = () => {
  const context = useContext(PronounContext);
  if (!context) throw new Error('usePronouns must be used within a PronounProvider');
  return context;
};
