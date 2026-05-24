export const APP_LANGUAGE_STORAGE_KEY = 'virtide:app-language';

export const SUPPORTED_LANGUAGES = [
  { code: 'fr', label: 'Français', nativeLabel: 'Français', dir: 'ltr' as const },
  { code: 'en', label: 'English', nativeLabel: 'English', dir: 'ltr' as const },
  { code: 'ar', label: 'العربية', nativeLabel: 'العربية', dir: 'rtl' as const },
] as const;

export type AppLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export function isAppLanguageCode(value: string | null | undefined): value is AppLanguageCode {
  return SUPPORTED_LANGUAGES.some((l) => l.code === value);
}

export function readStoredLanguage(): AppLanguageCode {
  if (typeof window === 'undefined') return 'fr';
  const stored = localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
  return isAppLanguageCode(stored) ? stored : 'fr';
}

export function persistLanguage(code: AppLanguageCode): void {
  localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, code);
}

export function applyDocumentLanguage(code: AppLanguageCode): void {
  const meta = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  document.documentElement.lang = code;
  document.documentElement.dir = meta?.dir ?? 'ltr';
  document.body.classList.toggle('app-rtl', code === 'ar');
}
