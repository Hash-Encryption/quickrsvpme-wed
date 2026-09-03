import { type ReactNode, type ComponentType, useContext, useEffect, useMemo, useRef, useState, createContext } from 'react';
import { ErrorBoundary, type ErrorFallbackProps } from '@/components/error-boundary';
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
import { AuthPage } from '@/auth/AuthPage';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { RequireAuth } from '@/auth/RequireAuth';
import { WeddingInvitationRenderer, WeddingStudio } from '@/wedding/WeddingMode';
import { WeddingWorkspaceProvider, useWeddingWorkspace } from '@/wedding/WeddingWorkspaceProvider';
import { anonymousDesignTransferFailedEvent, anonymousDesignTransferKey, anonymousDesignTransferResultKey, anonymousDesignTransferredEvent, hasDraftTransferMarker, requestAnonymousDesignTransfer, transferredDraftResult, withDraftTransferMarker } from '@/wedding/anonymous-transfer';
import type { WeddingProject } from '@/wedding/workspace';
import { AdminPage } from '@/admin/AdminPage';
import { DashboardPage } from '@/app/DashboardPage';
import { EmptyProjectSection, ProjectShell } from '@/app/ProjectShell';
import { BackendGuestManager, BackendScanner, EventOperationsOverview } from '@/app/Phase3Operations';
import {
  buildProjectRoute,
  findAuthenticatedProjectEvent,
  isPublicInvitationRoute,
  legacyProjectRoute,
  partyProject,
  resolveAdminSection,
  resolveProjectSection,
  type ProjectSummary,
  type ProjectType,
} from '@/app/projects';
import {
  defaultWeddingEvent,
  defaultWeddingGuest,
  clampGuestCount,
  getWhatsAppShareUrl,
  isValidGuestToken,
  mergeWeddingEvent,
  type EventMode,
  type WeddingEventData,
  type WeddingGuestData,
  type WeddingRsvp,
} from '@/wedding/model';
import { defaultPartyEvent, formatPartyDate, mergePartyEvent, partyTemplates, type PartyEventData } from '@/party/model';
import { createDesignDraft, createGeneralInvitation, createGuest, deleteDesignDraft, getDesignDraftPublishAccess, listDesignDrafts, listEventConfigs, listGuests, publishDesignDraft, recordInvitationOpen, resolveInvitation, rotatePersonalInvitation, savePartyConfig, submitGeneralRsvp, submitPersonalRsvp, tagGuest, updateDesignDraft, updateGuest, type DesignDraft, type DesignDraftPublishAccess } from '@/backend/phase2';
import { updateEvent } from '@/backend/events';
import { loadAdminSnapshot, setAdminEntitlement, setTemplateActive, type AdminSnapshot } from '@/backend/phase3';
import type { BackendEvent, EntitlementStatus, EventGuest, EventLifecycle, InvitationResolution, ProductId } from '@/backend/types';
import {
  emptyOperationalState,
  guestsCsv,
  guestsForProject,
  invitationUrl,
  normalizeOperationalState,
  operationalStats,
  projectKey,
  updateOperationalGuestByToken,
  type OperationalState,
} from '@/app/operations';

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
  operations: OperationalState;
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
  weddingResponse: { guestCount: 1, message: '' }, operations: emptyOperationalState(),
};

type EngineContextValue = {
  state: EngineState;
  ready: boolean;
  setRsvp: (value: RSVPStatus, guestCount?: number) => void;
  setSong: (value: string) => void;
  setMeal: (value: string) => void;
  toggleBlock: (key: BlockKey) => void;
  reorderBlocks: (blocks: StudioBlock[]) => void;
  updateBlock: (key: BlockKey, patch: Partial<BlockContent>) => void;
  setMode: (mode: EventMode) => void;
  setInvitationLocale: (locale: InvitationLocale) => void;
  updatePartyEvent: (patch: Partial<PartyEventData>) => void;
  submitWeddingRsvp: (response: WeddingRsvp) => void;
  activePartyEventId: string;
  openPartyEvent: (id: string) => void;
  openPartyDraft: (draft: DesignDraft<Record<string, unknown>>) => void;
  savePartyDraft: () => Promise<void>;
  loadPublicInvitation: (resolution: InvitationResolution, token: string, generalName?: string) => void;
  publicReadOnly: boolean;
  storageAvailable: boolean;
};
const EngineContext = createContext<EngineContextValue | null>(null);

function EngineProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { activeProject, preserveLegacyWedding } = useWeddingWorkspace();
  const initialWeddingId = useRef(activeProject.id).current;
  const [state, setState] = useState<EngineState>(defaultState);
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [activePartyEventId, setActivePartyEventId] = useState('');
  const partyVersionRef = useRef(0);
  const partyTemplateRef = useRef<string | null>(null);
  const partyTemplateKeyRef = useRef<string | null>(null);
  const partyHydratedRef = useRef(false);
  const partyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partyQueueRef = useRef(Promise.resolve());
  const partyDraftRef = useRef<DesignDraft<Record<string, unknown>> | null>(null);
  const partyTransferRef = useRef<Promise<void> | null>(null);
  const partyUserRef = useRef<string | null>(null);
  const [publicInvitation, setPublicInvitation] = useState<{ token: string; kind: 'personal' | 'general'; requestId: string; readOnly: boolean } | null>(null);
  useEffect(() => {
    let raw: string | null;
    try {
      raw = localStorage.getItem('luxury-rsvp-engine');
    } catch {
      setStorageAvailable(false);
      setState({ ...defaultState, operations: normalizeOperationalState(undefined, defaultState, initialWeddingId, partyProject.id) });
      setReady(true);
      return;
    }
    try {
      const saved = raw ? JSON.parse(raw) as Partial<EngineState> & { weddingEvent?: unknown } : {};
      const { weddingEvent: _legacyWedding, ...genericSaved } = saved;
      const next = {
          ...defaultState,
          ...genericSaved,
          invitationLocale: resolvePartyInvitationLocale(saved),
          partyEvent: mergePartyEvent(saved.partyEvent as Partial<PartyEventData> | undefined),
          weddingGuest: { ...defaultWeddingGuest, ...saved.weddingGuest },
          weddingResponse: { ...defaultState.weddingResponse, ...saved.weddingResponse },
      };
      setState({ ...next, operations: normalizeOperationalState(saved.operations, next, initialWeddingId, partyProject.id) });
    } catch {
      setState({ ...defaultState, operations: normalizeOperationalState(undefined, defaultState, initialWeddingId, partyProject.id) });
    }
    setReady(true);
  }, [initialWeddingId]);
  useEffect(() => {
    if (ready && storageAvailable) {
      try {
        const existing = JSON.parse(localStorage.getItem('luxury-rsvp-engine') ?? '{}') as Partial<EngineState> & { weddingEvent?: unknown };
        const backendParty = Boolean(auth.session && (partyDraftRef.current || activePartyEventId));
        const anonymousParty = backendParty ? {
          partyEvent: existing.partyEvent,
          blocks: (existing as Partial<EngineState>).blocks,
          invitationLocale: (existing as Partial<EngineState>).invitationLocale,
        } : {};
        const persisted = preserveLegacyWedding && existing.weddingEvent
          ? { ...state, weddingEvent: existing.weddingEvent }
          : state;
        localStorage.setItem('luxury-rsvp-engine', JSON.stringify({ ...persisted, ...anonymousParty }));
      }
      catch { setStorageAvailable(false); }
    }
  }, [activePartyEventId, auth.session, state, ready, preserveLegacyWedding, storageAvailable]);
  useEffect(() => {
    if (auth.session) { partyUserRef.current = auth.session.user.id; return; }
    if (auth.loading || !partyUserRef.current) return;
    partyUserRef.current = null;
    partyDraftRef.current = null;
    setActivePartyEventId('');
    try {
      const saved = JSON.parse(localStorage.getItem('luxury-rsvp-engine') ?? '{}') as Partial<EngineState>;
      setState((current) => ({ ...current, partyEvent: mergePartyEvent(saved.partyEvent), blocks: Array.isArray(saved.blocks) ? saved.blocks : initialBlocks, invitationLocale: resolvePartyInvitationLocale(saved) }));
    } catch {
      setState((current) => ({ ...current, partyEvent: defaultPartyEvent, blocks: initialBlocks, invitationLocale: 'ar' }));
    }
  }, [auth.loading, auth.session]);
  useEffect(() => {
    if (!auth.session || auth.loading) return;
    if (sessionStorage.getItem(anonymousDesignTransferKey) === 'party') return;
    const partyEvents = auth.events.filter((event) => event.product_id === 'party' && !event.deleted_at);
    const eventId = partyEvents.some((event) => event.id === activePartyEventId) ? activePartyEventId : partyEvents[0]?.id;
    if (!eventId) return;
    setActivePartyEventId(eventId);
    partyHydratedRef.current = false;
    void listEventConfigs<Partial<PartyEventData> & { blocks?: StudioBlock[]; invitationLocale?: InvitationLocale }>('party').then((configs) => {
      const config = configs.find((item) => item.event_id === eventId);
      const event = partyEvents.find((item) => item.id === eventId)!;
      partyVersionRef.current = config?.version ?? 0;
      partyTemplateRef.current = config?.template_version_id ?? null;
      partyTemplateKeyRef.current = typeof config?.template_snapshot.templateId === 'string' ? config.template_snapshot.templateId : null;
      setState((current) => ({ ...current, partyEvent: mergePartyEvent(config?.configuration ?? { title: event.title, venue: event.venue_name ?? '', city: event.city ?? '' }), blocks: Array.isArray(config?.configuration.blocks) ? config.configuration.blocks : current.blocks, invitationLocale: config?.configuration.invitationLocale === 'en' ? 'en' : event.invitation_locale }));
      partyHydratedRef.current = true;
    }).catch(() => { partyHydratedRef.current = true; });
  }, [activePartyEventId, auth.events, auth.loading, auth.session]);
  useEffect(() => {
    if (!ready || !auth.session || auth.loading || sessionStorage.getItem(anonymousDesignTransferKey) !== 'party' || partyTransferRef.current) return;
    partyTransferRef.current = (async () => {
      const sourceId = 'party-local-workspace';
      const drafts = await listDesignDrafts<Record<string, unknown>>('party');
      let draft = drafts.find((item) => hasDraftTransferMarker(item.configuration, sourceId));
      if (!draft) {
        const configuration = withDraftTransferMarker({ ...structuredClone(state.partyEvent), blocks: structuredClone(state.blocks), invitationLocale: state.invitationLocale }, sourceId);
        draft = await createDesignDraft('party', state.partyEvent.title, configuration);
      }
      try {
        const saved = JSON.parse(localStorage.getItem('luxury-rsvp-engine') ?? '{}') as Record<string, unknown>;
        delete saved.partyEvent; delete saved.blocks; delete saved.invitationLocale;
        localStorage.setItem('luxury-rsvp-engine', JSON.stringify(saved));
      } catch { /* Authenticated Draft remains authoritative. */ }
      sessionStorage.setItem(anonymousDesignTransferResultKey, transferredDraftResult('party', draft.id));
      sessionStorage.removeItem(anonymousDesignTransferKey);
      window.dispatchEvent(new Event(anonymousDesignTransferredEvent));
    })().catch((caught) => {
      window.dispatchEvent(new CustomEvent(anonymousDesignTransferFailedEvent, { detail: caught instanceof Error ? caught.message : 'Design Draft transfer failed.' }));
    }).finally(() => { partyTransferRef.current = null; });
  }, [auth.loading, auth.session, ready, state.blocks, state.invitationLocale, state.partyEvent]);
  useEffect(() => {
    if (!partyHydratedRef.current || (!activePartyEventId && !partyDraftRef.current) || !auth.session) return;
    if (partyTimerRef.current) clearTimeout(partyTimerRef.current);
    partyTimerRef.current = setTimeout(() => {
      const configuration = { ...state.partyEvent, blocks: state.blocks, invitationLocale: state.invitationLocale };
      const existingTemplate = partyTemplateKeyRef.current === state.partyEvent.templateId ? partyTemplateRef.current : null;
      partyQueueRef.current = partyQueueRef.current.then(async () => {
        if (partyDraftRef.current) {
          partyDraftRef.current = await updateDesignDraft(partyDraftRef.current, state.partyEvent.title, configuration);
          return;
        }
        const saved = await savePartyConfig(activePartyEventId, configuration, partyVersionRef.current, existingTemplate);
        partyVersionRef.current = saved.version;
        partyTemplateRef.current = saved.template_version_id;
        partyTemplateKeyRef.current = state.partyEvent.templateId;
        await updateEvent(activePartyEventId, { title: state.partyEvent.title, invitation_locale: state.invitationLocale, venue_name: state.partyEvent.venue || null, city: state.partyEvent.city || null });
      }).catch(() => undefined);
    }, 500);
    return () => { if (partyTimerRef.current) clearTimeout(partyTimerRef.current); };
  }, [activePartyEventId, auth.session, state.blocks, state.invitationLocale, state.partyEvent]);
  const commitPublicRsvp = (rsvp: RSVPStatus, guestCount: number, message = '') => {
    if (!publicInvitation || rsvp === 'pending') return Promise.resolve();
    return publicInvitation.kind === 'personal'
      ? submitPersonalRsvp(publicInvitation.token, rsvp, rsvp === 'accepted' ? guestCount : 0, message)
      : submitGeneralRsvp(publicInvitation.token, publicInvitation.requestId, state.weddingGuest.name, rsvp, rsvp === 'accepted' ? guestCount : 0, message);
  };
  const value = useMemo(() => ({
    state, ready,
    setRsvp: (rsvp: RSVPStatus, guestCount?: number) => {
      const acceptedCount = clampGuestCount(guestCount ?? state.plusOnes + 1, state.weddingGuest.allowedCompanions);
      if (publicInvitation && rsvp !== 'pending') {
        void commitPublicRsvp(rsvp, acceptedCount).then(() => setState((s) => ({ ...s, rsvp, plusOnes: rsvp === 'accepted' ? acceptedCount - 1 : 0 })));
        return;
      }
      setState((s) => {
      const key = projectKey(s.mode === 'wedding' ? 'wedding' : 'party', s.mode === 'wedding' ? activeProject.id : partyProject.id);
      const localAcceptedCount = clampGuestCount(guestCount ?? s.plusOnes + 1, s.weddingGuest.allowedCompanions);
      return {
        ...s,
        rsvp,
        plusOnes: guestCount === undefined ? s.plusOnes : localAcceptedCount - 1,
        operations: updateOperationalGuestByToken(s.operations, key, s.weddingGuest.token, { rsvp, guestCount: rsvp === 'accepted' ? localAcceptedCount : 0 }),
      };
      });
    },
    setSong: (song: string) => setState((s) => ({ ...s, song })),
    setMeal: (meal: string) => setState((s) => ({ ...s, meal })),
    toggleBlock: (key: BlockKey) => setState((s) => ({ ...s, blocks: s.blocks.map((b) => b.key === key ? { ...b, enabled: !b.enabled } : b) })),
    reorderBlocks: (blocks: StudioBlock[]) => setState((s) => ({ ...s, blocks })),
    updateBlock: (key: BlockKey, patch: Partial<BlockContent>) => setState((s) => ({ ...s, blocks: s.blocks.map((b) => b.key === key ? { ...b, content: { ...b.content, ...patch } } : b) })),
    setMode: (mode: EventMode) => setState((s) => ({ ...s, mode })),
    setInvitationLocale: (invitationLocale: InvitationLocale) => setState((s) => ({ ...s, invitationLocale })),
    updatePartyEvent: (patch: Partial<PartyEventData>) => setState((s) => ({ ...s, partyEvent: mergePartyEvent({ ...s.partyEvent, ...patch }) })),
    submitWeddingRsvp: async (response: WeddingRsvp) => {
      if (publicInvitation) await commitPublicRsvp(response.status, response.guestCount, response.message);
      setState((s) => ({ ...s, rsvp: response.status, plusOnes: Math.max(0, response.guestCount - 1), weddingResponse: { guestCount: response.guestCount, message: response.message }, operations: publicInvitation ? s.operations : updateOperationalGuestByToken(s.operations, projectKey('wedding', activeProject.id), s.weddingGuest.token, { rsvp: response.status, guestCount: response.guestCount, message: response.message }) }));
    },
    activePartyEventId,
    openPartyEvent: (id: string) => { partyDraftRef.current = null; setActivePartyEventId(id); },
    openPartyDraft: (draft: DesignDraft<Record<string, unknown>>) => {
      partyDraftRef.current = draft;
      setActivePartyEventId('');
      partyHydratedRef.current = false;
      const configuration = draft.configuration as Partial<PartyEventData> & { blocks?: StudioBlock[]; invitationLocale?: InvitationLocale };
      setState((current) => ({ ...current, mode: 'standard', partyEvent: mergePartyEvent(configuration), blocks: Array.isArray(configuration.blocks) ? configuration.blocks : current.blocks, invitationLocale: configuration.invitationLocale === 'en' ? 'en' : 'ar' }));
      partyHydratedRef.current = true;
    },
    savePartyDraft: async () => {
      if (!partyDraftRef.current) return;
      const configuration = { ...state.partyEvent, blocks: state.blocks, invitationLocale: state.invitationLocale };
      partyQueueRef.current = partyQueueRef.current.then(async () => {
        partyDraftRef.current = await updateDesignDraft(partyDraftRef.current!, state.partyEvent.title, configuration);
      });
      await partyQueueRef.current;
    },
    loadPublicInvitation: (resolution: InvitationResolution, token: string, generalName = '') => {
      if (!resolution.event || !resolution.kind) return;
      const configuration = resolution.configuration ?? {};
      const guest = resolution.guest;
      const allowedCompanions = guest?.allowed_companions ?? resolution.event.general_invite_allowed_companions;
      setPublicInvitation({ token, kind: resolution.kind, requestId: crypto.randomUUID(), readOnly: resolution.status === 'archived_read_only' });
      setState((current) => ({ ...current, mode: resolution.event!.product_id === 'wedding' ? 'wedding' : 'standard', invitationLocale: resolution.event!.invitation_locale, partyEvent: resolution.event!.product_id === 'party' ? mergePartyEvent(configuration as Partial<PartyEventData>) : current.partyEvent, blocks: Array.isArray(configuration.blocks) ? configuration.blocks as StudioBlock[] : current.blocks, weddingGuest: { ...defaultWeddingGuest, name: guest?.name ?? generalName, token, allowedCompanions, invitationVariantOverride: guest?.invitation_variant_override ?? undefined }, rsvp: guest?.rsvp_status ?? 'pending', plusOnes: Math.max(0, (guest?.confirmed_party_size ?? 1) - 1), weddingResponse: { guestCount: guest?.confirmed_party_size || 1, message: guest?.custom_message ?? '' } }));
    },
    publicReadOnly: publicInvitation?.readOnly ?? false,
    storageAvailable,
  }), [activePartyEventId, activeProject.id, publicInvitation, state, ready, storageAvailable]);
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
  return <p className={`tracking-suite break-words text-[10px] font-semibold uppercase text-[#A98219] ${className}`}>{children}</p>;
}

function Monogram({ compact = false }: { compact?: boolean }) {
  return <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}><div className={`font-display leading-none text-[#0A2E23] ${compact ? 'text-2xl' : 'text-4xl'}`}>M<span className="mx-0.5 text-[#D4AF37]">&amp;</span>L</div>{!compact && <div className="hidden border-l border-[#D4AF37]/70 pl-3 text-[9px] font-semibold uppercase leading-relaxed tracking-[.18em] text-[#2D2421]/60 sm:block">The private<br />wedding suite</div>}</div>;
}

function QuietHeader({ studio = false, anonymous = false }: { studio?: boolean; anonymous?: ProductId | false }) {
  const { t } = useAppLocale();
  return <header className="relative z-20 flex items-center justify-between px-5 py-6 sm:px-10 lg:px-16">
    <Link href={anonymous ? `/design/${anonymous}` : '/studio'} data-testid={`link-${studio ? 'studio-hub' : 'studio'}`} className="focus-ring"><Monogram compact={studio} /></Link>
    <div className="flex items-center gap-3">
      <AppLanguageControl compact />
      <Eyebrow className="hidden sm:block">{studio ? 'HOST STUDIO / 01' : 'A PERSONAL INVITATION'}</Eyebrow>
      {!anonymous && (studio ? <Link href="/scanner" aria-label={t('scanner')} data-testid="link-scanner" className="focus-ring rounded-full border border-[#D4AF37]/60 bg-[#FFFDF9]/40 p-2.5 text-[#0A2E23] transition hover:bg-[#FFFDF9]"><QrCode size={17} /></Link> : <Link href="/studio" data-testid="link-open-studio" className="focus-ring rounded-full border border-[#D4AF37]/60 bg-[#FFFDF9]/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-[.15em] text-[#0A2E23] transition hover:bg-[#FFFDF9]">{t('partyStudio')}</Link>)}
    </div>
  </header>;
}

function SuiteCard({ children, className = '', id, grommetless = false }: { children: ReactNode; className?: string; id?: string; grommetless?: boolean }) {
  return <motion.section id={id} whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: .7, ease: [0.22, 1, .36, 1] }} className={`suite-card ${grommetless ? 'grommetless' : ''} ${className}`}>{children}</motion.section>;
}

function InitialsAvatar() {
  return <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D4AF37] bg-[#0A2E23] font-display text-lg text-[#D4AF37]" data-testid="avatar-hashim">HA</div>;
}

function QRMark({ label }: { label: string }) {
  const cells = useMemo(() => Array.from({ length: 81 }, (_, i) => [0, 2, 6, 8, 18, 20, 24, 26, 54, 56, 60, 62].includes(i) || (i * 7 + 3) % 5 < 2), []);
  return <div className="grid grid-cols-9 gap-[3px] rounded-lg bg-[#FFFDF9] p-3 shadow-inner" aria-label={label} data-testid="qr-pass">{cells.map((filled, i) => <span key={i} className={`aspect-square rounded-[1px] ${filled ? 'bg-[#0A2E23]' : 'bg-transparent'}`} />)}</div>;
}

const blockIcons: Record<BlockKey, IconType> = { catering: Utensils, dress: Shirt, schedule: CalendarDays, registry: Heart, song: Music2, faq: HelpCircle };

function GuestPage({ preview = false }: { preview?: boolean } = {}) {
  const { state, ready, setRsvp, setSong, setMeal, submitWeddingRsvp, loadPublicInvitation, publicReadOnly } = useEngine();
  const { activeProject } = useWeddingWorkspace();
  const { token } = useParams<{ token: string }>();
  const [resolution, setResolution] = useState<InvitationResolution | null>(null);
  const [resolutionError, setResolutionError] = useState(false);
  const [generalName, setGeneralName] = useState('');
  const [identified, setIdentified] = useState(false);
  const openedRef = useRef('');
  const loadedRef = useRef('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const backendToken = !preview && token !== 'demo' ? token : undefined;
  useEffect(() => {
    if (!backendToken) return;
    let live = true;
    loadedRef.current = '';
    setResolution(null); setResolutionError(false); setIdentified(false);
    void resolveInvitation(backendToken).then((result) => { if (live) setResolution(result); }).catch(() => { if (live) setResolutionError(true); });
    return () => { live = false; };
  }, [backendToken]);
  useEffect(() => {
    if (!backendToken || !resolution?.kind || !resolution.event || (resolution.kind === 'general' && !identified)) return;
    if (loadedRef.current === backendToken) return;
    loadedRef.current = backendToken;
    loadPublicInvitation(resolution, backendToken, generalName);
    if (openedRef.current !== backendToken) {
      openedRef.current = backendToken;
      requestAnimationFrame(() => void recordInvitationOpen(backendToken).catch(() => undefined));
    }
  }, [backendToken, generalName, identified, loadPublicInvitation, resolution]);
  if (backendToken && (!resolution || resolutionError)) return resolutionError ? <TokenError /> : <LoadingPage />;
  if (resolution && !['active', 'archived_read_only'].includes(resolution.status)) return <TokenError />;
  if (resolution?.kind === 'general' && !identified) return <div className="grain flex min-h-[100dvh] items-center justify-center bg-[#FAF7F2] p-5"><form onSubmit={(event) => { event.preventDefault(); if (generalName.trim()) setIdentified(true); }} className="suite-card w-full max-w-md p-7"><Eyebrow>{invitationT(resolution.event!.invitation_locale, 'invitation')}</Eyebrow><h1 className="mt-3 font-display text-4xl text-[#0A2E23]">{resolution.event!.title}</h1><input autoFocus required value={generalName} onChange={(event) => setGeneralName(event.target.value)} placeholder={invitationT(resolution.event!.invitation_locale, 'guestName')} className="mt-6 min-h-12 w-full rounded-xl border border-[#D4AF37]/55 px-4" /><Button type="submit" className="mt-4 w-full">{invitationT(resolution.event!.invitation_locale, 'continue')}</Button></form></div>;
  const validToken = Boolean(resolution) || preview || isValidGuestToken(token, state.weddingGuest.token);
  const visibleBlocks = state.blocks.filter((block) => block.enabled);
  const displayedRsvp = preview ? 'accepted' : state.rsvp;
  const partyEvent = state.partyEvent;
  const partyGuestCount = clampGuestCount(state.plusOnes + 1, state.weddingGuest.allowedCompanions);
  if (!ready) return <LoadingPage />;
  if (!validToken) return <TokenError />;
  if ((resolution?.event?.product_id ?? (state.mode === 'wedding' ? 'wedding' : 'party')) === 'wedding') return <WeddingInvitationRenderer
    event={resolution ? mergeWeddingEvent(resolution.configuration as Partial<ReturnType<typeof mergeWeddingEvent>>) : activeProject.event}
    guest={{ ...state.weddingGuest, token: token ?? state.weddingGuest.token }}
    rsvpStatus={state.rsvp}
    rsvpResponse={state.weddingResponse}
    onSubmit={submitWeddingRsvp}
    readOnly={publicReadOnly}
  />;
  return <div className={`party-invitation party-template--${partyEvent.templateId} grain min-h-[100dvh] overflow-hidden text-[#2D2421] ${preview ? 'party-invitation--preview' : ''}`} lang={state.invitationLocale} dir={localeDirection(state.invitationLocale)}>
    <div className="gold-thread" />
    <header className="relative z-20 flex items-center justify-between px-5 py-6 sm:px-10" aria-label={invitationT(state.invitationLocale, 'invitation')}><Monogram compact /></header>
    <main className="relative z-10 mx-auto max-w-4xl px-5 pb-28 sm:px-8">
      <FadeIn className="relative flex flex-col items-center pb-16 pt-10 text-center sm:pt-16">
        <div className="party-hero-mark mb-7 flex h-24 w-24 items-center justify-center rounded-full border shadow-[0_12px_25px_rgba(10,46,35,.18)]"><PartyPopper size={34} strokeWidth={1.35} /></div>
        <Eyebrow className="max-w-full text-center"><bdi>{partyEvent.venue} · {partyEvent.city}</bdi></Eyebrow>
        <h1 className="party-title mt-5 max-w-2xl break-words font-display text-6xl leading-[.9] sm:text-8xl" data-testid="text-event-title"><bdi>{partyEvent.title}</bdi></h1>
        <p className="mt-5 max-w-xl break-words font-display text-2xl italic text-[#2D2421]/65"><bdi>{partyEvent.invitationWording}</bdi></p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[.08em] text-[#2D2421]/65"><time dateTime={partyEvent.date}>{formatPartyDate(partyEvent.date, state.invitationLocale)}</time><span className="h-1 w-1 rounded-full bg-[#D4AF37]" /><time dateTime={partyEvent.startTime} dir="ltr">{partyEvent.startTime}</time></div>
      </FadeIn>

      <AnimatePresence mode="wait">
        {displayedRsvp === 'pending' && !publicReadOnly && <motion.div key="rsvp" initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="suite-card mx-auto max-w-xl p-7 text-center sm:p-12">
          <Eyebrow>{partyInvitationT(state.invitationLocale, 'privateFor')} {state.weddingGuest.name}</Eyebrow>
          <h2 className="mt-3 font-display text-4xl text-[#0A2E23]">{invitationT(state.invitationLocale, 'rsvpTitle')}</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-[#2D2421]/70">{partyInvitationT(state.invitationLocale, 'replyBy')} <time dateTime={partyEvent.rsvpDeadline}>{formatPartyDate(partyEvent.rsvpDeadline, state.invitationLocale)}</time>.</p>
          <div className="mx-auto mt-7 flex max-w-xs items-center justify-between rounded-2xl border border-[#D4AF37]/45 bg-[#FFFDF9]/45 p-3"><span className="text-start text-xs font-semibold">{invitationT(state.invitationLocale, 'guestCount')}<small className="mt-1 block font-normal text-[#2D2421]/55">{invitationT(state.invitationLocale, 'allowed')}: {1 + state.weddingGuest.allowedCompanions}</small></span><div className="flex items-center gap-3"><button className="focus-ring flex h-11 w-11 items-center justify-center rounded-full border border-[#D4AF37]/55" onClick={() => setRsvp('pending', partyGuestCount - 1)} disabled={partyGuestCount <= 1} aria-label={invitationT(state.invitationLocale, 'decreaseGuests')}>−</button><b>{partyGuestCount}</b><button className="focus-ring flex h-11 w-11 items-center justify-center rounded-full border border-[#D4AF37]/55" onClick={() => setRsvp('pending', partyGuestCount + 1)} disabled={partyGuestCount >= 1 + state.weddingGuest.allowedCompanions} aria-label={invitationT(state.invitationLocale, 'increaseGuests')}>+</button></div></div>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row"><Button onClick={() => setRsvp('accepted', partyGuestCount)} icon={Check}>{invitationT(state.invitationLocale, 'attending')}</Button><Button onClick={() => setRsvp('declined')} variant="ghost" icon={X}>{invitationT(state.invitationLocale, 'declining')}</Button></div>
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[.12em] text-[#2D2421]/45"><LockKeyhole size={12} /> {partyInvitationT(state.invitationLocale, 'noAccount')}</div>
        </motion.div>}
        {displayedRsvp === 'declined' && <motion.div key="declined" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="suite-card mx-auto max-w-xl p-8 text-center sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#D4AF37] text-[#D4AF37]"><Heart size={22} strokeWidth={1.4} /></div>
          <h2 className="mt-5 font-display text-4xl text-[#0A2E23]">{partyInvitationT(state.invitationLocale, 'missedTitle')}</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-[#2D2421]/70">{partyInvitationT(state.invitationLocale, 'missedBody')}</p>
          {!publicReadOnly && <button onClick={() => setRsvp('pending')} data-testid="button-change-rsvp" className="focus-ring mt-7 min-h-11 text-[10px] font-bold uppercase tracking-[.18em] text-[#A98219] underline underline-offset-4">{partyInvitationT(state.invitationLocale, 'changeResponse')}</button>}
        </motion.div>}
        {displayedRsvp === 'accepted' && <motion.div key="accepted" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl">
          <SuiteCard className="p-7 sm:p-10">
            <div className="flex items-start justify-between gap-5"><div><Eyebrow>{partyInvitationT(state.invitationLocale, 'onList')}</Eyebrow><h2 className="mt-2 font-display text-4xl text-[#0A2E23]">{partyInvitationT(state.invitationLocale, 'acceptedTitle')}</h2><p className="mt-1 text-sm text-[#2D2421]/65">{partyInvitationT(state.invitationLocale, 'acceptedBody')}</p></div><CheckCircle2 className="shrink-0 text-[#0A2E23]" size={28} strokeWidth={1.4} /></div>
            <div className="mt-7 flex items-center gap-3 border-t border-[#D4AF37]/35 pt-5"><InitialsAvatar /><div className="min-w-0"><p className="break-words font-semibold text-[#0A2E23]" data-testid="text-guest-name">{state.weddingGuest.name}</p><p className="break-all text-[11px] uppercase tracking-[.12em] text-[#2D2421]/55">{partyGuestCount} {partyInvitationT(state.invitationLocale, 'guest')} · {partyInvitationT(state.invitationLocale, 'token')} {token ?? 'demo'}</p></div><span className="ms-auto shrink-0 rounded-full bg-[#0A2E23]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#0A2E23]">{partyInvitationT(state.invitationLocale, 'confirmed')}</span></div>
            {!publicReadOnly && <button onClick={() => setRsvp('pending')} data-testid="button-change-rsvp" className="focus-ring mt-7 min-h-11 text-[10px] font-bold uppercase tracking-[.18em] text-[#A98219] underline underline-offset-4">{partyInvitationT(state.invitationLocale, 'changeResponse')}</button>}
          </SuiteCard>
          <div className="my-16 text-center"><Eyebrow>{partyInvitationT(state.invitationLocale, 'details')}</Eyebrow><p className="mt-3 font-display text-3xl text-[#0A2E23]">{partyInvitationT(state.invitationLocale, 'detailsTitle')}</p></div>
          {visibleBlocks.map((block, index) => <GuestBlock key={block.key} block={block} index={index} openFaq={openFaq} setOpenFaq={setOpenFaq} song={state.song} setSong={preview ? () => undefined : setSong} meal={state.meal} setMeal={preview ? () => undefined : setMeal} />)}
          <SuiteCard className="mt-14 p-8 text-center sm:p-12">
            <Eyebrow>{partyInvitationT(state.invitationLocale, 'digitalPass')}</Eyebrow><h2 className="mt-3 font-display text-4xl text-[#0A2E23]">{partyInvitationT(state.invitationLocale, 'passTitle')}</h2><p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-[#2D2421]/65">{partyInvitationT(state.invitationLocale, 'passBody')}</p><div className="mx-auto mt-7 w-fit"><QRMark label={partyInvitationT(state.invitationLocale, 'digitalPass')} /></div><p className="mt-4 break-all font-mono text-[10px] tracking-[.12em] text-[#2D2421]/50"><bdi>{partyEvent.title} · {state.weddingGuest.passId}</bdi></p>
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
    {block.key === 'dress' && <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><p className="mt-3 max-w-md text-sm leading-7 text-[#2D2421]/65">{c.note}</p></div><div className="flex -space-x-2" aria-label={partyInvitationT(state.invitationLocale, 'suggestedColors')}><span className="h-10 w-10 rounded-full border-2 border-[#EADBC8] bg-[#6D3F35]" /><span className="h-10 w-10 rounded-full border-2 border-[#EADBC8] bg-[#C48B63]" /><span className="h-10 w-10 rounded-full border-2 border-[#EADBC8] bg-[#34594B]" /></div></div>}
    {block.key === 'schedule' && <><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><div className="mt-7 space-y-0">{[['17:30', 'arrival'], ['18:15', 'ceremony'], ['19:00', 'dinner'], ['21:30', 'dancing']].map(([time, key]) => <div key={time} className="flex gap-5 border-s border-[#D4AF37] py-3 ps-5"><span className="w-20 shrink-0 font-mono text-[10px] font-bold text-[#A98219]" dir="ltr">{time}</span><span className="text-sm text-[#2D2421]/75">{partyInvitationT(state.invitationLocale, key as PartyInvitationKey)}</span></div>)}</div></>}
    {block.key === 'registry' && <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#2D2421]/65">{partyInvitationT(state.invitationLocale, 'registryBody')}</p></div><Button variant="ivory" icon={ExternalLink} onClick={() => window.open('https://example.com', '_blank')}>{partyInvitationT(state.invitationLocale, 'viewRegistry')}</Button></div>}
    {block.key === 'song' && <><h2 className="break-words font-display text-4xl text-[#0A2E23]">{c.heading}</h2><p className="mt-2 text-sm text-[#2D2421]/65">{partyInvitationT(state.invitationLocale, 'songHelp')}</p><div className="mt-6 flex flex-col gap-3 sm:flex-row"><input value={song} onChange={(e) => setSong(e.target.value)} data-testid="input-song-request" aria-label={partyInvitationT(state.invitationLocale, 'songPlaceholder')} placeholder={partyInvitationT(state.invitationLocale, 'songPlaceholder')} className="focus-ring min-h-11 min-w-0 flex-1 rounded-full border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-5 py-3 text-sm outline-none placeholder:text-[#2D2421]/35" /><Button variant="dark" icon={Music2} onClick={() => setSong(song)}>{partyInvitationT(state.invitationLocale, 'saveSong')}</Button></div></>}
    {block.key === 'faq' && <><h2 className="break-words font-display text-4xl text-[#0A2E23]">{c.heading}</h2><div className="mt-5">{c.questions?.map((item, qIndex) => <div key={item.q} className="border-b border-[#D4AF37]/35"><button onClick={() => setOpenFaq(openFaq === qIndex ? null : qIndex)} data-testid={`button-faq-${qIndex}`} aria-expanded={openFaq === qIndex} className="focus-ring flex w-full items-center justify-between gap-3 py-4 text-start text-sm font-semibold text-[#2D2421]"><span className="break-words">{item.q}</span><ChevronDown aria-hidden="true" size={16} className={`shrink-0 text-[#A98219] transition-transform ${openFaq === qIndex ? 'rotate-180' : ''}`} /></button><AnimatePresence initial={false}>{openFaq === qIndex && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pb-4 text-sm leading-6 text-[#2D2421]/65">{item.a}</motion.p>}</AnimatePresence></div>)}</div></>}
  </SuiteCard>;
}

function LoadingPage() {
  const { t } = useAppLocale();
  return <div className="min-h-[100dvh] bg-[#FAF7F2] p-6" role="status" aria-live="polite"><span className="sr-only">{t('loading')}</span><div className="mx-auto mt-20 max-w-xl space-y-4" aria-hidden="true"><div className="h-5 w-24 animate-pulse rounded-full bg-[#EADBC8]" /><div className="h-44 animate-pulse rounded-[28px] bg-[#EADBC8]" /><div className="h-24 animate-pulse rounded-[28px] bg-[#EADBC8]" /></div></div>;
}
function TokenError() {
  const { t } = useAppLocale();
  return <div className="grain flex min-h-[100dvh] items-center justify-center bg-[#FAF7F2] p-6 text-center"><div className="gold-thread" /><SuiteCard className="relative z-10 max-w-md p-10"><XCircle className="mx-auto text-[#A98219]" size={34} strokeWidth={1.3} /><h1 className="mt-5 font-display text-4xl text-[#0A2E23]">{t('invalidInvitationTitle')}</h1><p className="mt-3 text-sm leading-6 text-[#2D2421]/65">{t('invalidInvitationHelp')}</p><Link href="/i/demo" data-testid="link-demo-invitation" className="focus-ring mt-6 inline-flex rounded-full bg-[#0A2E23] px-5 py-3 text-[11px] font-bold uppercase tracking-[.12em] text-[#FFFDF9]">{t('openDemoInvitation')}</Link></SuiteCard></div>;
}

function NotFoundPage() {
  const { t } = useAppLocale();
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[#F5F2EC] p-6 text-center"><div className="max-w-md"><XCircle className="mx-auto text-[#A4813C]" /><h1 className="mt-5 text-4xl font-semibold">{t('notFoundTitle')}</h1><p className="mt-3 text-sm leading-6 text-[#756F66]">{t('notFoundHelp')}</p><Link href="/" className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-full bg-[#0C2D24] px-5 text-xs font-semibold text-white">{t('backToProjects')}</Link></div></div>;
}

function AppErrorFallback({ resetError }: ErrorFallbackProps) {
  const { t } = useAppLocale();
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[#F5F2EC] p-6 text-center"><div className="max-w-md"><XCircle className="mx-auto text-[#A4813C]" /><h1 className="mt-5 text-4xl font-semibold">{t('appErrorTitle')}</h1><p className="mt-3 text-sm leading-6 text-[#756F66]">{t('appErrorHelp')}</p><button type="button" onClick={resetError} className="focus-ring mt-6 min-h-11 rounded-full bg-[#0C2D24] px-5 text-xs font-semibold text-white">{t(isPublicInvitationRoute(window.location.pathname) ? 'tryAgain' : 'retry')}</button></div></div>;
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
  const auth = useAuth();
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
      {!embedded && <QuietHeader studio anonymous={!auth.session && 'party'} />}
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
              <Link href={auth.session ? '/studio' : '/design/wedding'} data-testid="link-switch-studio" className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#D4AF37]/70 px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#0A2E23] hover:bg-[#D4AF37]/10">
                <ArrowLeft size={13} /> {t('switchType')}
              </Link>
              <Link href={auth.session ? '/' : '/auth'} onClick={() => { if (!auth.session) requestAnonymousDesignTransfer('party'); }} data-testid="link-preview-invitation" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D4AF37]/70 px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#0A2E23]">
                <ExternalLink size={14} /> {t('preview')}
              </Link>
              {auth.session && <Link href={buildProjectRoute('party', partyProject.id, 'scanner')} data-testid="link-open-scanner" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0A2E23] px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#FFFDF9]">
                <QrCode size={14} /> {t('doorScanner')}
              </Link>}
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
  const { activeProject, updateActiveEvent, saveStatus, storageError } = useWeddingWorkspace();
  const auth = useAuth();
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
      {!embedded && <QuietHeader studio anonymous={!auth.session && 'wedding'} />}
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
              {auth.session && <Link href="/studio" data-testid="link-switch-studio" className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/70 px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#0A2E23] hover:bg-[#D4AF37]/10">
                <ArrowLeft size={13} /> {t('switchType')}
              </Link>}
              <Link href={auth.session ? "/" : "/auth"} onClick={() => { if (!auth.session) requestAnonymousDesignTransfer('wedding'); }} data-testid="link-preview-invitation" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D4AF37]/70 px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#0A2E23]">
                <ExternalLink size={14} /> {t('preview')}
              </Link>
              {auth.session && <Link href="/scanner" data-testid="link-open-scanner" className="focus-ring inline-flex items-center gap-2 rounded-full bg-[#0A2E23] px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#FFFDF9]">
                <QrCode size={14} /> {t('doorScanner')}
              </Link>}
            </div>
          </div>
        </FadeIn>

        <div className="my-5 text-xs text-[#2D2421]/60" role="status">{t(saveStatus === 'saving' ? 'saving' : saveStatus === 'error' ? 'saveError' : 'saved')}</div>
        {storageError && <p className="mb-5 rounded-xl bg-[#b4534b]/10 px-3 py-2 text-xs text-[#8c302b]" role="alert">{storageError}</p>}
        <WeddingStudio
          event={activeProject.event}
          guest={state.weddingGuest}
          rsvpStatus={state.rsvp}
          rsvpResponse={state.weddingResponse}
          onChange={updateActiveEvent}
        />
        {!embedded && auth.session && <div className="mt-8"><GuestManager /></div>}
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

function GuestManager({ project }: { project?: ProjectSummary } = {}) {
  const { t } = useAppLocale();
  const { state, storageAvailable } = useEngine();
  const auth = useAuth();
  const { activeProject } = useWeddingWorkspace();
  const context = project ?? (state.mode === 'wedding' ? weddingProjectSummary(activeProject) : partyProjectSummary(state.partyEvent));
  const [backendGuests, setBackendGuests] = useState<EventGuest[]>([]);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [companions, setCompanions] = useState(0);
  const [tagNames, setTagNames] = useState<Record<string, string>>({});
  const refreshGuests = () => auth.session ? listGuests(context.id).then(setBackendGuests) : Promise.resolve();
  useEffect(() => { void refreshGuests(); }, [auth.session, context.id]);
  const guests = auth.session ? backendGuests.map((guest) => ({ id: guest.id, name: guest.name, phone: guest.phone ?? '', token: tokens[guest.id] ?? '', allowedCompanions: guest.allowed_companions, invitationVariantOverride: guest.invitation_variant_override ?? undefined, rsvp: guest.rsvp_status, guestCount: guest.confirmed_party_size, message: guest.custom_message ?? '', checkedIn: false, openCount: guest.personal_invitations?.[0]?.open_count ?? 0 })) : guestsForProject(state.operations, projectKey(context.type, context.id)).map((guest) => ({ ...guest, openCount: 0 }));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RSVPStatus | 'all' | 'not-opened' | 'opened-no-rsvp'>('all');
  const [copied, setCopied] = useState('');
  const visibleGuests = guests.filter((guest) => (filter === 'all' || guest.rsvp === filter || (filter === 'not-opened' && guest.openCount === 0) || (filter === 'opened-no-rsvp' && guest.openCount > 0 && guest.rsvp === 'pending')) && `${guest.name} ${guest.phone} ${guest.token}`.toLowerCase().includes(query.trim().toLowerCase()));
  const guestUrl = (token: string) => invitationUrl(window.location.origin, import.meta.env.BASE_URL, token);
  const sendWhatsApp = (guest: (typeof guests)[number]) => window.open(getWhatsAppShareUrl(context.type === 'wedding' ? 'wedding' : 'standard', context.name, guest.phone, guestUrl(guest.token)), '_blank', 'noopener,noreferrer');
  const copyInvitation = async (guest: (typeof guests)[number]) => {
    const token = guest.token || await rotatePersonalInvitation(guest.id);
    setTokens((current) => ({ ...current, [guest.id]: token }));
    await navigator.clipboard.writeText(guestUrl(token));
    setCopied(guest.id);
  };
  const exportGuests = () => {
    const url = URL.createObjectURL(new Blob([guestsCsv(guests)], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'quickrsvp-guest-list.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  return <div className="suite-card overflow-hidden p-6 sm:p-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Eyebrow>{t('guestList')} / {String(guests.length).padStart(2, '0')}</Eyebrow><h2 className="mt-2 break-words font-display text-4xl text-[#0A2E23]">{t('guestListTitle')}</h2><p className="mt-2 text-xs text-[#2D2421]/55">{storageAvailable ? t('localGuestData') : t('sessionOnlyData')}</p></div><Button variant="ivory" icon={ArrowDownToLine} onClick={exportGuests}>{t('catererExport')}</Button></div>
    {auth.session && <div className="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_100px_auto]"><input value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder={t('guest')} className="min-h-11 rounded-xl border px-3" /><input value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} placeholder={t('missingPhone')} className="min-h-11 rounded-xl border px-3" /><input type="number" min="0" max="50" value={companions} onChange={(event) => setCompanions(Number(event.target.value))} className="min-h-11 rounded-xl border px-3" /><Button disabled={!guestName.trim()} onClick={() => void createGuest(context.id, guestName, guestPhone, companions).then((result) => { setTokens((current) => ({ ...current, [result.guest.id]: result.token })); setGuestName(''); setGuestPhone(''); setCompanions(0); return refreshGuests(); })}>{t('createEvent')}</Button></div>}
    <div className="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]"><label className="sr-only" htmlFor="guest-search">{t('searchGuests')}</label><input id="guest-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('searchGuests')} className="focus-ring min-h-11 rounded-xl border border-[#D4AF37]/45 bg-[#FFFDF9] px-4 text-sm" /><label className="sr-only" htmlFor="guest-response-filter">{t('response')}</label><select id="guest-response-filter" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="focus-ring min-h-11 rounded-xl border border-[#D4AF37]/45 bg-[#FFFDF9] px-4 text-sm"><option value="all">{t('allResponses')}</option><option value="not-opened">Not opened</option><option value="opened-no-rsvp">Opened — No RSVP</option><option value="pending">{t('pending')}</option><option value="accepted">{t('accepted')}</option><option value="declined">{t('declined')}</option></select></div>
    {visibleGuests.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-[#D4AF37]/45 p-8 text-center text-sm text-[#2D2421]/55">{t('noGuests')}</div> : <div className="mt-6 grid gap-3">{visibleGuests.map((guest) => {
      const responseClass = guest.rsvp === 'accepted' ? 'bg-[#0A2E23]/10 text-[#0A2E23]' : 'bg-[#D4AF37]/15 text-[#8A6712]';
      return <article key={guest.id} className="rounded-2xl border border-[#D4AF37]/35 bg-[#FFFDF9]/45 p-4"><div className="flex flex-wrap items-center gap-3"><InitialsAvatar /><div className="min-w-0 flex-1">{auth.session ? <input defaultValue={guest.name} onBlur={(event) => { if (event.target.value.trim() && event.target.value !== guest.name) void updateGuest(guest.id, { name: event.target.value.trim() }).then(refreshGuests); }} className="min-h-9 w-full rounded-lg border px-2 text-sm font-semibold text-[#0A2E23]" /> : <p className="break-words text-sm font-semibold text-[#0A2E23]">{guest.name}</p>}<p className="break-all text-[10px] text-[#2D2421]/50"><bdi>{guest.phone || t('missingPhone')} · {guest.openCount > 0 && guest.rsvp === 'pending' ? 'Opened — No RSVP' : guest.openCount > 0 ? `Opened ${guest.openCount}` : 'Not opened'}</bdi></p></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${responseClass}`}>{t(guest.rsvp)}</span></div><div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#D4AF37]/25 pt-4"><p className="me-auto text-xs text-[#2D2421]/65">{guest.guestCount || 1} {t('guest')} · +{guest.allowedCompanions}</p>{auth.session && <input type="number" min="0" max="50" defaultValue={guest.allowedCompanions} onBlur={(event) => { const value = Number(event.target.value); if (value !== guest.allowedCompanions) void updateGuest(guest.id, { allowed_companions: value }).then(refreshGuests); }} className="min-h-10 w-16 rounded-xl border px-2 text-xs" />}<button onClick={() => void copyInvitation(guest)} className="focus-ring min-h-11 rounded-full border border-[#D4AF37]/60 px-3 text-[10px] font-bold uppercase text-[#0A2E23]">{copied === guest.id ? t('linkCopied') : t('copyLink')}</button>{auth.session && <><input value={tagNames[guest.id] ?? ''} onChange={(event) => setTagNames({ ...tagNames, [guest.id]: event.target.value })} placeholder="Tag" className="min-h-10 w-24 rounded-xl border px-2 text-xs" /><button disabled={!tagNames[guest.id]?.trim()} onClick={() => void tagGuest(context.id, guest.id, tagNames[guest.id]).then(() => setTagNames({ ...tagNames, [guest.id]: '' }))} className="min-h-10 rounded-full border px-3 text-xs">Tag</button></>}{guest.message && <span className="text-xs text-[#2D2421]/65">{guest.message}</span>}</div></article>;
    })}</div>}
  </div>;
}

function SendPage({ project }: { project: ProjectSummary }) {
  const { state } = useEngine();
  const auth = useAuth();
  const { t } = useAppLocale();
  const [backendGuests, setBackendGuests] = useState<EventGuest[]>([]);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  useEffect(() => { if (auth.session) void listGuests(project.id).then(setBackendGuests); }, [auth.session, project.id]);
  const guests = auth.session ? backendGuests.map((guest) => ({ id: guest.id, name: guest.name, phone: guest.phone ?? '', token: tokens[guest.id] ?? '', allowedCompanions: guest.allowed_companions, invitationVariantOverride: guest.invitation_variant_override ?? undefined, rsvp: guest.rsvp_status, guestCount: guest.confirmed_party_size, message: guest.custom_message ?? '', checkedIn: false })) : guestsForProject(state.operations, projectKey(project.type, project.id));
  const [selectedId, setSelectedId] = useState(guests[0]?.id ?? '');
  const [status, setStatus] = useState('');
  const guest = guests.find((item) => item.id === selectedId) ?? guests[0];
  const ensureUrl = async () => { if (!guest) return ''; const token = guest.token || await rotatePersonalInvitation(guest.id); setTokens((current) => ({ ...current, [guest.id]: token })); return invitationUrl(window.location.origin, import.meta.env.BASE_URL, token); };
  const copy = async () => { const url = await ensureUrl(); if (!url) return; await navigator.clipboard.writeText(url); setStatus(t('linkCopied')); };
  const openInvitation = async () => { const url = await ensureUrl(); if (!url) return; if (!window.open(url, '_blank', 'noopener,noreferrer')) window.location.assign(url); setStatus(t('invitationOpened')); };
  const openWhatsApp = async () => { const url = await ensureUrl(); if (!guest || !url) return; window.open(getWhatsAppShareUrl(project.type === 'wedding' ? 'wedding' : 'standard', project.name, guest.phone, url), '_blank', 'noopener,noreferrer'); setStatus(t('whatsappOpened')); };
  const copyGeneral = async () => { const token = await createGeneralInvitation(project.id); await navigator.clipboard.writeText(invitationUrl(window.location.origin, import.meta.env.BASE_URL, token)); setStatus(t('linkCopied')); };
  const openGeneral = async () => { const token = await createGeneralInvitation(project.id); const url = invitationUrl(window.location.origin, import.meta.env.BASE_URL, token); if (!window.open(url, '_blank', 'noopener,noreferrer')) window.location.assign(url); };
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"><section className="rounded-3xl border border-[#D9D2C5] bg-white p-6 sm:p-8"><Eyebrow>{t('send')}</Eyebrow><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">{t('sendTitle')}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#756F66]">{t('sendLocalHelp')}</p>{guests.length ? <div className="mt-7"><label className="text-xs font-semibold" htmlFor="send-recipient">{t('recipient')}</label><select id="send-recipient" value={guest?.id} onChange={(event) => { setSelectedId(event.target.value); setStatus(''); }} className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-[#D9D2C5] px-4">{guests.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.phone || t('missingPhone')}</option>)}</select><div className="mt-5 flex flex-wrap gap-2"><Button onClick={() => void copy()}>{t('copyLink')}</Button><Button variant="ivory" icon={ExternalLink} onClick={() => void openInvitation()}>{t('openInvitation')}</Button><Button variant="ivory" icon={MessageCircle} onClick={() => void openWhatsApp()}>{t('prepareWhatsApp')}</Button><Button variant="ivory" icon={Link2} onClick={() => void copyGeneral()}>General link</Button><Button variant="ivory" icon={ExternalLink} onClick={() => void openGeneral()}>{t('openGeneralInvitation')}</Button></div>{status && <p className="mt-4 text-xs font-semibold text-[#0A2E23]" role="status">{status}</p>}</div> : <div className="mt-7"><p className="rounded-2xl border border-dashed border-[#D9D2C5] p-6 text-sm text-[#756F66]">{t('noGuests')}</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="ivory" icon={Link2} onClick={() => void copyGeneral()}>General link</Button><Button variant="ivory" icon={ExternalLink} onClick={() => void openGeneral()}>{t('openGeneralInvitation')}</Button></div></div>}</section><aside className="rounded-3xl border border-[#D9D2C5] bg-[#0C2D24] p-6 text-white"><QrCode className="text-[#D4B363]" /><h2 className="mt-5 text-xl font-semibold">{t('preparedNotDelivered')}</h2><p className="mt-3 text-sm leading-6 text-white/60">{t('sendBoundary')}</p><Link href={buildProjectRoute(project.type, project.id, 'invitation')} className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 text-xs font-semibold">{t('preview')}</Link></aside></div>;
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

function backendProjectSummary(event: BackendEvent): ProjectSummary & { lifecycleStatus: string } {
  return { id: event.id, type: event.product_id, name: event.title, date: event.starts_at ?? '', venue: [event.venue_name, event.city].filter(Boolean).join(', '), lifecycleStatus: event.lifecycle_status };
}

function DashboardRoute() {
  const auth = useAuth();
  const [, navigate] = useLocation();
  const [drafts, setDrafts] = useState<DesignDraft<Record<string, unknown>>[]>([]);
  const loadDrafts = () => Promise.all([listDesignDrafts<Record<string, unknown>>('wedding'), listDesignDrafts<Record<string, unknown>>('party')]).then(([wedding, party]) => setDrafts([...wedding, ...party]));
  useEffect(() => { void loadDrafts().catch(() => setDrafts([])); }, []);
  return <DashboardPage
    projects={auth.events.filter((event) => !event.deleted_at).map(backendProjectSummary)}
    drafts={drafts.map((draft) => ({ id: draft.id, type: draft.product_id, name: draft.title, updatedAt: draft.updated_at }))}
    account={{
      name: auth.client?.display_name ?? '',
      email: auth.session?.user.email ?? '',
      admin: auth.admin,
      eventCount: auth.events.length,
      access: Object.fromEntries(auth.entitlements.map((item) => [item.product_id, item.status])),
    }}
    onSignOut={() => void auth.signOut()}
    onCreate={async (type, title) => {
      const configuration = type === 'wedding'
        ? structuredClone(defaultWeddingEvent) as WeddingEventData & Record<string, unknown>
        : { ...structuredClone(defaultPartyEvent), blocks: structuredClone(initialBlocks), invitationLocale: 'ar' };
      const draft = await createDesignDraft(type, title, configuration);
      navigate(`/drafts/${type}/${draft.id}`);
    }}
    onRename={async (id, title) => { await updateEvent(id, { title }); await auth.refresh(); }}
    onArchive={async (id) => { await updateEvent(id, { lifecycle_status: 'archived' }); await auth.refresh(); }}
    onDelete={async (id) => { await updateEvent(id, { deleted_at: new Date().toISOString() }); await auth.refresh(); }}
    onDeleteDraft={async (id) => { await deleteDesignDraft(id); await loadDrafts(); }}
  />;
}

function DraftRoutePage() {
  const { type: rawType, draftId } = useParams<{ type: string; draftId: string }>();
  const type = rawType === 'wedding' || rawType === 'party' ? rawType : null;
  const auth = useAuth();
  const workspace = useWeddingWorkspace();
  const { openPartyDraft, savePartyDraft } = useEngine();
  const { t } = useAppLocale();
  const [, navigate] = useLocation();
  const [draft, setDraft] = useState<DesignDraft<Record<string, unknown>> | null>(null);
  const [access, setAccess] = useState<DesignDraftPublishAccess | null>(null);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const openedRef = useRef('');

  useEffect(() => {
    if (!type || !draftId) return;
    let live = true;
    Promise.all([listDesignDrafts<Record<string, unknown>>(type), getDesignDraftPublishAccess(draftId)])
      .then(async ([items, authority]) => {
        const found = items.find((item) => item.id === draftId);
        if (!found) throw new Error('Design Draft not found.');
        if (type === 'wedding') await workspace.openDraft(draftId);
        else if (openedRef.current !== draftId) { openedRef.current = draftId; openPartyDraft(found); }
        if (live) { setDraft(found); setAccess(authority); }
      })
      .catch((caught) => { if (live) setError(caught instanceof Error ? caught.message : t('operationFailed')); });
    return () => { live = false; };
  }, [draftId, type]);

  if (!type) return <NotFoundPage />;
  if (error) return <main className="min-h-[100dvh] bg-[#F5F2EC] p-5"><div className="mx-auto max-w-xl rounded-3xl bg-white p-7 text-[#8c302b]" role="alert">{error}</div></main>;
  if (!draft) return <LoadingPage />;
  const allowed = access?.allowed ?? access?.can_publish;
  const authorityMessage = String(access?.reason ?? access?.code ?? access?.status ?? (allowed === true ? t('publishAvailable') : t('publicationUnavailable')));
  const publish = async () => {
    setPublishing(true); setError('');
    try {
      if (type === 'wedding') await workspace.saveNow();
      else await savePartyDraft();
      const event = await publishDesignDraft(draft.id);
      await auth.refresh();
      navigate(buildProjectRoute(type, event.id, 'overview'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('operationFailed'));
    } finally { setPublishing(false); }
  };
  return <div className="min-h-[100dvh] bg-[#F5F2EC] text-[#17251F]"><header className="sticky top-0 z-40 border-b border-[#D9D2C5] bg-[#FAF8F4]/95 px-5 py-4 backdrop-blur"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#8B7040]">{t(type)} · {t('draft')}</p><h1 className="text-lg font-semibold">{draft.title}</h1></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-2 text-xs ${allowed === false ? 'bg-[#8c302b]/10 text-[#8c302b]' : 'bg-[#0C2D24]/10 text-[#0C2D24]'}`}>{authorityMessage}</span><button disabled={publishing || !access || allowed === false} onClick={() => void publish()} className="min-h-11 rounded-full bg-[#0C2D24] px-5 text-xs font-semibold text-white disabled:opacity-40">{publishing ? t('publishing') : t('publish')}</button><Link href="/" className="min-h-11 rounded-full border border-[#D9D2C5] px-5 py-3 text-xs font-semibold">{t('projects')}</Link></div></div></header>{error && <p className="mx-auto mt-4 max-w-7xl rounded-2xl bg-[#8c302b]/10 p-4 text-sm text-[#8c302b]" role="alert">{error}</p>}<main className="mx-auto max-w-7xl p-4 sm:p-7">{type === 'wedding' ? <WeddingStudioPage embedded /> : <PartyStudioPage embedded />}</main></div>;
}

function ProjectRoutePage({ type }: { type: ProjectType }) {
  const { eventId, section: rawSection } = useParams<{ eventId: string; section: string }>();
  const { state, ready, setMode, storageAvailable, activePartyEventId, openPartyEvent } = useEngine();
  const auth = useAuth();
  const workspace = useWeddingWorkspace();
  const { t } = useAppLocale();
  const backendEvent = findAuthenticatedProjectEvent(auth.events, type, eventId);
  const weddingProject = type === 'wedding' ? workspace.projects.find((item) => item.id === eventId) : undefined;
  const project = type === 'wedding'
    ? weddingProject && weddingProjectSummary(weddingProject)
    : backendEvent
      ? { ...backendProjectSummary(backendEvent), name: activePartyEventId === eventId ? state.partyEvent.title : backendEvent.title }
      : undefined;
  const section = resolveProjectSection(type, rawSection);

  useEffect(() => {
    if (!ready || !project) return;
    const mode = type === 'wedding' ? 'wedding' : 'standard';
    if (state.mode !== mode) setMode(mode);
    if (weddingProject && workspace.activeProject.id !== weddingProject.id) void workspace.openProject(weddingProject.id).catch(() => undefined);
    if (type === 'party' && eventId !== activePartyEventId) openPartyEvent(eventId);
  }, [activePartyEventId, eventId, openPartyEvent, project, ready, setMode, state.mode, type, weddingProject, workspace]);

  if (!ready || (auth.dataLoading && !backendEvent)) return <LoadingPage />;
  if (!project) return <NotFoundPage />;
  if ((weddingProject && workspace.activeProject.id !== weddingProject.id) || (type === 'party' && activePartyEventId !== eventId)) return <LoadingPage />;

  let content: ReactNode;
  const deadline = type === 'wedding' ? weddingProject?.event.rsvpDeadline ?? '' : state.partyEvent.rsvpDeadline;
  if (section === 'overview') content = <EventOperationsOverview project={project} rsvpDeadline={deadline} />;
  else if (section === 'invitation') content = type === 'wedding' ? <WeddingStudioPage embedded /> : <PartyStudioPage embedded />;
  else if (section === 'guests') content = <BackendGuestManager project={project} />;
  else if (section === 'scanner') content = <BackendScanner project={project} />;
  else if (section === 'send') content = <SendPage project={project} />;
  else content = <div className="space-y-4"><EmptyProjectSection title={t('settingsTitle')}>{t('settingsHelp')}</EmptyProjectSection>{backendEvent && <EventLifecycleControl event={backendEvent} onSave={async (lifecycle_status) => { await updateEvent(backendEvent.id, { lifecycle_status }); await auth.refresh(); }} />}<section className="mx-auto max-w-2xl rounded-3xl border border-[#D9D2C5] bg-white p-7"><h2 className="font-semibold">{t('appLanguage')}</h2><p className="mt-2 text-sm text-[#756F66]">{t('appLanguageHelp')}</p><div className="mt-4"><AppLanguageControl /></div></section></div>;

  return <ProjectShell project={project} section={section}>{!storageAvailable && <p className="mb-4 rounded-2xl border border-[#A98219]/35 bg-[#FFF8E5] p-4 text-sm text-[#6B5518]" role="status">{t('sessionOnlyData')}</p>}{content}</ProjectShell>;
}

function EventLifecycleControl({ event, onSave }: { event: BackendEvent; onSave: (status: EventLifecycle) => Promise<void> }) {
  const { t } = useAppLocale();
  const [status, setStatus] = useState(event.lifecycle_status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const labels = { planning: 'lifecyclePlanning', active: 'lifecycleActive', ended: 'lifecycleEnded', archived: 'lifecycleArchived', cancelled: 'lifecycleCancelled' } as const;
  return <section className="mx-auto max-w-2xl rounded-3xl border border-[#D9D2C5] bg-white p-7"><h2 className="font-semibold">{t('eventStatus')}</h2><div className="mt-4 flex flex-col gap-3 sm:flex-row"><select aria-label={t('eventStatus')} value={status} onChange={(change) => setStatus(change.target.value as EventLifecycle)} className="min-h-11 flex-1 rounded-xl border border-[#D9D2C5] px-3">{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select><button disabled={busy || status === event.lifecycle_status} onClick={() => { setBusy(true); setError(false); void onSave(status).catch(() => setError(true)).finally(() => setBusy(false)); }} className="min-h-11 rounded-xl bg-[#0C2D24] px-5 text-xs font-bold text-white disabled:opacity-40">{t('saveChanges')}</button></div>{error && <p className="mt-3 text-sm text-[#8c302b]" role="alert">{t('operationFailed')}</p>}</section>;
}

function WeddingProjectRoute() { return <ProjectRoutePage type="wedding" />; }
function PartyProjectRoute() { return <ProjectRoutePage type="party" />; }
function GuestRoute() { return <GuestPage />; }

const emptyAdminSnapshot: AdminSnapshot = { clients: [], entitlements: [], events: [], guests: [], templates: [], assets: [], activity: [] };

function AdminRoute() {
  const { section } = useParams<{ section?: string }>();
  const { t } = useAppLocale();
  const [snapshot, setSnapshot] = useState<AdminSnapshot>(emptyAdminSnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = async () => { setLoading(true); setError(''); try { setSnapshot(await loadAdminSnapshot()); } catch { setError(t('operationFailed')); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, []);
  const entitlement = async (clientId: string, productId: ProductId, status: EntitlementStatus, endsAt: string | null) => { await setAdminEntitlement(clientId, productId, status, endsAt); await refresh(); };
  const template = async (id: string, active: boolean) => { await setTemplateActive(id, active); await refresh(); };
  return <AdminPage section={resolveAdminSection(section)} snapshot={snapshot} loading={loading} error={error} onRefresh={refresh} onEntitlement={entitlement} onTemplate={template} />;
}

function LegacyRedirect({ path }: { path: '/studio/wedding' | '/studio/party' | '/scanner' }) {
  const { activeProject } = useWeddingWorkspace();
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(legacyProjectRoute(path, activeProject.id), { replace: true }); }, [activeProject.id, path, setLocation]);
  return <LoadingPage />;
}

function NotFound() {
  return <NotFoundPage />;
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, left: 0 }); }, [location]);
  return null;
}

function Router() {
  return (
    <ErrorBoundary resetKey={window.location.pathname} FallbackComponent={AppErrorFallback}>
      <ScrollToTop />
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/design/wedding">{() => <WeddingStudioPage />}</Route>
        <Route path="/design/party">{() => <PartyStudioPage />}</Route>
        <Route path="/i/:token" component={GuestRoute} />
        <Route path="/">{() => <RequireAuth><DashboardRoute /></RequireAuth>}</Route>
        <Route path="/drafts/:type/:draftId">{() => <RequireAuth><DraftRoutePage /></RequireAuth>}</Route>
        <Route path="/weddings/:eventId/:section">{() => <RequireAuth><WeddingProjectRoute /></RequireAuth>}</Route>
        <Route path="/parties/:eventId/:section">{() => <RequireAuth><PartyProjectRoute /></RequireAuth>}</Route>
        <Route path="/admin/:section">{() => <RequireAuth admin><AdminRoute /></RequireAuth>}</Route>
        <Route path="/admin">{() => <RequireAuth admin><AdminRoute /></RequireAuth>}</Route>
        <Route path="/studio/party">{() => <RequireAuth><LegacyRedirect path="/studio/party" /></RequireAuth>}</Route>
        <Route path="/studio/wedding">{() => <RequireAuth><LegacyRedirect path="/studio/wedding" /></RequireAuth>}</Route>
        <Route path="/studio">{() => <RequireAuth><StudioHubPage /></RequireAuth>}</Route>
        <Route path="/scanner">{() => <RequireAuth><LegacyRedirect path="/scanner" /></RequireAuth>}</Route>
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return <AppLocaleProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AuthProvider><WeddingWorkspaceProvider><EngineProvider><Router /></EngineProvider></WeddingWorkspaceProvider></AuthProvider></WouterRouter></AppLocaleProvider>;
}

export default App;
