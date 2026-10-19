import { type CSSProperties, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Gift,
  Heart,
  HelpCircle,
  LockKeyhole,
  MapPin,
  Music2,
  PartyPopper,
  QrCode,
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
  partyStyles,
  resolvePartyStyleId,
  type PartyEventData,
  type BlockKey,
  type BlockContent,
  type StudioBlock,
} from './model.ts';
import { formatFullHijriDate } from '../utils/saudiCalendar.ts';

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
  invitationLocale: InvitationLocale;
  uiLocale?: 'en' | 'ar';
  onRsvp?: (status: RSVPStatus, count?: number) => void;
  onSongChange?: (song: string) => void;
  onMealChange?: (meal: string) => void;
  readOnly?: boolean;
  isEditMode?: boolean;
  selectedBlockId?: string | null;
  onSelectBlock?: (id: string) => void;
  onSelectSection?: (section: 'hero' | 'details' | 'wording' | 'design') => void;
  onMoveBlock?: (index: number, direction: -1 | 1) => void;
  onToggleBlock?: (id: string) => void;
  onDeleteBlock?: (id: string) => void;
  onDuplicateBlock?: (id: string) => void;
  onChangeTitleScale?: (scale: 'sm' | 'md' | 'lg' | 'xl') => void;
};

/**
 * High-density luxury SVG QR Code with finder patterns for Apple Wallet & VIP Gate Pass
 */
export function QRPassMark({ label }: { label: string }) {
  // Deterministic 11x11 pattern with authentic 3x3 finder patterns in top-left, top-right, bottom-left
  const matrix = useMemo(() => {
    const size = 11;
    const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    // Helper to paint finder pattern
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

    // Decorative timing patterns
    for (let i = 3; i < 8; i++) {
      grid[1][i] = i % 2 === 0;
      grid[i][1] = i % 2 === 0;
      grid[i][9] = i % 2 === 1;
      grid[9][i] = i % 2 === 1;
    }

    // Dynamic data bits
    for (let r = 3; r < 8; r++) {
      for (let c = 3; c < 8; c++) {
        grid[r][c] = (r * 7 + c * 13 + 5) % 3 < 2;
      }
    }

    // Pass ID corner bits
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
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="h-6 w-6 rounded-md bg-white/95 border border-[var(--party-accent)]/80 flex items-center justify-center shadow-xs">
          <Sparkles size={11} className="text-[#C28B55]" />
        </div>
      </div>
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
}: PartyInvitationRendererProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [localSong, setLocalSong] = useState(song);
  const [heroSelected, setHeroSelected] = useState(false);

  const isArabic = invitationLocale === 'ar';
  const styleKey = resolvePartyStyleId(event.templateId, event.styleId);
  const style = partyStyles[styleKey] ?? partyStyles['luxury-emerald'];

  const bg = event.backgroundColor || style.backgroundColor;
  const primary = event.primaryColor || style.primaryColor;
  const accent = event.accentColor || style.accentColor;
  const surface = style.surfaceColor;

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
    ? partyInvitationT(invitationLocale, 'corporateBadge')
    : isBirthday
    ? partyInvitationT(invitationLocale, 'birthdayBadge')
    : isBabyShower
    ? partyInvitationT(invitationLocale, 'babyShowerBadge')
    : partyInvitationT(invitationLocale, 'customBadge');

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

  const handleHeroClick = () => {
    if (!isEditMode) return;
    setHeroSelected(true);
    onSelectSection?.('hero');
  };

  return (
    <div
      style={partyStyle}
      className={`party-invitation party-template--${event.templateId} party-layout--${event.layout} party-type--${event.typography} party-motion--${event.motion} min-h-[100dvh] overflow-x-hidden text-[var(--party-primary)] select-text relative transition-colors duration-300 ${preview ? 'party-invitation--preview' : ''}`}
      lang={invitationLocale}
      dir={localeDirection(invitationLocale)}
    >
      {/* Background Custom Image with Contrast Dimmer */}
      {event.backgroundImageUrl && (
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center transition-opacity"
          style={{
            backgroundImage: `url(${event.backgroundImageUrl})`,
            backgroundSize: event.backgroundFitMode || 'cover',
          }}
        >
          <div
            className="absolute inset-0 bg-black"
            style={{ opacity: event.backgroundOverlayOpacity ?? 0.45 }}
          />
        </div>
      )}

      {/* Background Decorative Layer */}
      {event.decorations && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
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
      <main className="relative z-10 mx-auto max-w-2xl px-5 sm:px-8 pt-8 pb-28">
        {/* HERO SECTION */}
        <section
          onClick={handleHeroClick}
          className={`relative text-center pb-10 pt-6 transition-all duration-200 ${
            isEditMode
              ? 'cursor-pointer rounded-3xl p-4 hover:ring-1 hover:ring-[var(--party-accent)]/50'
              : ''
          } ${
            isEditMode && heroSelected && !selectedBlockId
              ? 'ring-1 ring-[var(--party-accent)] shadow-xl bg-black/10 rounded-3xl'
              : ''
          } ${
            isCustom
              ? 'border border-[var(--party-accent)]/30 rounded-[28px] p-6 sm:p-8 backdrop-blur-xs shadow-sm bg-black/10'
              : isBabyShower
              ? 'border border-[var(--party-accent)]/30 rounded-t-[110px] rounded-b-[28px] p-8 backdrop-blur-xs bg-black/5'
              : ''
          }`}
          data-testid="section-hero"
        >
          {/* On-Canvas Floating Action Pill Bar for Hero */}
          {isEditMode && heroSelected && !selectedBlockId && (
            <div
              className="absolute -top-4 inset-x-0 mx-auto z-30 flex items-center justify-center gap-1.5 p-1 rounded-full bg-[#18201C]/95 text-white border border-[var(--party-accent)]/60 shadow-2xl backdrop-blur-md w-fit max-w-[95%]"
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

          {/* Logo Showcase */}
          {event.logoUrl && (
            <div className="mb-5 flex justify-center">
              <img
                src={event.logoUrl}
                alt="Brand Logo"
                className={`transition-all shadow-sm ${logoSizeClass} ${logoShapeClass}`}
              />
            </div>
          )}

          {/* Badge Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--party-accent)]/40 bg-[var(--party-surface)]/80 px-4 py-1.5 backdrop-blur-xs shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--party-accent)]" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.18em] text-[var(--party-accent)]">
              <bdi>{badgeText}</bdi>
            </span>
          </div>

          {/* Host Name */}
          {event.hostName && (
            <p className="mt-4 text-xs sm:text-sm font-semibold tracking-wider uppercase opacity-75">
              <bdi>{event.hostName}</bdi>
            </p>
          )}

          {/* Event Title */}
          <h1
            className={`mt-4 font-display font-bold leading-[1.08] text-[var(--party-primary)] break-words ${titleScaleClass}`}
            dir="auto"
          >
            <bdi>{event.title}</bdi>
          </h1>

          {/* Cultural Saudi Divider for Custom/Majlis */}
          {isCustom && (
            <div className="my-4 flex items-center justify-center gap-2 text-[var(--party-accent)]/60 text-xs select-none">
              <span className="h-px w-12 bg-current" />
              <span>✦</span>
              <span className="h-px w-12 bg-current" />
            </div>
          )}

          {/* Subtitle */}
          {event.subtitle && (
            <p className="mt-2 text-sm sm:text-base font-medium opacity-85" dir="auto">
              <bdi>{event.subtitle}</bdi>
            </p>
          )}

          {/* Invitation Wording */}
          <p
            className="mx-auto mt-5 max-w-lg break-words text-sm sm:text-base leading-relaxed opacity-90 text-[var(--party-primary)]"
            dir="auto"
          >
            <bdi>{event.invitationWording}</bdi>
          </p>

          {/* 4 Distinct Architectural Date / Venue Showcase */}
          {isCorporate ? (
            /* Corporate: Structured 2-column Date/Hijri & Venue/Maps glass bar */
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
              <div className="rounded-2xl border border-[var(--party-accent)]/30 bg-[var(--party-surface)]/80 p-3.5 backdrop-blur-xs text-start">
                <div className="flex items-center gap-2 text-[var(--party-accent)] text-xs font-bold uppercase tracking-wider mb-1">
                  <CalendarDays size={14} />
                  <span>{formatPartyDate(event.date, invitationLocale)}</span>
                </div>
                {event.showHijriDate && event.date && (
                  <p className="text-[11px] opacity-80 font-medium">
                    {formatFullHijriDate(event.date, isArabic ? 'ar' : 'en')}
                  </p>
                )}
                {(event.timeLabel || event.startTime) && (
                  <p className="text-[11px] opacity-85 mt-1 flex items-center gap-1.5 font-mono" dir="ltr">
                    <Clock size={12} className="text-[var(--party-accent)]" />
                    <span>{event.timeLabel || event.startTime}</span>
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--party-accent)]/30 bg-[var(--party-surface)]/80 p-3.5 backdrop-blur-xs text-start flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[var(--party-accent)] text-xs font-bold mb-1">
                    <MapPin size={14} />
                    <bdi>{event.venue || (isArabic ? 'الموقع سيحدد لاحقاً' : 'Venue TBA')}</bdi>
                  </div>
                  {event.city && <p className="text-[11px] opacity-80">{event.city}</p>}
                </div>
                {event.mapUrl && (
                  <a
                    href={event.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--party-accent)] hover:underline"
                  >
                    <span>{isArabic ? 'فتح في خرائط Google' : 'Open in Maps'}</span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
          ) : (
            /* Standard / Ambient floating badges */
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
              {event.date && (
                <div className="flex items-center gap-2 rounded-full border border-[var(--party-accent)]/40 bg-[var(--party-surface)]/75 px-4 py-2 text-xs font-semibold backdrop-blur-xs shadow-xs">
                  <CalendarDays size={14} className="text-[var(--party-accent)]" />
                  <time dateTime={event.date}>
                    {formatPartyDate(event.date, invitationLocale)}
                  </time>
                  {event.showHijriDate && (
                    <span className="opacity-75 text-[11px] font-normal ps-1">
                      &bull; {formatFullHijriDate(event.date, isArabic ? 'ar' : 'en')}
                    </span>
                  )}
                </div>
              )}

              {(event.timeLabel || event.startTime) && (
                <div className="flex items-center gap-2 rounded-full border border-[var(--party-accent)]/40 bg-[var(--party-surface)]/75 px-4 py-2 text-xs font-semibold backdrop-blur-xs shadow-xs">
                  <Clock size={14} className="text-[var(--party-accent)]" />
                  <span dir="ltr">{event.timeLabel || event.startTime}</span>
                </div>
              )}

              {event.venue && (
                <div className="flex items-center gap-2 rounded-full border border-[var(--party-accent)]/40 bg-[var(--party-surface)]/75 px-4 py-2 text-xs font-semibold backdrop-blur-xs shadow-xs">
                  <MapPin size={14} className="text-[var(--party-accent)]" />
                  <bdi>
                    {event.venue}
                    {event.city ? ` · ${event.city}` : ''}
                  </bdi>
                  {event.mapUrl && (
                    <a
                      href={event.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--party-accent)] hover:opacity-75 ms-1"
                      aria-label="Google Maps"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* INVITATION MODULAR BLOCKS — Seamless Continuous Flow (Zero Box-Inside-Box Clutter) */}
        {visibleBlocks.length > 0 && (
          <section className="my-8 space-y-6" data-testid="section-blocks">
            {visibleBlocks.map((block, index) => {
              const isSelected = isEditMode && selectedBlockId === block.id;

              return (
                <div
                  key={block.id}
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
                    invitationLocale={invitationLocale}
                    templateId={event.templateId}
                    eventVenue={[event.venue, event.city].filter(Boolean).join(' · ')}
                    eventHost={event.hostName}
                  />
                </div>
              );
            })}
          </section>
        )}

        {/* ETIQUETTE & ACCESS BADGES */}
        {event.etiquetteBadges && event.etiquetteBadges.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 my-8">
            {event.etiquetteBadges.map((badge, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--party-accent)]/30 bg-black/20 px-3 py-1 text-[11px] font-semibold text-[var(--party-accent)] backdrop-blur-xs"
              >
                <Sparkles size={11} className="text-[var(--party-accent)]" />
                <bdi>{badge}</bdi>
              </span>
            ))}
          </div>
        )}

        {/* RSVP INTERACTION SECTION */}
        <section className="mt-4 mb-12" data-testid="section-rsvp">
          <AnimatePresence mode="wait">
            {displayedRsvp === 'pending' && !readOnly && (
              <motion.div
                key="rsvp-pending"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="party-card rounded-3xl border border-[var(--party-accent)]/40 bg-[var(--party-surface)]/90 p-6 sm:p-10 text-center shadow-lg backdrop-blur-md"
              >
                <p className="text-[10px] uppercase tracking-[.18em] text-[var(--party-accent)] font-bold">
                  {partyInvitationT(invitationLocale, 'privateFor')} {guestName}
                </p>

                <h2 className="mt-3 font-display text-3xl sm:text-4xl text-[var(--party-primary)]">
                  {invitationT(invitationLocale, 'rsvpTitle')}
                </h2>

                {event.rsvpDeadline && (
                  <p className="mx-auto mt-2 max-w-sm text-xs sm:text-sm leading-6 opacity-75">
                    {partyInvitationT(invitationLocale, 'replyBy')}{' '}
                    <time dateTime={event.rsvpDeadline} className="font-semibold underline underline-offset-2">
                      {formatPartyDate(event.rsvpDeadline, invitationLocale)}
                    </time>
                  </p>
                )}

                {/* Companions Counter */}
                <div className="mx-auto mt-6 flex max-w-xs items-center justify-between rounded-2xl border border-[var(--party-accent)]/40 bg-white/10 p-3">
                  <span className="text-start text-xs font-semibold">
                    {invitationT(invitationLocale, 'guestCount')}
                    <small className="mt-0.5 block text-[10px] opacity-65 font-normal">
                      {invitationT(invitationLocale, 'allowed')}: {maxGuests}
                    </small>
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-[var(--party-accent)]/50 text-base font-bold transition hover:bg-[var(--party-accent)]/20 disabled:opacity-30"
                      onClick={() => onRsvp?.('pending', totalGuestCount - 1)}
                      disabled={totalGuestCount <= 1}
                      aria-label={invitationT(invitationLocale, 'decreaseGuests')}
                    >
                      &minus;
                    </button>
                    <b className="font-mono text-base">{totalGuestCount}</b>
                    <button
                      type="button"
                      className="focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-[var(--party-accent)]/50 text-base font-bold transition hover:bg-[var(--party-accent)]/20 disabled:opacity-30"
                      onClick={() => onRsvp?.('pending', totalGuestCount + 1)}
                      disabled={totalGuestCount >= maxGuests}
                      aria-label={invitationT(invitationLocale, 'increaseGuests')}
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
                    <span>{invitationT(invitationLocale, 'attending')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRsvp?.('declined')}
                    className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--party-accent)]/40 bg-transparent px-6 py-3 text-xs font-semibold text-[var(--party-primary)] transition hover:bg-white/10 active:scale-98"
                  >
                    <X size={15} />
                    <span>{invitationT(invitationLocale, 'declining')}</span>
                  </button>
                </div>

                <div className="mt-6 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[.12em] opacity-60">
                  <LockKeyhole size={12} />
                  <span>{partyInvitationT(invitationLocale, 'noAccount')}</span>
                </div>
              </motion.div>
            )}

            {displayedRsvp === 'declined' && (
              <motion.div
                key="rsvp-declined"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="party-card rounded-3xl border border-[var(--party-accent)]/40 bg-[var(--party-surface)]/90 p-8 text-center shadow-lg"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--party-accent)] text-[var(--party-accent)]">
                  <Heart size={22} strokeWidth={1.5} />
                </div>
                <h2 className="mt-5 font-display text-3xl text-[var(--party-primary)]">
                  {partyInvitationT(invitationLocale, 'missedTitle')}
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm opacity-75">
                  {partyInvitationT(invitationLocale, 'missedBody')}
                </p>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onRsvp?.('pending')}
                    data-testid="button-change-rsvp"
                    className="focus-ring mt-6 inline-flex min-h-11 items-center gap-1.5 text-xs font-bold uppercase tracking-[.15em] text-[var(--party-accent)] underline underline-offset-4"
                  >
                    {partyInvitationT(invitationLocale, 'changeResponse')}
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
                <div className="party-card rounded-3xl border border-[var(--party-accent)]/50 bg-[var(--party-surface)]/95 p-6 sm:p-8 shadow-md backdrop-blur-md">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-[.18em] text-[var(--party-accent)]">
                        {partyInvitationT(invitationLocale, 'onList')}
                      </p>
                      <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[var(--party-primary)]">
                        {partyInvitationT(invitationLocale, 'acceptedTitle')}
                      </h2>
                      <p className="mt-1 text-xs sm:text-sm opacity-75">
                        {partyInvitationT(invitationLocale, 'acceptedBody')}
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
                          {totalGuestCount} {partyInvitationT(invitationLocale, 'guest')} &bull;{' '}
                          {token}
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full bg-[var(--party-accent)]/15 border border-[var(--party-accent)]/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--party-accent)]">
                      {partyInvitationT(invitationLocale, 'confirmed')}
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
                        {partyInvitationT(invitationLocale, 'changeResponse')}
                      </button>
                    </div>
                  )}
                </div>

                {/* DIGITAL ADMISSION VIP PASS (Apple Wallet / Mazoom Style) */}
                <div className="party-pass-card relative overflow-hidden rounded-[28px] border border-[var(--party-accent)]/50 bg-[var(--party-surface)]/95 p-6 sm:p-9 text-center shadow-2xl backdrop-blur-md">
                  {/* Perforation notch at top */}
                  <div className="absolute top-0 inset-x-0 mx-auto h-3 w-16 rounded-b-xl bg-black/40 border-b border-x border-[var(--party-accent)]/30" />

                  <div className="pt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--party-accent)]/30 bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--party-accent)]">
                    <Sparkles size={11} />
                    <span>{partyInvitationT(invitationLocale, 'digitalPass')}</span>
                  </div>

                  <h3 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-[var(--party-primary)]">
                    {partyInvitationT(invitationLocale, 'passTitle')}
                  </h3>

                  <p className="mx-auto mt-1 max-w-xs text-xs sm:text-sm opacity-75">
                    {partyInvitationT(invitationLocale, 'passBody')}
                  </p>

                  <div className="mx-auto mt-6 w-fit">
                    <QRPassMark label={partyInvitationT(invitationLocale, 'digitalPass')} />
                  </div>

                  <div className="mt-5 rounded-2xl border border-[var(--party-accent)]/25 bg-black/20 p-4 max-w-xs mx-auto text-xs">
                    <p className="font-mono font-bold tracking-widest text-[var(--party-accent)] text-sm">
                      {passId} &bull; {token}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[var(--party-primary)]">
                      {guestName}
                    </p>
                    <p className="mt-0.5 text-[11px] opacity-70">
                      {event.title} &bull; {totalGuestCount} {partyInvitationT(invitationLocale, 'guest')}
                    </p>
                    <div className="mt-3 pt-2.5 border-t border-[var(--party-accent)]/20 flex items-center justify-between text-[10px] text-[var(--party-accent)]">
                      <span className="font-semibold uppercase tracking-wider">
                        {partyInvitationT(invitationLocale, 'confirmedPass')}
                      </span>
                      <span className="flex items-center gap-1 font-bold">
                        <Check size={11} strokeWidth={3} /> VIP ENTRY
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Footer Note */}
        <footer className="mt-16 text-center opacity-60">
          <div className="mx-auto mb-4 h-px w-20 bg-[var(--party-accent)]/40" />
          <p className="font-display text-sm sm:text-base italic">
            {partyInvitationT(invitationLocale, 'madeFor')}
          </p>
        </footer>
      </main>
    </div>
  );
}

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
  const isCorporate = templateId === 'corporate';
  const isCustom = templateId === 'custom';
  const isArabic = invitationLocale === 'ar';

  if (block.key === 'divider') {
    return <hr data-testid="party-block-divider" className="my-8 border-[var(--party-accent)]/30" />;
  }

  if (block.key === 'spacer') {
    return <div data-testid="party-block-spacer" className="h-10 sm:h-14" aria-hidden="true" />;
  }

  return (
    <article
      className="party-block-card relative overflow-hidden rounded-2xl border-t border-[var(--party-accent)]/20 bg-[var(--party-surface)]/75 p-5 sm:p-7 shadow-xs backdrop-blur-xs transition"
    >
      {/* Block Header (Zero 01 numbers, zero orange stamps!) */}
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

      {/* CATERING / MENU BLOCK */}
      {block.key === 'catering' && (
        <div>
          {c.mode === 'note' ? (
            /* Dignified Saudi Hospitality Note Mode (No radio buttons) */
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

      {/* DRESS CODE BLOCK */}
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

      {/* SCHEDULE BLOCK */}
      {block.key === 'schedule' && (
        <div className="space-y-0">
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
          ).map(([time, text]) => (
            <div
              key={time + text}
              className="flex items-center gap-4 border-s-2 border-[var(--party-accent)]/40 py-3 ps-4 relative"
            >
              <span className="absolute -start-[5px] top-4.5 h-2 w-2 rounded-full bg-[var(--party-accent)]" />
              <span className="font-mono text-xs font-bold text-[var(--party-accent)] w-20 shrink-0" dir="ltr">
                {time}
              </span>
              <span className="text-sm font-semibold opacity-90" dir="auto">
                <bdi>{text}</bdi>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* REGISTRY BLOCK */}
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

      {/* SONG REQUEST BLOCK */}
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

      {/* FAQ BLOCK */}
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

      {/* TEXT, VENUE, HOST, CTA */}
      {['text', 'venue', 'host', 'cta'].includes(block.key) && (
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
