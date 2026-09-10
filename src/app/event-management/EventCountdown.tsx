import { useEffect, useState } from 'react';
import { useAppLocale } from '@/i18n/app-locale';

interface EventCountdownProps {
  dateStr?: string | null;
  className?: string;
}

type TimeRemaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isToday: boolean;
  isPassed: boolean;
};

function calculateTimeRemaining(targetDate: Date): TimeRemaining {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    // Check if target is today (within 24 hours of start or same calendar day)
    const isSameDay =
      targetDate.getFullYear() === now.getFullYear() &&
      targetDate.getMonth() === now.getMonth() &&
      targetDate.getDate() === now.getDate();

    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isToday: isSameDay,
      isPassed: !isSameDay,
    };
  }

  const seconds = Math.floor((diff / 1000) % 60);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  return {
    days,
    hours,
    minutes,
    seconds,
    isToday: false,
    isPassed: false,
  };
}

export function EventCountdown({ dateStr, className = '' }: EventCountdownProps) {
  const { t } = useAppLocale();

  const targetDate = dateStr
    ? new Date(dateStr.includes('T') ? dateStr : `${dateStr}T18:00:00`)
    : null;

  const isValidDate = targetDate && !Number.isNaN(targetDate.getTime());

  const [time, setTime] = useState<TimeRemaining>(() =>
    isValidDate ? calculateTimeRemaining(targetDate) : { days: 0, hours: 0, minutes: 0, seconds: 0, isToday: false, isPassed: false }
  );

  useEffect(() => {
    if (!isValidDate) return;

    // Update immediately and set local interval
    setTime(calculateTimeRemaining(targetDate));

    const intervalId = setInterval(() => {
      setTime(calculateTimeRemaining(targetDate));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isValidDate, dateStr]);

  if (!isValidDate) {
    return null;
  }

  if (time.isToday) {
    return (
      <div className={`rounded-3xl bg-[#0C2D24] p-6 text-white text-center shadow-lg ${className}`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#D4B363]">
          {t('timeUntilCelebration')}
        </p>
        <p className="mt-2 text-2xl font-bold text-white">
          🎉 {t('eventToday')}
        </p>
      </div>
    );
  }

  if (time.isPassed) {
    return (
      <div className={`rounded-3xl bg-[#0C2D24] p-6 text-white text-center shadow-lg ${className}`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#D4B363]">
          {t('timeUntilCelebration')}
        </p>
        <p className="mt-2 text-xl font-bold text-white/80">
          {t('eventConcluded')}
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-3xl bg-[#0C2D24] p-5 sm:p-7 text-white shadow-[0_12px_40px_rgba(12,45,36,0.18)] ${className}`}>
      <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-[#D4B363]">
        {t('timeUntilCelebration')}
      </p>

      <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-4 text-center">
        {/* Days */}
        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl sm:text-3xl font-bold tabular-nums text-white">
            {time.days}
          </div>
          <span className="mt-2 text-[11px] font-medium text-white/70">
            {t('countdownDays')}
          </span>
        </div>

        {/* Hours */}
        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl sm:text-3xl font-bold tabular-nums text-white">
            {time.hours}
          </div>
          <span className="mt-2 text-[11px] font-medium text-white/70">
            {t('countdownHours')}
          </span>
        </div>

        {/* Minutes */}
        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl sm:text-3xl font-bold tabular-nums text-white">
            {time.minutes}
          </div>
          <span className="mt-2 text-[11px] font-medium text-white/70">
            {t('countdownMinutes')}
          </span>
        </div>

        {/* Seconds */}
        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl sm:text-3xl font-bold tabular-nums text-white">
            {time.seconds}
          </div>
          <span className="mt-2 text-[11px] font-medium text-white/70">
            {t('countdownSeconds')}
          </span>
        </div>
      </div>
    </div>
  );
}
