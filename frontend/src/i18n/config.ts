import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import {
  APP_LANGUAGE_STORAGE_KEY,
  applyDocumentLanguage,
  isAppLanguageCode,
  type AppLanguageCode,
} from '../lib/language';
import fr from '../../public/assets/i18n/fr.json';
import en from '../../public/assets/i18n/en.json';
import ar from '../../public/assets/i18n/ar.json';

const resources = {
  fr: { translation: fr },
  en: { translation: en },
  ar: { translation: ar },
};

let initialized = false;

export async function initI18n(): Promise<typeof i18n> {
  if (initialized) return i18n;

  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'fr',
      supportedLngs: ['fr', 'en', 'ar'],
      nonExplicitSupportedLngs: true,
      interpolation: { escapeValue: false },
      detection: {
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: APP_LANGUAGE_STORAGE_KEY,
        caches: ['localStorage'],
      },
      react: { useSuspense: false },
    });

  i18n.on('languageChanged', (lng) => {
    if (isAppLanguageCode(lng)) {
      applyDocumentLanguage(lng);
    }
  });

  const current = i18n.language;
  if (isAppLanguageCode(current)) {
    applyDocumentLanguage(current);
  } else {
    applyDocumentLanguage('fr');
  }

  initialized = true;
  return i18n;
}

export async function changeAppLanguage(code: AppLanguageCode): Promise<void> {
  localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, code);
  await i18n.changeLanguage(code);
  applyDocumentLanguage(code);
}

export default i18n;
