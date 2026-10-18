/**
 * Saudi Umm al-Qura Calendar Utilities
 * Built on native Intl.DateTimeFormat with islamic-umalqura
 */

export type HijriDateParts = {
  weekday: string;
  day: string;
  month: string;
  year: string;
  era: string;
};

/**
 * Accurately computes Umm al-Qura Hijri day, month name, and year for any Gregorian YYYY-MM-DD
 */
export function getHijriDateParts(isoDate: string, locale: 'ar' | 'en' = 'ar'): HijriDateParts {
  if (!isoDate) {
    return { weekday: '', day: '', month: '', year: '', era: locale === 'ar' ? 'هـ' : 'AH' };
  }

  const date = new Date(isoDate.includes('T') ? isoDate : `${isoDate.trim()}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return { weekday: '', day: '', month: '', year: '', era: locale === 'ar' ? 'هـ' : 'AH' };
  }

  const calendarLocale = locale === 'ar' ? 'ar-SA-u-ca-islamic-umalqura' : 'en-US-u-ca-islamic-umalqura';
  try {
    const formatter = new Intl.DateTimeFormat(calendarLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long',
    });
    const parts = formatter.formatToParts(date);
    const map: Record<string, string> = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }

    return {
      weekday: map.weekday || '',
      day: map.day || '',
      month: map.month || '',
      year: map.year || '',
      era: map.era || (locale === 'ar' ? 'هـ' : 'AH'),
    };
  } catch {
    return { weekday: '', day: '', month: '', year: '', era: locale === 'ar' ? 'هـ' : 'AH' };
  }
}

/**
 * Returns e.g. "الأربعاء ١٧ جمادى الأولى ١٤٤٨ هـ" (AR) or "Wednesday, 17 Jumada I 1448 AH" (EN)
 */
export function formatFullHijriDate(isoDate: string, locale: 'ar' | 'en' = 'ar'): string {
  const parts = getHijriDateParts(isoDate, locale);
  if (!parts.day || !parts.month || !parts.year) {
    return '';
  }

  if (locale === 'ar') {
    return `${parts.weekday ? parts.weekday + ' ' : ''}${parts.day} ${parts.month} ${parts.year} ${parts.era}`.trim();
  }
  return `${parts.weekday ? parts.weekday + ', ' : ''}${parts.day} ${parts.month} ${parts.year} ${parts.era}`.trim();
}

/**
 * Formats Gregorian date in active locale
 */
export function formatGregorianDate(isoDate: string, locale: 'ar' | 'en' = 'ar'): string {
  if (!isoDate) return '';
  const date = new Date(isoDate.includes('T') ? isoDate : `${isoDate.trim()}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;

  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return isoDate;
  }
}

/**
 * Cleanly formats Gregorian + Hijri summary in the active UI locale without leaking Arabic into English mode.
 * e.g.
 * AR: "الأربعاء، ٢٨ أكتوبر ٢٠٢٦ م · ١٧ جمادى الأولى ١٤٤٨ هـ"
 * EN: "Wednesday, 28 October 2026 · 17 Jumada I 1448 AH"
 */
export function formatDualDateSummary(
  isoDate: string,
  locale: 'ar' | 'en' = 'ar',
  showHijri = true
): string {
  if (!isoDate) return '';
  const greg = formatGregorianDate(isoDate, locale);
  if (!showHijri) return greg;

  const hijri = formatFullHijriDate(isoDate, locale);
  if (!hijri) return greg;

  return `${greg} · ${hijri}`;
}

/**
 * Overlapping Hijri Month Header for a Gregorian Month/Year
 * e.g. "ربيع الآخر · جمادى الأولى ١٤٤٨ هـ" or "Rabi' II · Jumada I 1448 AH"
 */
export function getOverlappingHijriMonths(
  year: number,
  monthIndex: number,
  locale: 'ar' | 'en' = 'ar'
): string {
  const firstDay = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
  const lastDayNum = new Date(year, monthIndex + 1, 0).getDate();
  const lastDay = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

  const firstParts = getHijriDateParts(firstDay, locale);
  const lastParts = getHijriDateParts(lastDay, locale);

  if (!firstParts.month) return '';

  if (firstParts.month === lastParts.month && firstParts.year === lastParts.year) {
    return `${firstParts.month} ${firstParts.year} ${firstParts.era}`.trim();
  }

  if (firstParts.year === lastParts.year) {
    return `${firstParts.month} · ${lastParts.month} ${lastParts.year} ${lastParts.era}`.trim();
  }

  return `${firstParts.month} ${firstParts.year} · ${lastParts.month} ${lastParts.year} ${lastParts.era}`.trim();
}

/**
 * 1-Tap Timing Chips for Saudi Weddings and Celebrations
 */
export const SAUDI_TIME_ANCHORS = [
  {
    id: 'after-isha',
    time: '20:30',
    labelAr: 'بعد صلاة العشاء',
    labelEn: 'After Isha Prayer',
  },
  {
    id: 'after-maghrib',
    time: '18:45',
    labelAr: 'بعد صلاة المغرب',
    labelEn: 'After Maghrib Prayer',
  },
  {
    id: '8pm',
    time: '20:00',
    labelAr: '8:00 مساءً',
    labelEn: '8:00 PM',
  },
  {
    id: '9pm',
    time: '21:00',
    labelAr: '9:00 مساءً',
    labelEn: '9:00 PM',
  },
] as const;
