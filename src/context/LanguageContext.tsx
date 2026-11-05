import React, { createContext, useContext, useState, useEffect } from 'react';
import enCatalog from '../../locales/en.json';
import filCatalog from '../../locales/fil.json';
import hilCatalog from '../../locales/hil.json';
import cebCatalog from '../../locales/ceb.json';

export type Language = 'en' | 'fil' | 'ceb' | 'hil';

/**
 * Languages offered in the UI. Every picker (sign-in prompt, onboarding, top-bar menu) reads this list.
 * To add one: create locales/<code>.json (missing keys fall back to English), register it in `catalogs`,
 * add it here and to the server's language enums, and give it a greeting in LanguageChoice.
 * Set `enabled: false` to hide a language without removing it.
 */
export const LANGUAGE_OPTIONS: Array<{
  code: Language;
  label: string;
  nativeLabel: string;
  enabled: boolean;
}> = [
  { code: 'en', label: 'English', nativeLabel: 'English', enabled: true },
  { code: 'fil', label: 'Filipino', nativeLabel: 'Filipino', enabled: true },
  { code: 'ceb', label: 'Bisaya', nativeLabel: 'Sinugboanon', enabled: true },
  { code: 'hil', label: 'Hiligaynon', nativeLabel: 'Ilonggo', enabled: true }
];

export const ENABLED_LANGUAGES = LANGUAGE_OPTIONS.filter((l) => l.enabled);

const isEnabled = (code: string | null | undefined): code is Language =>
  ENABLED_LANGUAGES.some((l) => l.code === code);

const CHOSEN_KEY = 'enterseed_language';

interface LanguageContextType {
  /** True once the visitor has explicitly picked a language on this device. */
  hasChosenLanguage: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const catalogs: Record<Language, any> = {
  en: enCatalog,
  fil: filCatalog,
  ceb: cebCatalog,
  hil: hilCatalog,
};

function getNestedValue(obj: any, path: string): string | undefined {
  if (!obj) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const readSaved = () => {
    try {
      return localStorage.getItem(CHOSEN_KEY);
    } catch {
      return null;
    }
  };

  const [language, setLanguageState] = useState<Language>(() => {
    const saved = readSaved();
    return isEnabled(saved) ? saved : 'en';
  });
  const [hasChosenLanguage, setHasChosen] = useState(() => isEnabled(readSaved()));

  const setLanguage = (lang: Language) => {
    // A stored preference for a language that is not launched yet falls back to English.
    const next = isEnabled(lang) ? lang : 'en';
    setLanguageState(next);
    setHasChosen(true);
    try {
      localStorage.setItem(CHOSEN_KEY, next);
    } catch {
      // private mode: keep the choice for this session only
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (path: string, params?: Record<string, string | number>): string => {
    // Check in current language catalog under messages
    let val = getNestedValue(catalogs[language]?.messages, path);
    // Fallback to English catalog
    if (!val && language !== 'en') {
      val = getNestedValue(catalogs.en?.messages, path);
    }
    // Check root legacy or direct path if not found under messages
    if (!val) {
      val = getNestedValue(catalogs[language], path);
    }
    if (!val && language !== 'en') {
      val = getNestedValue(catalogs.en, path);
    }

    if (!val) {
      // Return last part of path capitalized or the path itself
      const parts = path.split('.');
      return parts[parts.length - 1];
    }

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        val = (val as string).replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }

    return val;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, hasChosenLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
