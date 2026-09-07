import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Gift,
  HelpCircle,
  Layers,
  MapPin,
  Maximize2,
  Minus,
  Music2,
  Palette,
  PartyPopper,
  Plus,
  Redo2,
  Save,
  Shirt,
  Sparkles,
  Trash2,
  Undo2,
  User,
  Utensils,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { AppLanguageControl, useAppLocale } from '../i18n/app-locale.tsx';
import { localeDirection, type InvitationLocale } from '../i18n/locale.ts';
import {
  changePartyStyle,
  changePartyTemplate,
  formatPartyDate,
  partyStyles,
  partyTemplates,
  resolvePartyStyleId,
  type PartyEventData,
  type PartyLayout,
  type PartyMotion,
  type PartyTemplateId,
  type PartyTypography,
} from './model.ts';
import {
  PartyInvitationRenderer,
  type BlockContent,
  type BlockKey,
  type StudioBlock,
} from './PartyInvitationRenderer.tsx';

export type PartyStudioProps = {
  embedded?: boolean;
  initialEvent: PartyEventData;
  initialBlocks: StudioBlock[];
  invitationLocale: InvitationLocale;
  onSave?: (
    event: PartyEventData,
    blocks: StudioBlock[],
    locale: InvitationLocale
  ) => Promise<void>;
  onPublish?: () => Promise<void>;
  publishAllowed?: boolean;
  publishLabel?: string;
  isPublishing?: boolean;
  saveStatus?: 'saved' | 'saving' | 'error' | 'conflict';
  storageAvailable?: boolean;
  backHref?: string;
  backLabel?: string;
  draftTitle?: string;
};

type DrawerTab = 'info' | 'design' | 'sections' | 'edit-block' | 'add-block' | null;

type HistorySnapshot = {
  event: PartyEventData;
  blocks: StudioBlock[];
  invitationLocale: InvitationLocale;
};

export function PartyStudio({
  embedded = false,
  initialEvent,
  initialBlocks,
  invitationLocale: initialLocale,
  onSave,
  onPublish,
  publishAllowed = true,
  publishLabel,
  isPublishing = false,
  saveStatus = 'saved',
  storageAvailable = true,
  backHref = '/planner/party',
  backLabel,
  draftTitle,
}: PartyStudioProps) {
  const { t, locale: appLocale, dir } = useAppLocale();
  const [, navigate] = useLocation();

  // Primary State
  const [event, setEvent] = useState<PartyEventData>(initialEvent);
  const [blocks, setBlocks] = useState<StudioBlock[]>(initialBlocks);
  const [invitationLocale, setInvitationLocale] = useState<InvitationLocale>(initialLocale);

  // Undo / Redo Stacks (Max 25)
  const historyRef = useRef<{ past: HistorySnapshot[]; future: HistorySnapshot[] }>({
    past: [],
    future: [],
  });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Active Contextual Drawer
  const [activeTab, setActiveTab] = useState<DrawerTab>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isPreviewOnly, setIsPreviewOnly] = useState(false);

  // Sync props when initial changes externally
  useEffect(() => {
    setEvent(initialEvent);
    setBlocks(initialBlocks);
    setInvitationLocale(initialLocale);
  }, [initialEvent, initialBlocks, initialLocale]);

  // Helper to push history snapshot
  const pushHistory = useCallback(
    (nextEvent: PartyEventData, nextBlocks: StudioBlock[], nextLocale: InvitationLocale) => {
      historyRef.current.past.push({
        event: structuredClone(event),
        blocks: structuredClone(blocks),
        invitationLocale,
      });
      if (historyRef.current.past.length > 25) historyRef.current.past.shift();
      historyRef.current.future = [];
      setCanUndo(true);
      setCanRedo(false);
    },
    [event, blocks, invitationLocale]
  );

  const handleUndo = useCallback(() => {
    if (historyRef.current.past.length === 0) return;
    const previous = historyRef.current.past.pop()!;
    historyRef.current.future.push({
      event: structuredClone(event),
      blocks: structuredClone(blocks),
      invitationLocale,
    });
    setEvent(previous.event);
    setBlocks(previous.blocks);
    setInvitationLocale(previous.invitationLocale);
    setCanUndo(historyRef.current.past.length > 0);
    setCanRedo(true);
    void onSave?.(previous.event, previous.blocks, previous.invitationLocale);
  }, [event, blocks, invitationLocale, onSave]);

  const handleRedo = useCallback(() => {
    if (historyRef.current.future.length === 0) return;
    const next = historyRef.current.future.pop()!;
    historyRef.current.past.push({
      event: structuredClone(event),
      blocks: structuredClone(blocks),
      invitationLocale,
    });
    setEvent(next.event);
    setBlocks(next.blocks);
    setInvitationLocale(next.invitationLocale);
    setCanUndo(true);
    setCanRedo(historyRef.current.future.length > 0);
    void onSave?.(next.event, next.blocks, next.invitationLocale);
  }, [event, blocks, invitationLocale, onSave]);

  // Keyboard shortcut listener for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Mutator helpers
  const updateEventFields = (patch: Partial<PartyEventData>) => {
    pushHistory(event, blocks, invitationLocale);
    const updated = { ...event, ...patch };
    setEvent(updated);
    void onSave?.(updated, blocks, invitationLocale);
  };

  const handleTemplateSwitch = (tplId: PartyTemplateId) => {
    pushHistory(event, blocks, invitationLocale);
    const updated = changePartyTemplate(event, tplId);
    setEvent(updated);
    void onSave?.(updated, blocks, invitationLocale);
  };

  const handleStyleSwitch = (styleId: string) => {
    pushHistory(event, blocks, invitationLocale);
    const updated = changePartyStyle(event, styleId);
    setEvent(updated);
    void onSave?.(updated, blocks, invitationLocale);
  };

  // Block management
  const handleMoveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    pushHistory(event, blocks, invitationLocale);
    const nextBlocks = [...blocks];
    [nextBlocks[index], nextBlocks[target]] = [nextBlocks[target], nextBlocks[index]];
    setBlocks(nextBlocks);
    void onSave?.(event, nextBlocks, invitationLocale);
  };

  const handleToggleBlock = (id: string) => {
    pushHistory(event, blocks, invitationLocale);
    const nextBlocks = blocks.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b));
    setBlocks(nextBlocks);
    void onSave?.(event, nextBlocks, invitationLocale);
  };

  const handleDuplicateBlock = (id: string) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    pushHistory(event, blocks, invitationLocale);
    const nextBlocks = [...blocks];
    const clone = {
      ...structuredClone(blocks[idx]),
      id: crypto.randomUUID(),
      label: `${blocks[idx].label} (Copy)`,
    };
    nextBlocks.splice(idx + 1, 0, clone);
    setBlocks(nextBlocks);
    setSelectedBlockId(clone.id);
    setActiveTab('edit-block');
    void onSave?.(event, nextBlocks, invitationLocale);
  };

  const handleDeleteBlock = (id: string) => {
    if (!window.confirm(t('confirmDelete'))) return;
    pushHistory(event, blocks, invitationLocale);
    const nextBlocks = blocks.filter((b) => b.id !== id);
    setBlocks(nextBlocks);
    if (selectedBlockId === id) {
      setSelectedBlockId(null);
      if (activeTab === 'edit-block') setActiveTab('sections');
    }
    void onSave?.(event, nextBlocks, invitationLocale);
  };

  const handleAddBlock = (key: BlockKey) => {
    pushHistory(event, blocks, invitationLocale);
    const newBlock: StudioBlock = {
      id: crypto.randomUUID(),
      key,
      enabled: true,
      label: t(key),
      eyebrow: key.toUpperCase(),
      content: {
        heading: t(key),
        note: '',
        entree: key === 'catering' ? ['Signature Dish 1', 'Signature Dish 2'] : undefined,
        swatches: key === 'catering' || key === 'dress' ? ['#0A2E23', '#D4AF37', '#C28B55'] : undefined,
        questions: key === 'faq' ? [{ q: 'Question 1', a: 'Answer 1' }] : undefined,
      },
    };
    const nextBlocks = [...blocks, newBlock];
    setBlocks(nextBlocks);
    setSelectedBlockId(newBlock.id);
    setActiveTab('edit-block');
    void onSave?.(event, nextBlocks, invitationLocale);
  };

  const handleUpdateBlockContent = (id: string, patch: Partial<BlockContent>) => {
    pushHistory(event, blocks, invitationLocale);
    const nextBlocks = blocks.map((b) =>
      b.id === id ? { ...b, content: { ...b.content, ...patch } } : b
    );
    setBlocks(nextBlocks);
    void onSave?.(event, nextBlocks, invitationLocale);
  };

  // Direct selection from Preview
  const handleSelectBlockFromPreview = (id: string) => {
    setSelectedBlockId(id);
    setActiveTab('edit-block');
  };

  const handleSelectSectionFromPreview = (sec: 'hero' | 'details' | 'wording' | 'design') => {
    if (sec === 'design') setActiveTab('design');
    else setActiveTab('info');
  };

  const activeBlock = blocks.find((b) => b.id === selectedBlockId);

  return (
    <div
      className={`party-studio-shell relative flex min-h-[100dvh] flex-col bg-[#FAF7F2] text-[#1F2923] antialiased ${
        embedded ? 'rounded-3xl border border-[#D4AF37]/35 shadow-sm' : ''
      }`}
      dir={dir}
    >
      {/* 1. TOP APP BAR (Modeled directly after Screen 10) */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#D4AF37]/35 bg-[#FAF7F2]/95 px-4 sm:px-8 py-3.5 backdrop-blur-md">
        {/* Left: Back Arrow & Status */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={backHref}
            className="focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-[#D4AF37]/40 bg-white/70 text-[#0A2E23] transition hover:bg-white active:scale-95"
            aria-label={backLabel || t('backToProjects')}
            data-testid="link-back"
          >
            <ArrowLeft
              size={18}
              className={`transition-transform ${dir === 'rtl' ? 'rotate-180' : ''}`}
            />
          </Link>

          <div className="min-w-0">
            <h1 className="truncate text-sm sm:text-base font-bold text-[#0A2E23]">
              {draftTitle || event.title || t('partyStudio')}
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-[#2D2421]/65">
              <span
                className={`h-2 w-2 rounded-full ${
                  saveStatus === 'saving'
                    ? 'bg-[#D4AF37] animate-pulse'
                    : saveStatus === 'error' || saveStatus === 'conflict'
                    ? 'bg-[#B4534B]'
                    : 'bg-[#0A2E23]'
                }`}
              />
              <span className="font-medium">
                {saveStatus === 'saving'
                  ? t('saving')
                  : saveStatus === 'error'
                  ? t('saveError')
                  : saveStatus === 'conflict'
                  ? t('saveConflict')
                  : t('saved')}
              </span>
            </div>
          </div>
        </div>

        {/* Center/Right: Undo, Redo, Preview Toggle, Publish */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 border-e border-[#D4AF37]/30 pe-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              aria-label={t('undo')}
              title={t('undo')}
              data-testid="button-undo"
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-[#D4AF37]/40 bg-white/60 text-[#0A2E23] transition hover:bg-white disabled:opacity-30"
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              aria-label={t('redo')}
              title={t('redo')}
              data-testid="button-redo"
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-[#D4AF37]/40 bg-white/60 text-[#0A2E23] transition hover:bg-white disabled:opacity-30"
            >
              <Redo2 size={15} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsPreviewOnly(!isPreviewOnly)}
            aria-pressed={isPreviewOnly}
            data-testid="button-preview-toggle"
            className={`focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition active:scale-95 ${
              isPreviewOnly
                ? 'border-[#0A2E23] bg-[#0A2E23] text-white shadow-xs'
                : 'border-[#D4AF37]/50 bg-white/70 text-[#0A2E23] hover:bg-white'
            }`}
          >
            {isPreviewOnly ? <Edit3 size={14} /> : <Eye size={14} />}
            <span>{t(isPreviewOnly ? 'editView' : 'previewView')}</span>
          </button>

          {onPublish && (
            <button
              type="button"
              disabled={isPublishing || !publishAllowed}
              onClick={() => void onPublish()}
              data-testid="button-publish-party"
              className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-full bg-[#0A2E23] px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#144837] disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
            >
              <Sparkles size={14} className="text-[#D4AF37]" />
              <span>{isPublishing ? t('publishing') : publishLabel || t('publishDraft')}</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. MAIN WORKSPACE — Dominant Central Preview */}
      <main className="relative flex-1 overflow-y-auto px-3 sm:px-6 py-6 pb-28 sm:pb-32 flex justify-center">
        <div className="party-device-frame relative w-full max-w-[430px] rounded-[36px] border-[6px] border-[#2A3B32]/80 bg-white shadow-2xl overflow-hidden transition-all duration-300">
          <PartyInvitationRenderer
            event={event}
            blocks={blocks}
            invitationLocale={invitationLocale}
            isEditMode={!isPreviewOnly}
            preview={isPreviewOnly}
            selectedBlockId={selectedBlockId}
            onSelectBlock={handleSelectBlockFromPreview}
            onSelectSection={handleSelectSectionFromPreview}
          />
        </div>
      </main>

      {/* 3. BOTTOM EDITING BAR (Exact Screen 10 representation) */}
      {!isPreviewOnly && (
        <nav
          className="fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t border-[#D4AF37]/35 bg-[#FAF7F2]/95 px-4 py-2.5 backdrop-blur-md shadow-lg"
          aria-label={t('guestExperience')}
        >
          {/* Information Tab */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'info' ? null : 'info')}
            data-testid="tab-party-info"
            aria-expanded={activeTab === 'info'}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition ${
              activeTab === 'info'
                ? 'text-[#0A2E23] font-bold'
                : 'text-[#2D2421]/65 hover:text-[#0A2E23]'
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                activeTab === 'info' ? 'bg-[#0A2E23] text-white shadow-xs' : 'bg-transparent'
              }`}
            >
              <FileText size={18} />
            </span>
            <span className="text-[11px] font-semibold">{t('infoTab')}</span>
          </button>

          {/* Design Tab */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'design' ? null : 'design')}
            data-testid="tab-party-design"
            aria-expanded={activeTab === 'design'}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition ${
              activeTab === 'design'
                ? 'text-[#0A2E23] font-bold'
                : 'text-[#2D2421]/65 hover:text-[#0A2E23]'
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                activeTab === 'design' ? 'bg-[#0A2E23] text-white shadow-xs' : 'bg-transparent'
              }`}
            >
              <Palette size={18} />
            </span>
            <span className="text-[11px] font-semibold">{t('designTab')}</span>
          </button>

          {/* Sections Tab */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'sections' ? null : 'sections')}
            data-testid="tab-party-sections"
            aria-expanded={activeTab === 'sections'}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition ${
              activeTab === 'sections'
                ? 'text-[#0A2E23] font-bold'
                : 'text-[#2D2421]/65 hover:text-[#0A2E23]'
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                activeTab === 'sections' ? 'bg-[#0A2E23] text-white shadow-xs' : 'bg-transparent'
              }`}
            >
              <Layers size={18} />
            </span>
            <span className="text-[11px] font-semibold">{t('sectionsTab')}</span>
          </button>

          {/* Add Section Direct Action */}
          <button
            type="button"
            onClick={() => setActiveTab('add-block')}
            data-testid="tab-party-add-block"
            className="flex flex-col items-center gap-1 p-2 rounded-2xl text-[#0A2E23] hover:opacity-85 transition"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D4AF37] text-black font-bold shadow-xs">
              <Plus size={20} strokeWidth={2.5} />
            </span>
            <span className="text-[11px] font-semibold">{t('addSection')}</span>
          </button>
        </nav>
      )}

      {/* 4. CONTEXTUAL DRAWER / BOTTOM SHEET */}
      <AnimatePresence>
        {activeTab && !isPreviewOnly && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveTab(null)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
              aria-hidden="true"
            />

            {/* Sheet Surface */}
            <motion.aside
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-xl max-h-[85vh] overflow-y-auto rounded-t-[32px] border-t border-[#D4AF37]/50 bg-[#FAF7F2] p-6 shadow-2xl"
              aria-labelledby="party-sheet-title"
            >
              {/* Top Drag Pill & Close */}
              <div className="flex items-center justify-between pb-4 border-b border-[#D4AF37]/30">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-[#D4AF37]" />
                  <h2 id="party-sheet-title" className="text-base font-bold text-[#0A2E23]">
                    {activeTab === 'info' && t('eventDetails')}
                    {activeTab === 'design' && t('designNav')}
                    {activeTab === 'sections' && t('invitationBlocks')}
                    {activeTab === 'edit-block' && `${t('edit')} ${activeBlock?.label || ''}`}
                    {activeTab === 'add-block' && t('sectionCatalog')}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab(null)}
                  className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-[#D4AF37]/40 bg-white text-[#2D2421]/70 hover:bg-black/5"
                  aria-label={t('cancel')}
                >
                  <X size={16} />
                </button>
              </div>

              {/* SHEET A: INFORMATION */}
              {activeTab === 'info' && (
                <div className="mt-5 space-y-4">
                  <label className="block text-xs font-bold text-[#0A2E23]">
                    <span>{t('eventTitle')}</span>
                    <input
                      value={event.title}
                      onChange={(e) => updateEventFields({ title: e.target.value })}
                      data-testid="input-party-title"
                      className="qr-field mt-1.5"
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>{t('hostNameLabel')}</span>
                      <input
                        value={event.hostName || ''}
                        onChange={(e) => updateEventFields({ hostName: e.target.value })}
                        placeholder={t('hostNamePlaceholder')}
                        className="qr-field mt-1.5"
                      />
                    </label>

                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>{t('subtitleLabel')}</span>
                      <input
                        value={event.subtitle || ''}
                        onChange={(e) => updateEventFields({ subtitle: e.target.value })}
                        placeholder={t('subtitlePlaceholder')}
                        className="qr-field mt-1.5"
                      />
                    </label>
                  </div>

                  <label className="block text-xs font-bold text-[#0A2E23]">
                    <span>{t('invitationWording')}</span>
                    <textarea
                      rows={3}
                      value={event.invitationWording}
                      onChange={(e) => updateEventFields({ invitationWording: e.target.value })}
                      data-testid="input-invitation-wording"
                      className="qr-field mt-1.5"
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>{t('date')}</span>
                      <input
                        type="date"
                        value={event.date}
                        onChange={(e) => updateEventFields({ date: e.target.value })}
                        data-testid="input-event-date"
                        className="qr-field mt-1.5"
                      />
                    </label>

                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>{t('startTime')}</span>
                      <input
                        type="time"
                        value={event.startTime}
                        onChange={(e) => updateEventFields({ startTime: e.target.value })}
                        className="qr-field mt-1.5"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>{t('venue')}</span>
                      <input
                        value={event.venue}
                        onChange={(e) => updateEventFields({ venue: e.target.value })}
                        data-testid="input-event-venue"
                        className="qr-field mt-1.5"
                      />
                    </label>

                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>{t('city')}</span>
                      <input
                        value={event.city}
                        onChange={(e) => updateEventFields({ city: e.target.value })}
                        className="qr-field mt-1.5"
                      />
                    </label>
                  </div>

                  <label className="block text-xs font-bold text-[#0A2E23]">
                    <span>{t('rsvpDeadline')}</span>
                    <input
                      type="date"
                      value={event.rsvpDeadline}
                      onChange={(e) => updateEventFields({ rsvpDeadline: e.target.value })}
                      className="qr-field mt-1.5"
                    />
                  </label>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab(null)}
                      className="qr-button qr-button--primary w-full justify-center text-sm font-bold min-h-11"
                    >
                      <Check size={16} />
                      <span>{t('saveChanges')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SHEET B: DESIGN */}
              {activeTab === 'design' && (
                <div className="mt-5 space-y-6">
                  {/* Template Family Selection */}
                  <div>
                    <span className="block text-xs font-bold text-[#0A2E23] mb-2">
                      {t('templateFamily')}
                    </span>
                    <div className="grid grid-cols-2 gap-2.5">
                      {Object.values(partyTemplates).map((tpl) => {
                        const isChosen = event.templateId === tpl.id;
                        const name = appLocale === 'ar' ? tpl.nameAr : tpl.name;
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            data-testid={`button-party-template-${tpl.id}`}
                            onClick={() => handleTemplateSwitch(tpl.id)}
                            className={`focus-ring rounded-2xl border p-3 text-start transition ${
                              isChosen
                                ? 'border-[#0A2E23] bg-[#0A2E23] text-white shadow-xs'
                                : 'border-[#D4AF37]/40 bg-white/70 hover:bg-white'
                            }`}
                          >
                            <span className={`party-template-swatch party-template-swatch--${tpl.id}`} />
                            <strong className="mt-2 block text-xs">{name}</strong>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Coordinated Visual Style Presets */}
                  <div>
                    <span className="block text-xs font-bold text-[#0A2E23] mb-2">
                      {t('stylePreset')}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {partyTemplates[event.templateId]?.supportedStyles.map((styleKey) => {
                        const s = partyStyles[styleKey];
                        if (!s) return null;
                        const currentStyleKey = resolvePartyStyleId(event.templateId, event.styleId);
                        const isCurrent = currentStyleKey === s.id;
                        const name = appLocale === 'ar' ? s.nameAr : s.name;

                        return (
                          <button
                            key={s.id}
                            type="button"
                            data-testid={`button-party-style-${s.id}`}
                            onClick={() => handleStyleSwitch(s.id)}
                            className={`focus-ring rounded-2xl border p-3 text-start transition flex flex-col justify-between ${
                              isCurrent
                                ? 'border-[#0A2E23] bg-white ring-2 ring-[#0A2E23] shadow-xs'
                                : 'border-[#D4AF37]/35 bg-white/50 hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-2">
                              <span
                                className="h-4 w-4 rounded-full border border-black/20"
                                style={{ backgroundColor: s.backgroundColor }}
                              />
                              <span
                                className="h-4 w-4 rounded-full border border-black/20"
                                style={{ backgroundColor: s.accentColor }}
                              />
                              <span
                                className="h-4 w-4 rounded-full border border-black/20"
                                style={{ backgroundColor: s.primaryColor }}
                              />
                            </div>
                            <span className="text-xs font-bold text-[#0A2E23]">{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Typography, Layout, Motion */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-[#D4AF37]/30 pt-4">
                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>{t('typography')}</span>
                      <select
                        value={event.typography}
                        onChange={(e) => updateEventFields({ typography: e.target.value as PartyTypography })}
                        className="qr-field mt-1 text-xs"
                      >
                        <option value="display">{t('displayStyle')}</option>
                        <option value="modern">{t('modernStyle')}</option>
                      </select>
                    </label>

                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>{t('layout')}</span>
                      <select
                        value={event.layout}
                        onChange={(e) => updateEventFields({ layout: e.target.value as PartyLayout })}
                        className="qr-field mt-1 text-xs"
                      >
                        <option value="centered">{t('centered')}</option>
                        <option value="editorial">{t('editorial')}</option>
                      </select>
                    </label>

                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>{t('motion')}</span>
                      <select
                        value={event.motion}
                        onChange={(e) => updateEventFields({ motion: e.target.value as PartyMotion })}
                        className="qr-field mt-1 text-xs"
                      >
                        <option value="gentle">{t('gentle')}</option>
                        <option value="none">{t('none')}</option>
                      </select>
                    </label>
                  </div>

                  {/* Decorations Toggle */}
                  <label className="flex items-center gap-3 rounded-2xl border border-[#D4AF37]/40 bg-white/60 p-3.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={event.decorations}
                      onChange={(e) => updateEventFields({ decorations: e.target.checked })}
                      className="h-4 w-4 rounded text-[#0A2E23]"
                    />
                    <span className="text-xs font-bold text-[#0A2E23]">
                      {t('decorations')}
                    </span>
                  </label>

                  {/* Custom Colors Override */}
                  <div className="border-t border-[#D4AF37]/30 pt-4">
                    <p className="text-xs font-bold text-[#0A2E23] mb-3">
                      {t('details')} &bull; Color Overrides
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <label className="text-[11px] font-semibold text-[#0A2E23]">
                        <span>{t('background')}</span>
                        <input
                          type="color"
                          value={event.backgroundColor || '#0F1E2E'}
                          onChange={(e) => updateEventFields({ backgroundColor: e.target.value })}
                          className="mt-1 h-9 w-full rounded-xl border p-1 cursor-pointer"
                        />
                      </label>
                      <label className="text-[11px] font-semibold text-[#0A2E23]">
                        <span>{t('primaryColor')}</span>
                        <input
                          type="color"
                          value={event.primaryColor || '#FFFFFF'}
                          onChange={(e) => updateEventFields({ primaryColor: e.target.value })}
                          className="mt-1 h-9 w-full rounded-xl border p-1 cursor-pointer"
                        />
                      </label>
                      <label className="text-[11px] font-semibold text-[#0A2E23]">
                        <span>{t('accentColor')}</span>
                        <input
                          type="color"
                          value={event.accentColor || '#D4AF37'}
                          onChange={(e) => updateEventFields({ accentColor: e.target.value })}
                          className="mt-1 h-9 w-full rounded-xl border p-1 cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Invitation Language */}
                  <div className="border-t border-[#D4AF37]/30 pt-4">
                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>{t('invitationLanguage')}</span>
                      <select
                        value={invitationLocale}
                        onChange={(e) => {
                          const val = e.target.value as InvitationLocale;
                          setInvitationLocale(val);
                          void onSave?.(event, blocks, val);
                        }}
                        className="qr-field mt-1.5 text-xs"
                      >
                        <option value="ar">{t('arabic')}</option>
                        <option value="en">{t('english')}</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}

              {/* SHEET C: SECTIONS (Manage blocks, reorder, delete, add) */}
              {activeTab === 'sections' && (
                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#2D2421]/70">
                      {blocks.filter((b) => b.enabled).length} / {blocks.length} {t('visible')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('add-block')}
                      data-testid="button-add-section-sheet"
                      className="qr-button qr-button--primary text-xs py-1.5 px-3 min-h-9"
                    >
                      <Plus size={14} />
                      <span>{t('addSection')}</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {blocks.map((b, idx) => (
                      <div
                        key={b.id}
                        className={`flex items-center justify-between gap-2.5 rounded-2xl border p-3 transition ${
                          b.enabled
                            ? 'border-[#D4AF37]/45 bg-white/80'
                            : 'border-[#2D2421]/15 bg-black/5 opacity-55'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-[#0A2E23]">
                            {b.label || t(b.key)}
                          </p>
                          <p className="truncate text-[11px] text-[#2D2421]/60">
                            {b.content.heading || b.key}
                          </p>
                        </div>

                        {/* Actions: Up, Down, Edit, Duplicate, Delete, Visibility */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveBlock(idx, -1)}
                            disabled={idx === 0}
                            data-testid={`button-move-up-${b.id}`}
                            aria-label={`${t('moveUp')} ${b.label}`}
                            className="focus-ring flex h-8 w-8 items-center justify-center rounded-full border border-[#D4AF37]/40 text-[#0A2E23] disabled:opacity-25 hover:bg-white"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveBlock(idx, 1)}
                            disabled={idx === blocks.length - 1}
                            data-testid={`button-move-down-${b.id}`}
                            aria-label={`${t('moveDown')} ${b.label}`}
                            className="focus-ring flex h-8 w-8 items-center justify-center rounded-full border border-[#D4AF37]/40 text-[#0A2E23] disabled:opacity-25 hover:bg-white"
                          >
                            <ArrowDown size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBlockId(b.id);
                              setActiveTab('edit-block');
                            }}
                            aria-label={`${t('edit')} ${b.label}`}
                            data-testid={`button-edit-block-${b.id}`}
                            className="focus-ring flex h-8 w-8 items-center justify-center rounded-full border border-[#D4AF37]/40 text-[#0A2E23] hover:bg-white"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateBlock(b.id)}
                            data-testid={`button-duplicate-${b.id}`}
                            aria-label={`${t('duplicate')} ${b.label}`}
                            className="focus-ring flex h-8 w-8 items-center justify-center rounded-full border border-[#D4AF37]/40 text-[#0A2E23] hover:bg-white"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBlock(b.id)}
                            data-testid={`button-delete-${b.id}`}
                            aria-label={`${t('delete')} ${b.label}`}
                            className="focus-ring flex h-8 w-8 items-center justify-center rounded-full border border-[#D4AF37]/40 text-[#8C302B] hover:bg-white"
                          >
                            <Trash2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleBlock(b.id)}
                            data-testid={`button-toggle-${b.id}`}
                            aria-label={t(b.enabled ? 'hide' : 'show')}
                            className={`focus-ring flex h-8 w-8 items-center justify-center rounded-full transition ${
                              b.enabled ? 'bg-[#0A2E23] text-white' : 'bg-black/10 text-black/40'
                            }`}
                          >
                            {b.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SHEET D: EDIT INDIVIDUAL BLOCK */}
              {activeTab === 'edit-block' && activeBlock && (
                <div className="mt-5 space-y-4">
                  <label className="block text-xs font-bold text-[#0A2E23]">
                    <span>{t('heading')}</span>
                    <input
                      value={activeBlock.content.heading}
                      onChange={(e) => handleUpdateBlockContent(activeBlock.id, { heading: e.target.value })}
                      data-testid="input-block-heading"
                      className="qr-field mt-1.5"
                    />
                  </label>

                  {/* Note / Description */}
                  {!['catering', 'faq', 'divider', 'spacer'].includes(activeBlock.key) && (
                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>{t('description')}</span>
                      <textarea
                        rows={3}
                        value={activeBlock.content.note || ''}
                        onChange={(e) => handleUpdateBlockContent(activeBlock.id, { note: e.target.value })}
                        className="qr-field mt-1.5"
                      />
                    </label>
                  )}

                  {/* CTA Button URL */}
                  {activeBlock.key === 'cta' && (
                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>Link URL</span>
                      <input
                        type="url"
                        value={activeBlock.content.url || ''}
                        onChange={(e) => handleUpdateBlockContent(activeBlock.id, { url: e.target.value })}
                        placeholder="https://..."
                        className="qr-field mt-1.5"
                      />
                    </label>
                  )}

                  {/* Catering Entrees */}
                  {activeBlock.key === 'catering' && (
                    <div>
                      <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                        {t('entrees')}
                      </span>
                      <textarea
                        rows={4}
                        value={(activeBlock.content.entree || []).join('\n')}
                        onChange={(e) =>
                          handleUpdateBlockContent(activeBlock.id, {
                            entree: e.target.value
                              .split('\n')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className="qr-field font-mono text-xs"
                        placeholder="Dish 1&#10;Dish 2&#10;Dish 3"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('sections')}
                      className="qr-button qr-button--primary flex-1 justify-center min-h-11"
                    >
                      <Check size={16} />
                      <span>{t('saveChanges')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBlock(activeBlock.id)}
                      className="qr-button qr-button--danger px-4 min-h-11"
                      title={t('delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* SHEET E: ADD NEW SECTION CATALOG */}
              {activeTab === 'add-block' && (
                <div className="mt-5 space-y-4">
                  <p className="text-xs text-[#2D2421]/70">
                    {t('sectionCatalogHelp')}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(
                      [
                        { key: 'catering', icon: Utensils, label: t('catering') },
                        { key: 'schedule', icon: CalendarDays, label: t('schedule') },
                        { key: 'dress', icon: Shirt, label: t('dress') },
                        { key: 'registry', icon: Gift, label: t('registry') },
                        { key: 'song', icon: Music2, label: t('song') },
                        { key: 'faq', icon: HelpCircle, label: t('faq') },
                        { key: 'host', icon: User, label: t('host') },
                        { key: 'venue', icon: MapPin, label: t('venue') },
                        { key: 'text', icon: Sparkles, label: t('text') },
                        { key: 'cta', icon: ExternalLink, label: t('cta') },
                        { key: 'divider', icon: Minus, label: t('divider') },
                        { key: 'spacer', icon: Layers, label: t('spacer') },
                      ] as const
                    ).map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => handleAddBlock(cat.key)}
                          data-testid={`button-add-catalog-${cat.key}`}
                          className="focus-ring flex flex-col items-center justify-center p-4 rounded-2xl border border-[#D4AF37]/40 bg-white/70 hover:bg-white hover:border-[#0A2E23] transition shadow-xs text-center"
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A2E23]/10 text-[#0A2E23] mb-2">
                            <Icon size={18} />
                          </span>
                          <span className="text-xs font-bold text-[#0A2E23]">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
