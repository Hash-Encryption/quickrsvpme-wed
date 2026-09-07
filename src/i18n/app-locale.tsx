import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { localeDirection, persistAppLocale, readPersistedAppLocale, type AppLocale } from './locale';
import { appTranslations, type AppTranslationKey } from './app-locale-data.ts';

export { appTranslations, type AppTranslationKey };

type AppLocaleContextValue = {
  locale: AppLocale;
  dir: 'rtl' | 'ltr';
  setLocale: (locale: AppLocale) => void;
  t: (key: AppTranslationKey) => string;
};

const AppLocaleContext = createContext<AppLocaleContextValue | null>(null);

export function AppLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>(() => {
    try { return readPersistedAppLocale(localStorage); } catch { return 'ar'; }
  });
  const dir = localeDirection(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    try { persistAppLocale(localStorage, locale); } catch { /* Session state still works. */ }
  }, [dir, locale]);

  const value = useMemo(() => ({ locale, dir, setLocale, t: (key: AppTranslationKey) => appTranslations[locale][key] }), [dir, locale]);
  return <AppLocaleContext.Provider value={value}>{children}</AppLocaleContext.Provider>;
}

export function useAppLocale() {
  const value = useContext(AppLocaleContext);
  if (!value) throw new Error('App locale context unavailable');
  return value;
}

export function AppLanguageControl({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useAppLocale();
  return <button type="button" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} className="focus-ring min-h-11 rounded-full border border-current/25 px-3 text-xs font-semibold" aria-label={t('appLanguage')} lang={locale === 'ar' ? 'en' : 'ar'}>{compact ? (locale === 'ar' ? 'EN' : 'ع') : t('language')}</button>;
}
