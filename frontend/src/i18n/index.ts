import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enLocales from './locales/en.json';
import hiLocales from './locales/hi.json';
import mrLocales from './locales/mr.json';
import knLocales from './locales/kn.json';
import teLocales from './locales/te.json';

import mobileEn from './locales/mobile/en.json';
import mobileHi from './locales/mobile/hi.json';
import mobileMr from './locales/mobile/mr.json';
import mobileKn from './locales/mobile/kn.json';
import mobileTe from './locales/mobile/te.json';

const resources = {
  en: { translation: enLocales, mobile: mobileEn },
  hi: { translation: hiLocales, mobile: mobileHi },
  mr: { translation: mrLocales, mobile: mobileMr },
  kn: { translation: knLocales, mobile: mobileKn },
  te: { translation: teLocales, mobile: mobileTe },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS: 'translation',
    ns: ['translation', 'mobile'],
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
