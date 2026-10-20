import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Award,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  Copy,
  Edit3,
  ExternalLink,
  EyeOff,
  Gift,
  Heart,
  HelpCircle,
  LockKeyhole,
  MapPin,
  Mic,
  Music2,
  Shirt,
  Sparkles,
  Trash2,
  User,
  Utensils,
  X,
} from 'lucide-react';
import { localeDirection, type InvitationLocale } from '../i18n/locale.ts';
import { invitationT } from '../i18n/invitation.ts';
import { partyInvitationT, type PartyInvitationKey } from '../i18n/party.ts';
import {
  formatPartyDate,
  parseEventDateDetails,
  partyStyles,
  resolvePartyStyleId,
  type PartyEventData,
  type BlockKey,
  type BlockContent,
  type StudioBlock,
} from './model.ts';
import { formatFullHijriDate } from '../utils/saudiCalendar.ts';
import { hexToRgb, getRelativeLuminance, mixColors } from '../utils/brandColorExtractor.ts';
import { PartyEnvelopeOpener } from './PartyEnvelopeOpener.tsx';
import './party.css';

export type RSVPStatus = 'pending' | 'accepted' | 'declined';
export type { BlockKey, BlockContent, StudioBlock };

export type PartyInvitationRendererProps = {
  event: PartyEventData;
  blocks: StudioBlock[];
  guestName?: string;
  token?: string;
  passId?: string;
  allowedCompanions?: number;
  rsvpStatus?: RSVPStatus;
  plusOnes?: number;
  guestCount?: number;
  maxGuests?: number;
  preview?: boolean;
  song?: string;
  meal?: string;
  invitationLocale?: InvitationLocale;
  uiLocale?: 'en' | 'ar';
  activeTab?: 'card' | 'pass';
  onRsvp?: (status: RSVPStatus, count?: number) => void;
  onSongChange?: (song: string) => void;
  onMealChange?: (meal: string) => void;
  readOnly?: boolean;
  isEditMode?: boolean;
  selectedBlockId?: string | null;
  onSelectBlock?: (id: string) => void;
  onSelectSection?: (sectionKey: string) => void;
  onMoveBlock?: (index: number, direction: -1 | 1) => void;
  onToggleBlock?: (id: string) => void;
  onDeleteBlock?: (id: string) => void;
  onDuplicateBlock?: (id: string) => void;
  onChangeTitleScale?: (scale: 'sm' | 'md' | 'lg' | 'xl') => void;
  forceEnvelopeOpen?: boolean;
  onEnvelopeOpened?: () => void;
};

/**
 * High-density luxury SVG QR Code with finder patterns for Apple Wallet & VIP Gate Pass
 */
export function QRPassMark({ label }: { label: string }) {
  const matrix = useMemo(() => {
    const size = 11;
    const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    const paintFinder = (row: number, col: number) => {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          grid[row + r][col + c] = true;
        }
      }
    };

    paintFinder(0, 0);
    paintFinder(0, 8);
    paintFinder(8, 0);

    for (let i = 3; i < 8; i++) {
      grid[1][i] = i % 2 === 0;
      grid[i][1] = i % 2 === 0;
      grid[i][9] = i % 2 === 1;
      grid[9][i] = i % 2 === 1;
    }

    for (let r = 3; r < 8; r++) {
      for (let c = 3; c < 8; c++) {
        grid[r][c] = (r * 7 + c * 13 + 5) % 3 < 2;
      }
    }

    grid[0][4] = true;
    grid[0][6] = true;
    grid[10][4] = true;
    grid[10][7] = true;
    grid[10][10] = true;
    grid[8][8] = true;

    return grid;
  }, []);

  return (
    <div
      className="relative rounded-2xl bg-white p-3.5 shadow-md border border-[var(--party-accent)]/40"
      aria-label={label}
      data-testid="qr-pass"
    >
      <div className="grid grid-cols-11 gap-[2.5px] w-36 h-36">
        {matrix.flatMap((row, r) =>
          row.map((filled, c) => (
            <span
              key={`${r}-${c}`}
              className={`rounded-[1.5px] transition-colors ${
                filled ? 'bg-[#0A1A14]' : 'bg-transparent'
              }`}
            />
          ))
        )}
      </div>
    </div>
  );
}

export { parseEventDateDetails };

/**
 * Live 1-second interval countdown towards event date
 */
export function useLiveCountdown(dateStr: string, timeStr = '19:00') {
  const calculate = () => {
    if (!dateStr) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false };
    const [y, m, d] = dateStr.trim().split('-').map(Number);
    const [hh, mm] = (timeStr || '19:00').split(':').map(Number);
    const target = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0)).getTime();
    const diff = target - Date.now();
    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
    }
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
      isPast: false,
    };
  };

  const [timeLeft, setTimeLeft] = useState(calculate);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculate());
    }, 1000);
    return () => clearInterval(timer);
  }, [dateStr, timeStr]);

  return timeLeft;
}

/**
 * Hardware-Accelerated Scroll-Reveal Motion Wrapper
 * Immediately visible on SSR/tests and when event.motion === 'none'
 */
export function PartyScrollReveal({
  children,
  className = '',
  delay = 0,
  disabled = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined' || disabled) {
      return true;
    }
    return false;
  });

  useEffect(() => {
    if (isVisible || disabled) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [disabled, isVisible]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(22px) scale(0.985)',
        transition: 'opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1), transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Reel 1 Oversized Architectural Date Lockup + Dual Timing Split Plaque
 */
export function EditorialDateLockup({
  event,
  effectiveLocale,
  isArabic,
  dateDetails,
}: {
  event: PartyEventData;
  effectiveLocale: InvitationLocale;
  isArabic: boolean;
  dateDetails: ReturnType<typeof parseEventDateDetails>;
}) {
  const timeDisplay = event.timeLabel || event.startTime || (isArabic ? 'بعد صلاة العشاء' : 'Evening');
  const receptionDisplay = event.receptionTime || event.startTime || (isArabic ? '7:30 م' : '7:30 PM');
  const mapHref = event.mapUrl || (event.venue || event.city ? `https://maps.google.com/?q=${encodeURIComponent([event.venue, event.city].filter(Boolean).join(' '))}` : undefined);

  return (
    <div className="text-center my-3 space-y-6" data-testid="editorial-date-lockup">
      {/* Top Ribbon: Day of Week & Starting Time */}
      <div className="flex items-center justify-between border-y border-[var(--party-accent)]/30 py-2.5 px-3 text-xs tracking-widest uppercase font-bold text-[var(--party-accent)]">
        <span>{dateDetails?.dayOfWeek || (isArabic ? 'يوم الحفل' : 'Event Day')}</span>
        <span>•</span>
        <span>{isArabic ? `يبدأ: ${timeDisplay}` : `Starts: ${timeDisplay}`}</span>
      </div>

      {/* Sculpted Center Date Lockup: Oversized Day Numeral beside stacked Month & Year */}
      <div className="flex items-center justify-center gap-5 sm:gap-7 py-2">
        <span
          className="font-serif font-black text-6xl sm:text-7xl lg:text-8xl text-[var(--party-accent)] leading-none tabular-nums drop-shadow-sm select-all"
        >
          {dateDetails?.day || '14'}
        </span>
        <div className="text-start border-s-2 border-[var(--party-accent)]/40 ps-4">
          <p className="font-serif font-bold text-xl sm:text-2xl tracking-widest uppercase text-[var(--party-primary)] leading-tight">
            {dateDetails?.monthName || (isArabic ? 'أكتوبر' : 'October')}
          </p>
          <p className="font-mono text-sm sm:text-base font-semibold tracking-wider opacity-70 text-[var(--party-primary)] mt-0.5">
            {dateDetails?.year || '2026'}
          </p>
        </div>
      </div>

      {/* Umm al-Qura Hijri Date Pill */}
      {event.showHijriDate !== false && event.date && (
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--party-accent)]/35 bg-black/10 px-4 py-1 text-xs font-semibold shadow-xs">
          <CalendarDays size={13} className="text-[var(--party-accent)]" />
          <span>{formatFullHijriDate(event.date, isArabic ? 'ar' : 'en')}</span>
        </div>
      )}

      {/* Dual Timing Split Row (Saudi Hospitality Standard) */}
      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto pt-2">
        {/* Column 1: Reception */}
        <div className="rounded-2xl border border-[var(--party-accent)]/25 bg-black/10 p-3.5 text-center shadow-xs">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--party-accent)] mb-1">
            ☕ {isArabic ? 'استقبال الضيوف' : 'Guest Reception'}
          </p>
          <p className="font-mono font-bold text-sm text-[var(--party-primary)]" dir="ltr">
            {receptionDisplay}
          </p>
        </div>

        {/* Column 2: Main Event / Dinner */}
        <div className="rounded-2xl border border-[var(--party-accent)]/25 bg-black/10 p-3.5 text-center shadow-xs">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--party-accent)] mb-1">
            ✨ {isArabic ? 'بدء الحفل والعشاء' : 'Ceremony & Dinner'}
          </p>
          <p className="font-mono font-bold text-sm text-[var(--party-primary)]" dir="ltr">
            {timeDisplay}
          </p>
        </div>
      </div>

      {/* Editorial Venue & Google Maps Plaque */}
      {(event.venue || event.city) && (
        <div className="rounded-2xl border border-[var(--party-accent)]/30 bg-black/10 p-4 max-w-md mx-auto text-center shadow-xs">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--party-accent)] mb-1">
            <MapPin size={15} />
            <bdi>{event.venue}</bdi>
          </div>
          {event.city && (
            <p className="text-xs opacity-75 mb-3">{event.city}</p>
          )}
          {mapHref && (
            <a
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-google-maps"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--party-accent)]/50 bg-[var(--party-accent)]/15 hover:bg-[var(--party-accent)]/25 px-4 py-1.5 text-[11px] font-bold text-[var(--party-accent)] transition shadow-xs active:scale-95"
            >
              <span>{isArabic ? 'فتح الموقع في الخرائط 📍' : 'Open in Google Maps 📍'}</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Embedded Live 4-Tile Countdown + High-Contrast Circled Month Calendar Card
 */
export function CountdownAndCalendarSheet({
  event,
  dateDetails,
  isArabic,
}: {
  event: PartyEventData;
  dateDetails: ReturnType<typeof parseEventDateDetails>;
  isArabic: boolean;
}) {
  const timeLeft = useLiveCountdown(event.date, event.startTime);

  const weekdayHeaders = isArabic
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="mt-8 space-y-6" data-testid="section-countdown-calendar">
      {/* 1. Live 4-Tile Countdown */}
      <div className="space-y-2">
        <span className="block text-[10px] uppercase font-bold tracking-[.2em] text-center text-[var(--party-accent)]">
          ⏳ {isArabic ? 'العد التنازلي للمناسبة' : 'Live Event Countdown'}
        </span>
        <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-sm sm:max-w-md mx-auto">
          {[
            { label: isArabic ? 'يوم' : 'Days', value: timeLeft.days },
            { label: isArabic ? 'ساعة' : 'Hours', value: timeLeft.hours },
            { label: isArabic ? 'دقيقة' : 'Mins', value: timeLeft.minutes },
            { label: isArabic ? 'ثانية' : 'Secs', value: timeLeft.seconds },
          ].map((tile) => (
            <div
              key={tile.label}
              className="rounded-2xl border border-[var(--party-accent)]/30 bg-black/15 p-2.5 sm:p-3 text-center shadow-xs"
            >
              <span className="block font-mono font-black text-xl sm:text-2xl text-[var(--party-accent)] leading-tight tabular-nums">
                {String(tile.value).padStart(2, '0')}
              </span>
              <span className="block text-[10px] font-bold opacity-75 uppercase tracking-wider mt-0.5">
                {tile.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Embedded High-Contrast Month Calendar Card */}
      {dateDetails && (
        <div className="rounded-2xl p-5 shadow-lg border border-[var(--party-accent)]/35 bg-[#FAF6EE] text-[#18181B] max-w-sm sm:max-w-md mx-auto">
          {/* Calendar Header */}
          <div className="flex items-center justify-between border-b border-[#18181B]/15 pb-2.5 mb-3">
            <span className="font-serif font-bold text-sm sm:text-base text-[#18181B]">
              📅 {dateDetails.monthName} {dateDetails.year}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#18181B]/60">
              {isArabic ? 'تقويم المناسبة' : 'Calendar'}
            </span>
          </div>

          {/* 7-Column Weekday Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#18181B]/60 mb-2">
            {weekdayHeaders.map((w, idx) => (
              <span key={idx} className="truncate">{w.slice(0, 3)}</span>
            ))}
          </div>

          {/* Month Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {/* Blank offset days */}
            {Array.from({ length: dateDetails.firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-7 w-7" />
            ))}

            {/* Calendar Days */}
            {Array.from({ length: dateDetails.totalDays }, (_, i) => i + 1).map((d) => {
              const isEventDay = d === dateDetails.day;
              return (
                <div key={d} className="flex items-center justify-center h-7 w-7 mx-auto">
                  {isEventDay ? (
                    <span
                      data-testid="calendar-event-day"
                      className="bg-[var(--party-accent)] text-[#091119] font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-md ring-4 ring-[var(--party-accent)]/25 animate-pulse"
                      title={isArabic ? 'موعد المناسبة' : 'Event Date'}
                    >
                      {d}
                    </span>
                  ) : (
                    <span className="text-[#18181B]/80 font-medium">{d}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Culturally authentic Saudi Arabic auto-localization for untouched English seed data.
 */
function localizeSeedBlock(block: StudioBlock, isAr: boolean): StudioBlock {
  if (!isAr) return block;

  const key = block.key;
  const eyebrow = block.eyebrow?.trim();
  const heading = block.content.heading?.trim();
  const note = block.content.note?.trim();

  const next: StudioBlock = {
    ...block,
    content: { ...block.content },
  };

  if (key === 'catering') {
    if (eyebrow === 'YOUR TABLE') next.eyebrow = 'الضيافة والعشاء';
    if (heading === 'A seat at our table') next.content.heading = 'نتشرف بحضوركم على مائدة العشاء';
    const isDefaultEntree =
      !next.content.entree ||
      next.content.entree.every((d) =>
        ['Rosemary chicken', 'Miso-glazed salmon', 'Garden ravioli'].includes(d)
      );
    if (isDefaultEntree) {
      next.content.entree = [
        'القهوة السعودية والضيافة الترحيبية',
        'مأدبة العشاء الفاخرة',
        'الحلويات والمشروبات الساخنة',
      ];
    }
  } else if (key === 'dress') {
    if (eyebrow === 'THE ATTIRE') next.eyebrow = 'الزي المطلوب';
    if (heading === 'Garden formal') next.content.heading = 'الزي الرسمي السعودي / كاجوال أنيق';
    if (
      !note ||
      note.includes('A little polished') ||
      note.includes('evening colors are encouraged')
    ) {
      next.content.note = 'نسعد بحضوركم بإطلالة أنيقة تناسب الأمسية.';
    }
  } else if (key === 'schedule') {
    if (eyebrow === 'THE EVENING') next.eyebrow = 'برنامج الأمسية';
    if (heading === 'A day in full bloom') next.content.heading = 'فقرات الحفل';
  } else if (key === 'registry') {
    if (eyebrow === 'A LITTLE SOMETHING') next.eyebrow = 'ملاحظة خاصة';
    if (heading === 'Your presence is enough') next.content.heading = 'حضوركم بيننا هو أجمل هدية';
  } else if (key === 'song') {
    if (eyebrow === 'SET THE TONE') next.eyebrow = 'شاركونا اللحظة';
    if (heading === 'Bring a song to the dance floor')
      next.content.heading = 'كلمة أو تهنئة لصاحب الدعوة';
  } else if (key === 'faq') {
    if (eyebrow === 'GOOD TO KNOW') next.eyebrow = 'معلومات الوصول والمواقف';
    if (heading === 'Before you join us') next.content.heading = 'تفاصيل الدخول والموقع';
    const isDefaultQuestions =
      !next.content.questions ||
      next.content.questions.some((q) => q.q.includes('plus one') || q.q.includes('park'));
    if (isDefaultQuestions) {
      next.content.questions = [
        {
          q: 'هل تتوفر خدمة صف السيارات (Valet)؟',
          a: 'نعم، تتوفر خدمة صف السيارات عند البوابة الرئيسية للمكان.',
        },
        {
          q: 'كيف يتم الدخول للمناسبة؟',
          a: 'يرجى إبراز بطاقة الدخول الرقمية (QR) الخاصة بدعوتك عند الاستقبال.',
        },
      ];
    }
  }

  return next;
}

export function PartyInvitationRenderer({
  event,
  blocks,
  guestName = 'الضيف الكريم',
  token = 'demo',
  passId = 'PASS-2026',
  allowedCompanions = 1,
  rsvpStatus = 'pending',
  plusOnes = 0,
  guestCount,
  maxGuests: propMaxGuests,
  preview = false,
  song = '',
  meal = '',
  invitationLocale,
  uiLocale = 'ar',
  activeTab,
  onRsvp,
  onSongChange,
  onMealChange,
  readOnly = false,
  isEditMode = false,
  selectedBlockId,
  onSelectBlock,
  onSelectSection,
  onMoveBlock,
  onToggleBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onChangeTitleScale,
  forceEnvelopeOpen = false,
  onEnvelopeOpened,
}: PartyInvitationRendererProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [localSong, setLocalSong] = useState(song);
  const [heroSelected, setHeroSelected] = useState(false);
  const [envelopeDismissed, setEnvelopeDismissed] = useState(false);

  useEffect(() => {
    if (forceEnvelopeOpen) {
      setEnvelopeDismissed(false);
    }
  }, [forceEnvelopeOpen]);

  const effectiveLocale: InvitationLocale = invitationLocale ?? (uiLocale === 'en' ? 'en' : 'ar');
  const isArabic = effectiveLocale === 'ar';

  const dateDetails = useMemo(() => {
    return parseEventDateDetails(event.date, isArabic ? 'ar' : 'en');
  }, [event.date, isArabic]);

  const styleKey = resolvePartyStyleId(event.templateId, event.styleId);
  const style = partyStyles[styleKey] ?? partyStyles['luxury-emerald'];

  const bg = event.backgroundColor || style.backgroundColor;
  const primary = event.primaryColor || style.primaryColor;
  const accent = event.accentColor || style.accentColor;

  // Dynamically calculate surface color based on the active background to eliminate hardcoded navy boxes
  const isDarkBg = useMemo(() => {
    try {
      const [r, g, b] = hexToRgb(bg);
      return getRelativeLuminance(r, g, b) < 0.45;
    } catch {
      return true;
    }
  }, [bg]);

  const surface = useMemo(() => {
    if (!event.backgroundColor) return style.surfaceColor;
    return isDarkBg ? mixColors(bg, '#FFFFFF', 0.08) : mixColors(bg, '#000000', 0.05);
  }, [event.backgroundColor, bg, isDarkBg, style.surfaceColor]);

  const partyStyle = {
    '--party-bg': bg,
    '--party-surface': surface,
    '--party-primary': primary,
    '--party-accent': accent,
  } as CSSProperties;

  // Filter visible blocks and auto-localize untouched defaults when in Arabic
  const visibleBlocks = blocks
    .filter((b) => b.enabled)
    .map((b) => localizeSeedBlock(b, isArabic));

  const displayedRsvp = isEditMode || preview ? 'accepted' : rsvpStatus;
  const totalGuestCount = guestCount ?? Math.max(1, plusOnes + 1);
  const maxGuests = propMaxGuests ?? 1 + allowedCompanions;

  const isCorporate = event.templateId === 'corporate';
  const isBirthday = event.templateId === 'birthday';
  const isBabyShower = event.templateId === 'baby-shower';
  const isCustom = event.templateId === 'custom';

  const defaultBadge = isCorporate
    ? partyInvitationT(effectiveLocale, 'corporateBadge')
    : isBirthday
    ? partyInvitationT(effectiveLocale, 'birthdayBadge')
    : isBabyShower
    ? partyInvitationT(effectiveLocale, 'babyShowerBadge')
    : partyInvitationT(effectiveLocale, 'customBadge');

  const badgeText = event.badgeText?.trim() || defaultBadge;

  // Title Scale sizing
  const titleScaleClass = {
    sm: 'text-2xl sm:text-3xl',
    md: 'text-3xl sm:text-4xl',
    lg: 'text-4xl sm:text-5xl',
    xl: 'text-5xl sm:text-6xl',
  }[event.titleScale || 'lg'];

  // Logo Size & Shape
  const logoSizeClass = {
    sm: 'h-10 max-w-[120px]',
    md: 'h-14 max-w-[160px]',
    lg: 'h-20 max-w-[220px]',
  }[event.logoSize || 'md'];

  const logoShapeClass = {
    original: 'object-contain',
    circle: 'rounded-full aspect-square object-cover',
    rounded: 'rounded-2xl object-cover',
  }[event.logoShape || 'original'];

  const logoContainerMode = event.logoContainer || 'auto-clean';
  const logoPlacement = event.logoPlacement || 'top-center';

  // Render logo with container styling
  const renderLogo = (customClass = '') => {
    if (!event.logoUrl) return null;

    const imgEl = (
      <img
        src={event.logoUrl}
        alt="Brand Logo"
        className={`transition-all ${logoSizeClass} ${logoShapeClass} ${customClass}`}
      />
    );

    if (logoContainerMode === 'glass-crest') {
      return (
        <div className="px-5 py-2.5 rounded-2xl bg-white/95 backdrop-blur-md shadow-lg border border-[var(--party-accent)]/30 inline-flex items-center justify-center">
          {imgEl}
        </div>
      );
    }

    if (logoContainerMode === 'white-pill') {
      return (
        <div className="px-4 py-2 rounded-full bg-white shadow-md inline-flex items-center justify-center">
          {imgEl}
        </div>
      );
    }

    // 'auto-clean' / 'raw'
    return <div className="inline-block drop-shadow-md">{imgEl}</div>;
  };

  const handleHeroClick = () => {
    if (!isEditMode) return;
    setHeroSelected(true);
    onSelectSection?.('hero');
  };

  const bgMode = event.backgroundMode || 'full-pinned';
  const bgBlur = event.backgroundBlur ?? 0;
  const overlayOpacity = event.backgroundOverlayOpacity ?? 0.55;

  return (
    <div
      style={partyStyle}
      className={`party-invitation party-template--${event.templateId} party-layout--${event.layout} party-type--${event.typography} party-motion--${event.motion} min-h-[100dvh] overflow-x-hidden text-[var(--party-primary)] select-text relative transition-colors duration-300 ${preview ? 'party-invitation--preview' : ''}`}
      lang={effectiveLocale}
      dir={localeDirection(effectiveLocale)}
    >
      {/* 0. 3D WAX SEAL LUXURY ENVELOPE INTRO */}
      {(event.enableEnvelopeOpener || forceEnvelopeOpen) && !envelopeDismissed && (!isEditMode || forceEnvelopeOpen) && (
        <PartyEnvelopeOpener
          title={event.title}
          hostName={event.hostName}
          logoUrl={event.logoUrl}
          useLogoOnWaxSeal={event.useLogoOnWaxSeal}
          waxSealText={event.waxSealText}
          backgroundColor={bg}
          primaryColor={primary}
          accentColor={accent}
          locale={isArabic ? 'ar' : 'en'}
          isOpen={envelopeDismissed}
          onOpen={() => {
            setEnvelopeDismissed(true);
            onEnvelopeOpened?.();
          }}
        />
      )}

      {/* 1. BACKGROUND ENGINE (Zero Tiling/Repeating + 3 Fill Modes + Blur) */}
      {event.backgroundImageUrl && (
        <>
          {bgMode === 'full-pinned' && (
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
              <img
                src={event.backgroundImageUrl}
                alt=""
                className="w-full h-full object-cover object-center"
                style={{
                  filter: bgBlur > 0 ? `blur(${bgBlur}px) scale(1.05)` : undefined,
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: bg,
                  opacity: overlayOpacity,
                }}
              />
              {/* Bottom melt fade so long scrolling sections seamlessly match canvas background */}
              <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[var(--party-bg)] to-transparent" />
            </div>
          )}

          {bgMode === 'frame-9-16' && (
            <div
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                backgroundImage: `url(${event.backgroundImageUrl})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: '100% 100%',
                backgroundPosition: 'center',
                filter: bgBlur > 0 ? `blur(${bgBlur}px)` : undefined,
              }}
              aria-hidden="true"
            >
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: bg,
                  opacity: overlayOpacity * 0.45,
                }}
              />
            </div>
          )}
        </>
      )}

      {/* Top Banner Mode (Header Image) */}
      {event.backgroundImageUrl && bgMode === 'hero-banner' && (
        <div className="relative w-full h-56 sm:h-64 overflow-hidden z-0">
          <img
            src={event.backgroundImageUrl}
            alt=""
            className="w-full h-full object-cover object-center"
            style={{
              filter: bgBlur > 0 ? `blur(${bgBlur}px)` : undefined,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--party-bg)] via-[var(--party-bg)]/40 to-transparent" />
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: bg,
              opacity: overlayOpacity * 0.35,
            }}
          />
        </div>
      )}

      {/* Background Decorative Layer */}
      {event.decorations && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-0" aria-hidden="true">
          {isCorporate && (
            <div className="absolute inset-0 opacity-15">
              <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[var(--party-accent)] to-transparent" />
              <div className="absolute right-8 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[var(--party-accent)] to-transparent" />
              <div className="absolute inset-x-0 top-32 h-px bg-gradient-to-r from-transparent via-[var(--party-accent)] to-transparent" />
            </div>
          )}

          {isBirthday && (
            <>
              <div className="party-balloon-decoration party-balloon--left" />
              <div className="party-balloon-decoration party-balloon--right" />
              <div className="party-confetti-sparkle party-confetti--1" />
              <div className="party-confetti-sparkle party-confetti--2" />
              <div className="party-confetti-sparkle party-confetti--3" />
            </>
          )}

          {isBabyShower && (
            <>
              <div className="party-cloud-decoration party-cloud--top" />
              <div className="party-botanical-wreath party-wreath--corner" />
            </>
          )}

          {isCustom && (
            <>
              <div className="gold-thread" />
              <div className="absolute left-6 right-6 top-6 bottom-6 border border-[var(--party-accent)]/20 pointer-events-none rounded-[32px]" />
            </>
          )}
        </div>
      )}

      {/* Main Luxury Poster Container */}
      <main className="relative z-10 mx-auto max-w-2xl px-5 sm:px-8 pt-6 pb-28">
        {/* On-Canvas Floating Action Pill Bar for Hero */}
        {isEditMode && heroSelected && !selectedBlockId && (
          <div
            className="mb-4 mx-auto z-30 flex items-center justify-center gap-1.5 p-1 rounded-full bg-[#18201C]/95 text-white border border-[var(--party-accent)]/60 shadow-2xl backdrop-blur-md w-fit max-w-[95%]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onSelectSection?.('hero')}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-white/10 hover:bg-white/20 transition"
            >
              <Edit3 size={11} className="text-[var(--party-accent)]" />
              <span>{isArabic ? 'تعديل التفاصيل' : 'Edit Details'}</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSection?.('wording')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 hover:bg-white/20 transition"
            >
              <Sparkles size={11} className="text-[var(--party-accent)]" />
              <span>{isArabic ? 'الصياغة' : 'Wording'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const scales: ('sm' | 'md' | 'lg' | 'xl')[] = ['sm', 'md', 'lg', 'xl'];
                const curr = event.titleScale || 'lg';
                const next = scales[(scales.indexOf(curr) + 1) % scales.length];
                onChangeTitleScale?.(next);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 hover:bg-white/20 transition"
              title="Change Title Size"
            >
              <span className="text-[var(--party-accent)] font-bold text-[10px]">
                📏 {(event.titleScale || 'lg').toUpperCase()}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSection?.('design')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 hover:bg-white/20 transition"
            >
              <span>🏷️</span>
              <span>{isArabic ? '+ الشعار' : '+ Logo'}</span>
            </button>
          </div>
        )}

        {/* 2. THE 4 DISTINCT ARCHITECTURAL HERO LAYOUTS */}

        {/* TEMPLATE ARCHITECTURE 1: CORPORATE EXECUTIVE BENTO */}
        {isCorporate && (
          <section
            onClick={handleHeroClick}
            className={`relative pb-8 pt-4 transition-all duration-200 ${
              isEditMode ? 'cursor-pointer hover:ring-1 hover:ring-[var(--party-accent)]/50 rounded-3xl p-3' : ''
            } ${isEditMode && heroSelected && !selectedBlockId ? 'ring-1 ring-[var(--party-accent)] shadow-xl bg-black/10 rounded-3xl' : ''}`}
            data-testid="section-hero"
          >
            {/* Top Architectural Header Bar */}
            <div className="flex items-center justify-between border-b border-[var(--party-accent)]/20 pb-4 mb-6">
              <div className="flex items-center gap-3">
                {event.logoUrl && (logoPlacement === 'header-bar' || logoPlacement === 'top-center') ? (
                  renderLogo('max-h-11')
                ) : (
                  <span className="font-display font-bold tracking-widest text-xs uppercase text-[var(--party-accent)]">
                    {event.hostName || 'EXECUTIVE INVITATION'}
                  </span>
                )}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--party-accent)]/40 bg-[var(--party-surface)] px-3.5 py-1 shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--party-accent)] animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--party-accent)]">
                  <bdi>{badgeText}</bdi>
                </span>
              </div>
            </div>

            {/* Headline and Host Wording */}
            <div className="text-center sm:text-start max-w-xl">
              {event.hostName && (
                <p className="text-xs sm:text-sm font-semibold tracking-widest uppercase text-[var(--party-accent)] mb-2">
                  <bdi>{isArabic ? `بدعوة كريمة من: ${event.hostName}` : `Hosted by ${event.hostName}`}</bdi>
                </p>
              )}
              <h1 className={`font-display font-bold leading-[1.08] text-[var(--party-primary)] break-words ${titleScaleClass}`} dir="auto">
                <bdi>{event.title}</bdi>
              </h1>
              {event.subtitle && (
                <p className="mt-2 text-sm sm:text-base font-medium opacity-85" dir="auto">
                  <bdi>{event.subtitle}</bdi>
                </p>
              )}
              <p className="mt-4 break-words text-sm sm:text-base leading-relaxed opacity-90 text-[var(--party-primary)]" dir="auto">
                <bdi>{event.invitationWording}</bdi>
              </p>
            </div>

            {/* 2x2 Bento Info Grid */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Bento 1: Gregorian & Hijri Date */}
              <div className="rounded-2xl border border-[var(--party-accent)]/30 bg-[var(--party-surface)] p-4 text-start shadow-xs">
                <div className="flex items-center gap-2 text-[var(--party-accent)] text-xs font-bold uppercase tracking-wider mb-1">
                  <CalendarDays size={15} />
                  <span>{formatPartyDate(event.date, effectiveLocale)}</span>
                </div>
                {event.showHijriDate && event.date && (
                  <p className="text-xs opacity-80 font-medium mt-1">
                    {formatFullHijriDate(event.date, isArabic ? 'ar' : 'en')}
                  </p>
                )}
              </div>

              {/* Bento 2: Time & Saudi Anchor */}
              <div className="rounded-2xl border border-[var(--party-accent)]/30 bg-[var(--party-surface)] p-4 text-start shadow-xs">
                <div className="flex items-center gap-2 text-[var(--party-accent)] text-xs font-bold uppercase tracking-wider mb-1">
                  <Clock size={15} />
                  <span>{isArabic ? 'موعد الحضور' : 'Time'}</span>
                </div>
                <p className="text-xs font-semibold opacity-90 mt-1" dir={isArabic ? 'rtl' : 'ltr'}>
                  {event.timeLabel || event.startTime || (isArabic ? 'بعد صلاة العشاء' : 'Evening')}
                </p>
              </div>

              {/* Bento 3: Venue, City & Maps Pin */}
              <div className="rounded-2xl border border-[var(--party-accent)]/30 bg-[var(--party-surface)] p-4 text-start shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[var(--party-accent)] text-xs font-bold mb-1">
                    <MapPin size={15} />
                    <bdi>{event.venue || (isArabic ? 'الموقع سيحدد لاحقاً' : 'Venue TBA')}</bdi>
                  </div>
                  {event.city && <p className="text-xs opacity-75">{event.city}</p>}
                </div>
                {event.mapUrl && (
                  <a
                    href={event.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--party-accent)] hover:underline"
                  >
                    <span>{isArabic ? 'فتح في خرائط Google' : 'Open in Maps'}</span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>

              {/* Bento 4: VIP Access & Attire Code */}
              <div className="rounded-2xl border border-[var(--party-accent)]/30 bg-[var(--party-surface)] p-4 text-start shadow-xs">
                <div className="flex items-center gap-2 text-[var(--party-accent)] text-xs font-bold uppercase tracking-wider mb-1">
                  <Shirt size={15} />
                  <span>{isArabic ? 'الزي والدخول' : 'Access & Attire'}</span>
                </div>
                <p className="text-xs font-semibold opacity-90 mt-1">
                  {isArabic ? 'الزي الرسمي السعودي · الدخول ببطاقة الدعوة' : 'Business Formal · Invitation Required'}
                </p>
              </div>
            </div>

            {/* Ambient Floating Dust */}
            {event.motion !== 'none' && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="absolute top-1/4 start-1/4 h-1.5 w-1.5 rounded-full bg-[var(--party-accent)]/40 animate-floating-dust" />
                <div className="absolute top-1/2 end-1/3 h-2 w-2 rounded-full bg-[var(--party-accent)]/30 animate-floating-dust" style={{ animationDelay: '3s' }} />
                <div className="absolute bottom-1/4 start-1/3 h-1 w-1 rounded-full bg-[var(--party-accent)]/50 animate-floating-dust" style={{ animationDelay: '6s' }} />
              </div>
            )}

            {/* Scroll Down Micro-Indicator */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                const el = document.getElementById('party-invitation-body');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="pt-6 pb-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition opacity-75 hover:opacity-100 animate-scroll-pulse text-center select-none"
              aria-label={isArabic ? 'اسحب للتفاصيل' : 'Scroll down for details'}
            >
              <span className="text-[10px] uppercase font-bold tracking-[.2em] text-[var(--party-accent)]">
                {isArabic ? 'اسحب للتفاصيل' : 'Scroll for Details'}
              </span>
              <ChevronDown size={14} className="text-[var(--party-accent)]" />
            </div>
          </section>
        )}

        {/* TEMPLATE ARCHITECTURE 2: ROYAL SAUDI MAJLIS STATIONERY */}
        {isCustom && (
          <section
            onClick={handleHeroClick}
            className={`relative text-center border-2 border-[var(--party-accent)]/40 rounded-[32px] p-6 sm:p-10 shadow-sm backdrop-blur-xs transition-all duration-200 ${
              isEditMode ? 'cursor-pointer hover:ring-1 hover:ring-[var(--party-accent)]/50' : ''
            } ${isEditMode && heroSelected && !selectedBlockId ? 'ring-1 ring-[var(--party-accent)]' : ''}`}
            style={{ backgroundColor: surface }}
            data-testid="section-hero"
          >
            {/* SVG Arabesque Corner Ornaments */}
            <svg className="absolute top-2.5 start-2.5 w-7 h-7 text-[var(--party-accent)] opacity-60" viewBox="0 0 32 32" fill="none">
              <path d="M2 14V2H14M2 2L12 12M6 2H10M2 6V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <svg className="absolute top-2.5 end-2.5 w-7 h-7 text-[var(--party-accent)] opacity-60" viewBox="0 0 32 32" fill="none">
              <path d="M30 14V2H18M30 2L20 12M26 2H22M30 6V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <svg className="absolute bottom-2.5 start-2.5 w-7 h-7 text-[var(--party-accent)] opacity-60" viewBox="0 0 32 32" fill="none">
              <path d="M2 18V30H14M2 30L12 20M6 30H10M2 26V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <svg className="absolute bottom-2.5 end-2.5 w-7 h-7 text-[var(--party-accent)] opacity-60" viewBox="0 0 32 32" fill="none">
              <path d="M30 18V30H18M30 30L20 20M26 30H22M30 26V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>

            {/* Central Top Ceremonial Crest */}
            <div className="mb-4 flex flex-col items-center">
              {event.logoUrl && (logoPlacement === 'top-center' || logoPlacement === 'header-bar') ? (
                <div className="mb-3">{renderLogo()}</div>
              ) : (
                <div className="h-8 w-8 rounded-full border border-[var(--party-accent)]/50 flex items-center justify-center text-[var(--party-accent)] mb-2">
                  <span className="text-sm">❖</span>
                </div>
              )}
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--party-accent)]/40 px-4 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--party-accent)]">
                <bdi>{badgeText}</bdi>
              </div>
            </div>

            {event.hostName && (
              <p className="mt-2 text-xs sm:text-sm font-semibold tracking-wider uppercase opacity-85">
                <bdi>{event.hostName}</bdi>
              </p>
            )}

            <h1 className={`mt-3 font-display font-bold leading-[1.12] text-[var(--party-primary)] break-words ${titleScaleClass}`} dir="auto">
              <bdi>{event.title}</bdi>
            </h1>

            {/* Cultural Saudi Divider */}
            <div className="my-4 flex items-center justify-center gap-3 text-[var(--party-accent)]/70 text-xs select-none">
              <span className="h-px w-14 bg-current" />
              <span>✦</span>
              <span className="h-px w-14 bg-current" />
            </div>

            {event.subtitle && (
              <p className="text-sm sm:text-base font-medium opacity-85" dir="auto">
                <bdi>{event.subtitle}</bdi>
              </p>
            )}

            <p className="mx-auto mt-4 max-w-lg break-words text-sm sm:text-base leading-relaxed opacity-90 text-[var(--party-primary)]" dir="auto">
              <bdi>{event.invitationWording}</bdi>
            </p>

            {/* Ceremonial Date & Hijri Medallion */}
            <div className="mt-8 inline-flex flex-col sm:flex-row items-center justify-center gap-3 rounded-2xl border border-[var(--party-accent)]/35 bg-black/15 px-6 py-3 shadow-inner">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--party-accent)]">
                <CalendarDays size={15} />
                <time dateTime={event.date}>{formatPartyDate(event.date, effectiveLocale)}</time>
              </div>
              {event.showHijriDate && event.date && (
                <span className="text-xs opacity-80">
                  &bull; {formatFullHijriDate(event.date, isArabic ? 'ar' : 'en')}
                </span>
              )}
              {(event.timeLabel || event.startTime) && (
                <span className="text-xs opacity-80 flex items-center gap-1 font-mono" dir="ltr">
                  <Clock size={12} className="text-[var(--party-accent)]" />
                  {event.timeLabel || event.startTime}
                </span>
              )}
            </div>

            {event.venue && (
              <div className="mt-3 text-xs opacity-80 flex items-center justify-center gap-1.5">
                <MapPin size={13} className="text-[var(--party-accent)]" />
                <bdi>{event.venue}{event.city ? ` · ${event.city}` : ''}</bdi>
              </div>
            )}

            {/* Ambient Floating Dust */}
            {event.motion !== 'none' && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="absolute top-1/4 start-1/4 h-1.5 w-1.5 rounded-full bg-[var(--party-accent)]/40 animate-floating-dust" />
                <div className="absolute top-1/2 end-1/3 h-2 w-2 rounded-full bg-[var(--party-accent)]/30 animate-floating-dust" style={{ animationDelay: '3s' }} />
                <div className="absolute bottom-1/4 start-1/3 h-1 w-1 rounded-full bg-[var(--party-accent)]/50 animate-floating-dust" style={{ animationDelay: '6s' }} />
              </div>
            )}

            {/* Scroll Down Micro-Indicator */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                const el = document.getElementById('party-invitation-body');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="pt-6 pb-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition opacity-75 hover:opacity-100 animate-scroll-pulse text-center select-none"
              aria-label={isArabic ? 'اسحب للتفاصيل' : 'Scroll down for details'}
            >
              <span className="text-[10px] uppercase font-bold tracking-[.2em] text-[var(--party-accent)]">
                {isArabic ? 'اسحب للتفاصيل' : 'Scroll for Details'}
              </span>
              <ChevronDown size={14} className="text-[var(--party-accent)]" />
            </div>
          </section>
        )}

        {/* TEMPLATE ARCHITECTURE 3: APPLE INVITES FLOATING GLASS POSTER */}
        {isBirthday && (
          <section
            onClick={handleHeroClick}
            className={`relative text-center pb-8 pt-4 transition-all duration-200 ${
              isEditMode ? 'cursor-pointer hover:ring-1 hover:ring-[var(--party-accent)]/50 rounded-3xl p-3' : ''
            } ${isEditMode && heroSelected && !selectedBlockId ? 'ring-1 ring-[var(--party-accent)] rounded-3xl' : ''}`}
            data-testid="section-hero"
          >
            {/* Sculpted Frosted Glass Hero Card */}
            <div className="backdrop-blur-xl bg-white/10 border border-white/25 rounded-[32px] p-6 sm:p-9 shadow-2xl relative overflow-hidden mb-6">
              {event.logoUrl && <div className="mb-4 flex justify-center">{renderLogo()}</div>}

              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--party-accent)]/40 bg-[var(--party-surface)]/80 px-4 py-1.5 shadow-xs mb-4">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--party-accent)]" />
                <span className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--party-accent)]">
                  <bdi>{badgeText}</bdi>
                </span>
              </div>

              {event.hostName && (
                <p className="text-xs sm:text-sm font-semibold tracking-wider uppercase opacity-85 mb-2">
                  <bdi>{event.hostName}</bdi>
                </p>
              )}

              <h1 className={`font-display font-bold leading-[1.08] text-[var(--party-primary)] break-words ${titleScaleClass}`} dir="auto">
                <bdi>{event.title}</bdi>
              </h1>

              {event.subtitle && (
                <p className="mt-2 text-sm sm:text-base font-medium opacity-85" dir="auto">
                  <bdi>{event.subtitle}</bdi>
                </p>
              )}

              <p className="mx-auto mt-4 max-w-lg break-words text-sm sm:text-base leading-relaxed opacity-90 text-[var(--party-primary)]" dir="auto">
                <bdi>{event.invitationWording}</bdi>
              </p>
            </div>

            {/* Floating Glass Info Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {event.date && (
                <div className="flex items-center gap-2 rounded-full border border-[var(--party-accent)]/40 bg-[var(--party-surface)] px-4 py-2 text-xs font-semibold shadow-xs">
                  <CalendarDays size={14} className="text-[var(--party-accent)]" />
                  <time dateTime={event.date}>{formatPartyDate(event.date, effectiveLocale)}</time>
                  {event.showHijriDate && (
                    <span className="opacity-75 text-[11px] font-normal ps-1">
                      &bull; {formatFullHijriDate(event.date, isArabic ? 'ar' : 'en')}
                    </span>
                  )}
                </div>
              )}

              {(event.timeLabel || event.startTime) && (
                <div className="flex items-center gap-2 rounded-full border border-[var(--party-accent)]/40 bg-[var(--party-surface)] px-4 py-2 text-xs font-semibold shadow-xs">
                  <Clock size={14} className="text-[var(--party-accent)]" />
                  <span dir="ltr">{event.timeLabel || event.startTime}</span>
                </div>
              )}

              {event.venue && (
                <div className="flex items-center gap-2 rounded-full border border-[var(--party-accent)]/40 bg-[var(--party-surface)] px-4 py-2 text-xs font-semibold shadow-xs">
                  <MapPin size={14} className="text-[var(--party-accent)]" />
                  <bdi>{event.venue}{event.city ? ` · ${event.city}` : ''}</bdi>
                </div>
              )}
            </div>

            {/* Ambient Floating Dust */}
            {event.motion !== 'none' && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="absolute top-1/4 start-1/4 h-1.5 w-1.5 rounded-full bg-[var(--party-accent)]/40 animate-floating-dust" />
                <div className="absolute top-1/2 end-1/3 h-2 w-2 rounded-full bg-[var(--party-accent)]/30 animate-floating-dust" style={{ animationDelay: '3s' }} />
                <div className="absolute bottom-1/4 start-1/3 h-1 w-1 rounded-full bg-[var(--party-accent)]/50 animate-floating-dust" style={{ animationDelay: '6s' }} />
              </div>
            )}

            {/* Scroll Down Micro-Indicator */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                const el = document.getElementById('party-invitation-body');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="pt-6 pb-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition opacity-75 hover:opacity-100 animate-scroll-pulse text-center select-none"
              aria-label={isArabic ? 'اسحب للتفاصيل' : 'Scroll down for details'}
            >
              <span className="text-[10px] uppercase font-bold tracking-[.2em] text-[var(--party-accent)]">
                {isArabic ? 'اسحب للتفاصيل' : 'Scroll for Details'}
              </span>
              <ChevronDown size={14} className="text-[var(--party-accent)]" />
            </div>
          </section>
        )}

        {/* TEMPLATE ARCHITECTURE 4: BOTANICAL ARCH MEDALLION */}
        {isBabyShower && (
          <section
            onClick={handleHeroClick}
            className={`relative text-center border border-[var(--party-accent)]/30 rounded-t-[160px] rounded-b-[32px] p-8 sm:p-12 shadow-sm backdrop-blur-xs transition-all duration-200 ${
              isEditMode ? 'cursor-pointer hover:ring-1 hover:ring-[var(--party-accent)]/50' : ''
            } ${isEditMode && heroSelected && !selectedBlockId ? 'ring-1 ring-[var(--party-accent)]' : ''}`}
            style={{ backgroundColor: surface }}
            data-testid="section-hero"
          >
            {/* Botanical Olive-Branch Floral Emblem at crown */}
            <svg className="mx-auto w-12 h-12 text-[var(--party-accent)] opacity-80 mb-3" viewBox="0 0 48 48" fill="none">
              <path d="M24 8C20 16 14 20 8 22M24 8C28 16 34 20 40 22M24 8V38M24 18C18 22 14 28 12 36M24 18C30 22 34 28 36 36M24 28C20 32 17 38 16 42M24 28C28 32 31 38 32 42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>

            {event.logoUrl && <div className="mb-3 flex justify-center">{renderLogo()}</div>}

            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--party-accent)]/40 px-4 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--party-accent)] mb-3">
              <bdi>{badgeText}</bdi>
            </div>

            {event.hostName && (
              <p className="text-xs sm:text-sm font-semibold tracking-wider uppercase opacity-85 mb-2">
                <bdi>{event.hostName}</bdi>
              </p>
            )}

            <h1 className={`font-display font-bold leading-[1.1] text-[var(--party-primary)] break-words ${titleScaleClass}`} dir="auto">
              <bdi>{event.title}</bdi>
            </h1>

            {event.subtitle && (
              <p className="mt-2 text-sm sm:text-base font-medium opacity-85" dir="auto">
                <bdi>{event.subtitle}</bdi>
              </p>
            )}

            <p className="mx-auto mt-4 max-w-lg break-words text-sm sm:text-base leading-relaxed opacity-90 text-[var(--party-primary)]" dir="auto">
              <bdi>{event.invitationWording}</bdi>
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
              {event.date && (
                <div className="flex items-center gap-2 rounded-full border border-[var(--party-accent)]/30 bg-black/10 px-4 py-1.5 text-xs font-semibold">
                  <CalendarDays size={14} className="text-[var(--party-accent)]" />
                  <time dateTime={event.date}>{formatPartyDate(event.date, effectiveLocale)}</time>
                  {event.showHijriDate && (
                    <span className="opacity-75 text-[11px] font-normal ps-1">
                      &bull; {formatFullHijriDate(event.date, isArabic ? 'ar' : 'en')}
                    </span>
                  )}
                </div>
              )}
              {event.venue && (
                <div className="flex items-center gap-2 rounded-full border border-[var(--party-accent)]/30 bg-black/10 px-4 py-1.5 text-xs font-semibold">
                  <MapPin size={14} className="text-[var(--party-accent)]" />
                  <bdi>{event.venue}</bdi>
                </div>
              )}
            </div>

            {/* Ambient Floating Dust */}
            {event.motion !== 'none' && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="absolute top-1/4 start-1/4 h-1.5 w-1.5 rounded-full bg-[var(--party-accent)]/40 animate-floating-dust" />
                <div className="absolute top-1/2 end-1/3 h-2 w-2 rounded-full bg-[var(--party-accent)]/30 animate-floating-dust" style={{ animationDelay: '3s' }} />
                <div className="absolute bottom-1/4 start-1/3 h-1 w-1 rounded-full bg-[var(--party-accent)]/50 animate-floating-dust" style={{ animationDelay: '6s' }} />
              </div>
            )}

            {/* Scroll Down Micro-Indicator */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                const el = document.getElementById('party-invitation-body');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="pt-6 pb-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition opacity-75 hover:opacity-100 animate-scroll-pulse text-center select-none"
              aria-label={isArabic ? 'اسحب للتفاصيل' : 'Scroll down for details'}
            >
              <span className="text-[10px] uppercase font-bold tracking-[.2em] text-[var(--party-accent)]">
                {isArabic ? 'اسحب للتفاصيل' : 'Scroll for Details'}
              </span>
              <ChevronDown size={14} className="text-[var(--party-accent)]" />
            </div>
          </section>
        )}

        {/* CURVED LUXURY EDITORIAL BODY SHEET */}
        <div
          id="party-invitation-body"
          className="rounded-t-[36px] -mt-6 relative z-10 px-5 py-8 sm:px-8 sm:py-10 shadow-[0_-18px_45px_rgba(0,0,0,0.28)] border-t border-[var(--party-accent)]/35 overflow-hidden"
          style={{ backgroundColor: surface }}
        >
          {/* Inner double-hairline ornamental frame */}
          <div
            className="pointer-events-none absolute inset-3 rounded-[28px] border border-[var(--party-accent)]/15"
            aria-hidden="true"
          />

          {/* EDITORIAL DATE LOCKUP (Reel Upgrade 2) */}
          <PartyScrollReveal disabled={event.motion === 'none'}>
            <EditorialDateLockup
              event={event}
              effectiveLocale={effectiveLocale}
              isArabic={isArabic}
              dateDetails={dateDetails}
            />
          </PartyScrollReveal>

          {/* COUNTDOWN & CALENDAR (Reel Upgrade 3) */}
          {event.showCountdownCalendar !== false && (
            <PartyScrollReveal delay={120} disabled={event.motion === 'none'}>
              <CountdownAndCalendarSheet
                event={event}
                dateDetails={dateDetails}
                isArabic={isArabic}
              />
            </PartyScrollReveal>
          )}

          {/* Delicate Ornamental Divider */}
          <div className="my-10 flex items-center justify-center gap-4 text-[var(--party-accent)]/60" aria-hidden="true">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--party-accent)]/35 to-transparent" />
            <span className="text-xs">✦</span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--party-accent)]/35 to-transparent" />
          </div>

          {/* 3. MODULAR BLOCKS SECTION — Seamless Continuous Flow */}
          {visibleBlocks.length > 0 && (
            <section className="my-8 space-y-6" data-testid="section-blocks">
              {visibleBlocks.map((block, index) => {
                const isSelected = isEditMode && selectedBlockId === block.id;

                return (
                  <PartyScrollReveal
                    key={block.id}
                    delay={Math.min(index * 60, 300)}
                    disabled={event.motion === 'none'}
                  >
                    <div
                      id={`party-block-${block.id}`}
                      data-testid={`party-block-${block.key}`}
                      onClick={() => {
                        if (isEditMode) {
                          setHeroSelected(false);
                          onSelectBlock?.(block.id);
                        }
                      }}
                      className={`relative transition-all duration-200 ${
                        isEditMode
                          ? 'cursor-pointer hover:ring-1 hover:ring-[var(--party-accent)]/50 rounded-2xl p-1'
                          : ''
                      } ${
                        isSelected
                          ? 'ring-1 ring-[var(--party-accent)] shadow-xl bg-black/10 rounded-2xl'
                          : ''
                      }`}
                    >
                      {/* On-Canvas Floating Action Pill Bar for Block */}
                      {isEditMode && isSelected && (
                        <div
                          className="absolute -top-4 inset-x-0 mx-auto z-30 flex items-center justify-center gap-1 p-1 rounded-full bg-[#18201C]/95 text-white border border-[var(--party-accent)]/60 shadow-2xl backdrop-blur-md w-fit max-w-[95%]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectBlock?.(block.id)}
                            data-testid={`button-edit-block-${block.id}`}
                            aria-label={`Edit ${block.label}`}
                            className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-[var(--party-accent)] text-black hover:brightness-110 transition"
                          >
                            <Edit3 size={11} />
                            <span>{isArabic ? 'تعديل' : 'Edit'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onMoveBlock?.(index, -1)}
                            disabled={index === 0}
                            data-testid={`button-move-up-${block.id}`}
                            aria-label={`Move Up ${block.label}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition"
                            title="Move Up"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onMoveBlock?.(index, 1)}
                            disabled={index === visibleBlocks.length - 1}
                            data-testid={`button-move-down-${block.id}`}
                            aria-label={`Move Down ${block.label}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition"
                            title="Move Down"
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicateBlock?.(block.id)}
                            data-testid={`button-duplicate-${block.id}`}
                            aria-label={`Duplicate ${block.label}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
                            title="Duplicate"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleBlock?.(block.id)}
                            data-testid={`button-toggle-${block.id}`}
                            aria-label={`Toggle ${block.label}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
                            title="Hide Block"
                          >
                            <EyeOff size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteBlock?.(block.id)}
                            data-testid={`button-delete-${block.id}`}
                            aria-label={`Delete ${block.label}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#B4534B]/20 text-[#FF8F87] hover:bg-[#B4534B]/40 transition"
                            title="Delete Block"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}

                      <RenderBlockItem
                        block={block}
                        index={index}
                        openFaq={openFaq}
                        setOpenFaq={setOpenFaq}
                        song={isEditMode ? song : localSong}
                        setSong={(val) => {
                          setLocalSong(val);
                          onSongChange?.(val);
                        }}
                        meal={meal}
                        setMeal={(val) => onMealChange?.(val)}
                        invitationLocale={effectiveLocale}
                        templateId={event.templateId}
                        eventVenue={[event.venue, event.city].filter(Boolean).join(' · ')}
                        eventHost={event.hostName}
                      />
                    </div>
                  </PartyScrollReveal>
                );
              })}
            </section>
          )}

          {/* ETIQUETTE & ACCESS BADGES */}
          {event.etiquetteBadges && event.etiquetteBadges.length > 0 && (
            <PartyScrollReveal disabled={event.motion === 'none'}>
              <div className="flex flex-wrap items-center justify-center gap-2 my-8">
                {event.etiquetteBadges.map((badge, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--party-accent)]/30 bg-[var(--party-surface)] px-3.5 py-1 text-[11px] font-semibold text-[var(--party-accent)] shadow-xs"
                  >
                    <Sparkles size={11} className="text-[var(--party-accent)]" />
                    <bdi>{badge}</bdi>
                  </span>
                ))}
              </div>
            </PartyScrollReveal>
          )}

          {/* 4. RSVP INTERACTION SECTION */}
          <section className="mt-4 mb-12" data-testid="section-rsvp">
          <AnimatePresence mode="wait">
            {displayedRsvp === 'pending' && !readOnly && (
              <motion.div
                key="rsvp-pending"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="party-card rounded-3xl border border-[var(--party-accent)]/40 p-6 sm:p-10 text-center shadow-lg backdrop-blur-md"
                style={{ backgroundColor: surface }}
              >
                <p className="text-[10px] uppercase tracking-[.18em] text-[var(--party-accent)] font-bold">
                  {partyInvitationT(effectiveLocale, 'privateFor')} {guestName}
                </p>

                <h2 className="mt-3 font-display text-3xl sm:text-4xl text-[var(--party-primary)] font-bold">
                  {invitationT(effectiveLocale, 'rsvpTitle')}
                </h2>

                {event.rsvpDeadline && (
                  <p className="mx-auto mt-2 max-w-sm text-xs sm:text-sm leading-6 opacity-75">
                    {partyInvitationT(effectiveLocale, 'replyBy')}{' '}
                    <time dateTime={event.rsvpDeadline} className="font-semibold underline underline-offset-2">
                      {formatPartyDate(event.rsvpDeadline, effectiveLocale)}
                    </time>
                  </p>
                )}

                {/* Companions Counter */}
                <div className="mx-auto mt-6 flex max-w-xs items-center justify-between rounded-2xl border border-[var(--party-accent)]/40 bg-black/10 p-3">
                  <span className="text-start text-xs font-semibold">
                    {invitationT(effectiveLocale, 'guestCount')}
                    <small className="mt-0.5 block text-[10px] opacity-65 font-normal">
                      {invitationT(effectiveLocale, 'allowed')}: {maxGuests}
                    </small>
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-[var(--party-accent)]/50 text-base font-bold transition hover:bg-[var(--party-accent)]/20 disabled:opacity-30"
                      onClick={() => onRsvp?.('pending', totalGuestCount - 1)}
                      disabled={totalGuestCount <= 1}
                      aria-label={invitationT(effectiveLocale, 'decreaseGuests')}
                    >
                      &minus;
                    </button>
                    <b className="font-mono text-base">{totalGuestCount}</b>
                    <button
                      type="button"
                      className="focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-[var(--party-accent)]/50 text-base font-bold transition hover:bg-[var(--party-accent)]/20 disabled:opacity-30"
                      onClick={() => onRsvp?.('pending', totalGuestCount + 1)}
                      disabled={totalGuestCount >= maxGuests}
                      aria-label={invitationT(effectiveLocale, 'increaseGuests')}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Accept / Decline Action Buttons */}
                <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => onRsvp?.('accepted', totalGuestCount)}
                    className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--party-accent)] px-7 py-3 text-xs font-bold uppercase tracking-wider text-black shadow-md transition hover:brightness-110 active:scale-98"
                  >
                    <Check size={16} strokeWidth={2.5} />
                    <span>{invitationT(effectiveLocale, 'attending')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRsvp?.('declined')}
                    className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--party-accent)]/40 bg-transparent px-6 py-3 text-xs font-semibold text-[var(--party-primary)] transition hover:bg-white/10 active:scale-98"
                  >
                    <X size={15} />
                    <span>{invitationT(effectiveLocale, 'declining')}</span>
                  </button>
                </div>

                <div className="mt-6 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[.12em] opacity-60">
                  <LockKeyhole size={12} />
                  <span>{partyInvitationT(effectiveLocale, 'noAccount')}</span>
                </div>
              </motion.div>
            )}

            {displayedRsvp === 'declined' && (
              <motion.div
                key="rsvp-declined"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="party-card rounded-3xl border border-[var(--party-accent)]/40 p-8 text-center shadow-lg"
                style={{ backgroundColor: surface }}
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--party-accent)] text-[var(--party-accent)]">
                  <Heart size={22} strokeWidth={1.5} />
                </div>
                <h2 className="mt-5 font-display text-3xl text-[var(--party-primary)] font-bold">
                  {partyInvitationT(effectiveLocale, 'missedTitle')}
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm opacity-75">
                  {partyInvitationT(effectiveLocale, 'missedBody')}
                </p>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onRsvp?.('pending')}
                    data-testid="button-change-rsvp"
                    className="focus-ring mt-6 inline-flex min-h-11 items-center gap-1.5 text-xs font-bold uppercase tracking-[.15em] text-[var(--party-accent)] underline underline-offset-4"
                  >
                    {partyInvitationT(effectiveLocale, 'changeResponse')}
                  </button>
                )}
              </motion.div>
            )}

            {displayedRsvp === 'accepted' && (
              <motion.div
                key="rsvp-accepted"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                {/* Confirmation Header Card */}
                <div
                  className="party-card rounded-3xl border border-[var(--party-accent)]/50 p-6 sm:p-8 shadow-md backdrop-blur-md"
                  style={{ backgroundColor: surface }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-[.18em] text-[var(--party-accent)]">
                        {partyInvitationT(effectiveLocale, 'onList')}
                      </p>
                      <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[var(--party-primary)]">
                        {partyInvitationT(effectiveLocale, 'acceptedTitle')}
                      </h2>
                      <p className="mt-1 text-xs sm:text-sm opacity-75">
                        {partyInvitationT(effectiveLocale, 'acceptedBody')}
                      </p>
                    </div>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--party-accent)]/20 text-[var(--party-accent)] border border-[var(--party-accent)]/40">
                      <CheckCircle2 size={24} strokeWidth={2} />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--party-accent)]/20 pt-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--party-accent)] bg-black/20 text-xs font-bold text-[var(--party-accent)]">
                        {guestName.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-bold text-sm text-[var(--party-primary)]">
                          {guestName}
                        </p>
                        <p className="text-[11px] opacity-60">
                          {totalGuestCount} {partyInvitationT(effectiveLocale, 'guest')} &bull;{' '}
                          {token}
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full bg-[var(--party-accent)]/15 border border-[var(--party-accent)]/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--party-accent)]">
                      {partyInvitationT(effectiveLocale, 'confirmed')}
                    </span>
                  </div>

                  {!readOnly && !isEditMode && (
                    <div className="mt-4 pt-3 border-t border-[var(--party-accent)]/15 text-start">
                      <button
                        type="button"
                        onClick={() => onRsvp?.('pending')}
                        data-testid="button-change-rsvp"
                        className="text-[11px] font-semibold text-[var(--party-accent)] hover:underline"
                      >
                        {partyInvitationT(effectiveLocale, 'changeResponse')}
                      </button>
                    </div>
                  )}
                </div>

                {/* DIGITAL ADMISSION VIP PASS (Apple Wallet / Mazoom Style) */}
                <div
                  className="party-pass-card relative overflow-hidden rounded-[28px] border border-[var(--party-accent)]/50 p-6 sm:p-9 text-center shadow-2xl backdrop-blur-md"
                  style={{ backgroundColor: surface }}
                >
                  <div className="absolute top-0 inset-x-0 mx-auto h-3 w-16 rounded-b-xl bg-black/40 border-b border-x border-[var(--party-accent)]/30" />

                  <div className="pt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--party-accent)]/30 bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--party-accent)]">
                    <Sparkles size={11} />
                    <span>{partyInvitationT(effectiveLocale, 'digitalPass')}</span>
                  </div>

                  <h3 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-[var(--party-primary)]">
                    {partyInvitationT(effectiveLocale, 'passTitle')}
                  </h3>

                  <p className="mx-auto mt-1 max-w-xs text-xs sm:text-sm opacity-75">
                    {partyInvitationT(effectiveLocale, 'passBody')}
                  </p>

                  <div className="mx-auto mt-6 w-fit">
                    <QRPassMark label={partyInvitationT(effectiveLocale, 'digitalPass')} />
                  </div>

                  <div className="mt-5 rounded-2xl border border-[var(--party-accent)]/25 bg-black/20 p-4 max-w-xs mx-auto text-xs">
                    <p className="font-mono font-bold tracking-widest text-[var(--party-accent)] text-sm">
                      {passId} &bull; {token}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[var(--party-primary)]">
                      {guestName}
                    </p>
                    <p className="mt-0.5 text-[11px] opacity-70">
                      {event.title} &bull; {totalGuestCount} {partyInvitationT(effectiveLocale, 'guest')}
                    </p>
                    <div className="mt-3 pt-2.5 border-t border-[var(--party-accent)]/20 flex items-center justify-between text-[10px] text-[var(--party-accent)]">
                      <span className="font-semibold uppercase tracking-wider">
                        {partyInvitationT(effectiveLocale, 'confirmedPass')}
                      </span>
                      <span className="flex items-center gap-1 font-bold">
                        <Check size={11} strokeWidth={3} /> VIP ENTRY
                      </span>
                    </div>
                  </div>

                  {/* Optional Footer Seal Logo */}
                  {event.logoUrl && (logoPlacement === 'hero-seal' || logoPlacement === 'both-footer') && (
                    <div className="mt-6 pt-4 border-t border-[var(--party-accent)]/20 flex justify-center">
                      {renderLogo('max-h-8 opacity-80')}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Footer Note */}
        <footer className="mt-16 text-center opacity-60">
          <div className="mx-auto mb-4 h-px w-20 bg-[var(--party-accent)]/40" />
          <p className="font-display text-sm sm:text-base italic">
            {partyInvitationT(effectiveLocale, 'madeFor')}
          </p>
          {event.logoUrl && (logoPlacement === 'hero-seal' || logoPlacement === 'both-footer') && (
            <div className="mt-4 flex justify-center">{renderLogo('max-h-7 opacity-70')}</div>
          )}
        </footer>
        </div>
      </main>
    </div>
  );
}

/**
 * Renders individual modular blocks including the 4 Custom Smart Section layouts:
 * 1. Editorial Card (default / text)
 * 2. Feature / Bullet Grid
 * 3. Image Spotlight
 * 4. Stats / Speaker Card
 */
function RenderBlockItem({
  block,
  index,
  openFaq,
  setOpenFaq,
  song,
  setSong,
  meal,
  setMeal,
  invitationLocale,
  templateId,
  eventVenue,
  eventHost,
}: {
  block: StudioBlock;
  index: number;
  openFaq: number | null;
  setOpenFaq: (idx: number | null) => void;
  song: string;
  setSong: (s: string) => void;
  meal: string;
  setMeal: (m: string) => void;
  invitationLocale: InvitationLocale;
  templateId: string;
  eventVenue?: string;
  eventHost?: string;
}) {
  const c = block.content;
  const isArabic = invitationLocale === 'ar';

  if (block.key === 'divider') {
    return <hr data-testid="party-block-divider" className="my-8 border-[var(--party-accent)]/30" />;
  }

  if (block.key === 'spacer') {
    return <div data-testid="party-block-spacer" className="h-10 sm:h-14" aria-hidden="true" />;
  }

  return (
    <article className="party-block-card relative overflow-hidden rounded-2xl border-t border-[var(--party-accent)]/20 bg-[var(--party-surface)] p-5 sm:p-7 shadow-xs backdrop-blur-xs transition">
      {/* Block Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--party-accent)]/50 bg-[var(--party-accent)]/15 text-[var(--party-accent)]">
          {block.key === 'catering' && <Utensils size={16} strokeWidth={1.75} />}
          {block.key === 'dress' && <Shirt size={16} strokeWidth={1.75} />}
          {block.key === 'schedule' && <CalendarDays size={16} strokeWidth={1.75} />}
          {block.key === 'registry' && <Gift size={16} strokeWidth={1.75} />}
          {block.key === 'song' && <Music2 size={16} strokeWidth={1.75} />}
          {block.key === 'faq' && <HelpCircle size={16} strokeWidth={1.75} />}
          {block.key === 'venue' && <MapPin size={16} strokeWidth={1.75} />}
          {block.key === 'host' && <User size={16} strokeWidth={1.75} />}
          {block.key === 'text' && <Sparkles size={16} strokeWidth={1.75} />}
          {block.key === 'cta' && <ExternalLink size={16} strokeWidth={1.75} />}
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--party-accent)]">
            <bdi>{block.eyebrow || block.label}</bdi>
          </p>
          <h3 className="font-display text-xl sm:text-2xl font-bold text-[var(--party-primary)]" dir="auto">
            <bdi>{c.heading}</bdi>
          </h3>
        </div>
      </div>

      {/* 1. CATERING / HOSPITALITY BLOCK */}
      {block.key === 'catering' && (
        <div>
          {c.mode === 'note' ? (
            /* Dignified Saudi Hospitality Note Mode */
            <div className="flex items-start gap-3 rounded-2xl bg-black/10 p-4 border border-[var(--party-accent)]/20">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--party-accent)]/20 text-[var(--party-accent)]">
                <Coffee size={16} />
              </div>
              <p className="text-sm leading-relaxed opacity-90" dir="auto">
                <bdi>
                  {c.note ||
                    (isArabic
                      ? 'نتشرف بضيافتكم الكريمة وتقديم القهوة السعودية الأصيلة ومأدبة العشاء الفاخرة.'
                      : 'We are honored to welcome you with authentic hospitality and a fine dining experience.')}
                </bdi>
              </p>
            </div>
          ) : (
            /* Selectable Menu / Dish Mode */
            <div>
              <p className="text-xs leading-6 opacity-75 mb-4" dir="auto">
                <bdi>{partyInvitationT(invitationLocale, 'choosePlate')}</bdi>
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(c.entree && c.entree.length > 0
                  ? c.entree
                  : isArabic
                  ? ['القهوة والضيافة', 'مأدبة العشاء', 'الحلويات والمشروبات']
                  : ['Rosemary chicken', 'Miso-glazed salmon', 'Garden ravioli']
                ).map((dish, dishIdx) => {
                  const swatchColor = c.swatches?.[dishIdx] || '#C28B55';
                  const isChosen = meal === dish;

                  return (
                    <button
                      key={dish}
                      type="button"
                      onClick={() => setMeal(dish)}
                      data-testid={`button-entree-${dish}`}
                      className={`focus-ring flex flex-col justify-between rounded-2xl border p-4 text-start transition min-h-24 ${
                        isChosen
                          ? 'border-[var(--party-accent)] bg-[var(--party-accent)]/20 shadow-xs'
                          : 'border-[var(--party-accent)]/30 bg-black/10 hover:bg-white/10'
                      }`}
                    >
                      <span
                        className="mb-3 block h-2 w-8 rounded-full"
                        style={{ backgroundColor: swatchColor }}
                      />
                      <span className="text-xs font-bold text-[var(--party-primary)]" dir="auto">
                        <bdi>{dish}</bdi>
                      </span>
                      {isChosen && (
                        <span className="mt-2 text-[9px] font-bold uppercase tracking-wider text-[var(--party-accent)] flex items-center gap-1">
                          <Check size={11} strokeWidth={3} /> {partyInvitationT(invitationLocale, 'selected')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. DRESS CODE BLOCK */}
      {block.key === 'dress' && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="max-w-md">
            {c.dressPreset && (
              <span className="mb-2 inline-block rounded-full bg-[var(--party-accent)]/20 border border-[var(--party-accent)]/40 px-3 py-0.5 text-[10px] font-bold text-[var(--party-accent)]">
                {c.dressPreset}
              </span>
            )}
            <p className="text-sm leading-relaxed opacity-85" dir="auto">
              <bdi>
                {c.note ||
                  (isArabic
                    ? 'نسعد بحضوركم بإطلالة أنيقة تناسب بهجة الأمسية.'
                    : 'Evening colors and celebratory attire are encouraged.')}
              </bdi>
            </p>
          </div>
          <div
            className="flex items-center -space-x-2"
            aria-label={partyInvitationT(invitationLocale, 'suggestedColors')}
          >
            {(c.swatches && c.swatches.length > 0
              ? c.swatches
              : ['#6D3F35', '#C48B63', '#34594B']
            ).map((color, i) => (
              <span
                key={i}
                className="h-8 w-8 rounded-full border-2 border-white/50 shadow-sm"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 3. SCHEDULE BLOCK (Vertical Gold-Spine Icon Timeline) */}
      {block.key === 'schedule' && (
        <div className="relative py-2">
          {/* Central Glowing Vertical Gold/Accent Spine */}
          <div
            className="absolute top-2 bottom-2 start-6 sm:start-7 w-[2px] bg-gradient-to-b from-transparent via-[var(--party-accent)]/65 to-transparent pointer-events-none"
            aria-hidden="true"
          />

          <div className="space-y-4 sm:space-y-5 relative">
            {(c.scheduleItems && c.scheduleItems.length > 0
              ? c.scheduleItems.map((item) => [item.time, item.title])
              : isArabic
              ? [
                  ['8:30 PM', 'الاستقبال والقهوة السعودية'],
                  ['9:30 PM', 'مراسم الحفل والترحيب'],
                  ['10:00 PM', 'مأدبة العشاء الفاخرة'],
                  ['11:00 PM', 'الاحتفاء والختام'],
                ]
              : [
                  ['18:00', partyInvitationT(invitationLocale, 'arrival')],
                  ['19:00', partyInvitationT(invitationLocale, 'ceremony')],
                  ['20:00', partyInvitationT(invitationLocale, 'dinner')],
                  ['21:30', partyInvitationT(invitationLocale, 'dancing')],
                ]
            ).map(([time, text], idx) => {
              const lower = text.toLowerCase();
              const isCoffee = /قهو|استقبال|welcome|coffee|reception/i.test(lower);
              const isSpeech = /كلم|خطاب|مراسم|keynote|speech|ceremony/i.test(lower);
              const isDinner = /عشاء|بوفيه|مأدب|طعام|dinner|suhoor|dining/i.test(lower);
              const isAward = /تكريم|جائز|احتفاء|award|honor|milestone/i.test(lower);

              return (
                <div
                  key={time + text + idx}
                  className="flex items-start gap-3.5 sm:gap-5 group"
                >
                  {/* Glowing Milestone Node with contextual icon */}
                  <div className="relative z-10 flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--party-accent)]/50 bg-[var(--party-surface)] text-[var(--party-accent)] shadow-md transition group-hover:scale-105 group-hover:border-[var(--party-accent)]">
                    {isCoffee && <Coffee size={18} strokeWidth={1.8} />}
                    {isSpeech && <Mic size={18} strokeWidth={1.8} />}
                    {isDinner && <Utensils size={18} strokeWidth={1.8} />}
                    {isAward && <Award size={18} strokeWidth={1.8} />}
                    {!isCoffee && !isSpeech && !isDinner && !isAward && (
                      <Clock size={18} strokeWidth={1.8} />
                    )}
                    {/* Glowing pulse ring */}
                    <span className="absolute -inset-1 rounded-2xl bg-[var(--party-accent)]/15 blur-xs -z-10 opacity-0 group-hover:opacity-100 transition" />
                  </div>

                  {/* Editorial Activity Card */}
                  <div className="flex-1 min-w-0 rounded-2xl border border-[var(--party-accent)]/25 bg-black/10 p-3.5 sm:p-4 text-start shadow-xs transition group-hover:bg-black/15">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className="font-mono text-xs font-bold tracking-wider text-[var(--party-accent)] uppercase"
                        dir="ltr"
                      >
                        {time}
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--party-accent)]/50" />
                    </div>
                    <h4 className="text-sm font-semibold opacity-95 text-[var(--party-primary)] leading-snug" dir="auto">
                      <bdi>{text}</bdi>
                    </h4>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. REGISTRY / HIGHLIGHTS BLOCK */}
      {block.key === 'registry' && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <p className="text-sm leading-relaxed opacity-85 max-w-md" dir="auto">
            <bdi>{c.note || partyInvitationT(invitationLocale, 'registryBody')}</bdi>
          </p>
          <button
            type="button"
            onClick={() => window.open(c.url || 'https://example.com', '_blank', 'noopener,noreferrer')}
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--party-accent)] bg-white/10 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--party-primary)] hover:bg-white/20 transition"
          >
            <ExternalLink size={14} />
            <span>{partyInvitationT(invitationLocale, 'viewRegistry')}</span>
          </button>
        </div>
      )}

      {/* 5. SONG / GUEST NOTE REQUEST BLOCK */}
      {block.key === 'song' && (
        <div>
          <p className="text-xs opacity-75 mb-4" dir="auto">
            <bdi>{partyInvitationT(invitationLocale, 'songHelp')}</bdi>
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={song}
              onChange={(e) => setSong(e.target.value)}
              placeholder={partyInvitationT(invitationLocale, 'songPlaceholder')}
              aria-label={partyInvitationT(invitationLocale, 'songPlaceholder')}
              dir="auto"
              className="focus-ring min-h-11 flex-1 rounded-full border border-[var(--party-accent)]/40 bg-black/15 px-4 text-xs outline-none placeholder:opacity-40"
            />
            <button
              type="button"
              onClick={() => setSong(song)}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--party-accent)] px-5 py-2 text-xs font-bold uppercase tracking-wider text-black shadow-xs hover:brightness-110 transition"
            >
              <Music2 size={14} />
              <span>{partyInvitationT(invitationLocale, 'saveSong')}</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. FAQ / ACCESS & GATES BLOCK */}
      {block.key === 'faq' && (
        <div className="divide-y divide-[var(--party-accent)]/20">
          {(c.questions && c.questions.length > 0
            ? c.questions
            : [
                {
                  q: isArabic ? 'هل تتوفر خدمة صف السيارات (Valet)؟' : 'Can I bring a plus one?',
                  a: isArabic
                    ? 'نعم، تتوفر خدمة صف السيارات عند البوابة الرئيسية للمكان.'
                    : 'Your invitation notes your guest allowance.',
                },
                {
                  q: isArabic ? 'كيف يتم الدخول للمناسبة؟' : 'Where should I park?',
                  a: isArabic
                    ? 'يرجى إبراز بطاقة الدخول الرقمية (QR) الخاصة بدعوتك عند الاستقبال.'
                    : 'Valet parking is available at the main entrance.',
                },
              ]
          ).map((item, qIdx) => (
            <div key={qIdx} className="py-3">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === qIdx ? null : qIdx)}
                className="focus-ring flex w-full items-center justify-between gap-3 text-start text-xs sm:text-sm font-semibold text-[var(--party-primary)]"
                aria-expanded={openFaq === qIdx}
              >
                <span dir="auto"><bdi>{item.q}</bdi></span>
                <ChevronDown
                  size={15}
                  className={`shrink-0 text-[var(--party-accent)] transition-transform ${
                    openFaq === qIdx ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <AnimatePresence initial={false}>
                {openFaq === qIdx && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden pt-2 text-xs leading-relaxed opacity-80"
                    dir="auto"
                  >
                    <bdi>{item.a}</bdi>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* 7. CUSTOM SMART SECTION ENGINE (text / custom blocks) */}
      {block.key === 'text' && (
        <div>
          {/* Custom Layout Style 1: Feature / Bullet Grid */}
          {c.customLayout === 'bullet-grid' && c.bullets && c.bullets.length > 0 && (
            <div className="space-y-2.5">
              {c.note && (
                <p className="text-xs sm:text-sm leading-relaxed opacity-85 mb-3" dir="auto">
                  <bdi>{c.note}</bdi>
                </p>
              )}
              {c.bullets.map((bullet, bIdx) => (
                <div
                  key={bIdx}
                  className="flex items-center gap-3 rounded-xl bg-black/10 border border-[var(--party-accent)]/20 px-3.5 py-2.5"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--party-accent)]/20 text-[var(--party-accent)] text-[10px] font-bold">
                    ✦
                  </span>
                  <span className="text-xs sm:text-sm font-medium opacity-90" dir="auto">
                    <bdi>{bullet}</bdi>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Custom Layout Style 2: Image + Text Spotlight */}
          {c.customLayout === 'image-spotlight' && (
            <div className="space-y-3">
              {c.imageUrl && (
                <div className="relative rounded-2xl overflow-hidden border border-[var(--party-accent)]/30 max-h-56">
                  <img src={c.imageUrl} alt={c.heading} className="w-full h-full object-cover" />
                  {c.badge && (
                    <span className="absolute top-3 start-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[10px] font-bold text-[var(--party-accent)] border border-[var(--party-accent)]/40 shadow-xs">
                      {c.badge}
                    </span>
                  )}
                </div>
              )}
              {c.badge && !c.imageUrl && (
                <span className="inline-block rounded-full bg-[var(--party-accent)]/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--party-accent)]">
                  {c.badge}
                </span>
              )}
              {c.note && (
                <p className="whitespace-pre-line text-xs sm:text-sm leading-relaxed opacity-85" dir="auto">
                  <bdi>{c.note}</bdi>
                </p>
              )}
              {c.bullets && c.bullets.length > 0 && (
                <div className="mt-3 space-y-2">
                  {c.bullets.map((bullet, bIdx) => (
                    <div key={bIdx} className="flex items-start gap-2.5 text-xs opacity-85">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--party-accent)]/20 text-[var(--party-accent)] text-[10px] font-bold">
                        ✦
                      </span>
                      <p className="leading-relaxed flex-1" dir="auto">
                        <bdi>{bullet}</bdi>
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--party-accent)] px-5 py-2 text-xs font-bold uppercase tracking-wider text-black hover:brightness-110 transition"
                >
                  <ExternalLink size={13} />
                  <span>{c.buttonLabel || (isArabic ? 'المزيد من التفاصيل' : 'Learn More')}</span>
                </a>
              )}
            </div>
          )}

          {/* Custom Layout Style 3: VIP / Speaker Card or Highlights */}
          {c.customLayout === 'stats-highlights' && (
            <div className="space-y-3">
              {(c.imageUrl || c.badge || c.note) && (
                <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl bg-black/10 border border-[var(--party-accent)]/25 p-4">
                  {c.imageUrl ? (
                    <img
                      src={c.imageUrl}
                      alt={c.heading}
                      className="h-20 w-20 rounded-full object-cover border-2 border-[var(--party-accent)]/50 shrink-0 shadow-md"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-[var(--party-accent)]/20 border border-[var(--party-accent)]/40 flex items-center justify-center text-[var(--party-accent)] shrink-0">
                      <Award size={24} />
                    </div>
                  )}
                  <div className="text-center sm:text-start flex-1 min-w-0">
                    {c.badge && (
                      <span className="inline-block rounded-full bg-[var(--party-accent)]/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--party-accent)] mb-1">
                        {c.badge}
                      </span>
                    )}
                    <h4 className="font-display text-base font-bold text-[var(--party-primary)]" dir="auto">
                      <bdi>{c.heading}</bdi>
                    </h4>
                    {c.note && (
                      <p className="text-xs leading-relaxed opacity-80 mt-1" dir="auto">
                        <bdi>{c.note}</bdi>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {c.bullets && c.bullets.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {c.bullets.map((stat, sIdx) => (
                    <div
                      key={sIdx}
                      className="rounded-xl border border-[var(--party-accent)]/20 bg-black/10 p-3 text-center"
                    >
                      <p className="text-xs font-bold text-[var(--party-accent)]" dir="auto">
                        <bdi>{stat}</bdi>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Default Layout: Editorial Card */}
          {(!c.customLayout || c.customLayout === 'editorial-card') && (
            <div>
              {c.note && (
                <p className="whitespace-pre-line text-xs sm:text-sm leading-relaxed opacity-85" dir="auto">
                  <bdi>{c.note}</bdi>
                </p>
              )}
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--party-accent)] px-5 py-2 text-xs font-bold uppercase tracking-wider text-black hover:brightness-110 transition"
                >
                  <ExternalLink size={13} />
                  <span>{c.buttonLabel || (isArabic ? 'فتح الرابط' : 'Open Link')}</span>
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* 8. VENUE, HOST, CTA BLOCKS */}
      {['venue', 'host', 'cta'].includes(block.key) && (
        <div>
          {c.note && (
            <p className="whitespace-pre-line text-xs sm:text-sm leading-relaxed opacity-85" dir="auto">
              <bdi>{c.note}</bdi>
            </p>
          )}

          {!c.note && block.key === 'venue' && eventVenue && (
            <p className="text-xs sm:text-sm leading-relaxed opacity-85" dir="auto">
              <bdi>{eventVenue}</bdi>
            </p>
          )}

          {!c.note && block.key === 'host' && eventHost && (
            <p className="text-xs sm:text-sm leading-relaxed opacity-85" dir="auto">
              <bdi>{partyInvitationT(invitationLocale, 'hostsLabel')}: {eventHost}</bdi>
            </p>
          )}

          {block.key === 'cta' && (
            <a
              href={c.url || '#'}
              target={c.url ? '_blank' : undefined}
              rel={c.url ? 'noreferrer' : undefined}
              className="focus-ring mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--party-accent)] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-black shadow-xs hover:brightness-110 transition"
            >
              <ExternalLink size={14} />
              <span dir="auto"><bdi>{c.heading || (isArabic ? 'فتح الرابط' : 'Open link')}</bdi></span>
            </a>
          )}
        </div>
      )}
    </article>
  );
}
