import { type ReactNode, type ComponentType, useContext, useEffect, useMemo, useState, createContext } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import {
  ArrowDownToLine, ArrowLeft, CalendarDays, Check, CheckCircle2, ChevronDown,
  ClipboardCheck, Edit3, ExternalLink, GripVertical, Heart, HelpCircle,
  Link2, LockKeyhole, MapPin, MessageCircle, Music2, QrCode, Search, Shirt, Sparkles,
  TicketCheck, Utensils, X, XCircle,
} from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { WeddingInvitationRenderer, WeddingStudio } from '@/wedding/WeddingMode';
import { defaultWeddingEvent, defaultWeddingGuest, mergeWeddingEvent, type EventMode, type WeddingEventData, type WeddingGuestData, type WeddingRsvp } from '@/wedding/model';

const queryClient = new QueryClient();

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
  weddingEvent: WeddingEventData;
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
  mode: 'standard', weddingEvent: defaultWeddingEvent, weddingGuest: defaultWeddingGuest,
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
  setWeddingEvent: (event: WeddingEventData) => void;
  submitWeddingRsvp: (response: WeddingRsvp) => void;
};
const EngineContext = createContext<EngineContextValue | null>(null);

function EngineProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EngineState>(defaultState);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raw = localStorage.getItem('luxury-rsvp-engine');
    if (raw) {
      try {
        const saved = JSON.parse(raw) as Partial<EngineState>;
        setState({
          ...defaultState,
          ...saved,
          weddingEvent: mergeWeddingEvent(saved.weddingEvent),
          weddingGuest: { ...defaultWeddingGuest, ...saved.weddingGuest },
          weddingResponse: { ...defaultState.weddingResponse, ...saved.weddingResponse },
        });
      } catch { setState(defaultState); }
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem('luxury-rsvp-engine', JSON.stringify(state));
  }, [state, ready]);
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
    setWeddingEvent: (weddingEvent: WeddingEventData) => setState((s) => ({ ...s, weddingEvent })),
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
  return <motion.button whileTap={{ scale: .97 }} type={type} disabled={disabled} onClick={onClick} data-testid={`button-${String(children).toLowerCase().replace(/\s+/g, '-')}`} className={`focus-ring inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-[11px] font-semibold tracking-[.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}>{Icon && <Icon size={15} strokeWidth={1.8} />}{children}</motion.button>;
}

function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`tracking-suite whitespace-nowrap text-[10px] font-semibold uppercase text-[#A98219] ${className}`}>{children}</p>;
}

function Monogram({ compact = false }: { compact?: boolean }) {
  return <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}><div className={`font-display leading-none text-[#0A2E23] ${compact ? 'text-2xl' : 'text-4xl'}`}>M<span className="mx-0.5 text-[#D4AF37]">&amp;</span>L</div>{!compact && <div className="hidden border-l border-[#D4AF37]/70 pl-3 text-[9px] font-semibold uppercase leading-relaxed tracking-[.18em] text-[#2D2421]/60 sm:block">The private<br />wedding suite</div>}</div>;
}

function QuietHeader({ studio = false }: { studio?: boolean }) {
  return <header className="relative z-20 flex items-center justify-between px-5 py-6 sm:px-10 lg:px-16">
    <Link href={studio ? '/i/demo' : '/studio'} data-testid={`link-${studio ? 'guest-preview' : 'studio'}`} className="focus-ring"><Monogram compact={studio} /></Link>
    <div className="flex items-center gap-3">
      <Eyebrow className="hidden sm:block">{studio ? 'HOST STUDIO / 01' : 'A PERSONAL INVITATION'}</Eyebrow>
      {studio ? <Link href="/scanner" data-testid="link-scanner" className="focus-ring rounded-full border border-[#D4AF37]/60 bg-[#FFFDF9]/40 p-2.5 text-[#0A2E23] transition hover:bg-[#FFFDF9]"><QrCode size={17} /></Link> : <Link href="/studio" data-testid="link-open-studio" className="focus-ring rounded-full border border-[#D4AF37]/60 bg-[#FFFDF9]/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-[.15em] text-[#0A2E23] transition hover:bg-[#FFFDF9]">Studio</Link>}
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

function GuestPage() {
  const { state, ready, setRsvp, setSong, setMeal, submitWeddingRsvp } = useEngine();
  const { token } = useParams<{ token: string }>();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const validToken = token === 'demo' || token === 'k82f9x' || token === state.weddingGuest.token;
  const visibleBlocks = state.blocks.filter((block) => block.enabled);
  if (!ready) return <LoadingPage />;
  if (!validToken) return <TokenError />;
  if (state.mode === 'wedding') return <WeddingInvitationRenderer
    event={state.weddingEvent}
    guest={{ ...state.weddingGuest, token: token ?? state.weddingGuest.token }}
    rsvpStatus={state.rsvp}
    onSubmit={submitWeddingRsvp}
  />;
  return <div className="grain min-h-[100dvh] overflow-hidden bg-[#FAF7F2] text-[#2D2421]">
    <div className="gold-thread" />
    <QuietHeader />
    <main className="relative z-10 mx-auto max-w-4xl px-5 pb-28 sm:px-8">
      <FadeIn className="relative flex flex-col items-center pb-16 pt-10 text-center sm:pt-16">
        <div className="mb-7 flex h-24 w-24 items-center justify-center rounded-full border border-[#D4AF37] bg-[#0A2E23] shadow-[0_12px_25px_rgba(10,46,35,.18)]"><span className="font-display text-4xl text-[#D4AF37]">M<span className="text-[#FFFDF9]">&amp;</span>L</span></div>
        <Eyebrow>THE GRAND PALACE HALL · JEDDAH</Eyebrow>
        <h1 className="mt-5 max-w-2xl font-display text-6xl leading-[.84] text-[#0A2E23] sm:text-8xl" data-testid="text-event-title">Maya <span className="text-[#D4AF37]">&amp;</span> Liam</h1>
        <p className="mt-5 font-display text-2xl italic text-[#2D2421]/65">invite you to celebrate their beginning</p>
        <div className="mt-7 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[.13em] text-[#2D2421]/65"><span>14 October 2026</span><span className="h-1 w-1 rounded-full bg-[#D4AF37]" /><span>Seven o'clock</span></div>
      </FadeIn>

      <AnimatePresence mode="wait">
        {state.rsvp === 'pending' && <motion.div key="rsvp" initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="suite-card mx-auto max-w-xl p-7 text-center sm:p-12">
          <Eyebrow>DEAR HASHIM</Eyebrow>
          <h2 className="mt-3 font-display text-4xl text-[#0A2E23]">Will you join us?</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-[#2D2421]/70">We have kept a place for you. Kindly reply by 20 September 2026.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button onClick={() => setRsvp('accepted')} icon={Check}>Accept with pleasure</Button><Button onClick={() => setRsvp('declined')} variant="ghost" icon={X}>Unable to attend</Button></div>
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[.12em] text-[#2D2421]/45"><LockKeyhole size={12} /> No account required</div>
        </motion.div>}
        {state.rsvp === 'declined' && <motion.div key="declined" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="suite-card mx-auto max-w-xl p-8 text-center sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#D4AF37] text-[#D4AF37]"><Heart size={22} strokeWidth={1.4} /></div>
          <h2 className="mt-5 font-display text-4xl text-[#0A2E23]">We will miss you.</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-[#2D2421]/70">Thank you for letting us know, Hashim. You will be with us in spirit, and we are sending warmth your way.</p>
          <button onClick={() => setRsvp('pending')} data-testid="button-change-rsvp" className="focus-ring mt-7 text-[10px] font-bold uppercase tracking-[.18em] text-[#A98219] underline underline-offset-4">Change your response</button>
        </motion.div>}
        {state.rsvp === 'accepted' && <motion.div key="accepted" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl">
          <SuiteCard className="p-7 sm:p-10">
            <div className="flex items-start justify-between gap-5"><div><Eyebrow>YOU ARE ON THE LIST</Eyebrow><h2 className="mt-2 font-display text-4xl text-[#0A2E23]">With pleasure.</h2><p className="mt-1 text-sm text-[#2D2421]/65">Your place is reserved for the celebration.</p></div><CheckCircle2 className="shrink-0 text-[#0A2E23]" size={28} strokeWidth={1.4} /></div>
            <div className="mt-7 flex items-center gap-3 border-t border-[#D4AF37]/35 pt-5"><InitialsAvatar /><div><p className="font-semibold text-[#0A2E23]" data-testid="text-guest-name">Hashim Alnimari</p><p className="text-[11px] uppercase tracking-[.12em] text-[#2D2421]/55">1 guest · token {token}</p></div><span className="ml-auto rounded-full bg-[#0A2E23]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#0A2E23]">Confirmed</span></div>
          </SuiteCard>
          <div className="my-16 text-center"><Eyebrow>THE DETAILS</Eyebrow><p className="mt-3 font-display text-3xl text-[#0A2E23]">A few things for your evening.</p></div>
          {visibleBlocks.map((block, index) => <GuestBlock key={block.key} block={block} index={index} openFaq={openFaq} setOpenFaq={setOpenFaq} song={state.song} setSong={setSong} meal={state.meal} setMeal={setMeal} />)}
          <SuiteCard className="mt-14 p-8 text-center sm:p-12">
            <Eyebrow>YOUR DIGITAL PASS</Eyebrow><h2 className="mt-3 font-display text-4xl text-[#0A2E23]">See you under the lights.</h2><p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-[#2D2421]/65">Present this pass at the door. A screenshot works beautifully.</p><div className="mx-auto mt-7 w-fit"><QRMark /></div><p className="mt-4 font-mono text-[10px] tracking-[.22em] text-[#2D2421]/50">MAYA &amp; LIAM · HA-001</p>
          </SuiteCard>
        </motion.div>}
      </AnimatePresence>
    </main>
    <footer className="relative z-10 pb-10 text-center"><div className="mx-auto mb-5 h-px w-20 bg-[#D4AF37]" /><p className="font-display text-xl italic text-[#2D2421]/55">made for the moments that matter</p></footer>
  </div>;
}

function GuestBlock({ block, index, openFaq, setOpenFaq, song, setSong, meal, setMeal }: { block: StudioBlock; index: number; openFaq: number | null; setOpenFaq: (n: number | null) => void; song: string; setSong: (s: string) => void; meal: string; setMeal: (s: string) => void }) {
  const Icon = blockIcons[block.key];
  const c = block.content;
  return <SuiteCard className="mb-10 p-7 sm:p-10" id={`guest-${block.key}`}>
    <div className="mb-8 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D4AF37] text-[#0A2E23]"><Icon size={16} strokeWidth={1.5} /></div><Eyebrow>{c.note ? block.eyebrow : block.eyebrow}</Eyebrow><span className="ml-auto font-mono text-[10px] text-[#2D2421]/35">0{index + 1}</span></div>
    {block.key === 'catering' && <><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><p className="mt-2 text-sm leading-6 text-[#2D2421]/65">Choose the plate that feels most like you. We will take care of the rest.</p><div className="mt-7 grid gap-3 sm:grid-cols-3">{c.entree?.map((dish) => <button key={dish} onClick={() => setMeal(dish)} data-testid={`button-entree-${dish}`} className={`focus-ring rounded-2xl border p-4 text-left transition ${meal === dish ? 'border-[#0A2E23] bg-[#0A2E23] text-[#FFFDF9]' : 'border-[#D4AF37]/45 bg-[#FFFDF9]/45 hover:bg-[#FFFDF9]'}`}><span className="mb-4 block h-2 w-10 rounded-full" style={{ background: c.swatches?.[c.entree?.indexOf(dish) ?? 0] }} /><span className="text-xs font-semibold">{dish}</span></button>)}</div><p className="mt-4 text-[10px] uppercase tracking-[.12em] text-[#2D2421]/45">Selected: {meal || 'Not selected'}</p></>}
    {block.key === 'dress' && <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><p className="mt-3 max-w-md text-sm leading-7 text-[#2D2421]/65">{c.note}</p></div><div className="flex -space-x-2" aria-label="Suggested colors"><span className="h-10 w-10 rounded-full border-2 border-[#EADBC8] bg-[#6D3F35]" /><span className="h-10 w-10 rounded-full border-2 border-[#EADBC8] bg-[#C48B63]" /><span className="h-10 w-10 rounded-full border-2 border-[#EADBC8] bg-[#34594B]" /></div></div>}
    {block.key === 'schedule' && <><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><div className="mt-7 space-y-0">{[['05:30 PM', 'Arrival & welcome'], ['06:15 PM', 'Ceremony in the garden'], ['07:00 PM', 'Dinner under the stars'], ['09:30 PM', 'Dancing & dessert']].map(([time, label]) => <div key={time} className="flex gap-5 border-l border-[#D4AF37] py-3 pl-5"><span className="w-20 shrink-0 font-mono text-[10px] font-bold text-[#A98219]">{time}</span><span className="text-sm text-[#2D2421]/75">{label}</span></div>)}</div></>}
    {block.key === 'registry' && <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#2D2421]/65">If you would like to honour us with a gift, we have kept a small collection with Maison &amp; Co.</p></div><Button variant="ivory" icon={ExternalLink} onClick={() => window.open('https://example.com', '_blank')}>View registry</Button></div>}
    {block.key === 'song' && <><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><p className="mt-2 text-sm text-[#2D2421]/65">The song you hope finds you on the dance floor.</p><div className="mt-6 flex flex-col gap-3 sm:flex-row"><input value={song} onChange={(e) => setSong(e.target.value)} data-testid="input-song-request" placeholder="Artist — song title" className="focus-ring min-w-0 flex-1 rounded-full border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-5 py-3 text-sm outline-none placeholder:text-[#2D2421]/35" /><Button variant="dark" icon={Music2} onClick={() => setSong(song)}>Save song</Button></div></>}
    {block.key === 'faq' && <><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><div className="mt-5">{c.questions?.map((item, qIndex) => <div key={item.q} className="border-b border-[#D4AF37]/35"><button onClick={() => setOpenFaq(openFaq === qIndex ? null : qIndex)} data-testid={`button-faq-${qIndex}`} className="focus-ring flex w-full items-center justify-between py-4 text-left text-sm font-semibold text-[#2D2421]"><span>{item.q}</span><ChevronDown size={16} className={`text-[#A98219] transition-transform ${openFaq === qIndex ? 'rotate-180' : ''}`} /></button><AnimatePresence initial={false}>{openFaq === qIndex && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pb-4 text-sm leading-6 text-[#2D2421]/65">{item.a}</motion.p>}</AnimatePresence></div>)}</div></>}
  </SuiteCard>;
}

function LoadingPage() {
  return <div className="min-h-[100dvh] bg-[#FAF7F2] p-6"><div className="mx-auto mt-20 max-w-xl space-y-4"><div className="h-5 w-24 animate-pulse rounded-full bg-[#EADBC8]" /><div className="h-44 animate-pulse rounded-[28px] bg-[#EADBC8]" /><div className="h-24 animate-pulse rounded-[28px] bg-[#EADBC8]" /></div></div>;
}
function TokenError() {
  return <div className="grain flex min-h-[100dvh] items-center justify-center bg-[#FAF7F2] p-6 text-center"><div className="gold-thread" /><SuiteCard className="relative z-10 max-w-md p-10"><XCircle className="mx-auto text-[#A98219]" size={34} strokeWidth={1.3} /><h1 className="mt-5 font-display text-4xl text-[#0A2E23]">This invitation has moved.</h1><p className="mt-3 text-sm leading-6 text-[#2D2421]/65">Please check the link from your invitation or ask the hosts to send it again.</p><Link href="/i/demo" data-testid="link-demo-invitation" className="focus-ring mt-6 inline-flex rounded-full bg-[#0A2E23] px-5 py-3 text-[11px] font-bold uppercase tracking-[.12em] text-[#FFFDF9]">Open demo invitation</Link></SuiteCard></div>;
}

function StudioPage() {
  const { state, ready, toggleBlock, reorderBlocks, updateBlock, setMode, setWeddingEvent } = useEngine();
  const [activeEditor, setActiveEditor] = useState<BlockKey | null>(null);
  const activeBlock = state.blocks.find((b) => b.key === activeEditor);
  const accepted = state.rsvp === 'accepted';
  if (!ready) return <LoadingPage />;
  return <div className="grain min-h-[100dvh] bg-[#FAF7F2] text-[#2D2421]"><div className="gold-thread" /><QuietHeader studio />
    <main className="relative z-10 mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-14">
      <FadeIn><div className="flex flex-col justify-between gap-7 border-b border-[#D4AF37]/35 pb-8 md:flex-row md:items-end"><div><Eyebrow>{state.mode === 'wedding' ? 'QUICKRSVP / WEDDING MODE' : 'HOST STUDIO / STANDARD MODE'}</Eyebrow><h1 className="mt-3 font-display text-6xl leading-[.82] text-[#0A2E23] sm:text-7xl">{state.mode === 'wedding' ? <>Wedding mode,<br /><span className="text-[#D4AF37]">Arabic first.</span></> : <>Your suite,<br /><span className="text-[#D4AF37]">in your hands.</span></>}</h1><p className="mt-5 max-w-lg text-sm leading-6 text-[#2D2421]/65">{state.mode === 'wedding' ? 'أنشئ دعوة سينمائية فاخرة مع الحفاظ على روابط الضيوف والردود وبطاقة الدخول نفسها.' : 'Shape the guest experience, then send a private link that feels like yours.'}</p></div><div className="flex gap-2"><Link href="/i/demo" data-testid="link-preview-invitation" className="focus-ring inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/70 px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#0A2E23]"><ExternalLink size={14} /> Preview</Link><Link href="/scanner" data-testid="link-open-scanner" className="focus-ring inline-flex items-center gap-2 rounded-full bg-[#0A2E23] px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#FFFDF9]"><QrCode size={14} /> Door scanner</Link></div></div></FadeIn>
      <EventModePicker mode={state.mode} setMode={setMode} />
      {state.mode === 'wedding' ? <>
        <WeddingStudio event={state.weddingEvent} guest={state.weddingGuest} rsvpStatus={state.rsvp} onChange={setWeddingEvent} />
        <div className="mt-8"><GuestManager /></div>
      </> : <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-3"><StudioStat label="Invitation status" value="Live" detail="private link active" icon={Sparkles} /><StudioStat label="Responses" value={accepted ? '1 / 1' : '0 / 1'} detail={accepted ? 'Hashim confirmed' : 'awaiting first reply'} icon={ClipboardCheck} /><StudioStat label="Door pass" value={state.checkedIn ? 'Used' : 'Ready'} detail={state.checkedIn ? 'checked in' : 'web QR enabled'} icon={TicketCheck} /></div>
          <div className="suite-card p-6 sm:p-8"><div className="flex items-end justify-between gap-4"><div><Eyebrow>GUEST EXPERIENCE</Eyebrow><h2 className="mt-2 font-display text-4xl text-[#0A2E23]">Invitation blocks</h2></div><span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#2D2421]/45">{state.blocks.filter((b) => b.enabled).length} visible</span></div><p className="mt-2 text-sm text-[#2D2421]/60">Drag to set the pace. Toggle anything that does not belong.</p>
            <Reorder.Group axis="y" values={state.blocks} onReorder={reorderBlocks} className="mt-7 space-y-3">
              {state.blocks.map((block) => <Reorder.Item key={block.key} value={block} className={`flex items-center gap-3 rounded-2xl border p-3 transition ${block.enabled ? 'border-[#D4AF37]/55 bg-[#FFFDF9]/50' : 'border-[#2D2421]/10 bg-[#2D2421]/[.03] opacity-55'}`}><GripVertical data-testid={`grip-${block.key}`} size={18} className="shrink-0 cursor-grab text-[#A98219]" /><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A2E23] text-[#D4AF37]"><BlockIcon block={block.key} /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#0A2E23]">{block.label}</p><p className="truncate text-[11px] text-[#2D2421]/55">{block.content.heading}</p></div><button onClick={() => setActiveEditor(block.key)} data-testid={`button-edit-${block.key}`} aria-label={`Edit ${block.label}`} className="focus-ring rounded-full border border-[#D4AF37]/55 p-2 text-[#0A2E23] hover:bg-[#D4AF37]/10"><Edit3 size={14} /></button><button onClick={() => toggleBlock(block.key)} data-testid={`button-toggle-${block.key}`} aria-label={`${block.enabled ? 'Hide' : 'Show'} ${block.label}`} className={`focus-ring relative h-6 w-11 rounded-full transition ${block.enabled ? 'bg-[#0A2E23]' : 'bg-[#2D2421]/20'}`}><span className={`absolute top-1 h-4 w-4 rounded-full border border-[#D4AF37] bg-[#FFFDF9] transition-transform ${block.enabled ? 'left-6' : 'left-1'}`} /></button></Reorder.Item>)}
            </Reorder.Group>
          </div>
          <GuestManager />
        </div>
        <aside className="space-y-6">
          <SuiteCard className="p-6"><Eyebrow>THE EVENT</Eyebrow><div className="mt-3 flex items-start gap-3"><CalendarDays className="mt-1 text-[#A98219]" size={18} /><div><p className="font-display text-3xl text-[#0A2E23]">14 Oct 2026</p><p className="mt-1 text-xs text-[#2D2421]/60">The Grand Palace Hall<br />Jeddah, Saudi Arabia</p></div></div><div className="fine-rule my-5" /><div className="flex items-center gap-2 text-xs text-[#2D2421]/65"><MapPin size={14} className="text-[#A98219]" /> Garden ceremony · 7:00 PM</div></SuiteCard>
          <AnimatePresence mode="wait">{activeBlock ? <EditorPanel key={activeBlock.key} block={activeBlock} close={() => setActiveEditor(null)} updateBlock={updateBlock} /> : <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel rounded-[28px] p-6"><Edit3 className="text-[#A98219]" size={18} /><p className="mt-4 font-display text-2xl text-[#0A2E23]">Make it personal.</p><p className="mt-2 text-xs leading-5 text-[#2D2421]/60">Select any block to edit its language, menu, colors, or questions.</p></motion.div>}</AnimatePresence>
        </aside>
      </div>}
    </main>
  </div>;
}

function EventModePicker({ mode, setMode }: { mode: EventMode; setMode: (mode: EventMode) => void }) {
  return <section className="mt-7 rounded-[24px] border border-[#D4AF37]/35 bg-[#FFFDF9]/55 p-4" aria-labelledby="event-mode-heading">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><Eyebrow>STEP 1 · EVENT TYPE</Eyebrow><h2 id="event-mode-heading" className="mt-1 font-display text-2xl text-[#0A2E23]">Choose the building experience</h2></div><div className="grid grid-cols-2 gap-2" role="group" aria-label="Event type"><button onClick={() => setMode('standard')} aria-pressed={mode === 'standard'} className={`focus-ring min-h-11 rounded-full border px-4 text-xs font-semibold transition ${mode === 'standard' ? 'border-[#0A2E23] bg-[#0A2E23] text-white' : 'border-[#D4AF37]/55 bg-white/55 text-[#2D2421]'}`} data-testid="button-mode-standard">Birthday / Party</button><button onClick={() => setMode('wedding')} aria-pressed={mode === 'wedding'} className={`focus-ring min-h-11 rounded-full border px-4 text-xs font-semibold transition ${mode === 'wedding' ? 'border-[#71808D] bg-[#71808D] text-white' : 'border-[#D4AF37]/55 bg-white/55 text-[#2D2421]'}`} data-testid="button-mode-wedding">Wedding · زفاف</button></div></div>
    <p className="mt-3 text-[10px] text-[#2D2421]/55">Graduation and corporate events continue through Standard Mode in V1.</p>
  </section>;
}

function BlockIcon({ block }: { block: BlockKey }) { const Icon = blockIcons[block]; return <Icon size={15} strokeWidth={1.6} />; }
function StudioStat({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: IconType }) {
  return <div className="glass-panel rounded-2xl p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/50">{label}</p><Icon size={15} className="text-[#A98219]" /></div><p className="mt-3 font-display text-3xl text-[#0A2E23]" data-testid={`text-stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p><p className="mt-1 text-[10px] text-[#2D2421]/50">{detail}</p></div>;
}

function EditorPanel({ block, close, updateBlock }: { block: StudioBlock; close: () => void; updateBlock: (key: BlockKey, patch: Partial<BlockContent>) => void }) {
  const [heading, setHeading] = useState(block.content.heading);
  const [note, setNote] = useState(block.content.note ?? '');
  const [entree, setEntree] = useState((block.content.entree ?? []).join('\n'));
  const [questions, setQuestions] = useState(block.content.questions ?? []);
  const [swatches, setSwatches] = useState(block.content.swatches ?? ['#6D3F35', '#C48B63', '#34594B']);
  const save = () => { updateBlock(block.key, { heading, note, entree: entree.split('\n').map((x) => x.trim()).filter(Boolean), questions, swatches }); close(); };
  return <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} className="suite-card grommetless p-6"><div className="flex items-start justify-between"><div><Eyebrow>EDITING / {block.label}</Eyebrow><h3 className="mt-2 font-display text-3xl text-[#0A2E23]">{block.label}</h3></div><button onClick={close} data-testid="button-close-editor" className="focus-ring rounded-full p-1 text-[#2D2421]/60"><X size={18} /></button></div><div className="mt-6 space-y-5"><label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">Heading</span><input value={heading} onChange={(e) => setHeading(e.target.value)} data-testid="input-edit-heading" className="focus-ring w-full rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-4 py-3 text-sm outline-none" /></label>{(block.key === 'dress') && <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">Description</span><textarea value={note} onChange={(e) => setNote(e.target.value)} data-testid="input-edit-note" rows={4} className="focus-ring w-full resize-none rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-4 py-3 text-sm outline-none" /></label>}{block.key === 'catering' && <><label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">Entrées <span className="font-normal normal-case tracking-normal">(one per line)</span></span><textarea value={entree} onChange={(e) => setEntree(e.target.value)} data-testid="input-edit-entrees" rows={4} className="focus-ring w-full resize-none rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-4 py-3 text-sm outline-none" /></label><div><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">Menu swatches</span><div className="flex gap-3">{swatches.map((swatch, i) => <input key={i} type="color" value={swatch} onChange={(e) => setSwatches(swatches.map((color, colorI) => colorI === i ? e.target.value : color))} data-testid={`input-edit-swatch-${i}`} aria-label={`Menu swatch ${i + 1}`} className="h-10 w-full cursor-pointer rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF9]/60 p-1" />)}</div></div></>}{block.key === 'faq' && <div><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">Questions</span>{questions.map((item, i) => <input key={i} value={item.q} onChange={(e) => setQuestions(questions.map((q, qI) => qI === i ? { ...q, q: e.target.value } : q))} data-testid={`input-edit-question-${i}`} className="focus-ring mb-2 w-full rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-4 py-3 text-sm outline-none" />)}</div>}<Button variant="dark" className="w-full" icon={Check} onClick={save}>Save changes</Button></div></motion.div>;
}

function GuestManager() {
  const { state } = useEngine();
  const wedding = state.mode === 'wedding';
  const guest = wedding ? state.weddingGuest : { ...defaultWeddingGuest, name: 'Hashim Alnimari', allowedCompanions: 0 };
  const partySize = wedding && state.rsvp === 'accepted' ? state.weddingResponse.guestCount : 1;
  const invitationUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/i/${guest.token}`;
  const eventName = wedding ? [state.weddingEvent.groomName, state.weddingEvent.brideName].filter(Boolean).join(' و ') : 'Maya & Liam';
  const sendWhatsApp = () => { const message = encodeURIComponent(wedding ? `يسر ${eventName} دعوتكم لحضور حفل الزواج. دعوتكم الخاصة: ${invitationUrl}` : `${eventName} would love to celebrate with you. Your private invitation: ${invitationUrl}`); window.open(`https://wa.me/${guest.phone.replace(/\D/g, '')}?text=${message}`, '_blank', 'noopener,noreferrer'); };
  const exportGuests = () => { const csv = `Guest,Plus ones,RSVP,Checked in\n${guest.name.replaceAll(',', ' ')},${Math.max(0, partySize - 1)},${state.rsvp},${state.checkedIn}\n`; const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const link = document.createElement('a'); link.href = url; link.download = 'quickrsvp-guest-list.csv'; link.click(); URL.revokeObjectURL(url); };
  return <div className="suite-card overflow-hidden p-6 sm:p-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Eyebrow>GUEST LIST / 01</Eyebrow><h2 className="mt-2 font-display text-4xl text-[#0A2E23]">The people who matter.</h2></div><Button variant="ivory" icon={ArrowDownToLine} onClick={exportGuests}>Caterer export</Button></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[590px] text-left"><thead><tr className="border-b border-[#D4AF37]/35 text-[10px] uppercase tracking-[.12em] text-[#2D2421]/50"><th className="pb-3 font-semibold">Guest</th><th className="pb-3 font-semibold">Party</th><th className="pb-3 font-semibold">Response</th><th className="pb-3 text-right font-semibold">Invite</th></tr></thead><tbody><tr className="border-b border-[#D4AF37]/20"><td className="py-4"><div className="flex items-center gap-3"><InitialsAvatar /><div><p className="text-sm font-semibold text-[#0A2E23]" data-testid="row-guest-hashim">{guest.name}</p><p className="text-[10px] text-[#2D2421]/50">{guest.token}</p></div></div></td><td className="py-4 text-sm">{partySize} {partySize === 1 ? 'guest' : 'guests'}</td><td className="py-4"><span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[.1em] ${state.rsvp === 'accepted' ? 'bg-[#0A2E23]/10 text-[#0A2E23]' : 'bg-[#D4AF37]/15 text-[#8A6712]'}`}>{state.rsvp}</span></td><td className="py-4 text-right"><button onClick={sendWhatsApp} data-testid="button-whatsapp-hashim" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D4AF37]/60 px-3 py-2 text-[10px] font-bold uppercase tracking-[.08em] text-[#0A2E23] hover:bg-[#D4AF37]/10"><MessageCircle size={14} /> WhatsApp</button></td></tr></tbody></table></div><p className="mt-5 flex items-center gap-2 text-[10px] text-[#2D2421]/50"><Link2 size={12} className="text-[#A98219]" /> Personal link ready · /i/{guest.token}</p></div>;
}

function ScannerPage() {
  const { state, ready, setCheckedIn } = useEngine();
  const [token, setToken] = useState('');
  const [scan, setScan] = useState<'idle' | 'verified' | 'rejected'>('idle');
  const verify = () => setScan([state.weddingGuest.token.toLowerCase(), 'k82f9x', 'demo'].includes(token.trim().toLowerCase()) ? 'verified' : 'rejected');
  if (!ready) return <LoadingPage />;
  return <div className="grain min-h-[100dvh] bg-[#0A2E23] text-[#FFFDF9]"><div className="gold-thread opacity-45" /><header className="relative z-10 flex items-center justify-between px-5 py-6 sm:px-10"><Link href="/studio" data-testid="link-scanner-back" className="focus-ring flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#FFFDF9]/70"><ArrowLeft size={15} /> Studio</Link><div className="flex items-center gap-2"><div className="font-display text-2xl text-[#D4AF37]">M<span className="text-[#FFFDF9]">&amp;</span>L</div><Eyebrow>DOOR / 01</Eyebrow></div></header><main className="relative z-10 mx-auto max-w-2xl px-5 pb-16 pt-10 sm:pt-16"><FadeIn><div className="text-center"><Eyebrow>CONCIERGE CHECK-IN</Eyebrow><h1 className="mt-4 font-display text-6xl leading-[.85] text-[#FFFDF9] sm:text-7xl">Welcome them<br /><span className="text-[#D4AF37]">by name.</span></h1><p className="mx-auto mt-5 max-w-sm text-sm leading-6 text-[#FFFDF9]/60">Scan a guest’s private pass or enter their token to verify the evening.</p></div></FadeIn><div className="relative mx-auto mt-12 aspect-[1.2] max-w-lg overflow-hidden rounded-[30px] border border-[#D4AF37]/70 bg-[#071f18] shadow-[0_18px_50px_rgba(0,0,0,.3)]"><div className="absolute inset-5 rounded-2xl border border-[#D4AF37]/80"><span className="absolute -left-px -top-px h-10 w-10 border-l-2 border-t-2 border-[#D4AF37]" /><span className="absolute -right-px -top-px h-10 w-10 border-r-2 border-t-2 border-[#D4AF37]" /><span className="absolute -bottom-px -left-px h-10 w-10 border-b-2 border-l-2 border-[#D4AF37]" /><span className="absolute -bottom-px -right-px h-10 w-10 border-b-2 border-r-2 border-[#D4AF37]" /><motion.div animate={{ y: ['12%', '86%', '12%'] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} className="absolute left-[10%] right-[10%] h-px bg-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,.7)]" /></div><div className="absolute inset-0 flex items-center justify-center"><QrCode size={72} strokeWidth={.55} className="text-[#FFFDF9]/20" /></div><div className="absolute bottom-5 left-0 right-0 text-center text-[9px] font-bold uppercase tracking-[.2em] text-[#D4AF37]/75">camera viewfinder · ready</div></div><div className="mx-auto mt-8 max-w-lg"><div className="flex gap-2"><input value={token} onChange={(e) => { setToken(e.target.value); setScan('idle'); }} onKeyDown={(e) => e.key === 'Enter' && verify()} data-testid="input-scanner-token" placeholder={`Enter guest token · ${state.weddingGuest.token}`} className="focus-ring min-w-0 flex-1 rounded-full border border-[#D4AF37]/50 bg-[#FFFDF9]/10 px-5 py-3 text-sm text-[#FFFDF9] outline-none placeholder:text-[#FFFDF9]/35" /><Button variant="gold" icon={Search} onClick={verify}>Verify</Button></div><p className="mt-3 text-center text-[10px] uppercase tracking-[.15em] text-[#FFFDF9]/40">Demo mode · no camera permission required</p></div><AnimatePresence>{scan !== 'idle' && <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`mx-auto mt-8 max-w-lg rounded-[28px] border p-6 ${scan === 'verified' ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-[#d58c78] bg-[#d58c78]/10'}`}>{scan === 'verified' ? <div className="flex items-center gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-[#0A2E23]"><Check size={23} /></div><div className="min-w-0 flex-1"><Eyebrow>VERIFIED · {state.mode === 'wedding' ? state.weddingGuest.name : 'HASHIM ALNIMARI'}</Eyebrow><p className="mt-1 text-sm text-[#FFFDF9]/75">Invitation for {state.mode === 'wedding' ? Math.max(1, state.weddingResponse.guestCount) : 1} · {state.mode === 'wedding' ? state.weddingEvent.venue : 'The Grand Palace Hall'}</p></div>{state.checkedIn ? <span className="text-right text-[10px] font-bold uppercase tracking-[.1em] text-[#D4AF37]">Checked in</span> : <Button variant="gold" icon={Check} onClick={setCheckedIn}>Check in</Button>}</div> : <div className="flex items-center gap-4"><XCircle className="text-[#d58c78]" size={30} /><div><Eyebrow className="text-[#d58c78]">NOT RECOGNIZED</Eyebrow><p className="mt-1 text-sm text-[#FFFDF9]/70">Try the guest token again.</p></div></div>}</motion.div>}</AnimatePresence></main></div>;
}

function RedirectHome() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation('/i/demo'); }, [setLocation]);
  return <LoadingPage />;
}

function NotFound() {
  return <TokenError />;
}

function Router() {
  return <ErrorBoundary resetKey={window.location.pathname}><Switch><Route path="/" component={RedirectHome} /><Route path="/i/:token" component={GuestPage} /><Route path="/studio" component={StudioPage} /><Route path="/scanner" component={ScannerPage} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><EngineProvider><Router /></EngineProvider></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
