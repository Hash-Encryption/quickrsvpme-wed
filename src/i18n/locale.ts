export type Locale = 'ar' | 'en';
export type AppLocale = Locale;
export type InvitationLocale = Locale;

export const defaultLocale: Locale = 'ar';
export const APP_LOCALE_STORAGE_KEY = 'quickrsvp-app-locale';

export function normalizeLocale(value: unknown): Locale {
  return value === 'en' || value === 'ar' ? value : defaultLocale;
}

export function localeDirection(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function readPersistedAppLocale(storage: Pick<Storage, 'getItem'>): AppLocale {
  return normalizeLocale(storage.getItem(APP_LOCALE_STORAGE_KEY));
}

export function persistAppLocale(storage: Pick<Storage, 'setItem'>, locale: AppLocale): void {
  storage.setItem(APP_LOCALE_STORAGE_KEY, locale);
}
