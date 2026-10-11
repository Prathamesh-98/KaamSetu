import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enLocales from './locales/en.json';
import hiLocales from './locales/hi.json';
import mrLocales from './locales/mr.json';
import knLocales from './locales/kn.json';
import teLocales from './locales/te.json';

const resources = {
  en: { translation: enLocales },
  hi: { translation: hiLocales },
  mr: { translation: mrLocales },
  kn: { translation: knLocales },
  te: { translation: teLocales },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'kaamsetu_language',
    }
  });

export default i18n;
