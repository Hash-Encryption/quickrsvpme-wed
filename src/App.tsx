import { type ReactNode, type ComponentType, type CSSProperties, useContext, useEffect, useMemo, useRef, useState, createContext } from 'react';
import { Button as CustomerButton, ErrorState, LoadingState, PageShell } from '@/components/customer-ui';
import { ErrorBoundary, type ErrorFallbackProps } from '@/components/error-boundary';
import { AppLanguageControl, AppLocaleProvider, useAppLocale } from '@/i18n/app-locale';
import { localeDirection, type InvitationLocale } from '@/i18n/locale';
import { invitationT } from '@/i18n/invitation';
import { partyInvitationT, resolvePartyInvitationLocale, type PartyInvitationKey } from '@/i18n/party';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown, ArrowDownToLine, ArrowLeft, ArrowUp, CalendarDays, Check, CheckCircle2, ChevronDown, Copy,
  Edit3, ExternalLink, Heart, HelpCircle, Plus, Trash2,
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
import { AccountPage } from '@/app/AccountPage';
import { ChoosePlannerPage } from '@/app/ChoosePlannerPage';
import { WeddingPlannerPage } from '@/app/WeddingPlannerPage';
import { CreateWeddingPage } from '@/app/CreateWeddingPage';
import { PartyPlannerPage } from '@/app/PartyPlannerPage';
import { CreatePartyPage } from '@/app/CreatePartyPage';
import { PartyTemplateSelectionPage } from '@/app/PartyTemplateSelectionPage';
import { DashboardPage } from '@/app/DashboardPage';
import { commercialSummary, normalizePublicationPolicy, type CommercialSource } from '@/app/commercial';
import { allowedEventTransitions, isTerminalEvent } from '@/app/lifecycle';
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
import { PartyInvitationRenderer } from '@/party/PartyInvitationRenderer';
import { PartyStudio } from '@/party/PartyStudio';
import { createDesignDraft, createGeneralInvitation, createGuest, deleteDesignDraft, getDesignDraftPublishAccess, getGeneralInvitationRequestStatus, listDesignDrafts, listEventConfigs, listGuests, publishDesignDraft, recordInvitationOpen, resolveInvitation, rotatePersonalInvitation, savePartyConfig, submitGeneralInvitationRequest, submitPersonalRsvp, tagGuest, updateDesignDraft, updateGuest, type DesignDraft, type DesignDraftPublishAccess } from '@/backend/phase2';
import { updateEvent } from '@/backend/events';
import { loadCommercialSource } from '@/backend/commercial';
import { updateCurrentClientDisplayName } from '@/backend/clients';
import { loadAdminSection, retireAsset, setAdminEntitlement, setProductPolicy, setTemplateActive, type AdminSnapshot } from '@/backend/phase3';
import type { BackendEvent, EntitlementStatus, EventGuest, EventLifecycle, GeneralInvitationRequestStatus, InvitationResolution, ProductId } from '@/backend/types';
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
type BlockKey = 'catering' | 'dress' | 'schedule' | 'registry' | 'song' | 'faq' | 'text' | 'venue' | 'host' | 'cta' | 'divider' | 'spacer';
type IconType = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

type BlockContent = {
  heading: string;
  entree?: string[];
  swatches?: string[];
  questions?: { q: string; a: string }[];
  note?: string;
  url?: string;
};
type StudioBlock = { id: string; key: BlockKey; enabled: boolean; label: string; eyebrow: string; content: BlockContent };
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
  { id: 'catering', key: 'catering', enabled: true, label: 'Catering', eyebrow: 'YOUR TABLE', content: { heading: 'A seat at our table', entree: ['Rosemary chicken', 'Miso-glazed salmon', 'Garden ravioli'], swatches: ['#6D3F35', '#C48B63', '#34594B'] } },
  { id: 'dress', key: 'dress', enabled: true, label: 'Dress code', eyebrow: 'THE ATTIRE', content: { heading: 'Garden formal', note: 'A little polished, a little effortless. Suits, silk, and evening colors are encouraged.' } },
  { id: 'schedule', key: 'schedule', enabled: true, label: 'Schedule', eyebrow: 'THE EVENING', content: { heading: 'A day in full bloom' } },
  { id: 'registry', key: 'registry', enabled: true, label: 'Registry', eyebrow: 'A LITTLE SOMETHING', content: { heading: 'Your presence is enough' } },
  { id: 'song', key: 'song', enabled: true, label: 'Song request', eyebrow: 'SET THE TONE', content: { heading: 'Bring a song to the dance floor' } },
  { id: 'faq', key: 'faq', enabled: true, label: 'FAQ', eyebrow: 'GOOD TO KNOW', content: { heading: 'Before you join us', questions: [{ q: 'Can I bring a plus one?', a: 'Your invitation will note your guest count. For this invitation, we are looking forward to celebrating with you.' }, { q: 'Where should I park?', a: 'Valet parking will be available at the south entrance of The Grand Palace Hall from 5:00 PM.' }, { q: 'What time should I arrive?', a: 'Please arrive between 5:15 and 5:45 PM so we can welcome you before the ceremony.' }] } },
];

const blockKeys: BlockKey[] = ['catering', 'dress', 'schedule', 'registry', 'song', 'faq', 'text', 'venue', 'host', 'cta', 'divider', 'spacer'];
const normalizeBlocks = (value: unknown, fallback = initialBlocks): StudioBlock[] => !Array.isArray(value) ? fallback : value.flatMap((item, index) => {
  if (!item || typeof item !== 'object') return [];
  const source = item as Partial<StudioBlock>;
  if (!blockKeys.includes(source.key as BlockKey)) return [];
  return [{ id: typeof source.id === 'string' && source.id ? source.id : `${source.key}-${index}`, key: source.key as BlockKey, enabled: source.enabled !== false, label: typeof source.label === 'string' ? source.label : String(source.key), eyebrow: typeof source.eyebrow === 'string' ? source.eyebrow : '', content: source.content && typeof source.content === 'object' ? source.content : { heading: '' } }];
});

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
  toggleBlock: (id: string) => void;
  reorderBlocks: (blocks: StudioBlock[]) => void;
  updateBlock: (id: string, patch: Partial<BlockContent>) => void;
  addBlock: (key: BlockKey) => void;
  duplicateBlock: (id: string) => void;
  deleteBlock: (id: string) => void;
  setMode: (mode: EventMode) => void;
  setInvitationLocale: (locale: InvitationLocale) => void;
  updatePartyEvent: (patch: Partial<PartyEventData>) => void;
  submitWeddingRsvp: (response: WeddingRsvp) => void;
  activePartyEventId: string;
  openPartyEvent: (id: string) => void;
  openPartyDraft: (draft: DesignDraft<Record<string, unknown>>) => void;
  savePartyDraft: (overrideEvent?: PartyEventData, overrideBlocks?: StudioBlock[], overrideLocale?: InvitationLocale) => Promise<void>;
  loadPublicInvitation: (resolution: InvitationResolution, token: string, generalName?: string) => void;
  publicReadOnly: boolean;
  storageAvailable: boolean;
};
const EngineContext = createContext<EngineContextValue | null>(null);

function EngineProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [location] = useLocation();
  const partyBackendActive = location.startsWith('/parties/') || location.startsWith('/drafts/party/') || location === '/studio/party';
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
  const partyHydratedEventRef = useRef('');
  const partySaveBlockedRef = useRef(false);
  const partySavedConfigurationRef = useRef('');
  const partySavedEventMetadataRef = useRef('');
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
          blocks: normalizeBlocks(genericSaved.blocks),
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
      setState((current) => ({ ...current, partyEvent: mergePartyEvent(saved.partyEvent), blocks: normalizeBlocks(saved.blocks), invitationLocale: resolvePartyInvitationLocale(saved) }));
    } catch {
      setState((current) => ({ ...current, partyEvent: defaultPartyEvent, blocks: initialBlocks, invitationLocale: 'ar' }));
    }
  }, [auth.loading, auth.session]);
  useEffect(() => {
    if (!partyBackendActive || location.startsWith('/drafts/party/')) { partyHydratedEventRef.current = ''; return; }
    if (!auth.session || auth.loading) return;
    if (sessionStorage.getItem(anonymousDesignTransferKey) === 'party') return;
    const partyEvents = auth.events.filter((event) => event.product_id === 'party' && !event.deleted_at);
    const routeEventId = location.match(/^\/parties\/([^/]+)/)?.[1];
    const eventId = partyEvents.some((event) => event.id === routeEventId) ? routeEventId : partyEvents.some((event) => event.id === activePartyEventId) ? activePartyEventId : partyEvents[0]?.id;
    if (!eventId) return;
    if (eventId !== activePartyEventId) { setActivePartyEventId(eventId); return; }
    if (partyHydratedEventRef.current === eventId) return;
    partyHydratedEventRef.current = eventId;
    partyHydratedRef.current = false;
    partySaveBlockedRef.current = true;
    partySavedConfigurationRef.current = '';
    void listEventConfigs<Partial<PartyEventData> & { blocks?: StudioBlock[]; invitationLocale?: InvitationLocale }>('party').then((configs) => {
      const config = configs.find((item) => item.event_id === eventId);
      const event = partyEvents.find((item) => item.id === eventId)!;
      partyVersionRef.current = config?.version ?? 0;
      partyTemplateRef.current = config?.template_version_id ?? null;
      partyTemplateKeyRef.current = typeof config?.template_snapshot.templateId === 'string' ? config.template_snapshot.templateId : null;
      partySavedEventMetadataRef.current = JSON.stringify({ title: event.title, invitation_locale: event.invitation_locale, venue_name: event.venue_name, city: event.city });
      setState((current) => {
        const partyEvent = mergePartyEvent(config?.configuration ?? { title: event.title, venue: event.venue_name ?? '', city: event.city ?? '' });
        const blocks = normalizeBlocks(config?.configuration.blocks, current.blocks);
        const invitationLocale = config?.configuration.invitationLocale === 'en' ? 'en' : event.invitation_locale;
        partySavedConfigurationRef.current = JSON.stringify({ ...partyEvent, blocks, invitationLocale });
        partySaveBlockedRef.current = false;
        return { ...current, partyEvent, blocks, invitationLocale };
      });
      partyHydratedRef.current = true;
    }).catch(() => { partyHydratedEventRef.current = ''; partySaveBlockedRef.current = true; });
  }, [activePartyEventId, auth.events, auth.loading, auth.session, location, partyBackendActive]);
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
    if (!partyBackendActive || !partyHydratedRef.current || partySaveBlockedRef.current || (!activePartyEventId && !partyDraftRef.current) || !auth.session) return;
    if (partyTimerRef.current) clearTimeout(partyTimerRef.current);
    partyTimerRef.current = setTimeout(() => {
      const configuration = { ...state.partyEvent, blocks: state.blocks, invitationLocale: state.invitationLocale };
      const signature = JSON.stringify(configuration);
      const eventMetadata = { title: state.partyEvent.title, invitation_locale: state.invitationLocale, venue_name: state.partyEvent.venue || null, city: state.partyEvent.city || null };
      const eventMetadataSignature = JSON.stringify(eventMetadata);
      if (signature === partySavedConfigurationRef.current && (partyDraftRef.current || eventMetadataSignature === partySavedEventMetadataRef.current)) return;
      const existingTemplate = partyTemplateKeyRef.current === state.partyEvent.templateId ? partyTemplateRef.current : null;
      const operation = partyQueueRef.current.then(async () => {
        if (partySaveBlockedRef.current) return;
        if (partyDraftRef.current) {
          if (signature === partySavedConfigurationRef.current) return;
          partyDraftRef.current = await updateDesignDraft(partyDraftRef.current, state.partyEvent.title, configuration);
          partySavedConfigurationRef.current = signature;
          return;
        }
        if (signature !== partySavedConfigurationRef.current) {
          const saved = await savePartyConfig(activePartyEventId, configuration, partyVersionRef.current, existingTemplate);
          partyVersionRef.current = saved.version;
          partyTemplateRef.current = saved.template_version_id;
          partyTemplateKeyRef.current = state.partyEvent.templateId;
          partySavedConfigurationRef.current = signature;
        }
        if (eventMetadataSignature !== partySavedEventMetadataRef.current) {
          await updateEvent(activePartyEventId, eventMetadata);
          partySavedEventMetadataRef.current = eventMetadataSignature;
        }
      });
      partyQueueRef.current = operation.catch((caught) => {
        partySaveBlockedRef.current = true;
        if (import.meta.env.DEV) console.error('QuickRSVP Party autosave stopped after a backend conflict or failure.', caught);
      });
    }, 2000);
    return () => { if (partyTimerRef.current) clearTimeout(partyTimerRef.current); };
  }, [activePartyEventId, auth.session, partyBackendActive, state.blocks, state.invitationLocale, state.partyEvent]);
  const commitPublicRsvp = (rsvp: RSVPStatus, guestCount: number, message = '') => {
    if (!publicInvitation || rsvp === 'pending') return Promise.resolve();
    return submitPersonalRsvp(publicInvitation.token, rsvp, rsvp === 'accepted' ? guestCount : 0, message);
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
    toggleBlock: (id: string) => setState((s) => ({ ...s, blocks: s.blocks.map((b) => b.id === id ? { ...b, enabled: !b.enabled } : b) })),
    reorderBlocks: (blocks: StudioBlock[]) => setState((s) => ({ ...s, blocks })),
    updateBlock: (id: string, patch: Partial<BlockContent>) => setState((s) => ({ ...s, blocks: s.blocks.map((b) => b.id === id ? { ...b, content: { ...b.content, ...patch } } : b) })),
    addBlock: (key: BlockKey) => setState((s) => ({ ...s, blocks: [...s.blocks, { id: crypto.randomUUID(), key, enabled: true, label: key, eyebrow: '', content: { heading: '', note: '' } }] })),
    duplicateBlock: (id: string) => setState((s) => { const index = s.blocks.findIndex((block) => block.id === id); if (index < 0) return s; const blocks = [...s.blocks]; blocks.splice(index + 1, 0, { ...structuredClone(blocks[index]), id: crypto.randomUUID() }); return { ...s, blocks }; }),
    deleteBlock: (id: string) => setState((s) => ({ ...s, blocks: s.blocks.filter((block) => block.id !== id) })),
    setMode: (mode: EventMode) => setState((s) => ({ ...s, mode })),
    setInvitationLocale: (invitationLocale: InvitationLocale) => setState((s) => ({ ...s, invitationLocale })),
    updatePartyEvent: (patch: Partial<PartyEventData>) => setState((s) => ({ ...s, partyEvent: mergePartyEvent({ ...s.partyEvent, ...patch }) })),
    submitWeddingRsvp: async (response: WeddingRsvp) => {
      if (publicInvitation) await commitPublicRsvp(response.status, response.guestCount, response.message);
      setState((s) => ({ ...s, rsvp: response.status, plusOnes: Math.max(0, response.guestCount - 1), weddingResponse: { guestCount: response.guestCount, message: response.message }, operations: publicInvitation ? s.operations : updateOperationalGuestByToken(s.operations, projectKey('wedding', activeProject.id), s.weddingGuest.token, { rsvp: response.status, guestCount: response.guestCount, message: response.message }) }));
    },
    activePartyEventId,
    openPartyEvent: (id: string) => {
      partyDraftRef.current = null;
      partyHydratedRef.current = false;
      partyHydratedEventRef.current = '';
      partySaveBlockedRef.current = true;
      partySavedConfigurationRef.current = '';
      partySavedEventMetadataRef.current = '';
      setActivePartyEventId(id);
    },
    openPartyDraft: (draft: DesignDraft<Record<string, unknown>>) => {
      partyDraftRef.current = draft;
      setActivePartyEventId('');
      partyHydratedRef.current = false;
      partySaveBlockedRef.current = true;
      const configuration = draft.configuration as Partial<PartyEventData> & { blocks?: StudioBlock[]; invitationLocale?: InvitationLocale };
      setState((current) => {
        const partyEvent = mergePartyEvent(configuration);
        const blocks = normalizeBlocks(configuration.blocks, current.blocks);
        const invitationLocale = configuration.invitationLocale === 'en' ? 'en' : 'ar';
        partySavedConfigurationRef.current = JSON.stringify({ ...partyEvent, blocks, invitationLocale });
        partySaveBlockedRef.current = false;
        return { ...current, mode: 'standard', partyEvent, blocks, invitationLocale };
      });
      partyHydratedRef.current = true;
    },
    savePartyDraft: async (
      overrideEvent?: PartyEventData,
      overrideBlocks?: StudioBlock[],
      overrideLocale?: InvitationLocale
    ) => {
      if (!partyDraftRef.current) return;
      if (partySaveBlockedRef.current) throw new Error('Party saving is paused. Reload the Draft before trying again.');
      const eventToSave = overrideEvent ?? state.partyEvent;
      const blocksToSave = overrideBlocks ?? state.blocks;
      const localeToSave = overrideLocale ?? state.invitationLocale;
      const configuration = { ...eventToSave, blocks: blocksToSave, invitationLocale: localeToSave };
      const signature = JSON.stringify(configuration);
      if (signature === partySavedConfigurationRef.current) return;
      const operation = partyQueueRef.current.then(async () => {
        partyDraftRef.current = await updateDesignDraft(partyDraftRef.current!, eventToSave.title, configuration);
        partySavedConfigurationRef.current = signature;
      });
      partyQueueRef.current = operation.catch(() => undefined);
      try { await operation; }
      catch (caught) { partySaveBlockedRef.current = true; throw caught; }
    },
    loadPublicInvitation: (resolution: InvitationResolution, token: string, generalName = '') => {
      if (!resolution.event || !resolution.kind) return;
      const configuration = resolution.configuration ?? {};
      const guest = resolution.guest;
      const allowedCompanions = guest?.allowed_companions ?? resolution.event.general_invite_allowed_companions;
      setPublicInvitation({ token, kind: resolution.kind, requestId: crypto.randomUUID(), readOnly: resolution.status === 'archived_read_only' });
      setState((current) => ({ ...current, mode: resolution.event!.product_id === 'wedding' ? 'wedding' : 'standard', invitationLocale: resolution.event!.invitation_locale, partyEvent: resolution.event!.product_id === 'party' ? mergePartyEvent(configuration as Partial<PartyEventData>) : current.partyEvent, blocks: normalizeBlocks(configuration.blocks, current.blocks), weddingGuest: { ...defaultWeddingGuest, name: guest?.name ?? generalName, token, allowedCompanions, invitationVariantOverride: guest?.invitation_variant_override ?? undefined }, rsvp: guest?.rsvp_status ?? 'pending', plusOnes: Math.max(0, (guest?.confirmed_party_size ?? 1) - 1), weddingResponse: { guestCount: guest?.confirmed_party_size || 1, message: guest?.custom_message ?? '' } }));
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

const blockIcons: Record<BlockKey, IconType> = { catering: Utensils, dress: Shirt, schedule: CalendarDays, registry: Heart, song: Music2, faq: HelpCircle, text: Edit3, venue: CalendarDays, host: Heart, cta: ExternalLink, divider: ArrowDown, spacer: ArrowDown };

function GuestPage({ preview = false, onSelectBlock }: { preview?: boolean; onSelectBlock?: (id: string) => void } = {}) {
  const { state, ready, setRsvp, setSong, setMeal, submitWeddingRsvp, loadPublicInvitation, publicReadOnly } = useEngine();
  const { activeProject } = useWeddingWorkspace();
  const { token } = useParams<{ token: string }>();
  const [resolution, setResolution] = useState<InvitationResolution | null>(null);
  const [resolutionError, setResolutionError] = useState(false);
  const [generalName, setGeneralName] = useState('');
  const [generalPhone, setGeneralPhone] = useState('');
  const [generalRequestId, setGeneralRequestId] = useState('');
  const [generalStatus, setGeneralStatus] = useState<GeneralInvitationRequestStatus | null>(null);
  const [generalBusy, setGeneralBusy] = useState(false);
  const [generalError, setGeneralError] = useState(false);
  const openedRef = useRef('');
  const loadedRef = useRef('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const backendToken = !preview && token !== 'demo' ? token : undefined;
  useEffect(() => {
    if (!backendToken) return;
    let live = true;
    loadedRef.current = '';
    setResolution(null); setResolutionError(false); setGeneralStatus(null); setGeneralError(false);
    void resolveInvitation(backendToken).then((result) => { if (live) setResolution(result); }).catch(() => { if (live) setResolutionError(true); });
    return () => { live = false; };
  }, [backendToken]);
  useEffect(() => {
    if (!backendToken || !resolution?.kind || !resolution.event || resolution.kind === 'general') return;
    if (loadedRef.current === backendToken) return;
    loadedRef.current = backendToken;
    loadPublicInvitation(resolution, backendToken, generalName);
    if (openedRef.current !== backendToken) {
      openedRef.current = backendToken;
      void recordInvitationOpen(backendToken).catch(() => undefined);
    }
  }, [backendToken, loadPublicInvitation, resolution]);
  useEffect(() => {
    if (!backendToken || resolution?.kind !== 'general') return;
    const key = `quickrsvp-general-request:${backendToken}`;
    let requestId = '';
    try { requestId = localStorage.getItem(key) ?? ''; } catch { /* Status still works for this visit. */ }
    if (!requestId) return;
    setGeneralRequestId(requestId);
    void getGeneralInvitationRequestStatus(backendToken, requestId).then((status) => {
      if (status.state !== 'invalid') setGeneralStatus(status);
    }).catch(() => setGeneralError(true));
  }, [backendToken, resolution?.kind]);
  if (backendToken && (!resolution || resolutionError)) return resolutionError ? <TokenError /> : <LoadingPage />;
  if (resolution && !['active', 'archived_read_only'].includes(resolution.status)) return <TokenError />;
  if (resolution?.kind === 'general') {
    const copy = resolution.event!.invitation_locale === 'ar'
      ? { title: 'طلب دعوة', help: 'أدخل اسمك ورقم هاتفك لإرسال الطلب إلى المضيف.', phone: 'رقم الهاتف', submit: 'إرسال الطلب', awaiting: 'تم إرسال طلبك وهو بانتظار موافقة المضيف.', approved: 'تمت الموافقة على طلبك. سيرسل لك المضيف رابط دعوتك الخاصة.', rejected: 'تعذر قبول طلبك لهذه المناسبة.', failed: 'تعذر إرسال الطلب. تحقق من البيانات وحاول مرة أخرى.' }
      : { title: 'Request an invitation', help: 'Enter your name and phone number to send a request to the host.', phone: 'Phone number', submit: 'Send request', awaiting: 'Your request was sent and is awaiting host approval.', approved: 'Your request was approved. The host will send your personal invitation link.', rejected: 'Your request could not be accepted for this event.', failed: 'The request could not be sent. Check your details and try again.' };
    const submitRequest = async () => {
      const requestId = generalRequestId || crypto.randomUUID();
      setGeneralBusy(true); setGeneralError(false);
      try {
        const status = await submitGeneralInvitationRequest(backendToken!, requestId, generalName, generalPhone);
        setGeneralRequestId(requestId); setGeneralStatus(status);
        try { localStorage.setItem(`quickrsvp-general-request:${backendToken}`, requestId); } catch { /* Current status remains visible. */ }
      } catch { setGeneralError(true); }
      finally { setGeneralBusy(false); }
    };
    return <div className="grain flex min-h-[100dvh] items-center justify-center bg-[#FAF7F2] p-5" lang={resolution.event!.invitation_locale} dir={localeDirection(resolution.event!.invitation_locale)}><div className="suite-card w-full max-w-md p-7"><Eyebrow>{invitationT(resolution.event!.invitation_locale, 'invitation')}</Eyebrow><h1 className="mt-3 font-display text-4xl text-[#0A2E23]">{resolution.event!.title}</h1>{generalStatus ? <div className="mt-6 rounded-2xl border border-[#D4AF37]/45 bg-[#FFFDF9]/60 p-5 text-sm leading-7 text-[#2D2421]" role="status">{copy[generalStatus.state]}</div> : <form onSubmit={(event) => { event.preventDefault(); void submitRequest(); }}><h2 className="mt-6 text-xl font-semibold text-[#0A2E23]">{copy.title}</h2><p className="mt-2 text-sm leading-6 text-[#2D2421]/65">{copy.help}</p><input autoFocus required maxLength={200} value={generalName} onChange={(event) => setGeneralName(event.target.value)} placeholder={invitationT(resolution.event!.invitation_locale, 'guestName')} className="mt-5 min-h-12 w-full rounded-xl border border-[#D4AF37]/55 px-4" /><input required type="tel" minLength={7} maxLength={32} pattern="[0-9+() .-]{7,32}" dir="ltr" value={generalPhone} onChange={(event) => setGeneralPhone(event.target.value)} placeholder={copy.phone} aria-label={copy.phone} className="mt-3 min-h-12 w-full rounded-xl border border-[#D4AF37]/55 px-4" /><Button type="submit" disabled={generalBusy} className="mt-4 w-full">{copy.submit}</Button></form>}{generalError && <p className="mt-4 text-sm text-[#8c302b]" role="alert">{copy.failed}</p>}</div></div>;
  }
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

  return (
    <PartyInvitationRenderer
      event={partyEvent}
      blocks={state.blocks}
      guestName={state.weddingGuest.name}
      passId={state.weddingGuest.passId}
      rsvpStatus={displayedRsvp}
      guestCount={partyGuestCount}
      maxGuests={1 + state.weddingGuest.allowedCompanions}
      song={state.song}
      meal={state.meal}
      invitationLocale={state.invitationLocale}
      preview={preview}
      readOnly={publicReadOnly}
      onRsvp={(newStatus, newGuestCount) => setRsvp(newStatus, newGuestCount)}
      onSongChange={(newSong) => !preview && setSong(newSong)}
      onMealChange={(newMeal) => !preview && setMeal(newMeal)}
      onSelectBlock={onSelectBlock}
    />
  );
}

function GuestBlock({ block, index, openFaq, setOpenFaq, song, setSong, meal, setMeal, onSelect }: { block: StudioBlock; index: number; openFaq: number | null; setOpenFaq: (n: number | null) => void; song: string; setSong: (s: string) => void; meal: string; setMeal: (s: string) => void; onSelect?: (id: string) => void }) {
  const { state } = useEngine();
  const Icon = blockIcons[block.key];
  const c = block.content;
  return <div onClick={() => onSelect?.(block.id)} className={onSelect ? 'cursor-pointer' : ''}><SuiteCard className="mb-10 p-7 sm:p-10" id={`guest-${block.id}`}>
    <div className="mb-8 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D4AF37] text-[#0A2E23]"><Icon size={16} strokeWidth={1.5} /></div><Eyebrow>{c.note ? block.eyebrow : block.eyebrow}</Eyebrow><span className="ml-auto font-mono text-[10px] text-[#2D2421]/35">0{index + 1}</span></div>
    {block.key === 'catering' && <><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><p className="mt-2 text-sm leading-6 text-[#2D2421]/65">{partyInvitationT(state.invitationLocale, 'choosePlate')}</p><div className="mt-7 grid gap-3 sm:grid-cols-3">{c.entree?.map((dish) => <button key={dish} onClick={() => setMeal(dish)} data-testid={`button-entree-${dish}`} className={`focus-ring min-h-11 rounded-2xl border p-4 text-start transition ${meal === dish ? 'border-[#0A2E23] bg-[#0A2E23] text-[#FFFDF9]' : 'border-[#D4AF37]/45 bg-[#FFFDF9]/45 hover:bg-[#FFFDF9]'}`}><span className="mb-4 block h-2 w-10 rounded-full" style={{ background: c.swatches?.[c.entree?.indexOf(dish) ?? 0] }} /><span className="text-xs font-semibold">{dish}</span></button>)}</div><p className="mt-4 text-[10px] uppercase tracking-[.12em] text-[#2D2421]/45">{partyInvitationT(state.invitationLocale, 'selected')}: {meal || partyInvitationT(state.invitationLocale, 'notSelected')}</p></>}
    {block.key === 'dress' && <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><p className="mt-3 max-w-md text-sm leading-7 text-[#2D2421]/65">{c.note}</p></div><div className="flex -space-x-2" aria-label={partyInvitationT(state.invitationLocale, 'suggestedColors')}><span className="h-10 w-10 rounded-full border-2 border-[#EADBC8] bg-[#6D3F35]" /><span className="h-10 w-10 rounded-full border-2 border-[#EADBC8] bg-[#C48B63]" /><span className="h-10 w-10 rounded-full border-2 border-[#EADBC8] bg-[#34594B]" /></div></div>}
    {block.key === 'schedule' && <><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><div className="mt-7 space-y-0">{[['17:30', 'arrival'], ['18:15', 'ceremony'], ['19:00', 'dinner'], ['21:30', 'dancing']].map(([time, key]) => <div key={time} className="flex gap-5 border-s border-[#D4AF37] py-3 ps-5"><span className="w-20 shrink-0 font-mono text-[10px] font-bold text-[#A98219]" dir="ltr">{time}</span><span className="text-sm text-[#2D2421]/75">{partyInvitationT(state.invitationLocale, key as PartyInvitationKey)}</span></div>)}</div></>}
    {block.key === 'registry' && <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-4xl text-[#0A2E23]">{c.heading}</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#2D2421]/65">{partyInvitationT(state.invitationLocale, 'registryBody')}</p></div><Button variant="ivory" icon={ExternalLink} onClick={() => window.open('https://example.com', '_blank')}>{partyInvitationT(state.invitationLocale, 'viewRegistry')}</Button></div>}
    {block.key === 'song' && <><h2 className="break-words font-display text-4xl text-[#0A2E23]">{c.heading}</h2><p className="mt-2 text-sm text-[#2D2421]/65">{partyInvitationT(state.invitationLocale, 'songHelp')}</p><div className="mt-6 flex flex-col gap-3 sm:flex-row"><input value={song} onChange={(e) => setSong(e.target.value)} data-testid="input-song-request" aria-label={partyInvitationT(state.invitationLocale, 'songPlaceholder')} placeholder={partyInvitationT(state.invitationLocale, 'songPlaceholder')} className="focus-ring min-h-11 min-w-0 flex-1 rounded-full border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-5 py-3 text-sm outline-none placeholder:text-[#2D2421]/35" /><Button variant="dark" icon={Music2} onClick={() => setSong(song)}>{partyInvitationT(state.invitationLocale, 'saveSong')}</Button></div></>}
    {block.key === 'faq' && <><h2 className="break-words font-display text-4xl text-[#0A2E23]">{c.heading}</h2><div className="mt-5">{c.questions?.map((item, qIndex) => <div key={item.q} className="border-b border-[#D4AF37]/35"><button onClick={() => setOpenFaq(openFaq === qIndex ? null : qIndex)} data-testid={`button-faq-${qIndex}`} aria-expanded={openFaq === qIndex} className="focus-ring flex w-full items-center justify-between gap-3 py-4 text-start text-sm font-semibold text-[#2D2421]"><span className="break-words">{item.q}</span><ChevronDown aria-hidden="true" size={16} className={`shrink-0 text-[#A98219] transition-transform ${openFaq === qIndex ? 'rotate-180' : ''}`} /></button><AnimatePresence initial={false}>{openFaq === qIndex && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pb-4 text-sm leading-6 text-[#2D2421]/65">{item.a}</motion.p>}</AnimatePresence></div>)}</div></>}
    {['text', 'venue', 'host', 'cta'].includes(block.key) && <div><h2 className="break-words font-display text-4xl text-[#0A2E23]">{c.heading}</h2>{c.note && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#2D2421]/65">{c.note}</p>}{block.key === 'cta' && /^https?:\/\//.test(c.url ?? '') && (onSelect ? <span className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#0A2E23] px-5 text-xs font-semibold text-white">{c.heading}</span> : <a href={c.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#0A2E23] px-5 text-xs font-semibold text-white">{c.heading}</a>)}</div>}
    {block.key === 'divider' && <hr className="border-[#D4AF37]/50" />}
    {block.key === 'spacer' && <div className="h-14" aria-hidden="true" />}
  </SuiteCard></div>;
}

function LoadingPage() {
  const { t } = useAppLocale();
  return <PageShell className="qr-center"><LoadingState label={t('loading')} /></PageShell>;
}
function TokenError() {
  const { t } = useAppLocale();
  return <div className="grain flex min-h-[100dvh] items-center justify-center bg-[#FAF7F2] p-6 text-center"><div className="gold-thread" /><SuiteCard className="relative z-10 max-w-md p-10"><XCircle className="mx-auto text-[#A98219]" size={34} strokeWidth={1.3} /><h1 className="mt-5 font-display text-4xl text-[#0A2E23]">{t('invalidInvitationTitle')}</h1><p className="mt-3 text-sm leading-6 text-[#2D2421]/65">{t('invalidInvitationHelp')}</p><Link href="/i/demo" data-testid="link-demo-invitation" className="focus-ring mt-6 inline-flex rounded-full bg-[#0A2E23] px-5 py-3 text-[11px] font-bold uppercase tracking-[.12em] text-[#FFFDF9]">{t('openDemoInvitation')}</Link></SuiteCard></div>;
}

function NotFoundPage() {
  const { t } = useAppLocale();
  return <PageShell className="qr-center"><ErrorState title={t('notFoundTitle')} description={t('notFoundHelp')} action={<Link href="/" className="qr-button qr-button--primary">{t('backToProjects')}</Link>} /></PageShell>;
}

function AppErrorFallback({ resetError }: ErrorFallbackProps) {
  const { t } = useAppLocale();
  return <PageShell className="qr-center"><ErrorState title={t('appErrorTitle')} description={t('appErrorHelp')} action={<CustomerButton onClick={resetError}>{t(isPublicInvitationRoute(window.location.pathname) ? 'tryAgain' : 'retry')}</CustomerButton>} /></PageShell>;
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
  const { state, ready, setMode, setInvitationLocale, updatePartyEvent, reorderBlocks, savePartyDraft, storageAvailable } = useEngine();
  const auth = useAuth();
  const { t } = useAppLocale();
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'conflict'>('saved');

  useEffect(() => {
    if (ready && state.mode !== 'standard') {
      setMode('standard');
    }
  }, [ready, state.mode, setMode]);

  if (!ready) return <LoadingPage />;

  const handleSave = async (
    newEvent: PartyEventData,
    newBlocks: StudioBlock[],
    newLocale: InvitationLocale
  ) => {
    setSaveStatus('saving');
    try {
      updatePartyEvent(newEvent);
      reorderBlocks(newBlocks);
      setInvitationLocale(newLocale);
      await savePartyDraft(newEvent, newBlocks, newLocale);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  };

  return (
    <PartyStudio
      embedded={embedded}
      initialEvent={state.partyEvent}
      initialBlocks={state.blocks}
      invitationLocale={state.invitationLocale}
      saveStatus={saveStatus}
      storageAvailable={storageAvailable}
      onSave={handleSave}
      backHref={auth.session ? '/planner/party' : '/'}
      backLabel={t('projects')}
      draftTitle={state.partyEvent.title}
    />
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
  const control = 'focus-ring min-h-11 rounded-full border border-[#d1c7b7] bg-white/90 px-4 py-2 text-[10px] font-bold uppercase tracking-[.08em] text-[#0A2E23] shadow-xs transition hover:border-[#0A2E23] hover:bg-white active:scale-98 disabled:cursor-not-allowed disabled:opacity-40';

  return <section className="my-8 rounded-[28px] border border-[#D4AF37]/40 bg-[#FFFDF9]/55 p-5 shadow-sm" aria-label={t('weddingStudio')}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2">
        <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">{t('operationName')}</span><input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder={t('namePlaceholder')} className="qr-field-inline min-h-11 w-full rounded-2xl px-4 text-sm text-[#0A2E23]" /></label>
        <div>
        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55" htmlFor="wedding-project">{t('currentWedding')}</label>
        <select id="wedding-project" value={workspace.activeProject.id} onChange={(event) => { setConfirmProjectDeleteId(''); run(workspace.openProject(event.target.value)); }} className="qr-field-inline min-h-11 w-full rounded-2xl px-4 text-sm text-[#0A2E23]">
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
        <select value={selectedDesignId} onChange={(event) => setSelectedDesignId(event.target.value)} className="qr-field-inline min-h-11 min-w-0 flex-1 rounded-2xl px-4 text-sm text-[#0A2E23]" aria-label={t('savedDesigns')}>
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
function EditorPanel({ block, close, updateBlock }: { block: StudioBlock; close: () => void; updateBlock: (id: string, patch: Partial<BlockContent>) => void }) {
  const { t } = useAppLocale();
  const [heading, setHeading] = useState(block.content.heading);
  const [note, setNote] = useState(block.content.note ?? '');
  const [entree, setEntree] = useState((block.content.entree ?? []).join('\n'));
  const [questions, setQuestions] = useState(block.content.questions ?? []);
  const [swatches, setSwatches] = useState(block.content.swatches ?? ['#6D3F35', '#C48B63', '#34594B']);
  const [url, setUrl] = useState(block.content.url ?? '');
  const save = () => { updateBlock(block.id, { heading, note, url, entree: entree.split('\n').map((x) => x.trim()).filter(Boolean), questions, swatches }); close(); };
  return <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} className="suite-card grommetless p-6"><div className="flex items-start justify-between"><div><Eyebrow>{t('edit')} / {t(block.key)}</Eyebrow><h3 className="mt-2 font-display text-3xl text-[#0A2E23]">{t(block.key)}</h3></div><button onClick={close} data-testid="button-close-editor" aria-label={t('cancel')} className="focus-ring flex min-h-11 min-w-11 items-center justify-center rounded-full text-[#2D2421]/60"><X size={18} /></button></div><div className="mt-6 space-y-5"><label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">{t('heading')}</span><input value={heading} onChange={(e) => setHeading(e.target.value)} data-testid="input-edit-heading" className="focus-ring w-full rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-4 py-3 text-sm outline-none" /></label>{!['catering', 'faq', 'divider', 'spacer'].includes(block.key) && <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">{t('description')}</span><textarea value={note} onChange={(e) => setNote(e.target.value)} data-testid="input-edit-note" rows={4} className="focus-ring w-full resize-none rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-4 py-3 text-sm outline-none" /></label>}{block.key === 'cta' && <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">URL</span><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} className="focus-ring w-full rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-4 py-3 text-sm" /></label>}{block.key === 'catering' && <><label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">{t('entrees')}</span><textarea value={entree} onChange={(e) => setEntree(e.target.value)} data-testid="input-edit-entrees" rows={4} className="focus-ring w-full resize-none rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-4 py-3 text-sm outline-none" /></label><div><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">{t('menuSwatches')}</span><div className="flex gap-3">{swatches.map((swatch, i) => <input key={i} type="color" value={swatch} onChange={(e) => setSwatches(swatches.map((color, colorI) => colorI === i ? e.target.value : color))} data-testid={`input-edit-swatch-${i}`} aria-label={`${t('menuSwatches')} ${i + 1}`} className="h-10 w-full cursor-pointer rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF9]/60 p-1" />)}</div></div></>}{block.key === 'faq' && <div><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#2D2421]/55">{t('questions')}</span>{questions.map((item, i) => <input key={i} value={item.q} onChange={(e) => setQuestions(questions.map((q, qI) => qI === i ? { ...q, q: e.target.value } : q))} data-testid={`input-edit-question-${i}`} className="focus-ring mb-2 w-full rounded-xl border border-[#D4AF37]/50 bg-[#FFFDF9]/60 px-4 py-3 text-sm outline-none" />)}</div>}<Button variant="dark" className="w-full" icon={Check} onClick={save}>{t('saveChanges')}</Button></div></motion.div>;
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
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"><section className="rounded-3xl border border-[#D9D2C5] bg-white p-6 sm:p-8"><Eyebrow>{t('send')}</Eyebrow><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">{t('sendTitle')}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#756F66]">{t('sendLocalHelp')}</p>{guests.length ? <div className="mt-7"><label className="text-xs font-semibold" htmlFor="send-recipient">{t('recipient')}</label><select id="send-recipient" value={guest?.id} onChange={(event) => { setSelectedId(event.target.value); setStatus(''); }} className="qr-field-inline mt-2 min-h-12 w-full rounded-xl px-4 text-sm font-medium">{guests.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.phone || t('missingPhone')}</option>)}</select><div className="mt-5 flex flex-wrap gap-2"><Button onClick={() => void copy()}>{t('copyLink')}</Button><Button variant="ivory" icon={ExternalLink} onClick={() => void openInvitation()}>{t('openInvitation')}</Button><Button variant="ivory" icon={MessageCircle} onClick={() => void openWhatsApp()}>{t('prepareWhatsApp')}</Button><Button variant="ivory" icon={Link2} onClick={() => void copyGeneral()}>General link</Button><Button variant="ivory" icon={ExternalLink} onClick={() => void openGeneral()}>{t('openGeneralInvitation')}</Button></div>{status && <p className="mt-4 text-xs font-semibold text-[#0A2E23]" role="status">{status}</p>}</div> : <div className="mt-7"><p className="rounded-2xl border border-dashed border-[#D9D2C5] p-6 text-sm text-[#756F66]">{t('noGuests')}</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="ivory" icon={Link2} onClick={() => void copyGeneral()}>General link</Button><Button variant="ivory" icon={ExternalLink} onClick={() => void openGeneral()}>{t('openGeneralInvitation')}</Button></div></div>}</section><aside className="rounded-3xl border border-[#D9D2C5] bg-[#0C2D24] p-6 text-white"><QrCode className="text-[#D4B363]" /><h2 className="mt-5 text-xl font-semibold">{t('preparedNotDelivered')}</h2><p className="mt-3 text-sm leading-6 text-white/60">{t('sendBoundary')}</p><Link href={buildProjectRoute(project.type, project.id, 'invitation')} className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 text-xs font-semibold">{t('preview')}</Link></aside></div>;
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

function backendProjectSummary(event: BackendEvent): ProjectSummary & { lifecycleStatus: EventLifecycle } {
  return { id: event.id, type: event.product_id, name: event.title, date: event.starts_at ?? '', venue: [event.venue_name, event.city].filter(Boolean).join(', '), lifecycleStatus: event.lifecycle_status };
}

function DashboardRoute({ product }: { product?: ProductId }) {
  const auth = useAuth();
  const [, navigate] = useLocation();
  const [drafts, setDrafts] = useState<DesignDraft<Record<string, unknown>>[]>([]);
  const [commercial, setCommercial] = useState<CommercialSource | null>(null);
  const loadDrafts = () => listDesignDrafts<Record<string, unknown>>().then(setDrafts);
  useEffect(() => { if (auth.dataLoading) return; void loadDrafts().catch(() => setDrafts([])); void loadCommercialSource().then(setCommercial).catch(() => setCommercial(null)); }, [auth.dataLoading]);
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
    commercial={commercial ? {
      wedding: commercialSummary('wedding', auth.entitlements, commercial, auth.events),
      party: commercialSummary('party', auth.entitlements, commercial, auth.events),
    } : {}}
    product={product}
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

function AccountRoute() {
  const auth = useAuth();
  const [source, setSource] = useState<CommercialSource | null>(null);
  useEffect(() => { void loadCommercialSource().then(setSource).catch(() => setSource(null)); }, []);
  if (!auth.client) return <LoadingPage />;
  const commercial = source ? {
    wedding: commercialSummary('wedding', auth.entitlements, source, auth.events),
    party: commercialSummary('party', auth.entitlements, source, auth.events),
  } : {};
  return <AccountPage name={auth.client.display_name} email={auth.session?.user.email ?? ''} commercial={commercial} onSave={async (name) => { await updateCurrentClientDisplayName(auth.client!.id, name); await auth.refresh(); }} />;
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
  const alreadyPublished = (typeof access?.event_id === 'string' && access.event_id.length > 0)
    || auth.events.some((event) => event.source_draft_id === draft.id);
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
  return <div className="min-h-[100dvh] bg-[#F5F2EC] text-[#17251F]"><header className="sticky top-0 z-40 border-b border-[#D9D2C5] bg-[#FAF8F4]/95 px-5 py-4 backdrop-blur"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#8B7040]">{t(type)} · {t('draft')}</p><h1 className="text-lg font-semibold">{draft.title}</h1></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-2 text-xs ${allowed === false ? 'bg-[#8c302b]/10 text-[#8c302b]' : 'bg-[#0C2D24]/10 text-[#0C2D24]'}`}>{authorityMessage}</span><button disabled={publishing || !access || (allowed === false && !alreadyPublished)} onClick={() => void publish()} className="min-h-11 rounded-full bg-[#0C2D24] px-5 text-xs font-semibold text-white disabled:opacity-40">{publishing ? t('publishing') : t('publish')}</button><Link href="/" className="min-h-11 rounded-full border border-[#D9D2C5] px-5 py-3 text-xs font-semibold">{t('projects')}</Link></div></div></header>{error && <p className="mx-auto mt-4 max-w-7xl rounded-2xl bg-[#8c302b]/10 p-4 text-sm text-[#8c302b]" role="alert">{error}</p>}<main className="mx-auto max-w-7xl p-4 sm:p-7">{type === 'wedding' ? <WeddingStudioPage embedded /> : <PartyStudioPage embedded />}</main></div>;
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
  const terminal = backendEvent && isTerminalEvent(backendEvent.lifecycle_status);
  if (terminal && section !== 'overview' && section !== 'settings') content = <EmptyProjectSection title={t('eventReadOnly')}>{t('eventReadOnlyHelp')}</EmptyProjectSection>;
  else if (backendEvent?.lifecycle_status === 'planning' && section === 'scanner') content = <EmptyProjectSection title={t('eventDayScanner')}>{t('scannerActiveOnly')}</EmptyProjectSection>;
  else if (section === 'overview') content = <EventOperationsOverview project={project} rsvpDeadline={deadline} />;
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
  const allowed = allowedEventTransitions(event.lifecycle_status);
  return <section className="mx-auto max-w-2xl rounded-3xl border border-[#D9D2C5] bg-white p-7"><h2 className="font-semibold">{t('eventStatus')}</h2><div className="mt-4 flex flex-col gap-3 sm:flex-row"><select aria-label={t('eventStatus')} value={status} disabled={allowed.length === 1} onChange={(change) => setStatus(change.target.value as EventLifecycle)} className="qr-field-inline min-h-11 flex-1 rounded-xl px-3 text-sm disabled:opacity-60">{allowed.map((value) => <option key={value} value={value}>{t(labels[value])}</option>)}</select><button disabled={busy || status === event.lifecycle_status || allowed.length === 1} onClick={() => { setBusy(true); setError(false); void onSave(status).catch(() => setError(true)).finally(() => setBusy(false)); }} className="min-h-11 rounded-xl bg-[#0C2D24] px-5 text-xs font-bold text-white transition hover:bg-[#174839] disabled:opacity-40">{t('saveChanges')}</button></div>{error && <p className="mt-3 text-sm text-[#8c302b]" role="alert">{t('operationFailed')}</p>}</section>;
}

function WeddingProjectRoute() { return <ProjectRoutePage type="wedding" />; }
function PartyProjectRoute() { return <ProjectRoutePage type="party" />; }
function GuestRoute() { return <GuestPage />; }

const emptyAdminSnapshot: AdminSnapshot = { clients: [], entitlements: [], events: [], drafts: [], guests: [], templates: [], policies: [], assets: [], activity: [], entitlementActivity: [] };

function AdminRoute() {
  const { section } = useParams<{ section?: string }>();
  const { t } = useAppLocale();
  const activeSection = resolveAdminSection(section);
  const [snapshot, setSnapshot] = useState<AdminSnapshot>(emptyAdminSnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = async () => { setLoading(true); setError(''); try { setSnapshot(await loadAdminSection(activeSection)); } catch { setError(t('operationFailed')); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, [activeSection]);
  const entitlement = async (clientId: string, productId: ProductId, status: EntitlementStatus, startsAt: string | null, endsAt: string | null, overrides: Record<string, unknown>) => { await setAdminEntitlement(clientId, productId, status, startsAt, endsAt, normalizePublicationPolicy(productId, overrides)); await refresh(); };
  const template = async (id: string, active: boolean) => { await setTemplateActive(id, active); await refresh(); };
  const policy = async (productId: ProductId, configuration: Record<string, unknown>) => { await setProductPolicy(productId, normalizePublicationPolicy(productId, configuration)); await refresh(); };
  const asset = async (id: string) => { await retireAsset(id); await refresh(); };
  return <AdminPage section={activeSection} snapshot={snapshot} loading={loading} error={error} onRefresh={refresh} onEntitlement={entitlement} onTemplate={template} onPolicy={policy} onRetireAsset={asset} />;
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
        <Route path="/">{() => <RequireAuth><ChoosePlannerPage /></RequireAuth>}</Route>
        <Route path="/planner/wedding/new">{() => <RequireAuth><CreateWeddingPage /></RequireAuth>}</Route>
        <Route path="/planner/wedding">{() => <RequireAuth><WeddingPlannerPage /></RequireAuth>}</Route>
        <Route path="/planner/party/new">{() => <RequireAuth><CreatePartyPage /></RequireAuth>}</Route>
        <Route path="/planner/party/templates/:draftId">{() => <RequireAuth><PartyTemplateSelectionPage /></RequireAuth>}</Route>
        <Route path="/planner/party/templates">{() => <RequireAuth><PartyTemplateSelectionPage /></RequireAuth>}</Route>
        <Route path="/planner/party">{() => <RequireAuth><PartyPlannerPage /></RequireAuth>}</Route>
        <Route path="/account">{() => <RequireAuth><AccountRoute /></RequireAuth>}</Route>
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
