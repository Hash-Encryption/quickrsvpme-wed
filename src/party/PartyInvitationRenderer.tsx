import { type CSSProperties, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit3,
  ExternalLink,
  Gift,
  Heart,
  HelpCircle,
  LockKeyhole,
  MapPin,
  Music2,
  PartyPopper,
  Shirt,
  Sparkles,
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
} from './model.ts';

export type RSVPStatus = 'pending' | 'accepted' | 'declined';
export type BlockKey =
  | 'catering'
  | 'dress'
  | 'schedule'
  | 'registry'
  | 'song'
  | 'faq'
  | 'text'
  | 'venue'
  | 'host'
  | 'cta'
  | 'divider'
  | 'spacer';

export type BlockContent = {
  heading: string;
  entree?: string[];
  swatches?: string[];
  questions?: { q: string; a: string }[];
  note?: string;
  url?: string;
};

export type StudioBlock = {
  id: string;
  key: BlockKey;
  enabled: boolean;
  label: string;
  eyebrow: string;
  content: BlockContent;
};

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
  onRsvp?: (status: RSVPStatus, count?: number) => void;
  onSongChange?: (song: string) => void;
  onMealChange?: (meal: string) => void;
  readOnly?: boolean;
  isEditMode?: boolean;
  selectedBlockId?: string | null;
  onSelectBlock?: (id: string) => void;
  onSelectSection?: (section: 'hero' | 'details' | 'wording' | 'design') => void;
};

function QRPassMark({ label }: { label: string }) {
  const cells = useMemo(
    () =>
      Array.from({ length: 81 }, (_, i) =>
        [0, 2, 6, 8, 18, 20, 24, 26, 54, 56, 60, 62].includes(i) ||
        (i * 7 + 3) % 5 < 2
      ),
    []
  );

  return (
    <div
      className="grid grid-cols-9 gap-[3px] rounded-xl bg-white p-4 shadow-sm"
      aria-label={label}
      data-testid="qr-pass"
    >
      {cells.map((filled, i) => (
        <span
          key={i}
          className={`aspect-square rounded-[1.5px] ${
            filled ? 'bg-[#0A1A14]' : 'bg-transparent'
          }`}
        />
      ))}
    </div>
  );
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
  onRsvp,
  onSongChange,
  onMealChange,
  readOnly = false,
  isEditMode = false,
  selectedBlockId,
  onSelectBlock,
  onSelectSection,
}: PartyInvitationRendererProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [localSong, setLocalSong] = useState(song);

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

  const visibleBlocks = blocks.filter((b) => b.enabled);
  const displayedRsvp = (isEditMode || preview) ? 'accepted' : rsvpStatus;
  const totalGuestCount = guestCount ?? Math.max(1, plusOnes + 1);
  const maxGuests = propMaxGuests ?? (1 + allowedCompanions);

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

  return (
    <div
      style={partyStyle}
      className={`party-invitation party-template--${event.templateId} party-layout--${event.layout} party-type--${event.typography} party-motion--${event.motion} min-h-[100dvh] overflow-x-hidden text-[var(--party-primary)] select-text relative transition-colors duration-300 ${preview ? 'party-invitation--preview' : ''}`}
      lang={invitationLocale}
      dir={localeDirection(invitationLocale)}
    >
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

      {/* Main Content Container */}
      <main className="relative z-10 mx-auto max-w-2xl px-5 sm:px-8 pt-8 pb-28">
        {/* HERO SECTION */}
        <section
          onClick={() => isEditMode && onSelectSection?.('hero')}
          className={`relative text-center pb-12 pt-6 transition-all duration-200 ${
            isEditMode
              ? 'cursor-pointer rounded-3xl p-4 hover:ring-2 hover:ring-[var(--party-accent)]/60 hover:bg-black/5'
              : ''
          }`}
          data-testid="section-hero"
        >
          {isEditMode && (
            <span className="absolute top-2 end-2 inline-flex items-center gap-1 rounded-full bg-[var(--party-accent)]/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black shadow-xs">
              <Edit3 size={10} /> {partyInvitationT(invitationLocale, 'edit')}
            </span>
          )}

          {/* Badge Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--party-accent)]/40 bg-[var(--party-surface)]/80 px-4 py-1.5 backdrop-blur-xs shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--party-accent)]" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.18em] text-[var(--party-accent)]">
              {badgeText}
            </span>
          </div>

          {/* Template Motif Header */}
          {isBirthday && (
            <div className="mt-5 mb-2 flex items-center justify-center">
              <span className="font-display text-2xl sm:text-3xl italic tracking-wide text-[var(--party-accent)] opacity-90">
                Happy Birthday
              </span>
            </div>
          )}

          {isBabyShower && (
            <div className="mt-5 mb-2 flex items-center justify-center gap-2 text-[var(--party-accent)]">
              <Heart size={16} strokeWidth={1.5} />
              <span className="font-display text-xl sm:text-2xl italic">
                Welcome Little One
              </span>
              <Heart size={16} strokeWidth={1.5} />
            </div>
          )}

          {isCorporate && (
            <div className="mt-6 mb-2 flex items-center justify-center">
              <span className="h-px w-12 bg-[var(--party-accent)]/60" />
              <span className="mx-3 text-[10px] uppercase font-bold tracking-[.25em] text-[var(--party-accent)]">
                SUMMIT &bull; GALA &bull; RECEPTION
              </span>
              <span className="h-px w-12 bg-[var(--party-accent)]/60" />
            </div>
          )}

          {/* Event Title */}
          <h1
            className={`party-title mt-4 break-words font-display text-4xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-tight text-[var(--party-primary)]`}
            data-testid="text-event-title"
          >
            <bdi>{event.title}</bdi>
          </h1>

          {/* Subtitle / Host if provided */}
          {event.subtitle && (
            <p className="mt-2 text-base sm:text-lg font-medium opacity-80 text-[var(--party-primary)]">
              <bdi>{event.subtitle}</bdi>
            </p>
          )}

          {event.hostName && (
            <p className="mt-1 text-xs uppercase tracking-[.15em] text-[var(--party-accent)] font-semibold">
              <span>{partyInvitationT(invitationLocale, 'hostsLabel')}: </span>
              <bdi className="font-bold">{event.hostName}</bdi>
            </p>
          )}

          {/* Invitation Wording */}
          <p className="mx-auto mt-5 max-w-lg break-words text-sm sm:text-base leading-relaxed opacity-85 text-[var(--party-primary)]">
            <bdi>{event.invitationWording}</bdi>
          </p>

          {/* Date & Time / Venue Badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {event.date && (
              <div className="flex items-center gap-2 rounded-full border border-[var(--party-accent)]/40 bg-[var(--party-surface)]/75 px-4 py-2 text-xs font-semibold backdrop-blur-xs shadow-xs">
                <CalendarDays size={15} className="text-[var(--party-accent)]" />
                <time dateTime={event.date}>
                  {formatPartyDate(event.date, invitationLocale)}
                </time>
              </div>
            )}

            {event.startTime && (
              <div className="flex items-center gap-2 rounded-full border border-[var(--party-accent)]/40 bg-[var(--party-surface)]/75 px-4 py-2 text-xs font-semibold backdrop-blur-xs shadow-xs">
                <Clock size={15} className="text-[var(--party-accent)]" />
                <time dateTime={event.startTime} dir="ltr">
                  {event.startTime}
                </time>
              </div>
            )}

            {event.venue && (
              <div className="flex items-center gap-2 rounded-full border border-[var(--party-accent)]/40 bg-[var(--party-surface)]/75 px-4 py-2 text-xs font-semibold backdrop-blur-xs shadow-xs">
                <MapPin size={15} className="text-[var(--party-accent)]" />
                <bdi>
                  {event.venue}
                  {event.city ? ` · ${event.city}` : ''}
                </bdi>
              </div>
            )}
          </div>
        </section>

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

                {/* INVITATION BLOCKS */}
                <div className="space-y-6">
                  {visibleBlocks.map((block, index) => {
                    const isSelected = isEditMode && selectedBlockId === block.id;

                    return (
                      <div
                        key={block.id}
                        id={`party-block-${block.id}`}
                        onClick={() => isEditMode && onSelectBlock?.(block.id)}
                        className={`relative transition-all duration-200 ${
                          isEditMode
                            ? 'cursor-pointer hover:ring-2 hover:ring-[var(--party-accent)]/60'
                            : ''
                        } ${
                          isSelected
                            ? 'ring-2 ring-[var(--party-accent)] ring-offset-2 ring-offset-black/10 rounded-3xl'
                            : ''
                        }`}
                      >
                        {isEditMode && (
                          <div className="absolute top-3 end-3 z-10">
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--party-accent)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black shadow-xs">
                              <Edit3 size={10} /> {partyInvitationT(invitationLocale, 'edit')}
                            </span>
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
                        />
                      </div>
                    );
                  })}
                </div>

                {/* DIGITAL ADMISSION PASS (As seen in Reference 1 & 3) */}
                <div className="party-card rounded-3xl border border-[var(--party-accent)]/50 bg-[var(--party-surface)]/95 p-7 sm:p-10 text-center shadow-xl backdrop-blur-md">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[var(--party-accent)]/30 bg-black/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--party-accent)]">
                    <Sparkles size={12} />
                    <span>{partyInvitationT(invitationLocale, 'digitalPass')}</span>
                  </div>

                  <h3 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-[var(--party-primary)]">
                    {partyInvitationT(invitationLocale, 'passTitle')}
                  </h3>

                  <p className="mx-auto mt-2 max-w-xs text-xs sm:text-sm opacity-75">
                    {partyInvitationT(invitationLocale, 'passBody')}
                  </p>

                  <div className="mx-auto mt-6 w-fit">
                    <QRPassMark label={partyInvitationT(invitationLocale, 'digitalPass')} />
                  </div>

                  <div className="mt-5 rounded-2xl border border-[var(--party-accent)]/20 bg-black/10 p-3 max-w-xs mx-auto text-xs">
                    <p className="font-mono font-bold tracking-wider text-[var(--party-accent)]">
                      {passId} &bull; {token}
                    </p>
                    <p className="mt-1 text-[11px] opacity-70">
                      {event.title} &bull; {totalGuestCount} {partyInvitationT(invitationLocale, 'guest')}
                    </p>
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
}) {
  const c = block.content;
  const isCorporate = templateId === 'corporate';
  const isCustom = templateId === 'custom';

  if (block.key === 'divider') {
    return <hr className="my-8 border-[var(--party-accent)]/30" />;
  }

  if (block.key === 'spacer') {
    return <div className="h-10 sm:h-14" aria-hidden="true" />;
  }

  return (
    <article
      className={`party-card relative overflow-hidden rounded-3xl border border-[var(--party-accent)]/40 bg-[var(--party-surface)]/90 p-6 sm:p-8 shadow-sm backdrop-blur-md transition ${
        isCustom ? 'border-[var(--party-accent)]/30 bg-black/20' : ''
      }`}
    >
      {/* Block Header */}
      <div className="mb-6 flex items-center gap-3">
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

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--party-accent)]">
            {block.eyebrow || block.label}
          </p>
          <h3 className="font-display text-xl sm:text-2xl font-bold text-[var(--party-primary)]">
            {c.heading}
          </h3>
        </div>

        <span className="ms-auto font-mono text-[10px] opacity-40">
          0{index + 1}
        </span>
      </div>

      {/* CATERING / MENU BLOCK */}
      {block.key === 'catering' && (
        <div>
          <p className="text-xs leading-6 opacity-75 mb-5">
            {partyInvitationT(invitationLocale, 'choosePlate')}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(c.entree && c.entree.length > 0
              ? c.entree
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
                  <span className="text-xs font-bold text-[var(--party-primary)]">
                    {dish}
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

      {/* DRESS CODE BLOCK */}
      {block.key === 'dress' && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <p className="text-sm leading-relaxed opacity-85 max-w-md">
            {c.note || 'Evening colors and celebratory attire are encouraged.'}
          </p>
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
                className="h-9 w-9 rounded-full border-2 border-white/50 shadow-sm"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      )}

      {/* SCHEDULE BLOCK */}
      {block.key === 'schedule' && (
        <div className="space-y-0">
          {[
            ['18:00', 'arrival'],
            ['19:00', 'ceremony'],
            ['20:00', 'dinner'],
            ['21:30', 'dancing'],
          ].map(([time, key]) => (
            <div
              key={time}
              className="flex items-center gap-4 border-s-2 border-[var(--party-accent)]/40 py-3 ps-4 relative"
            >
              <span className="absolute -start-[5px] top-4.5 h-2 w-2 rounded-full bg-[var(--party-accent)]" />
              <span className="font-mono text-xs font-bold text-[var(--party-accent)] w-16 shrink-0" dir="ltr">
                {time}
              </span>
              <span className="text-sm font-semibold opacity-90">
                {partyInvitationT(invitationLocale, key as PartyInvitationKey)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* REGISTRY BLOCK */}
      {block.key === 'registry' && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <p className="text-sm leading-relaxed opacity-85 max-w-md">
            {c.note || partyInvitationT(invitationLocale, 'registryBody')}
          </p>
          <button
            type="button"
            onClick={() => window.open(c.url || 'https://example.com', '_blank', 'noopener,noreferrer')}
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--party-accent)] bg-white/10 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--party-primary)] hover:bg-white/20"
          >
            <ExternalLink size={14} />
            <span>{partyInvitationT(invitationLocale, 'viewRegistry')}</span>
          </button>
        </div>
      )}

      {/* SONG REQUEST BLOCK */}
      {block.key === 'song' && (
        <div>
          <p className="text-xs opacity-75 mb-4">
            {partyInvitationT(invitationLocale, 'songHelp')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={song}
              onChange={(e) => setSong(e.target.value)}
              placeholder={partyInvitationT(invitationLocale, 'songPlaceholder')}
              aria-label={partyInvitationT(invitationLocale, 'songPlaceholder')}
              className="focus-ring min-h-11 flex-1 rounded-full border border-[var(--party-accent)]/40 bg-black/15 px-4 text-xs outline-none placeholder:opacity-40"
            />
            <button
              type="button"
              onClick={() => setSong(song)}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--party-accent)] px-5 py-2 text-xs font-bold uppercase tracking-wider text-black shadow-xs hover:brightness-110"
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
                  q: 'Can I bring a plus one?',
                  a: 'Your invitation notes your guest allowance.',
                },
                {
                  q: 'Where should I park?',
                  a: 'Valet parking is available at the main entrance.',
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
                <span>{item.q}</span>
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
                    className="overflow-hidden pt-2 text-xs leading-relaxed opacity-75"
                  >
                    {item.a}
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
            <p className="whitespace-pre-line text-xs sm:text-sm leading-relaxed opacity-80">
              {c.note}
            </p>
          )}

          {block.key === 'cta' && c.url && (
            <a
              href={c.url}
              target="_blank"
              rel="noreferrer"
              className="focus-ring mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--party-accent)] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-black shadow-xs hover:brightness-110"
            >
              <ExternalLink size={14} />
              <span>{c.heading || 'Open link'}</span>
            </a>
          )}
        </div>
      )}
    </article>
  );
}
