import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { useAppLocale } from '@/i18n/app-locale';
import {
  getHijriDateParts,
  getOverlappingHijriMonths,
  formatDualDateSummary,
} from '@/utils/saudiCalendar';

export interface DualHijriCalendarProps {
  value: string;
  onChange: (isoDate: string) => void;
  locale?: 'ar' | 'en';
  id?: string;
  testId?: string;
  minDate?: string;
  disabled?: boolean;
  showHijri?: boolean;
}

export function DualHijriCalendar({
  value,
  onChange,
  locale: propLocale,
  id,
  testId,
  minDate,
  disabled = false,
  showHijri = true,
}: DualHijriCalendarProps) {
  const appLocale = useAppLocale();
  const locale = propLocale ?? appLocale.locale;
  const isRtl = locale === 'ar';

  // Parse initial view year and month
  const initialDate = useMemo(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      const parsed = new Date(`${value.trim()}T12:00:00Z`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  }, [value]);

  const [viewYear, setViewYear] = useState(() => initialDate.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(() => initialDate.getUTCMonth());

  // Navigate months
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Gregorian Month Name
  const gregorianMonthName = useMemo(() => {
    const d = new Date(Date.UTC(viewYear, viewMonth, 15));
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      month: 'long',
      year: 'numeric',
    }).format(d);
  }, [viewYear, viewMonth, locale]);

  // Overlapping Hijri Header
  const hijriMonthHeader = useMemo(() => {
    if (!showHijri) return '';
    return getOverlappingHijriMonths(viewYear, viewMonth, locale);
  }, [viewYear, viewMonth, locale, showHijri]);

  // Weekday column headers (Sunday to Saturday)
  const weekdayNames = useMemo(() => {
    if (locale === 'ar') {
      return ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    }
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }, [locale]);

  // Calendar cells for viewYear, viewMonth
  const daysInMonth = useMemo(() => {
    return new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
  }, [viewYear, viewMonth]);

  const firstDayOfWeek = useMemo(() => {
    // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    return new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
  }, [viewYear, viewMonth]);

  // Compute cell items
  const cells = useMemo(() => {
    const list: Array<{
      dateStr: string;
      gregorianDay: number;
      hijriDay: string;
      isWeekend: boolean;
      isDisabled: boolean;
      isSelected: boolean;
      isToday: boolean;
    } | null> = [];

    // Empty lead cells
    for (let i = 0; i < firstDayOfWeek; i++) {
      list.push(null);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = (firstDayOfWeek + day - 1) % 7;
      // In Saudi Arabia, Friday (5) and Saturday (6) are the weekend
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

      const hijriParts = showHijri ? getHijriDateParts(dateStr, locale) : null;
      const hijriDay = hijriParts?.day ?? '';

      const isSelected = value === dateStr;
      const isToday = dateStr === todayStr;
      const isDisabled = Boolean(minDate && dateStr < minDate) || disabled;

      list.push({
        dateStr,
        gregorianDay: day,
        hijriDay,
        isWeekend,
        isDisabled,
        isSelected,
        isToday,
      });
    }

    return list;
  }, [viewYear, viewMonth, daysInMonth, firstDayOfWeek, showHijri, locale, value, minDate, disabled]);

  const selectedSummary = useMemo(() => {
    if (!value) return '';
    return formatDualDateSummary(value, locale, showHijri);
  }, [value, locale, showHijri]);

  return (
    <div className="w-full rounded-2xl border border-[rgba(194,155,97,0.22)] bg-white/95 p-4 sm:p-5 shadow-[0_8px_24px_-8px_rgba(12,45,36,0.06)] backdrop-blur-md">
      {/* Hidden/accessible native input to maintain full test and form compatibility */}
      <input
        type="date"
        id={id}
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* 1. Dual Month Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-[rgba(194,155,97,0.14)]">
        <button
          type="button"
          onClick={isRtl ? handleNextMonth : handlePrevMonth}
          disabled={disabled}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#17251F]/70 transition hover:bg-[#F5EFE6] hover:text-[#0C2D24] active:scale-95 disabled:opacity-40"
          aria-label={isRtl ? 'الشهر القادم' : 'Previous month'}
        >
          {isRtl ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <div className="text-center">
          <h3 className="font-semibold text-sm sm:text-base text-[#0C2D24] tracking-tight tabular-nums">
            {gregorianMonthName}
          </h3>
          {showHijri && hijriMonthHeader && (
            <p className="text-[11px] font-medium text-[#8B7040] opacity-90 tabular-nums mt-0.5">
              {hijriMonthHeader}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={isRtl ? handlePrevMonth : handleNextMonth}
          disabled={disabled}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#17251F]/70 transition hover:bg-[#F5EFE6] hover:text-[#0C2D24] active:scale-95 disabled:opacity-40"
          aria-label={isRtl ? 'الشهر السابق' : 'Next month'}
        >
          {isRtl ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* 2. Weekday Header Strip */}
      <div className="grid grid-cols-7 gap-1 pt-3 pb-2 text-center text-[11px] font-medium text-[#756F66]">
        {weekdayNames.map((name, idx) => {
          const isWeekend = idx === 5 || idx === 6; // Friday, Saturday
          return (
            <span
              key={name}
              className={`py-1 rounded-md ${
                isWeekend ? 'text-[#8B7040] font-semibold bg-[#FFF9F0]/60' : ''
              }`}
            >
              {name}
            </span>
          );
        })}
      </div>

      {/* 3. Days Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="grid" aria-label={gregorianMonthName}>
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="h-11 sm:h-12" aria-hidden="true" />;
          }

          const {
            dateStr,
            gregorianDay,
            hijriDay,
            isWeekend,
            isDisabled,
            isSelected,
            isToday,
          } = cell;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(dateStr)}
              className={`relative flex h-11 sm:h-12 flex-col items-center justify-center rounded-xl transition-all duration-150 active:scale-95 ${
                isSelected
                  ? 'bg-[#0C2D24] text-white shadow-md ring-2 ring-[#0C2D24]/20'
                  : isDisabled
                  ? 'cursor-not-allowed text-black/20 bg-transparent'
                  : isWeekend
                  ? 'bg-[#FFF9F0] text-[#17251F] hover:bg-[#F5EFE6] hover:border-[#C29B61]/40'
                  : 'text-[#17251F] hover:bg-[#F5EFE6]'
              } ${isToday && !isSelected ? 'ring-1 ring-[#8B7040]/50' : ''}`}
              aria-selected={isSelected}
              aria-label={`${dateStr}${showHijri && hijriDay ? ` (${hijriDay})` : ''}`}
            >
              {/* Primary Gregorian Day */}
              <span
                className={`text-[13px] font-semibold tabular-nums leading-none ${
                  isSelected ? 'text-white' : 'text-[#17251F]'
                }`}
              >
                {gregorianDay}
              </span>

              {/* Secondary Hijri Inset Day */}
              {showHijri && hijriDay && (
                <span
                  className={`text-[9px] font-medium tabular-nums mt-0.5 leading-none ${
                    isSelected
                      ? 'text-[#E8D4A8]'
                      : isWeekend
                      ? 'text-[#8B7040]'
                      : 'text-[#8B7040]/75'
                  }`}
                >
                  {hijriDay}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Selected Date Summary Pill */}
      {selectedSummary && (
        <div className="mt-4 pt-3 border-t border-[rgba(194,155,97,0.14)] flex items-center justify-between text-xs rounded-xl bg-[#FAF7F2] p-2.5 sm:px-3 text-[#0C2D24]">
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon size={14} className="text-[#8B7040] shrink-0" aria-hidden="true" />
            <span className="font-semibold truncate tabular-nums">{selectedSummary}</span>
          </div>
        </div>
      )}
    </div>
  );
}
