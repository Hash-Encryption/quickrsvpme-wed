import { type ReactNode, type ComponentType, useContext, useEffect, useMemo, useState, createContext } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { AppLanguageControl, AppLocaleProvider, useAppLocale } from '@/i18n/app-locale';
import { localeDirection, type InvitationLocale } from '@/i18n/locale';
import { invitationT } from '@/i18n/invitation';
import { partyInvitationT, resolvePartyInvitationLocale, type PartyInvitationKey } from '@/i18n/party';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import {
  ArrowDown, ArrowDownToLine, ArrowLeft, ArrowUp, CalendarDays, Check, CheckCircle2, ChevronDown,
  Edit3, ExternalLink, GripVertical, Heart, HelpCircle,
  Link2, LockKeyhole, MessageCircle, Music2, PartyPopper, QrCode, Search, Shirt, Sparkles,
  Utensils, X, XCircle,
} from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { WeddingInvitationRenderer, WeddingStudio } from '@/wedding/WeddingMode';
import { WeddingWorkspaceProvider, useWeddingWorkspace } from '@/wedding/WeddingWorkspaceProvider';
import type { WeddingProject } from '@/wedding/workspace';
import { AdminPage } from '@/admin/AdminPage';
import { DashboardPage } from '@/app/DashboardPage';
import { EmptyProjectSection, ProjectOverview, ProjectShell } from '@/app/ProjectShell';
import {
  buildProjectRoute,
  legacyProjectRoute,
  partyProject,
  resolveProjectSection,
  type ProjectSummary,
  type ProjectType,
} from '@/app/projects';
import {
  defaultWeddingEvent,
  defaultWeddingGuest,
  getWhatsAppShareUrl,
  isValidGuestToken,
  resolveInvitationTitle,
  type EventMode,
  type WeddingGuestData,
  type WeddingRsvp,
} from '@/wedding/model';
import { defaultPartyEvent, formatPartyDate, mergePartyEvent, partyTemplates, type PartyEventData } from '@/party/model';

type RSVPStatus = 'pending' | 'accepted' | 'declined';
type BlockKey = 'catering' | 'dress' | 'schedule' | 'registry' | 'song' | 'faq';
type IconType = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

type BlockContent = {
  heading: string;
  entree?: string[];
  swatches?: string[];
  questions?: { q: string; a: string }[];
  note?: string;
};
type StudioBlock = { key: BlockKey; enabled: boolean; label: string; eyebrow: string; content: BlockContent };
type EngineState = {
  rsvp: RSVPStatus;
  plusOnes: number;
  song: string;
  meal: string;
  checkedIn: boolean;
  blocks: StudioBlock[];
  mode: EventMode;
  invitationLocale: InvitationLocale;
  partyEvent: PartyEventData;
  weddingGuest: WeddingGuestData;
  weddingResponse: { guestCount: number; message: string };
};

const initialBlocks: StudioBlock[] = [
  { key: 'catering', enabled: true, label: 'Catering', eyebrow: 'YOUR TABLE', content: { heading: 'A seat at our table', entree: ['Rosemary chicken', 'Miso-glazed salmon', 'Garden ravioli'], swatches: ['#6D3F35', '#C48B63', '#34594B'] } },
  { key: 'dress', enabled: true, label: 'Dress code', eyebrow: 'THE ATTIRE', content: { heading: 'Garden formal', note: 'A little polished, a little effortless. Suits, silk, and evening colors are encouraged.' } },
  { key: 'schedule', enabled: true, label: 'Schedule', eyebrow: 'THE EVENING', content: { heading: 'A day in full bloom' } },
  { key: 'registry', enabled: true, label: 'Registry', eyebrow: 'A LITTLE SOMETHING', content: { heading: 'Your presence is enough' } },
  { key: 'song', enabled: true, label: 'Song request', eyebrow: 'SET THE TONE', content: { heading: 'Bring a song to the dance floor' } },
  { key: 'faq', enabled: true, label: 'FAQ', eyebrow: 'GOOD TO KNOW', content: { heading: 'Before you join us', questions: [{ q: 'Can I bring a plus one?', a: 'Your invitation will note your guest count. For this invitation, we are looking forward to celebrating with you.' }, { q: 'Where should I park?', a: 'Valet parking will be available at the south entrance of The Grand Palace Hall from 5:00 PM.' }, { q: 'What time should I arrive?', a: 'Please arrive between 5:15 and 5:45 PM so we can welcome you before the ceremony.' }] } },
];

const defaultState: EngineState = {
  rsvp: 'pending', plusOnes: 0, song: '', meal: '', checkedIn: false, blocks: initialBlocks,
  mode: 'standard', invitationLocale: 'ar', partyEvent: defaultPartyEvent, weddingGuest: defaultWeddingGuest,
  weddingResponse: { guestCount: 1, message: '' },
};

type EngineContextValue = {
  state: EngineState;
  ready: boolean;
  setRsvp: (value: RSVPStatus) => void;
  setSong: (value: string) => void;
  setMeal: (value: string) => void;
  toggleBlock: (key: BlockKey) => void;
  reorderBlocks: (blocks: StudioBlock[]) => void;
  updateBlock: (key: BlockKey, patch: Partial<BlockContent>) => void;
  setCheckedIn: () => void;
  setMode: (mode: EventMode) => void;
  setInvitationLocale: (locale: InvitationLocale) => void;
  updatePartyEvent: (patch: Partial<PartyEventData>) => void;
  submitWeddingRsvp: (response: WeddingRsvp) => void;
};
const EngineContext = createContext<EngineContextValue | null>(null);

function EngineProvider({ children }: { children: ReactNode }) {
  const { preserveLegacyWedding } = useWeddingWorkspace();
  const [state, setState] = useState<EngineState>(defaultState);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raw = localStorage.getItem('luxury-rsvp-engine');
    if (raw) {
      try {
        const saved = JSON.parse(raw) as Partial<EngineState> & { weddingEvent?: unknown };
        const { weddingEvent: _legacyWedding, ...genericSaved } = saved;
        setState({
          ...defaultState,
          ...genericSaved,
          invitationLocale: resolvePartyInvitationLocale(saved),
          partyEvent: mergePartyEvent(saved.partyEvent as Partial<PartyEventData> | undefined),
          weddingGuest: { ...defaultWeddingGuest, ...saved.weddingGuest },
          weddingResponse: { ...defaultState.weddingResponse, ...saved.weddingResponse },
        });
      } catch { setState(defaultState); }
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        const existing = JSON.parse(localStorage.getItem('luxury-rsvp-engine') ?? '{}') as { weddingEvent?: unknown };
        const persisted = preserveLegacyWedding && existing.weddingEvent
          ? { ...state, weddingEvent: existing.weddingEvent }
          : state;
        localStorage.setItem('luxury-rsvp-engine', JSON.stringify(persisted));
      }
      catch { /* The bounded upload remains usable for this session if storage is unavailable. */ }
    }
  }, [state, ready, preserveLegacyWedding]);
  const value = useMemo(() => ({
    state, ready,
    setRsvp: (rsvp: RSVPStatus) => setState((s) => ({ ...s, rsvp })),
    setSong: (song: string) => setState((s) => ({ ...s, song })),
    setMeal: (meal: string) => setState((s) => ({ ...s, meal })),
    toggleBlock: (key: BlockKey) => setState((s) => ({ ...s, blocks: s.blocks.map((b) => b.key === key ? { ...b, enabled: !b.enabled } : b) })),
    reorderBlocks: (blocks: StudioBlock[]) => setState((s) => ({ ...s, blocks })),
    updateBlock: (key: BlockKey, patch: Partial<BlockContent>) => setState((s) => ({ ...s, blocks: s.blocks.map((b) => b.key === key ? { ...b, content: { ...b.content, ...patch } } : b) })),
    setCheckedIn: () => setState((s) => ({ ...s, checkedIn: true })),
    setMode: (mode: EventMode) => setState((s) => ({ ...s, mode })),
    setInvitationLocale: (invitationLocale: InvitationLocale) => setState((s) => ({ ...s, invitationLocale })),
    updatePartyEvent: (patch: Partial<PartyEventData>) => setState((s) => ({ ...s, partyEvent: mergePartyEvent({ ...s.partyEvent, ...patch }) })),
    submitWeddingRsvp: (response: WeddingRsvp) => setState((s) => ({
      ...s,
      rsvp: response.status,
      plusOnes: Math.max(0, response.guestCount - 1),
      weddingResponse: { guestCount: response.guestCount, message: response.message },
    })),
  }), [state, ready]);
  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

function useEngine() {
  const value = useContext(EngineContext);
  if (!value) throw new Error('Engine context unavailable');
  return value;
}

function FadeIn({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay, ease: [0.22, 1, .36, 1] }} className={className}>{children}</motion.div>;
}

function Button({ children, onClick, variant = 'dark', icon: Icon, className = '', disabled = false, type = 'button' }: { children: ReactNode; onClick?: () => void; variant?: 'dark' | 'gold' | 'ghost' | 'ivory'; icon?: IconType; className?: string; disabled?: boolean; type?: 'button' | 'submit' }) {
  const variants = {
    dark: 'bg-[#0A2E23] text-[#FFFDF9] border-[#0A2E23] hover:bg-[#174839]',
    gold: 'bg-[#D4AF37] text-[#2D2421] border-[#A98219] hover:bg-[#e1c253]',
    ghost: 'bg-transparent text-[#0A2E23] border-[#D4AF37]/70 hover:bg-[#D4AF37]/10',
    ivory: 'bg-[#FFFDF9]/75 text-[#2D2421] border-[#D4AF37]/55 hover:bg-[#FFFDF9]',
  };
  return <motion.button whileTap={{ scale: .97 }} type={type} disabled={disabled} onClick={onClick} data-testid={`button-${String(children).toLowerCase().replace(/\s+/g, '-')}`} className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-5 py-3 text-[11px] font-semibold tracking-[.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}>{Icon && <Icon size={15} strokeWidth={1.8} />}{children}</motion.button>;
}

function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`tracking-suite whitespace-nowrap text-[10px] font-semibold uppercase text-[#A98219] ${className}`}>{children}</p>;
}

function Monogram({ compact = false }: { compact?: boolean }) {
  return <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}><div className={`font-display leading-none text-[#0A2E23] ${compact ? 'text-2xl' : 'text-4xl'}`}>M<span className="mx-0.5 text-[#D4AF37]">&amp;</span>L</div>{!compact && <div className="hidden border-l border-[#D4AF37]/70 pl-3 text-[9px] font-semibold uppercase leading-relaxed tracking-[.18em] text-[#2D2421]/60 sm:block">The private<br />wedding suite</div>}</div>;
}

function QuietHeader({ studio = false }: { studio?: boolean }) {
  const { t } = useAppLocale();
  return <header className="relative z-20 flex items-center justify-between px-5 py-6 sm:px-10 lg:px-16">
    <Link href={studio ? '/studio' : '/studio'} data-testid={`link-${studio ? 'studio-hub' : 'studio'}`} className="focus-ring"><Monogram compact={studio} /></Link>
    <div className="flex items-center gap-3">
      <AppLanguageControl compact />
      <Eyebrow className="hidden sm:block">{studio ? 'HOST STUDIO / 01' : 'A PERSONAL INVITATION'}</Eyebrow>
      {studio ? <Link href="/scanner" aria-label={t('scanner')} data-testid="link-scanner" className="focus-ring rounded-full border border-[#D4AF37]/60 bg-[#FFFDF9]/40 p-2.5 text-[#0A2E23] transition hover:bg-[#FFFDF9]"><QrCode size={17} /></Link> : <Link href="/studio" data-testid="link-open-studio" className="focus-ring rounded-full border border-[#D4AF37]/60 bg-[#FFFDF9]/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-[.15em] text-[#0A2E23] transition hover:bg-[#FFFDF9]">{t('partyStudio')}</Link>}
    </div>
  </header>;
}

function SuiteCard({ children, className = '', id, grommetless = false }: { children: ReactNode; className?: string; id?: string; grommetless?: boolean }) {
  return <motion.section id={id} whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: .7, ease: [0.22, 1, .36, 1] }} className={`suite-card ${grommetless ? 'grommetless' : ''} ${className}`}>{children}</motion.section>;
}

function InitialsAvatar() {
  return <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D4AF37] bg-[#0A2E23] font-display text-lg text-[#D4AF37]" data-testid="avatar-hashim">HA</div>;
}

function QRMark() {
  const cells = useMemo(() => Array.from({ length: 81 }, (_, i) => [0, 2, 6, 8, 18, 20, 24, 26, 54, 56, 60, 62].includes(i) || (i * 7 + 3) % 5 < 2), []);
  return <div className="grid grid-cols-9 gap-[3px] rounded-lg bg-[#FFFDF9] p-3 shadow-inner" aria-label="Web QR pass" data-testid="qr-pass">{cells.map((filled, i) => <span key={i} className={`aspect-square rounded-[1px] ${filled ? 'bg-[#0A2E23]' : 'bg-transparent'}`} />)}</div>;
}

const blockIcons: Record<BlockKey, IconType> = { catering: Utensils, dress: Shirt, schedule: CalendarDays, registry: Heart, song: Music2, faq: HelpCircle };

function GuestPage({ preview = false }: { preview?: boolean } = {}) {
  const { state, ready, setRsvp, setSong, setMeal, submitWeddingRsvp } = useEngine();
  const { activeProject } = useWeddingWorkspace();
  const { token } = useParams<{ token: string }>();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const validToken = preview || isValidGuestToken(token, state.weddingGuest.token);
  const visibleBlocks = state.blocks.filter((block) => block.enabled);
  const displayedRsvp = preview ? 'accepted' : state.rsvp;
  const partyEvent = state.partyEvent;
  if (!ready) return <LoadingPage />;
  if (!validToken) return <TokenError />;
  if (state.mode === 'wedding') return <WeddingInvitationRenderer
    event={activeProject.event}
    guest={{ ...state.weddingGuest, token: token ?? state.weddingGuest.token }}
    rsvpStatus={state.rsvp}
    onSubmit={submitWeddingRsvp}
  />;
  return <div className={`party-invitation party-template--${partyEvent.templateId} grain min-h-[100dvh] overflow-hidden text-[#2D2421] ${preview ? 'party-invitation--preview' : ''}`} lang={state.invitationLocale} dir={localeDirection(state.invitationLocale)}>
    <div className="gold-thread" />
    <QuietHeader />
    <main className="relative z-10 mx-auto max-w-4xl px-5 pb-28 sm:px-8">
      <FadeIn className="relative flex flex-col items-center pb-16 pt-10 text-center sm:pt-16">
        <div className="party-hero-mark mb-7 flex h-24 w-24 items-center justify-center rounded-full border shadow-[0_12px_25px_rgba(10,46,35,.18)]"><PartyPopper size={34} strokeWidth={1.35} /></div>
        <Eyebrow><bdi>{partyEvent.venue} · {partyEvent.city}</bdi></Eyebrow>
        <h1 className="party-title mt-5 max-w-2xl font-display text-6xl leading-[.9] sm:text-8xl" data-testid="text-event-title"><bdi>{partyEvent.title}</bdi></h1>
        <p className="mt-5 max-w-xl font-display text-2xl italic text-[#2D2421]/65"><bdi>{partyEvent.invitationWording}</bdi></p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[.08em] text-[#2D2421]/65"><time dateTime={partyEvent.date}>{formatPartyDate(partyEvent.date, state.invitationLocale)}</time><span className="h-1 w-1 rounded-full bg-[#D4AF37]" /><time dateTime={partyEvent.startTime} dir="ltr">{partyEvent.startTime}</time></div>
      </FadeIn>

      <AnimatePresence mode="wait">
        {displayedRsvp === 'pending' && <motion.div key="rsvp" initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="suite-card mx-auto max-w-xl p-7 text-center sm:p-12">
          <Eyebrow>{partyInvitationT(state.invitationLocale, 'privateFor')} HASHIM</Eyebrow>
          <h2 className="mt-3 font-display text-4xl text-[#0A2E23]">{invitationT(state.invitationLocale, 'rsvpTitle')}</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-[#2D2421]/70">{partyInvitationT(state.invitationLocale, 'replyBy')} <time dateTime={partyEvent.rsvpDeadline}>{formatPartyDate(partyEvent.rsvpDeadline, state.invitationLocale)}</time>.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button onClick={() => setRsvp('accepted')} icon={Check}>{invitationT(state.invitationLocale, 'attending')}</Button><Button onClick={() => setRsvp('declined')} variant="ghost" icon={X}>{invitationT(state.invitationLocale, 'declining')}</Button></div>
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[.12em] text-[#2D2421]/45"><LockKeyhole size={12} /> {partyInvitationT(state.invitationLocale, 'noAccount')}</div>
        </motion.div>}
        {displayedRsvp === 'declined' && <motion.div key="declined" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="suite-card mx-auto max-w-xl p-8 text-center sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#D4AF37] text-[#D4AF37]"><Heart size={22} strokeWidth={1.4} /></div>
          <h2 className="mt-5 font-display text-4xl text-[#0A2E23]">{partyInvitationT(state.invitationLocale, 'missedTitle')}</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-[#2D2421]/70">{partyInvitationT(state.invitationLocale, 'missedBody')}</p>
          <button onClick={() => setRsvp('pending')} data-testid="button-change-rsvp" className="focus-ring mt-7 min-h-11 text-[10px] font-bold uppercase tracking-[.18em] text-[#A98219] underline underline-offset-4">{partyInvitationT(state.invitationLocale, 'changeResponse')}</button>
        </motion.div>}
        {displayedRsvp === 'accepted' && <motion.div key="accepted" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl">
          <SuiteCard className="p-7 sm:p-10">
            <div className="flex items-start justify-between gap-5"><div><Eyebrow>{partyInvitationT(state.invitationLocale, 'onList')}</Eyebrow><h2 className="mt-2 font-display text-4xl text-[#0A2E23]">{partyInvitationT(state.invitationLocale, 'acceptedTitle')}</h2><p className="mt-1 text-sm text-[#2D2421]/65">{partyInvitationT(state.invitationLocale, 'acceptedBody')}</p></div><CheckCircle2 className="shrink-0 text-[#0A2E23]" size={28} strokeWidth={1.4} /></div>
            <div className="mt-7 flex items-center gap-3 border-t border-[#D4AF37]/35 pt-5"><InitialsAvatar /><div><p className="font-semibold text-[#0A2E23]" data-testid="text-guest-name">Hashim Alnimari</p><p className="text-[11px] uppercase tracking-[.12em] text-[#2D2421]/55">1 {partyInvitationT(state.invitationLocale, 'guest')} · token {token ?? 'demo'}</p></div><span className="ms-auto rounded-full bg-[#0A2E23]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#0A2E23]">{partyInvitationT(state.invitationLocale, 'confirmed')}</span></div>
          </SuiteCard>
          <div className="my-16 text-center"><Eyebrow>{partyInvitationT(state.invitationLocale, 'details')}</Eyebrow><p className="mt-3 font-display text-3xl text-[#0A2E23]">{partyInvitationT(state.invitationLocale, 'detailsTitle')}</p></div>
          {visibleBlocks.map((block, index) => <GuestBlock key={block.key} block={block} index={index} openFaq={openFaq} setOpenFaq={setOpenFaq} song={state.song} setSong={preview ? () => undefined : setSong} meal={state.meal} setMeal={preview ? () => undefined : setMeal} />)}
          <SuiteCard className="mt-14 p-8 text-center sm:p-12">
            <Eyebrow>{partyInvitationT(state.invitationLocale, 'digitalPass')}</Eyebrow><h2 className="mt-3 font-display text-4xl text-[#0A2E23]">{partyInvitationT(state.invitationLocale, 'passTitle')}</h2><p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-[#2D2421]/65">{partyInvitationT(state.invitationLocale, 'passBody')}</p><div className="mx-auto mt-7 w-fit"><QRMark /></div><p className="mt-4 font-mono text-[10px] tracking-[.12em] text-[#2D2421]/50"><bdi>{partyEvent.title} · HA-001</bdi></p>
          </SuiteCard>
        </motion.div>}
      </AnimatePresence>
    </main>
    <footer className="relative z-10 pb-10 text-center"><div className="mx-auto mb-5 h-px w-20 bg-[#D4AF37]" /><p className="font-display text-xl italic text-[#2D2421]/55">{partyInvitationT(state.invitationLocale, 'madeFor')}</p></footer>
  </div>;
}

function GuestBlock({ block, index, openFaq, setOpenFaq, song, setSong, meal, setMeal }: { block: StudioBlock; index: number; openFaq: number | null; setOpenFaq: (n: number | null) => void; song: string; setSong: (s: string) => void; meal: string; setMeal: (s: string) => void }) {
  const { state } = useEngine();
  const Icon = blockIcons[block.key];
  const c = block.content;
  return <SuiteCard className="mb-10 p-7 sm:p-10" id={`guest-${block.key}`}>
    <div className="mb-8 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D4AF37] text-[#0A2E23]"><Icon size={16} strokeWidth={1.5} /></div><Eyebrow>{c.note ? block.eyebrow : block.eyebrow}</Eyebrow><span className="ml-auto font-mono text-[10px] text-[#2D2421]/35">0{index + 1}</span></div>
    {block.key === 'catering' && <><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><p className="mt-2 text-sm leading-6 text-[#2D2421]/65">{partyInvitationT(state.invitationLocale, 'choosePlate')}</p><div className="mt-7 grid gap-3 sm:grid-cols-3">{c.entree?.map((dish) => <button key={dish} onClick={() => setMeal(dish)} data-testid={`button-entree-${dish}`} className={`focus-ring min-h-11 rounded-2xl border p-4 text-start transition ${meal === dish ? 'border-[#0A2E23] bg-[#0A2E23] text-[#FFFDF9]' : 'border-[#D4AF37]/45 bg-[#FFFDF9]/45 hover:bg-[#FFFDF9]'}`}><span className="mb-4 block h-2 w-10 rounded-full" style={{ background: c.swatches?.[c.entree?.indexOf(dish) ?? 0] }} /><span className="text-xs font-semibold">{dish}</span></button>)}</div><p className="mt-4 text-[10px] uppercase tracking-[.12em] text-[#2D2421]/45">{partyInvitationT(state.invitationLocale, 'selected')}: {meal || partyInvitationT(state.invitationLocale, 'notSelected')}</p></>}
    {block.key === 'dress' && <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><p className="mt-3 max-w-md text-sm leading-7 text-[#2D2421]/65">{c.note}</p></div><div className="flex -space-x-2" aria-label="Suggested colors"><span className="h-10 w-10 rounded-full border-2 border-[#EADBC8] bg-[#6D3F35]" /><span className="h-10 w-10 rounded-full border-2 border-[#EADBC8] bg-[#C48B63]" /><span className="h-10 w-10 rounded-full border-2 border-[#EADBC8] bg-[#34594B]" /></div></div>}
    {block.key === 'schedule' && <><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><div className="mt-7 space-y-0">{[['17:30', 'arrival'], ['18:15', 'ceremony'], ['19:00', 'dinner'], ['21:30', 'dancing']].map(([time, key]) => <div key={time} className="flex gap-5 border-s border-[#D4AF37] py-3 ps-5"><span className="w-20 shrink-0 font-mono text-[10px] font-bold text-[#A98219]" dir="ltr">{time}</span><span className="text-sm text-[#2D2421]/75">{partyInvitationT(state.invitationLocale, key as PartyInvitationKey)}</span></div>)}</div></>}
    {block.key === 'registry' && <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#2D2421]/65">{partyInvitationT(state.invitationLocale, 'registryBody')}</p></div><Button variant="ivory" icon={ExternalLink} onClick={() => window.open('https://example.com', '_blank')}>{partyInvitationT(state.invitationLocale, 'viewRegistry')}</Button></div>}
    {block.key === 'song' && <><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><p className="mt-2 text-sm text-[#2D2421]/65">{partyInvitationT(state.invitationLocale, 'songHelp')}</p><div className="mt-6 flex flex-col gap-3 sm:flex-row"><input value={song} onChange={(e) => setSong(e.target.value)} data-testid="input-song-request" placeholder="Artist — song title" className="focus-ring min-h-11 min-w-0 flex-1 rounded-full border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-5 py-3 text-sm outline-none placeholder:text-[#2D2421]/35" /><Button variant="dark" icon={Music2} onClick={() => setSong(song)}>{partyInvitationT(state.invitationLocale, 'saveSong')}</Button></div></>}
    {block.key === 'faq' && <><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><div className="mt-5">{c.questions?.map((item, qIndex) => <div key={item.q} className="border-b border-[#D4AF37]/35"><button onClick={() => setOpenFaq(openFaq === qIndex ? null : qIndex)} data-testid={`button-faq-${qIndex}`} className="focus-ring flex w-full items-center justify-between py-4 text-left text-sm font-semibold text-[#2D2421]"><span>{item.q}</span><ChevronDown size={16} className={`text-[#A98219] transition-transform ${openFaq === qIndex ? 'rotate-180' : ''}`} /></button><AnimatePresence initial={false}>{openFaq === qIndex && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pb-4 text-sm leading-6 text-[#2D2421]/65">{item.a}</motion.p>}</AnimatePresence></div>)}</div></>}
  </SuiteCard>;
}

function LoadingPage() {
  return <div className="min-h-[100dvh] bg-[#FAF7F2] p-6"><div className="mx-auto mt-20 max-w-xl space-y-4"><div className="h-5 w-24 animate-pulse rounded-full bg-[#EADBC8]" /><div className="h-44 animate-pulse rounded-[28px] bg-[#EADBC8]" /><div className="h-24 animate-pulse rounded-[28px] bg-[#EADBC8]" /></div></div>;
}
function TokenError() {
  return <div className="grain flex min-h-[100dvh] items-center justify-center bg-[#FAF7F2] p-6 text-center"><div className="gold-thread" /><SuiteCard className="relative z-10 max-w-md p-10"><XCircle className="mx-auto text-[#A98219]" size={34} strokeWidth={1.3} /><h1 className="mt-5 font-display text-4xl text-[#0A2E23]">This invitation has moved.</h1><p className="mt-3 text-sm leading-6 text-[#2D2421]/65">Please check the link from your invitation or ask the hosts to send it again.</p><Link href="/i/demo" data-testid="link-demo-invitation" className="focus-ring mt-6 inline-flex rounded-full bg-[#0A2E23] px-5 py-3 text-[11px] font-bold uppercase tracking-[.12em] text-[#FFFDF9]">Open demo invitation</Link></SuiteCard></div>;
}

function StudioHubPage() {
  const { ready } = useEngine();
  const { t, dir } = useAppLocale();
  if (!ready) return <LoadingPage />;

  return (
    <div className="grain min-h-[100dvh] bg-[#FAF7F2] text-[#2D2421]">
      <div className="gold-thread" />
      <QuietHeader studio />
      <main className="relative z-10 mx-auto max-w-5xl px-5 pb-20 sm:px-8 lg:px-12">
        <FadeIn>
          <div className="border-b border-[#D4AF37]/35 pb-8 text-center sm:text-left">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <Eyebrow>{t('hostStudio')}</Eyebrow>
                <h1 className="mt-3 font-display text-5xl leading-[.9] text-[#0A2E23] sm:text-6xl lg:text-7xl">
                  {t('chooseStudio')}
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-[#2D2421]/65">
                  {t('chooseStudioHelp')}
                </p>
              </div>
              <div className="flex justify-center gap-2 sm:justify-start">
                <Link href="/i/demo" data-testid="link-preview-invitation" className="focus-ring inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/70 px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#0A2E23]">
                  <ExternalLink size={14} /> {t('preview')}
                </Link>
                <Link href="/scanner" data-testid="link-open-scanner" className="focus-ring inline-flex items-center gap-2 rounded-full bg-[#0A2E23] px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#FFFDF9]">
                  <QrCode size={14} /> {t('doorScanner')}
                </Link>
              </div>
            </div>
          </div>
        </FadeIn>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <FadeIn delay={0.1}>
            <div className="suite-card flex h-full flex-col justify-between p-7 sm:p-9 transition hover:border-[#D4AF37]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-[#0A2E23]/25 bg-[#0A2E23]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#0A2E23]">
                    {t('partyEvents')}
                  </span>
                  <Sparkles size={18} className="text-[#A98219]" />
                </div>
                <h2 className="mt-5 font-display text-3xl text-[#0A2E23] sm:text-4xl">
                  {t('standardInvitation')}
                </h2>
                <p className="mt-1 font-body text-xs font-semibold text-[#A98219]">
                  أعياد ميلاد · عشاء خاص · تخرج · مناسبات عامة
                </p>
                <p className="mt-4 text-xs leading-6 text-[#2D2421]/70">
                  {t('standardHelp')}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#D4AF37]/40 bg-[#FFFDF9]/60 px-3 py-1 text-[10px] font-medium text-[#2D2421]/70">
                    Modular Blocks
                  </span>
                  <span className="rounded-full border border-[#D4AF37]/40 bg-[#FFFDF9]/60 px-3 py-1 text-[10px] font-medium text-[#2D2421]/70">
                    Menu &amp; Swatches
                  </span>
                  <span className="rounded-full border border-[#D4AF37]/40 bg-[#FFFDF9]/60 px-3 py-1 text-[10px] font-medium text-[#2D2421]/70">
                    Song Requests
                  </span>
                  <span className="rounded-full border border-[#D4AF37]/40 bg-[#FFFDF9]/60 px-3 py-1 text-[10px] font-medium text-[#2D2421]/70">
                    Pass &amp; RSVP
                  </span>
                </div>
              </div>
              <div className="mt-8">
                <Link
                  href="/studio/party"
                  data-testid="link-studio-party"
                  className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#0A2E23] bg-[#0A2E23] px-6 py-3.5 text-xs font-semibold tracking-[.08em] text-[#FFFDF9] transition hover:bg-[#174839]"
                >
                  {t('openPartyStudio')} <ArrowLeft className={dir === 'ltr' ? 'rotate-180' : ''} size={14} />
                </Link>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="suite-card flex h-full flex-col justify-between p-7 sm:p-9 transition hover:border-[#71808D]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-[#71808D]/40 bg-[#71808D]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#53616B]">
                    {t('weddingSuite')}
                  </span>
                  <Heart size={18} className="text-[#A98219]" />
                </div>
                <h2 className="mt-5 font-display text-3xl text-[#0A2E23] sm:text-4xl">
                  {t('weddingInvitation')}
                </h2>
                <p className="mt-1 font-body text-xs font-semibold text-[#A98219]">
                  دعوة زفاف سينمائية وتجربة عربية فاخرة
                </p>
                <p className="mt-4 text-xs leading-6 text-[#2D2421]/70">
                  {t('weddingHelp')}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#71808D]/40 bg-[#FFFDF9]/60 px-3 py-1 text-[10px] font-medium text-[#2D2421]/70">
                    9:16 Mobile First
                  </span>
                  <span className="rounded-full border border-[#71808D]/40 bg-[#FFFDF9]/60 px-3 py-1 text-[10px] font-medium text-[#2D2421]/70">
                    Arabic Typography
                  </span>
                  <span className="rounded-full border border-[#71808D]/40 bg-[#FFFDF9]/60 px-3 py-1 text-[10px] font-medium text-[#2D2421]/70">
                    Guest Variants
                  </span>
                  <span className="rounded-full border border-[#71808D]/40 bg-[#FFFDF9]/60 px-3 py-1 text-[10px] font-medium text-[#2D2421]/70">
                    RSVP Drawer
                  </span>
                </div>
              </div>
              <div className="mt-8">
                <Link
                  href="/studio/wedding"
                  data-testid="link-studio-wedding"
                  className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#71808D] bg-[#71808D] px-6 py-3.5 text-xs font-semibold tracking-[.08em] text-white transition hover:bg-[#5f6e7a]"
                >
                  {t('openWeddingStudio')} <ArrowLeft className={dir === 'ltr' ? 'rotate-180' : ''} size={14} />
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>

        <div className="mt-10 rounded-2xl border border-[#D4AF37]/35 bg-[#FFFDF9]/40 p-4 text-center text-xs text-[#2D2421]/60">
          {t('sharedState')} <span className="font-mono font-semibold">/i/:token</span>
        </div>
      </main>
    </div>
  );
}

function PartyStudioPage({ embedded = false }: { embedded?: boolean }) {
  const { state, ready, toggleBlock, reorderBlocks, updateBlock, setMode, setInvitationLocale, updatePartyEvent } = useEngine();
  const { t, locale } = useAppLocale();
  const [activeEditor, setActiveEditor] = useState<BlockKey | null>(null);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const activeBlock = state.blocks.find((b) => b.key === activeEditor);
  const moveBlock = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= state.blocks.length) return;
    const blocks = [...state.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    reorderBlocks(blocks);
  };

  useEffect(() => {
    if (ready && state.mode !== 'standard') {
      setMode('standard');
    }
  }, [ready, state.mode, setMode]);

  if (!ready) return <LoadingPage />;

  return (
    <div className={`grain bg-[#FAF7F2] text-[#2D2421] ${embedded ? 'rounded-3xl py-6' : 'min-h-[100dvh]'}`}>
      <div className="gold-thread" />
      {!embedded && <QuietHeader studio />}
      <main className={`relative z-10 mx-auto max-w-7xl px-5 sm:px-8 ${embedded ? 'pb-6' : 'pb-20 lg:px-14'}`}>
        <FadeIn>
          <div className="flex flex-col justify-between gap-7 border-b border-[#D4AF37]/35 pb-8 md:flex-row md:items-end">
            <div>
              <Eyebrow>{t('hostStudio')}</Eyebrow>
              <h1 className="mt-3 font-display text-6xl leading-[.82] text-[#0A2E23] sm:text-7xl">
                {t('partyStudioTitle')}
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-6 text-[#2D2421]/65">
                {t('partyStudioHelp')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/studio" data-testid="link-switch-studio" className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/70 px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#0A2E23] hover:bg-[#D4AF37]/10">
                <ArrowLeft size={13} /> {t('switchType')}
              </Link>
              <Link href="/i/demo" data-testid="link-preview-invitation" className="focus-ring inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/70 px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#0A2E23]">
                <ExternalLink size={14} /> {t('preview')}
              </Link>
              <Link href={buildProjectRoute('party', partyProject.id, 'scanner')} data-testid="link-open-scanner" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0A2E23] px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#FFFDF9]">
                <QrCode size={14} /> {t('doorScanner')}
              </Link>
            </div>
          </div>
        </FadeIn>

        <div className="party-view-switch sticky top-16 z-20 mx-auto mt-5 grid max-w-xs grid-cols-2 rounded-full border border-[#D4AF37]/55 bg-[#FFFDF9]/95 p-1 shadow-sm backdrop-blur xl:hidden" aria-label={`${t('editView')} / ${t('previewView')}`}>
          {(['edit', 'preview'] as const).map((item) => <button key={item} type="button" onClick={() => setView(item)} aria-pressed={view === item} className={`focus-ring min-h-11 rounded-full px-4 text-xs font-semibold ${view === item ? 'bg-[#0A2E23] text-white' : 'text-[#0A2E23]'}`}>{t(item === 'edit' ? 'editView' : 'previewView')}</button>)}
        </div>

        <div className="party-studio-layout mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(340px,430px)]">
          <div className={`party-editor min-w-0 space-y-8 ${view === 'preview' ? 'party-mobile-hidden' : ''}`}>
            <section className="suite-card grommetless p-6 sm:p-8" aria-labelledby="party-event-details">
              <Eyebrow>{t('event')}</Eyebrow><h2 id="party-event-details" className="mt-2 font-display text-4xl text-[#0A2E23]">{t('eventDetails')}</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block text-xs font-semibold sm:col-span-2"><span className="mb-2 block">{t('eventTitle')}</span><input data-testid="input-party-title" value={state.partyEvent.title} onChange={(event) => updatePartyEvent({ title: event.target.value })} className="focus-ring min-h-11 w-full rounded-xl border border-[#D4AF37]/55 bg-[#FFFDF9] px-4" /></label>
                <label className="block text-xs font-semibold sm:col-span-2"><span className="mb-2 block">{t('invitationWording')}</span><textarea data-testid="input-party-wording" rows={3} value={state.partyEvent.invitationWording} onChange={(event) => updatePartyEvent({ invitationWording: event.target.value })} className="focus-ring w-full resize-y rounded-xl border border-[#D4AF37]/55 bg-[#FFFDF9] px-4 py-3" /></label>
                <label className="block text-xs font-semibold"><span className="mb-2 block">{t('date')}</span><input type="date" data-testid="input-party-date" value={state.partyEvent.date} onChange={(event) => updatePartyEvent({ date: event.target.value })} className="focus-ring min-h-11 w-full rounded-xl border border-[#D4AF37]/55 bg-[#FFFDF9] px-4" /></label>
                <label className="block text-xs font-semibold"><span className="mb-2 block">{t('startTime')}</span><input type="time" data-testid="input-party-time" value={state.partyEvent.startTime} onChange={(event) => updatePartyEvent({ startTime: event.target.value })} className="focus-ring min-h-11 w-full rounded-xl border border-[#D4AF37]/55 bg-[#FFFDF9] px-4" /></label>
                <label className="block text-xs font-semibold"><span className="mb-2 block">{t('venue')}</span><input data-testid="input-party-venue" value={state.partyEvent.venue} onChange={(event) => updatePartyEvent({ venue: event.target.value })} className="focus-ring min-h-11 w-full rounded-xl border border-[#D4AF37]/55 bg-[#FFFDF9] px-4" /></label>
                <label className="block text-xs font-semibold"><span className="mb-2 block">{t('city')}</span><input data-testid="input-party-city" value={state.partyEvent.city} onChange={(event) => updatePartyEvent({ city: event.target.value })} className="focus-ring min-h-11 w-full rounded-xl border border-[#D4AF37]/55 bg-[#FFFDF9] px-4" /></label>
                <label className="block text-xs font-semibold sm:col-span-2"><span className="mb-2 block">{t('rsvpDeadline')}</span><input type="date" data-testid="input-party-deadline" value={state.partyEvent.rsvpDeadline} onChange={(event) => updatePartyEvent({ rsvpDeadline: event.target.value })} className="focus-ring min-h-11 w-full rounded-xl border border-[#D4AF37]/55 bg-[#FFFDF9] px-4" /></label>
              </div>
            </section>

            <section className="suite-card grommetless p-6 sm:p-8" aria-labelledby="party-design">
              <Eyebrow>{t('designNav')}</Eyebrow><h2 id="party-design" className="mt-2 font-display text-4xl text-[#0A2E23]">{t('chooseTemplate')}</h2>
              <label className="mt-6 block max-w-xs text-xs font-semibold"><span className="mb-2 block">{t('invitationLanguage')}</span><select data-testid="select-party-invitation-locale" value={state.invitationLocale} onChange={(event) => setInvitationLocale(event.target.value as InvitationLocale)} className="focus-ring min-h-11 w-full rounded-xl border border-[#D4AF37]/55 bg-[#FFFDF9] px-4"><option value="ar">{t('arabic')}</option><option value="en">{t('english')}</option></select></label>
              <div className="party-template-grid mt-6 grid gap-3 sm:grid-cols-3">{Object.values(partyTemplates).map((template) => <button key={template.id} type="button" data-testid={`button-party-template-${template.id}`} onClick={() => updatePartyEvent({ templateId: template.id })} aria-pressed={state.partyEvent.templateId === template.id} className={`focus-ring min-h-24 rounded-2xl border p-4 text-start ${state.partyEvent.templateId === template.id ? 'border-[#0A2E23] bg-[#0A2E23] text-white' : 'border-[#D4AF37]/45 bg-[#FFFDF9]/60'}`}><span className={`party-template-swatch party-template-swatch--${template.id}`} /><strong className="mt-3 block text-sm">{locale === 'ar' ? template.nameAr : template.name}</strong><span className="mt-1 block text-[10px] opacity-65">{locale === 'ar' ? template.descriptionAr : template.description}</span>{state.partyEvent.templateId === template.id && <span className="mt-2 inline-flex items-center gap-1 text-[10px]"><Check size={13} /> {t('selected')}</span>}</button>)}</div>
            </section>
            <div className="suite-card p-6 sm:p-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <Eyebrow>{t('guestExperience')}</Eyebrow>
                  <h2 className="mt-2 font-display text-4xl text-[#0A2E23]">{t('invitationBlocks')}</h2>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#2D2421]/45">
                  {state.blocks.filter((b) => b.enabled).length} {t('visible')}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#2D2421]/60">
                {t('blocksHelp')}
              </p>
              <Reorder.Group axis="y" values={state.blocks} onReorder={reorderBlocks} className="mt-7 space-y-3">
                {state.blocks.map((block, index) => (
                  <Reorder.Item key={block.key} value={block} className={`party-block-row flex flex-wrap items-center gap-3 rounded-2xl border p-3 transition ${block.enabled ? 'border-[#D4AF37]/55 bg-[#FFFDF9]/50' : 'border-[#2D2421]/10 bg-[#2D2421]/[.03] opacity-55'}`}>
                    <GripVertical data-testid={`grip-${block.key}`} size={18} className="party-drag-handle shrink-0 cursor-grab text-[#A98219]" />
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A2E23] text-[#D4AF37]">
                      <BlockIcon block={block.key} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#0A2E23]">{t(block.key)}</p>
                      <p className="truncate text-[11px] text-[#2D2421]/55">{block.content.heading}</p>
                    </div>
                    <div className="party-block-actions flex w-full items-center justify-end gap-2 sm:w-auto">
                    <button onClick={() => moveBlock(index, -1)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); moveBlock(index, -1); } }} disabled={index === 0} aria-label={`${t('moveUp')} ${t(block.key)}`} className="focus-ring flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#D4AF37]/55 text-[#0A2E23] disabled:opacity-30"><ArrowUp size={14} /></button>
                    <button onClick={() => moveBlock(index, 1)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); moveBlock(index, 1); } }} disabled={index === state.blocks.length - 1} aria-label={`${t('moveDown')} ${t(block.key)}`} className="focus-ring flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#D4AF37]/55 text-[#0A2E23] disabled:opacity-30"><ArrowDown size={14} /></button>
                    <button onClick={() => setActiveEditor(block.key)} data-testid={`button-edit-${block.key}`} aria-label={`${t('edit')} ${t(block.key)}`} className="focus-ring flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#D4AF37]/55 text-[#0A2E23] hover:bg-[#D4AF37]/10">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => toggleBlock(block.key)} data-testid={`button-toggle-${block.key}`} aria-label={`${t(block.enabled ? 'hide' : 'show')} ${t(block.key)}`} aria-pressed={block.enabled} className={`focus-ring relative h-11 w-12 shrink-0 rounded-full transition ${block.enabled ? 'bg-[#0A2E23]' : 'bg-[#2D2421]/20'}`}>
                      <span className={`absolute top-3.5 h-4 w-4 rounded-full border border-[#D4AF37] bg-[#FFFDF9] transition-transform ${block.enabled ? 'end-2' : 'start-2'}`} />
                    </button>
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>
            {activeBlock && <EditorPanel key={activeBlock.key} block={activeBlock} close={() => setActiveEditor(null)} updateBlock={updateBlock} />}
          </div>
          <aside className={`party-preview-column ${view === 'edit' ? 'party-mobile-hidden' : ''}`} aria-label={t('previewView')}>
            <div className="party-preview-frame"><GuestPage preview /></div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function WeddingWorkspaceControls() {
  const workspace = useWeddingWorkspace();
  const { t } = useAppLocale();
  const [selectedDesignId, setSelectedDesignId] = useState('');
  const [draftName, setDraftName] = useState('');
  const [confirmProjectDeleteId, setConfirmProjectDeleteId] = useState('');
  const [confirmDesignDeleteId, setConfirmDesignDeleteId] = useState('');
  const run = (operation: Promise<void>) => void operation.catch(() => undefined);
  const selectedDesign = workspace.designs.find((design) => design.id === selectedDesignId);
  const statusLabel = t(workspace.saveStatus === 'saving' ? 'saving' : workspace.saveStatus === 'error' ? 'saveError' : 'saved');
  const control = 'focus-ring min-h-11 rounded-full border border-[#D4AF37]/55 bg-[#FFFDF9]/70 px-4 py-2 text-[10px] font-bold uppercase tracking-[.08em] text-[#0A2E23] transition hover:bg-[#FFFDF9] disabled:cursor-not-allowed disabled:opacity-40';

  return <section className="my-8 rounded-[28px] border border-[#D4AF37]/40 bg-[#FFFDF9]/55 p-5 shadow-sm" aria-label={t('weddingStudio')}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2">
        <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">{t('operationName')}</span><input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder={t('namePlaceholder')} className="focus-ring min-h-11 w-full rounded-2xl border border-[#D4AF37]/55 bg-[#FFFDF9] px-4 text-sm text-[#0A2E23]" /></label>
        <div>
        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55" htmlFor="wedding-project">{t('currentWedding')}</label>
        <select id="wedding-project" value={workspace.activeProject.id} onChange={(event) => { setConfirmProjectDeleteId(''); run(workspace.openProject(event.target.value)); }} className="focus-ring min-h-11 w-full rounded-2xl border border-[#D4AF37]/55 bg-[#FFFDF9] px-4 text-sm text-[#0A2E23]">
          {workspace.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={control} onClick={() => run(workspace.createProject(draftName || t('newWedding')))}>{t('createWedding')}</button>
        <button className={control} onClick={() => run(workspace.saveNow())}>{t('saveNow')}</button>
        <button className={control} onClick={() => run(workspace.renameProject(draftName || workspace.activeProject.name))}>{t('rename')}</button>
        <button className={control} onClick={() => run(workspace.duplicateProject(draftName || `${workspace.activeProject.name} — ${t('copy')}`))}>{t('duplicate')}</button>
        <button className={control} onClick={() => confirmProjectDeleteId === workspace.activeProject.id ? (run(workspace.deleteProject()), setConfirmProjectDeleteId('')) : setConfirmProjectDeleteId(workspace.activeProject.id)}>{t(confirmProjectDeleteId === workspace.activeProject.id ? 'confirmDelete' : 'delete')}</button>
        {confirmProjectDeleteId === workspace.activeProject.id && <button className={control} onClick={() => setConfirmProjectDeleteId('')}>{t('cancel')}</button>}
      </div>
    </div>
    <div className="mt-4 flex items-center gap-2 text-[11px] text-[#2D2421]/65" role="status"><span className={`h-2 w-2 rounded-full ${workspace.saveStatus === 'error' ? 'bg-[#b4534b]' : workspace.saveStatus === 'saving' ? 'bg-[#D4AF37]' : 'bg-[#0A2E23]'}`} />{statusLabel}</div>
    {workspace.storageError && <p className="mt-2 rounded-xl bg-[#b4534b]/10 px-3 py-2 text-xs text-[#8c302b]" role="alert">{workspace.storageError}</p>}
    <div className="mt-5 border-t border-[#D4AF37]/30 pt-5">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">{t('savedDesigns')}</p>
      <div className="flex flex-col gap-2 md:flex-row">
        <select value={selectedDesignId} onChange={(event) => setSelectedDesignId(event.target.value)} className="focus-ring min-h-11 min-w-0 flex-1 rounded-2xl border border-[#D4AF37]/55 bg-[#FFFDF9] px-4 text-sm text-[#0A2E23]" aria-label={t('savedDesigns')}>
          <option value="">{t('chooseDesign')}</option>
          {workspace.designs.map((design) => <option key={design.id} value={design.id}>{design.name}</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          <button className={control} onClick={() => run(workspace.saveCurrentDesign(draftName || `${workspace.activeProject.name} — ${t('design')}`))}>{t('saveAppearance')}</button>
          <button className={control} disabled={!selectedDesign} onClick={() => selectedDesign && workspace.applyDesign(selectedDesign.id)}>{t('apply')}</button>
          <button className={control} disabled={!selectedDesign} onClick={() => selectedDesign && run(workspace.renameDesign(selectedDesign.id, draftName || selectedDesign.name))}>{t('rename')}</button>
          <button className={control} disabled={!selectedDesign} onClick={() => {
            if (!selectedDesign) return;
            if (confirmDesignDeleteId === selectedDesign.id) {
              run(workspace.deleteDesign(selectedDesign.id));
              setSelectedDesignId('');
              setConfirmDesignDeleteId('');
            } else setConfirmDesignDeleteId(selectedDesign.id);
          }}>{t(selectedDesign && confirmDesignDeleteId === selectedDesign.id ? 'confirmDelete' : 'delete')}</button>
          {confirmDesignDeleteId && <button className={control} onClick={() => setConfirmDesignDeleteId('')}>{t('cancel')}</button>}
        </div>
      </div>
    </div>
  </section>;
}

function WeddingStudioPage({ embedded = false }: { embedded?: boolean }) {
  const { state, ready, setMode } = useEngine();
  const { activeProject, updateActiveEvent } = useWeddingWorkspace();
  const { t } = useAppLocale();

  useEffect(() => {
    if (ready && state.mode !== 'wedding') {
      setMode('wedding');
    }
  }, [ready, state.mode, setMode]);

  if (!ready) return <LoadingPage />;

  return (
    <div className={`grain bg-[#FAF7F2] text-[#2D2421] ${embedded ? 'rounded-3xl py-6' : 'min-h-[100dvh]'}`}>
      <div className="gold-thread" />
      {!embedded && <QuietHeader studio />}
      <main className={`relative z-10 mx-auto max-w-7xl px-5 sm:px-8 ${embedded ? 'pb-6' : 'pb-20 lg:px-14'}`}>
        <FadeIn>
          <div className="flex flex-col justify-between gap-7 border-b border-[#D4AF37]/35 pb-8 md:flex-row md:items-end">
            <div>
              <Eyebrow>{t('weddingStudio')}</Eyebrow>
              <h1 className="mt-3 font-display text-6xl leading-[.82] text-[#0A2E23] sm:text-7xl">
                {t('weddingStudioTitle')}
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-6 text-[#2D2421]/65">
                {t('weddingStudioHelp')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/studio" data-testid="link-switch-studio" className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/70 px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#0A2E23] hover:bg-[#D4AF37]/10">
                <ArrowLeft size={13} /> {t('switchType')}
              </Link>
              <Link href="/i/demo" data-testid="link-preview-invitation" className="focus-ring inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/70 px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#0A2E23]">
                <ExternalLink size={14} /> {t('preview')}
              </Link>
              <Link href="/scanner" data-testid="link-open-scanner" className="focus-ring inline-flex items-center gap-2 rounded-full bg-[#0A2E23] px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#FFFDF9]">
                <QrCode size={14} /> {t('doorScanner')}
              </Link>
            </div>
          </div>
        </FadeIn>

        <WeddingWorkspaceControls />
        <WeddingStudio
          event={activeProject.event}
          guest={state.weddingGuest}
          rsvpStatus={state.rsvp}
          onChange={updateActiveEvent}
        />
        {!embedded && <div className="mt-8"><GuestManager /></div>}
      </main>
    </div>
  );
}

function BlockIcon({ block }: { block: BlockKey }) { const Icon = blockIcons[block]; return <Icon size={15} strokeWidth={1.6} />; }
function EditorPanel({ block, close, updateBlock }: { block: StudioBlock; close: () => void; updateBlock: (key: BlockKey, patch: Partial<BlockContent>) => void }) {
  const { t } = useAppLocale();
  const [heading, setHeading] = useState(block.content.heading);
  const [note, setNote] = useState(block.content.note ?? '');
  const [entree, setEntree] = useState((block.content.entree ?? []).join('\n'));
  const [questions, setQuestions] = useState(block.content.questions ?? []);
  const [swatches, setSwatches] = useState(block.content.swatches ?? ['#6D3F35', '#C48B63', '#34594B']);
  const save = () => { updateBlock(block.key, { heading, note, entree: entree.split('\n').map((x) => x.trim()).filter(Boolean), questions, swatches }); close(); };
  return <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} className="suite-card grommetless p-6"><div className="flex items-start justify-between"><div><Eyebrow>{t('edit')} / {t(block.key)}</Eyebrow><h3 className="mt-2 font-display text-3xl text-[#0A2E23]">{t(block.key)}</h3></div><button onClick={close} data-testid="button-close-editor" aria-label={t('cancel')} className="focus-ring flex min-h-11 min-w-11 items-center justify-center rounded-full text-[#2D2421]/60"><X size={18} /></button></div><div className="mt-6 space-y-5"><label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">{t('heading')}</span><input value={heading} onChange={(e) => setHeading(e.target.value)} data-testid="input-edit-heading" className="focus-ring w-full rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-4 py-3 text-sm outline-none" /></label>{(block.key === 'dress') && <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">{t('description')}</span><textarea value={note} onChange={(e) => setNote(e.target.value)} data-testid="input-edit-note" rows={4} className="focus-ring w-full resize-none rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-4 py-3 text-sm outline-none" /></label>}{block.key === 'catering' && <><label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">{t('entrees')}</span><textarea value={entree} onChange={(e) => setEntree(e.target.value)} data-testid="input-edit-entrees" rows={4} className="focus-ring w-full resize-none rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-4 py-3 text-sm outline-none" /></label><div><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">{t('menuSwatches')}</span><div className="flex gap-3">{swatches.map((swatch, i) => <input key={i} type="color" value={swatch} onChange={(e) => setSwatches(swatches.map((color, colorI) => colorI === i ? e.target.value : color))} data-testid={`input-edit-swatch-${i}`} aria-label={`${t('menuSwatches')} ${i + 1}`} className="h-10 w-full cursor-pointer rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF9]/60 p-1" />)}</div></div></>}{block.key === 'faq' && <div><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">{t('questions')}</span>{questions.map((item, i) => <input key={i} value={item.q} onChange={(e) => setQuestions(questions.map((q, qI) => qI === i ? { ...q, q: e.target.value } : q))} data-testid={`input-edit-question-${i}`} className="focus-ring mb-2 w-full rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-4 py-3 text-sm outline-none" />)}</div>}<Button variant="dark" className="w-full" icon={Check} onClick={save}>{t('saveChanges')}</Button></div></motion.div>;
}

function GuestManager() {
  const { t } = useAppLocale();
  const { state } = useEngine();
  const { activeProject } = useWeddingWorkspace();
  const wedding = state.mode === 'wedding';
  const guest = wedding ? state.weddingGuest : { ...defaultWeddingGuest, name: 'Hashim Alnimari', allowedCompanions: 0 };
  const partySize = wedding && state.rsvp === 'accepted' ? state.weddingResponse.guestCount : 1;
  const invitationUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/i/${guest.token}`;
  const eventName = wedding ? resolveInvitationTitle(state.mode, activeProject.event) : state.partyEvent.title;
  const sendWhatsApp = () => {
    const url = getWhatsAppShareUrl(state.mode, eventName, guest.phone, invitationUrl);
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const exportGuests = () => {
    const csv = `Guest,Plus ones,RSVP,Checked in\n${guest.name.replaceAll(',', ' ')},${Math.max(0, partySize - 1)},${state.rsvp},${state.checkedIn}\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'quickrsvp-guest-list.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  const responseClass = state.rsvp === 'accepted' ? 'bg-[#0A2E23]/10 text-[#0A2E23]' : 'bg-[#D4AF37]/15 text-[#8A6712]';
  return <div className="suite-card overflow-hidden p-6 sm:p-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Eyebrow>{t('guestList')} / 01</Eyebrow><h2 className="mt-2 font-display text-4xl text-[#0A2E23]">{t('guestListTitle')}</h2></div><Button variant="ivory" icon={ArrowDownToLine} onClick={exportGuests}>{t('catererExport')}</Button></div>
    <div className="mt-6 rounded-2xl border border-[#D4AF37]/35 bg-[#FFFDF9]/45 p-4 sm:hidden">
      <div className="flex items-center gap-3"><InitialsAvatar /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#0A2E23]" data-testid="row-guest-hashim-mobile">{guest.name}</p><p className="text-[10px] text-[#2D2421]/50"><bdi>{guest.token}</bdi></p></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${responseClass}`}>{t(state.rsvp)}</span></div>
      <div className="mt-4 flex items-center justify-between border-t border-[#D4AF37]/25 pt-4"><p className="text-xs text-[#2D2421]/65">{partySize} {t('guest')}</p><button onClick={sendWhatsApp} data-testid="button-whatsapp-hashim-mobile" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D4AF37]/60 px-3 py-2 text-[10px] font-bold uppercase text-[#0A2E23]"><MessageCircle size={14} /> WhatsApp</button></div>
    </div>
    <div className="mt-6 hidden overflow-x-auto sm:block"><table className="w-full min-w-[590px] text-start"><thead><tr className="border-b border-[#D4AF37]/35 text-[10px] uppercase tracking-[.12em] text-[#2D2421]/50"><th className="pb-3 font-semibold">{t('guest')}</th><th className="pb-3 font-semibold">{t('party')}</th><th className="pb-3 font-semibold">{t('response')}</th><th className="pb-3 text-end font-semibold">{t('invite')}</th></tr></thead><tbody><tr className="border-b border-[#D4AF37]/20"><td className="py-4"><div className="flex items-center gap-3"><InitialsAvatar /><div><p className="text-sm font-semibold text-[#0A2E23]" data-testid="row-guest-hashim">{guest.name}</p><p className="text-[10px] text-[#2D2421]/50"><bdi>{guest.token}</bdi></p></div></div></td><td className="py-4 text-sm">{partySize}</td><td className="py-4"><span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[.1em] ${responseClass}`}>{t(state.rsvp)}</span></td><td className="py-4 text-end"><button onClick={sendWhatsApp} data-testid="button-whatsapp-hashim" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D4AF37]/60 px-3 py-2 text-[10px] font-bold uppercase tracking-[.08em] text-[#0A2E23] hover:bg-[#D4AF37]/10"><MessageCircle size={14} /> WhatsApp</button></td></tr></tbody></table></div>
    <p className="mt-5 flex items-center gap-2 text-[10px] text-[#2D2421]/50"><Link2 size={12} className="text-[#A98219]" /> {t('personalLink')} · <bdi>/i/{guest.token}</bdi></p>
  </div>;
}

function ScannerPage({ project }: { project?: ProjectSummary }) {
  const { state, ready, setCheckedIn } = useEngine();
  const { activeProject } = useWeddingWorkspace();
  const { t, dir } = useAppLocale();
  const [token, setToken] = useState('');
  const [scan, setScan] = useState<'idle' | 'verified' | 'rejected'>('idle');
  const verify = () => setScan(isValidGuestToken(token, state.weddingGuest.token) ? 'verified' : 'rejected');
  if (!ready) return <LoadingPage />;
  const context = project ?? weddingProjectSummary(activeProject);
  const backRoute = buildProjectRoute(context.type, context.id, 'overview');
  const guestName = state.mode === 'wedding' ? state.weddingGuest.name : 'Hashim Alnimari';
  const partySize = state.mode === 'wedding' ? Math.max(1, state.weddingResponse.guestCount) : 1;
  return <div className="grain min-h-[100dvh] bg-[#0A2E23] text-[#FFFDF9]">
    <div className="gold-thread opacity-45" />
    <header className="relative z-10 flex items-center justify-between px-5 py-6 sm:px-10"><Link href={backRoute} data-testid="link-scanner-back" className="focus-ring flex items-center gap-2 text-xs font-semibold text-white/70"><ArrowLeft className={dir === 'rtl' ? 'rotate-180' : ''} size={15} />{t('project')}</Link><div className="min-w-0 text-end"><p className="truncate text-sm font-semibold text-[#D4AF37]">{context.name}</p><p className="text-[9px] text-white/45"><bdi>{context.type} · {context.id}</bdi></p></div></header>
    <main className="relative z-10 mx-auto max-w-2xl px-5 pb-16 pt-10 sm:pt-16"><FadeIn><div className="text-center"><Eyebrow>{t('scanner')}</Eyebrow><h1 className="mt-4 font-display text-6xl leading-[.9] text-white sm:text-7xl">{t('scannerTitle')}</h1><p className="mx-auto mt-5 max-w-sm text-sm text-white/60">{t('scannerHelp')} <bdi>{context.date} · {context.venue}</bdi></p></div></FadeIn>
      <div className="relative mx-auto mt-12 aspect-[1.2] max-w-lg overflow-hidden rounded-[30px] border border-[#D4AF37]/70 bg-[#071f18]"><div className="absolute inset-5 rounded-2xl border border-[#D4AF37]/80" /><QrCode size={72} strokeWidth={.55} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20" /></div>
      <div className="mx-auto mt-8 max-w-lg"><div className="flex flex-col gap-2 sm:flex-row"><input value={token} onChange={(event) => { setToken(event.target.value); setScan('idle'); }} onKeyDown={(event) => event.key === 'Enter' && verify()} data-testid="input-scanner-token" placeholder={`${t('scannerPlaceholder')} · ${state.weddingGuest.token}`} dir="ltr" className="focus-ring min-h-12 min-w-0 flex-1 rounded-full border border-[#D4AF37]/50 bg-white/10 px-5 py-3 text-sm text-white outline-none placeholder:text-white/35" /><Button variant="gold" icon={Search} onClick={verify}>{t('verify')}</Button></div><p className="mt-3 text-center text-[10px] text-white/40">{t('frontendOnly')}</p></div>
      <AnimatePresence>{scan !== 'idle' && <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`mx-auto mt-8 max-w-lg rounded-[28px] border p-6 ${scan === 'verified' ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-[#d58c78] bg-[#d58c78]/10'}`}>{scan === 'verified' ? <div className="flex items-center gap-4"><Check className="text-[#D4AF37]" /><div className="min-w-0 flex-1"><Eyebrow>{t('verified')} · {guestName}</Eyebrow><p className="mt-1 text-sm text-white/75">{t('invitationFor')} {partySize} · {context.venue}</p></div>{state.checkedIn ? <span className="text-xs text-[#D4AF37]">{t('checkedIn')}</span> : <Button variant="gold" icon={Check} onClick={setCheckedIn}>{t('checkIn')}</Button>}</div> : <div className="flex items-center gap-4"><XCircle className="text-[#d58c78]" /><div><Eyebrow className="text-[#d58c78]">{t('notRecognized')}</Eyebrow><p className="mt-1 text-sm text-white/70">{t('tryAgain')}</p></div></div>}</motion.div>}</AnimatePresence>
    </main>
  </div>;
}

function weddingProjectSummary(project: WeddingProject): ProjectSummary {
  return {
    id: project.id,
    type: 'wedding',
    name: project.name,
    date: project.event.gregorianDate,
    venue: [project.event.venue, project.event.city].filter(Boolean).join(', '),
  };
}

function partyProjectSummary(event: PartyEventData): ProjectSummary {
  return { id: partyProject.id, type: 'party', name: event.title, date: formatPartyDate(event.date, 'en'), venue: [event.venue, event.city].filter(Boolean).join(', ') };
}

function DashboardRoute() {
  const { projects } = useWeddingWorkspace();
  const { state } = useEngine();
  return <DashboardPage projects={[...projects.map(weddingProjectSummary), partyProjectSummary(state.partyEvent)]} />;
}

function ProjectRoutePage({ type }: { type: ProjectType }) {
  const { eventId, section: rawSection } = useParams<{ eventId: string; section: string }>();
  const { state, ready, setMode } = useEngine();
  const workspace = useWeddingWorkspace();
  const { t } = useAppLocale();
  const weddingProject = type === 'wedding' ? workspace.projects.find((item) => item.id === eventId) : undefined;
  const project = type === 'wedding'
    ? weddingProject && weddingProjectSummary(weddingProject)
    : eventId === partyProject.id ? partyProjectSummary(state.partyEvent) : undefined;
  const section = resolveProjectSection(type, rawSection);

  useEffect(() => {
    if (!ready || !project) return;
    const mode = type === 'wedding' ? 'wedding' : 'standard';
    if (state.mode !== mode) setMode(mode);
    if (weddingProject && workspace.activeProject.id !== weddingProject.id) void workspace.openProject(weddingProject.id).catch(() => undefined);
  }, [project, ready, setMode, state.mode, type, weddingProject, workspace]);

  if (!ready) return <LoadingPage />;
  if (!project) return <TokenError />;

  let content: ReactNode;
  if (section === 'overview') content = <ProjectOverview project={project} guestCount={1} response={t(state.rsvp)} checkedIn={state.checkedIn} />;
  else if (section === 'invitation') content = type === 'wedding' ? <WeddingStudioPage embedded /> : <PartyStudioPage embedded />;
  else if (section === 'guests') content = <GuestManager />;
  else if (section === 'scanner') content = <ScannerPage project={project} />;
  else if (section === 'send') content = <EmptyProjectSection title={t('sendTitle')}>{t('sendHelp')}</EmptyProjectSection>;
  else content = <div className="space-y-4"><EmptyProjectSection title={t('settingsTitle')}>{t('settingsHelp')}</EmptyProjectSection><section className="mx-auto max-w-2xl rounded-3xl border border-[#D9D2C5] bg-white p-7"><h2 className="font-semibold">{t('appLanguage')}</h2><p className="mt-2 text-sm text-[#756F66]">{t('appLanguageHelp')}</p><div className="mt-4"><AppLanguageControl /></div></section></div>;

  return <ProjectShell project={project} section={section}>{content}</ProjectShell>;
}

function WeddingProjectRoute() { return <ProjectRoutePage type="wedding" />; }
function PartyProjectRoute() { return <ProjectRoutePage type="party" />; }
function GuestRoute() { return <GuestPage />; }

function LegacyRedirect({ path }: { path: '/studio/wedding' | '/studio/party' | '/scanner' }) {
  const { activeProject } = useWeddingWorkspace();
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(legacyProjectRoute(path, activeProject.id), { replace: true }); }, [activeProject.id, path, setLocation]);
  return <LoadingPage />;
}

function NotFound() {
  return <TokenError />;
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, left: 0 }); }, [location]);
  return null;
}

function Router() {
  return (
    <ErrorBoundary resetKey={window.location.pathname}>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={DashboardRoute} />
        <Route path="/i/:token" component={GuestRoute} />
        <Route path="/weddings/:eventId/:section" component={WeddingProjectRoute} />
        <Route path="/parties/:eventId/:section" component={PartyProjectRoute} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/studio/party">{() => <LegacyRedirect path="/studio/party" />}</Route>
        <Route path="/studio/wedding">{() => <LegacyRedirect path="/studio/wedding" />}</Route>
        <Route path="/studio" component={StudioHubPage} />
        <Route path="/scanner">{() => <LegacyRedirect path="/scanner" />}</Route>
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return <AppLocaleProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><WeddingWorkspaceProvider><EngineProvider><Router /></EngineProvider></WeddingWorkspaceProvider></WouterRouter></AppLocaleProvider>;
}

export default App;
