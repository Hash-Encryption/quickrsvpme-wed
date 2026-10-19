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
  Camera,
  Check,
  ChevronDown,
  Clock,
  Coffee,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Gift,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  MapPin,
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
  Upload,
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
  OCCASION_BLUEPRINTS,
  partyStyles,
  partyTemplates,
  resolvePartyStyleId,
  type OccasionBlueprint,
  type PartyEventData,
  type PartyLayout,
  type PartyMotion,
  type PartyTemplateId,
  type PartyTypography,
} from './model.ts';
import {
  PartyInvitationRenderer,
  QRPassMark,
  type BlockContent,
  type BlockKey,
  type StudioBlock,
} from './PartyInvitationRenderer.tsx';
import { DualHijriCalendar } from '../components/DualHijriCalendar.tsx';
import { SAUDI_TIME_ANCHORS } from '../utils/saudiCalendar.ts';
import {
  extractColorsFromImageDataUrl,
  SAUDI_LUXURY_PALETTES,
} from '../utils/brandColorExtractor.ts';

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

const SAUDI_WORDING_PRESETS = [
  {
    label: 'رسمية للشركات',
    labelEn: 'Corporate Formal',
    text: 'يسر مجلس الإدارة دعوتكم لحضور حفل العشاء السنوي وتكريم نخبة الإنجازات والشركاء في أمسية استثنائية تجمع قادة الأعمال.',
  },
  {
    label: 'احتفالية راقية',
    labelEn: 'Warm Celebration',
    text: 'يسعدنا ويشرفنا حضوركم ومشاركتنا بهجة هذه المناسبة السعيدة، لنصنع معاً ذكريات تدوم في أمسية مفعمة بالألفة والسرور.',
  },
  {
    label: 'تخرج وإنجاز',
    labelEn: 'Graduation & Honor',
    text: 'بكل فخر واعتزاز، نتشرف بدعوتكم لمشاركتنا فرحة التخرج والاحتفاء بمسيرة ملؤها الاجتهاد والنجاح والتميز.',
  },
  {
    label: 'مجلس واستراحة',
    labelEn: 'Majlis Gathering',
    text: 'نتشرف بحضوركم الكريم في مجلسنا العامر ونسعد بطيب اللقاء وتبادل الأحاديث الودية في أجواء أخوية دافئة.',
  },
];

const ETIQUETTE_BADGE_OPTIONS = [
  'جنة الأطفال منازلهم',
  'ممنوع التصوير',
  'الدخول ببطاقة الدعوة',
  'خدمة صف السيارات (Valet)',
];

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

  const isArabic = appLocale === 'ar';

  // Primary State
  const [event, setEvent] = useState<PartyEventData>(initialEvent);
  const [blocks, setBlocks] = useState<StudioBlock[]>(initialBlocks);
  const [invitationLocale, setInvitationLocale] = useState<InvitationLocale>(initialLocale);

  // View Mode: Invitation Card vs. VIP Gate Pass
  const [viewMode, setViewMode] = useState<'invitation' | 'pass'>('invitation');

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
  const [isExtractingColors, setIsExtractingColors] = useState(false);

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

  // 1-Tap Blueprint Application
  const handleApplyBlueprint = (bp: OccasionBlueprint) => {
    pushHistory(event, blocks, invitationLocale);

    const updatedEvent: PartyEventData = {
      ...event,
      occasionPresetId: bp.id,
      templateId: bp.templateId,
      styleId: bp.styleId,
      title: isArabic ? bp.titleAr : bp.titleEn,
      subtitle: isArabic ? bp.subtitleAr : bp.subtitleEn,
      invitationWording: isArabic ? bp.wordingAr : bp.wordingEn,
      badgeText: isArabic ? bp.badgeTextAr : bp.badgeTextEn,
      etiquetteBadges: isArabic ? bp.etiquetteBadgesAr ?? [] : bp.etiquetteBadgesEn ?? [],
      backgroundColor: null,
      primaryColor: null,
      accentColor: null,
    };

    // Enable only recommended sections (2-3 sections) for clean luxury layout
    const updatedBlocks = blocks.map((b) => ({
      ...b,
      enabled: bp.recommendedBlockKeys.includes(b.key),
    }));

    setEvent(updatedEvent);
    setBlocks(updatedBlocks);
    void onSave?.(updatedEvent, updatedBlocks, invitationLocale);
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
    const clone: StudioBlock = {
      ...structuredClone(blocks[idx]),
      id: crypto.randomUUID(),
      label: `${blocks[idx].label} (${isArabic ? 'نسخة' : 'Copy'})`,
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
        swatches:
          key === 'catering' || key === 'dress'
            ? ['#0A2E23', '#D4AF37', '#C28B55']
            : undefined,
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

  // Logo file upload handler
  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        updateEventFields({ logoUrl: dataUrl });
      }
    };
    reader.readAsDataURL(file);
  };

  // Background image file upload handler
  const handleBackgroundUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        updateEventFields({ backgroundImageUrl: dataUrl });
      }
    };
    reader.readAsDataURL(file);
  };

  // Apply colors from Logo
  const handleApplyLogoColors = async () => {
    if (!event.logoUrl) return;
    setIsExtractingColors(true);
    try {
      const palette = await extractColorsFromImageDataUrl(event.logoUrl);
      updateEventFields({
        backgroundColor: palette.background,
        primaryColor: palette.primary,
        accentColor: palette.accent,
        brandPalette: palette.swatches,
      });
    } finally {
      setIsExtractingColors(false);
    }
  };

  const activeBlock = blocks.find((b) => b.id === selectedBlockId);

  return (
    <div
      className={`party-studio-shell relative flex min-h-[100dvh] flex-col bg-[#FAF7F2] text-[#1F2923] antialiased ${
        embedded ? 'rounded-3xl border border-[#D4AF37]/35 shadow-sm' : ''
      }`}
      dir={dir}
    >
      {/* 1. ZONE A1: Single 56px Frosted Glass Bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-black/[0.06] bg-[#FAF7F2]/90 px-4 sm:px-6 backdrop-blur-xl">
        {/* Left: Back Arrow & Status */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href={backHref}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-[#17251F] transition hover:bg-black/[0.08] active:scale-95"
            aria-label={backLabel || t('backToProjects')}
            data-testid="link-back"
          >
            <ArrowLeft
              size={16}
              className={`transition-transform ${dir === 'rtl' ? 'rotate-180' : ''}`}
            />
          </Link>

          <div className="min-w-0">
            <h1 className="truncate text-xs sm:text-sm font-semibold text-[#17251F]">
              {draftTitle || event.title || t('partyStudio')}
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] text-[#756F66]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  saveStatus === 'saving'
                    ? 'bg-[#C29B61] animate-pulse'
                    : saveStatus === 'error' || saveStatus === 'conflict'
                    ? 'bg-[#B4534B]'
                    : 'bg-[#1B6344]'
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
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1 border-e border-black/[0.06] pe-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              aria-label={t('undo')}
              title={t('undo')}
              data-testid="button-undo"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] bg-white/80 text-[#17251F] transition hover:bg-white disabled:opacity-30"
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              aria-label={t('redo')}
              title={t('redo')}
              data-testid="button-redo"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] bg-white/80 text-[#17251F] transition hover:bg-white disabled:opacity-30"
            >
              <Redo2 size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsPreviewOnly(!isPreviewOnly)}
            aria-pressed={isPreviewOnly}
            data-testid="button-preview-toggle"
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition active:scale-95 ${
              isPreviewOnly
                ? 'border-[#0C2D24] bg-[#0C2D24] text-white shadow-xs'
                : 'border-black/[0.08] bg-white/80 text-[#17251F] hover:bg-white'
            }`}
          >
            {isPreviewOnly ? <Edit3 size={13} /> : <Eye size={13} />}
            <span>{t(isPreviewOnly ? 'editView' : 'previewView')}</span>
          </button>

          {onPublish && (
            <button
              type="button"
              disabled={isPublishing || !publishAllowed}
              onClick={() => void onPublish()}
              data-testid="button-publish-party"
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#0C2D24] px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#144837] disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
            >
              <Sparkles size={13} className="text-[#C29B61]" />
              <span>{isPublishing ? t('publishing') : publishLabel || t('publishDraft')}</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. ZONE A2: Card vs. VIP Pass Switcher */}
      <div className="flex items-center justify-center gap-1.5 p-1 bg-black/[0.04] rounded-full border border-black/[0.06] w-fit mx-auto mt-4 z-20">
        <button
          type="button"
          onClick={() => setViewMode('invitation')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition ${
            viewMode === 'invitation'
              ? 'bg-[#0A2E23] text-white shadow-xs'
              : 'text-[#2D2421]/70 hover:text-[#0A2E23]'
          }`}
        >
          <span>💌</span>
          <span>{isArabic ? 'بطاقة الدعوة' : 'Invitation Card'}</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('pass')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition ${
            viewMode === 'pass'
              ? 'bg-[#0A2E23] text-white shadow-xs'
              : 'text-[#2D2421]/70 hover:text-[#0A2E23]'
          }`}
        >
          <span>🎟️</span>
          <span>{isArabic ? 'بطاقة الدخول QR' : 'VIP Gate Pass'}</span>
        </button>
      </div>

      {/* 3. ZONE B1: 1-Tap Occasion Blueprints Strip */}
      <div className="w-full max-w-2xl mx-auto px-4 mt-3 mb-1">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {OCCASION_BLUEPRINTS.map((bp) => {
            const isSelected = event.occasionPresetId === bp.id;
            return (
              <button
                key={bp.id}
                type="button"
                onClick={() => handleApplyBlueprint(bp)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition shrink-0 active:scale-95 ${
                  isSelected
                    ? 'border-[#0A2E23] bg-[#0A2E23] text-white shadow-xs'
                    : 'border-[#D4AF37]/40 bg-white/80 text-[#17251F] hover:bg-white'
                }`}
              >
                <span>{bp.icon}</span>
                <span>
                  {isArabic
                    ? bp.titleAr.split(' ')[0] + ' ' + (bp.titleAr.split(' ')[1] || '')
                    : bp.titleEn.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. ZONE B2: Dominant Central Canvas with Seamless Luxury Poster */}
      <main className="relative flex-1 overflow-y-auto px-3 sm:px-6 py-4 pb-28 sm:pb-32 flex justify-center">
        <div
          data-testid="party-studio-canvas"
          className="party-device-frame relative w-full max-w-[430px] rounded-[36px] border-[6px] border-[#2A3B32]/80 bg-white shadow-2xl overflow-hidden transition-all duration-300"
        >
          {viewMode === 'pass' ? (
            /* Standalone VIP Gate Pass View */
            <div className="min-h-[100dvh] bg-[#0F1E2E] text-white p-6 sm:p-8 flex flex-col items-center justify-center text-center">
              <div className="party-pass-card relative w-full overflow-hidden rounded-[28px] border border-[#D4AF37]/50 bg-[#172B3E] p-6 sm:p-8 text-center shadow-2xl">
                <div className="absolute top-0 inset-x-0 mx-auto h-3 w-16 rounded-b-xl bg-black/40 border-b border-x border-[#D4AF37]/30" />
                <div className="pt-2 inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/30 bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]">
                  <Sparkles size={11} />
                  <span>{isArabic ? 'بطاقة الدخول الرقمية · VIP' : 'DIGITAL GATE PASS'}</span>
                </div>
                <h3 className="mt-4 font-display text-2xl font-bold text-[#F4F7F9]">
                  {event.title}
                </h3>
                {event.hostName && (
                  <p className="mt-1 text-xs opacity-75">{event.hostName}</p>
                )}
                <div className="mx-auto mt-6 w-fit">
                  <QRPassMark label="VIP Pass QR" />
                </div>
                <div className="mt-5 rounded-2xl border border-[#D4AF37]/25 bg-black/20 p-4 text-xs text-start">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-[#D4AF37] tracking-widest">
                      VIP-2026-PASS
                    </span>
                    <span className="text-[10px] font-bold uppercase text-[#D4AF37] bg-[#D4AF37]/15 px-2 py-0.5 rounded-full">
                      {isArabic ? 'دخول مؤكد' : 'CONFIRMED'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold">{isArabic ? 'الضيف الكريم' : 'VIP Guest'}</p>
                  <p className="mt-0.5 text-[11px] opacity-70">
                    {formatPartyDate(event.date, invitationLocale)} &bull;{' '}
                    {event.venue || (isArabic ? 'الموقع' : 'Venue')}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Seamless Luxury Poster View */
            <PartyInvitationRenderer
              event={event}
              blocks={blocks}
              invitationLocale={invitationLocale}
              uiLocale={appLocale}
              isEditMode={!isPreviewOnly}
              preview={isPreviewOnly}
              selectedBlockId={selectedBlockId}
              onSelectBlock={handleSelectBlockFromPreview}
              onSelectSection={handleSelectSectionFromPreview}
              onMoveBlock={handleMoveBlock}
              onToggleBlock={handleToggleBlock}
              onDeleteBlock={handleDeleteBlock}
              onDuplicateBlock={handleDuplicateBlock}
              onChangeTitleScale={(scale) => updateEventFields({ titleScale: scale })}
            />
          )}
        </div>
      </main>

      {/* 5. ZONE C: 4 Organized Studio Bottom Tabs */}
      {!isPreviewOnly && (
        <nav
          className="fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t border-[#D4AF37]/35 bg-[#FAF7F2]/95 px-4 py-2.5 backdrop-blur-md shadow-lg"
          aria-label={t('guestExperience')}
        >
          {/* Details / Information Tab */}
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

          {/* Brand / Design Tab */}
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

      {/* 6. CONTEXTUAL DRAWER / BOTTOM SHEET */}
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

              {/* SHEET A: INFORMATION (DETAILS) */}
              {activeTab === 'info' && (
                <div className="mt-5 space-y-4">
                  {/* 1-Tap Saudi Wording Presets */}
                  <div>
                    <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                      ✨ {isArabic ? 'صياغات دعوة جاهزة' : 'Wording Presets'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {SAUDI_WORDING_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => updateEventFields({ invitationWording: preset.text })}
                          className="px-3 py-1 rounded-full border border-[#D4AF37]/40 bg-white/70 hover:bg-white text-[11px] font-semibold text-[#0A2E23] transition shadow-2xs"
                        >
                          {isArabic ? preset.label : preset.labelEn}
                        </button>
                      ))}
                    </div>
                  </div>

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

                  {/* Dual Calendar with Hijri Toggle */}
                  <div className="rounded-2xl border border-[#D4AF37]/40 bg-white/60 p-4">
                    <span className="block text-xs font-bold text-[#0A2E23] mb-3">
                      📅 {isArabic ? 'تاريخ المناسبة (ميلادي وهجري)' : 'Event Date'}
                    </span>
                    <DualHijriCalendar
                      value={event.date}
                      onChange={(d) => updateEventFields({ date: d })}
                      locale={appLocale}
                    />
                    {/* Synced native input for test compatibility */}
                    <input
                      type="date"
                      value={event.date}
                      onChange={(e) => updateEventFields({ date: e.target.value })}
                      data-testid="input-event-date"
                      className="sr-only"
                      tabIndex={-1}
                      aria-hidden="true"
                    />

                    {/* 1-Tap Toggle for Hijri Date display on card */}
                    <label className="flex items-center gap-2.5 mt-3 pt-3 border-t border-[#D4AF37]/30 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={event.showHijriDate !== false}
                        onChange={(e) => updateEventFields({ showHijriDate: e.target.checked })}
                        className="h-4 w-4 rounded text-[#0A2E23]"
                      />
                      <span className="text-xs font-bold text-[#0A2E23]">
                        {isArabic ? 'إظهار التاريخ الهجري على بطاقة الدعوة' : 'Show Hijri date on invitation card'}
                      </span>
                    </label>
                  </div>

                  {/* 1-Tap Saudi Time Anchors */}
                  <div>
                    <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                      ⏰ {isArabic ? 'وقت الحفل والضيافة' : 'Event Timing'}
                    </span>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {SAUDI_TIME_ANCHORS.map((anchor) => (
                        <button
                          key={anchor.id}
                          type="button"
                          onClick={() =>
                            updateEventFields({
                              startTime: anchor.time,
                              timeLabel: isArabic ? anchor.labelAr : anchor.labelEn,
                            })
                          }
                          className="px-3 py-1 rounded-full border border-[#D4AF37]/40 bg-white/70 hover:bg-white text-[11px] font-semibold text-[#0A2E23] transition"
                        >
                          {isArabic ? anchor.labelAr : anchor.labelEn}
                        </button>
                      ))}
                    </div>
                    <input
                      type="time"
                      value={event.startTime}
                      onChange={(e) => updateEventFields({ startTime: e.target.value })}
                      className="qr-field"
                    />
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

                  {/* Google Maps Link */}
                  <label className="block text-xs font-bold text-[#0A2E23]">
                    <span>📍 {isArabic ? 'رابط خرائط Google' : 'Google Maps Link'}</span>
                    <input
                      type="url"
                      value={event.mapUrl || ''}
                      onChange={(e) => updateEventFields({ mapUrl: e.target.value })}
                      placeholder="https://maps.google.com/..."
                      className="qr-field mt-1.5"
                    />
                  </label>

                  {/* 1-Tap Etiquette Badges */}
                  <div>
                    <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                      🏷️ {isArabic ? 'شارات الدخول واللباقة' : 'Etiquette Badges'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {ETIQUETTE_BADGE_OPTIONS.map((badge) => {
                        const active = (event.etiquetteBadges || []).includes(badge);
                        return (
                          <button
                            key={badge}
                            type="button"
                            onClick={() => {
                              const curr = event.etiquetteBadges || [];
                              const next = active
                                ? curr.filter((b) => b !== badge)
                                : [...curr, badge];
                              updateEventFields({ etiquetteBadges: next });
                            }}
                            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
                              active
                                ? 'border-[#0A2E23] bg-[#0A2E23] text-white shadow-xs'
                                : 'border-[#D4AF37]/40 bg-white/70 hover:bg-white text-[#0A2E23]'
                            }`}
                          >
                            {badge}
                          </button>
                        );
                      })}
                    </div>
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

              {/* SHEET B: DESIGN (BRAND & THEME) */}
              {activeTab === 'design' && (
                <div className="mt-5 space-y-6">
                  {/* Company / Personal Logo Card */}
                  <div className="rounded-2xl border border-[#D4AF37]/40 bg-white/70 p-4">
                    <span className="block text-xs font-bold text-[#0A2E23] mb-2">
                      🏢 {isArabic ? 'شعار الشركة أو المنظم' : 'Company or Host Logo'}
                    </span>
                    <div className="flex items-center gap-3">
                      {event.logoUrl ? (
                        <div className="relative">
                          <img
                            src={event.logoUrl}
                            alt="Logo"
                            className="h-12 w-12 rounded-xl object-contain border p-1 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => updateEventFields({ logoUrl: null })}
                            className="absolute -top-1.5 -end-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#B4534B] text-white text-[10px]"
                          >
                            &times;
                          </button>
                        </div>
                      ) : (
                        <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#D4AF37] bg-white text-[#D4AF37] hover:bg-black/5">
                          <Upload size={18} />
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleLogoUpload(f);
                            }}
                          />
                        </label>
                      )}

                      <div className="flex-1">
                        <label className="inline-block text-xs font-bold text-[#0A2E23] cursor-pointer">
                          <span className="underline">{isArabic ? 'رفع شعار' : 'Upload Logo'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleLogoUpload(f);
                            }}
                          />
                        </label>
                        <p className="text-[11px] text-[#2D2421]/60">PNG, SVG, JPG, WebP</p>
                      </div>
                    </div>

                    {/* Logo Size and Shape pills + Auto-Theme */}
                    {event.logoUrl && (
                      <div className="mt-3 pt-3 border-t border-[#D4AF37]/20 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>{isArabic ? 'الحجم' : 'Size'}:</span>
                          <div className="flex gap-1.5">
                            {(['sm', 'md', 'lg'] as const).map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => updateEventFields({ logoSize: sz })}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition ${
                                  (event.logoSize || 'md') === sz
                                    ? 'bg-[#0A2E23] text-white'
                                    : 'bg-white border text-[#0A2E23]'
                                }`}
                              >
                                {sz}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>{isArabic ? 'الشكل' : 'Shape'}:</span>
                          <div className="flex gap-1.5">
                            {(
                              [
                                ['original', isArabic ? 'أصلي' : 'Original'],
                                ['circle', isArabic ? 'دائري' : 'Circle'],
                                ['rounded', isArabic ? 'مستدير' : 'Rounded'],
                              ] as const
                            ).map(([shp, label]) => (
                              <button
                                key={shp}
                                type="button"
                                onClick={() => updateEventFields({ logoShape: shp })}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                                  (event.logoShape || 'original') === shp
                                    ? 'bg-[#0A2E23] text-white'
                                    : 'bg-white border text-[#0A2E23]'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 1-Tap Auto-Color from Logo Button */}
                        <button
                          type="button"
                          onClick={handleApplyLogoColors}
                          disabled={isExtractingColors}
                          className="w-full mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-[#D4AF37] px-3 py-2 text-xs font-bold text-black shadow-xs hover:brightness-105 transition"
                        >
                          <Sparkles size={14} />
                          <span>
                            {isExtractingColors
                              ? isArabic
                                ? 'جاري الاستخراج...'
                                : 'Extracting...'
                              : isArabic
                              ? '✨ تطبيق ألوان الشعار تلقائياً'
                              : '✨ Apply Brand Colors from Logo'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Custom Background Photo + Readability Dimmer */}
                  <div className="rounded-2xl border border-[#D4AF37]/40 bg-white/70 p-4">
                    <span className="block text-xs font-bold text-[#0A2E23] mb-2">
                      🖼️ {isArabic ? 'صورة خلفية البطاقة' : 'Background Photo'}
                    </span>
                    <div className="flex items-center gap-3">
                      {event.backgroundImageUrl ? (
                        <div className="relative">
                          <img
                            src={event.backgroundImageUrl}
                            alt="Background"
                            className="h-12 w-12 rounded-xl object-cover border p-1 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => updateEventFields({ backgroundImageUrl: null })}
                            className="absolute -top-1.5 -end-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#B4534B] text-white text-[10px]"
                          >
                            &times;
                          </button>
                        </div>
                      ) : (
                        <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#D4AF37] bg-white text-[#D4AF37] hover:bg-black/5">
                          <ImageIcon size={18} />
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleBackgroundUpload(f);
                            }}
                          />
                        </label>
                      )}

                      <div className="flex-1">
                        <label className="inline-block text-xs font-bold text-[#0A2E23] cursor-pointer">
                          <span className="underline">
                            {isArabic ? 'رفع صورة خلفية' : 'Upload Background'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleBackgroundUpload(f);
                            }}
                          />
                        </label>
                        <p className="text-[11px] text-[#2D2421]/60">JPG, WebP, PNG</p>
                      </div>
                    </div>

                    {event.backgroundImageUrl && (
                      <div className="mt-3 pt-3 border-t border-[#D4AF37]/20 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>{isArabic ? 'وضعية العرض' : 'Fit'}:</span>
                          <div className="flex gap-2">
                            {(['cover', 'contain'] as const).map((fit) => (
                              <button
                                key={fit}
                                type="button"
                                onClick={() => updateEventFields({ backgroundFitMode: fit })}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition ${
                                  (event.backgroundFitMode || 'cover') === fit
                                    ? 'bg-[#0A2E23] text-white'
                                    : 'bg-white border text-[#0A2E23]'
                                }`}
                              >
                                {fit}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-semibold mb-1">
                            <span>{isArabic ? 'تعتيم الخلفية لضمان القراءة' : 'Readability Dimmer'}:</span>
                            <span className="font-mono">
                              {Math.round((event.backgroundOverlayOpacity ?? 0.45) * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="0.85"
                            step="0.05"
                            value={event.backgroundOverlayOpacity ?? 0.45}
                            onChange={(e) =>
                              updateEventFields({ backgroundOverlayOpacity: parseFloat(e.target.value) })
                            }
                            className="w-full accent-[#0A2E23]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Template Family Selection */}
                  <div>
                    <span className="block text-xs font-bold text-[#0A2E23] mb-2">
                      {t('templateFamily')}
                    </span>
                    <div className="grid grid-cols-2 gap-2.5">
                      {Object.values(partyTemplates).map((tpl) => {
                        const isChosen = event.templateId === tpl.id;
                        const name = isArabic ? tpl.nameAr : tpl.name;
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            data-testid={`button-party-template-${tpl.id}`}
                            data-option-id={`party-template-option-${tpl.id}`}
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
                        const name = isArabic ? s.nameAr : s.name;

                        return (
                          <button
                            key={s.id}
                            type="button"
                            data-testid={`button-party-style-${s.id}`}
                            data-option-id={`party-style-option-${s.id}`}
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

                  {/* Curated Saudi Luxury Palettes */}
                  <div>
                    <span className="block text-xs font-bold text-[#0A2E23] mb-2">
                      🎨 {isArabic ? 'باليتات فاخرة منتقاة للمناسبات السعودية' : 'Curated Luxury Palettes'}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {SAUDI_LUXURY_PALETTES.map((pal) => (
                        <button
                          key={pal.id}
                          type="button"
                          onClick={() =>
                            updateEventFields({
                              backgroundColor: pal.backgroundColor,
                              primaryColor: pal.primaryColor,
                              accentColor: pal.accentColor,
                            })
                          }
                          className="p-2.5 rounded-xl border border-[#D4AF37]/40 bg-white hover:bg-black/5 text-start transition flex items-center justify-between"
                        >
                          <div>
                            <p className="text-[11px] font-bold text-[#0A2E23]">
                              {isArabic ? pal.nameAr.split('·')[0].trim() : pal.name}
                            </p>
                          </div>
                          <div className="flex -space-x-1">
                            <span
                              className="h-3.5 w-3.5 rounded-full border"
                              style={{ backgroundColor: pal.backgroundColor }}
                            />
                            <span
                              className="h-3.5 w-3.5 rounded-full border"
                              style={{ backgroundColor: pal.accentColor }}
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Segmented Pills for Typography, Layout, Motion (No ugly select dropdowns!) */}
                  <div className="space-y-3 border-t border-[#D4AF37]/30 pt-4">
                    {/* Typography Pills */}
                    <div>
                      <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                        {t('typography')}
                      </span>
                      <div className="flex gap-2">
                        {(['display', 'modern'] as const).map((typ) => (
                          <button
                            key={typ}
                            type="button"
                            onClick={() => updateEventFields({ typography: typ })}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                              event.typography === typ
                                ? 'bg-[#0A2E23] text-white border-[#0A2E23]'
                                : 'bg-white border-[#D4AF37]/40 text-[#0A2E23]'
                            }`}
                          >
                            {typ === 'display' ? t('displayStyle') : t('modernStyle')}
                          </button>
                        ))}
                      </div>
                      <select
                        value={event.typography}
                        onChange={(e) => updateEventFields({ typography: e.target.value as PartyTypography })}
                        className="sr-only"
                        tabIndex={-1}
                      >
                        <option value="display">{t('displayStyle')}</option>
                        <option value="modern">{t('modernStyle')}</option>
                      </select>
                    </div>

                    {/* Layout Pills */}
                    <div>
                      <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                        {t('layout')}
                      </span>
                      <div className="flex gap-2">
                        {(['centered', 'editorial'] as const).map((lay) => (
                          <button
                            key={lay}
                            type="button"
                            onClick={() => updateEventFields({ layout: lay })}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                              event.layout === lay
                                ? 'bg-[#0A2E23] text-white border-[#0A2E23]'
                                : 'bg-white border-[#D4AF37]/40 text-[#0A2E23]'
                            }`}
                          >
                            {lay === 'centered' ? t('centered') : t('editorial')}
                          </button>
                        ))}
                      </div>
                      <select
                        value={event.layout}
                        onChange={(e) => updateEventFields({ layout: e.target.value as PartyLayout })}
                        className="sr-only"
                        tabIndex={-1}
                      >
                        <option value="centered">{t('centered')}</option>
                        <option value="editorial">{t('editorial')}</option>
                      </select>
                    </div>

                    {/* Motion Pills */}
                    <div>
                      <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                        {t('motion')}
                      </span>
                      <div className="flex gap-2">
                        {(['gentle', 'none'] as const).map((mot) => (
                          <button
                            key={mot}
                            type="button"
                            onClick={() => updateEventFields({ motion: mot })}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                              event.motion === mot
                                ? 'bg-[#0A2E23] text-white border-[#0A2E23]'
                                : 'bg-white border-[#D4AF37]/40 text-[#0A2E23]'
                            }`}
                          >
                            {mot === 'gentle' ? t('gentle') : t('none')}
                          </button>
                        ))}
                      </div>
                      <select
                        value={event.motion}
                        onChange={(e) => updateEventFields({ motion: e.target.value as PartyMotion })}
                        className="sr-only"
                        tabIndex={-1}
                      >
                        <option value="gentle">{t('gentle')}</option>
                        <option value="none">{t('none')}</option>
                      </select>
                    </div>
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

                  {/* Invitation Language Pills */}
                  <div className="border-t border-[#D4AF37]/30 pt-4">
                    <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                      {t('invitationLanguage')}
                    </span>
                    <div className="flex gap-2">
                      {(['ar', 'en'] as const).map((lng) => (
                        <button
                          key={lng}
                          type="button"
                          onClick={() => {
                            setInvitationLocale(lng);
                            void onSave?.(event, blocks, lng);
                          }}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                            invitationLocale === lng
                              ? 'bg-[#0A2E23] text-white border-[#0A2E23]'
                              : 'bg-white border-[#D4AF37]/40 text-[#0A2E23]'
                          }`}
                        >
                          {lng === 'ar' ? t('arabic') : t('english')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* SHEET C: SECTIONS (Clean Cards, No 36-Circle Clutter!) */}
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

                  {/* Section Cards */}
                  <div className="space-y-3">
                    {blocks.map((b, idx) => (
                      <div
                        key={b.id}
                        className={`rounded-2xl border p-3.5 transition flex flex-col justify-between gap-3 ${
                          b.enabled
                            ? 'border-[#D4AF37]/45 bg-white/90 shadow-2xs'
                            : 'border-[#2D2421]/15 bg-black/5 opacity-55'
                        }`}
                      >
                        {/* Top Row: Icon + Full Title & Subtitle + Visibility Pill */}
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBlockId(b.id);
                              setActiveTab('edit-block');
                            }}
                            className="flex items-center gap-3 min-w-0 text-start flex-1"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0A2E23]/10 text-[#0A2E23]">
                              <Edit3 size={15} />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-[#0A2E23]">
                                {b.label || t(b.key)}
                              </p>
                              <p className="truncate text-[11px] text-[#2D2421]/65">
                                {b.content.heading || b.key}
                              </p>
                            </div>
                          </button>

                          {/* Show/Hide Toggle Pill */}
                          <button
                            type="button"
                            onClick={() => handleToggleBlock(b.id)}
                            data-testid={`button-toggle-${b.id}`}
                            aria-label={t(b.enabled ? 'hide' : 'show')}
                            className={`focus-ring inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition ${
                              b.enabled
                                ? 'bg-[#0A2E23] text-white shadow-xs'
                                : 'bg-black/10 text-black/50'
                            }`}
                          >
                            {b.enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                            <span>{t(b.enabled ? 'visible' : 'hide')}</span>
                          </button>
                        </div>

                        {/* Bottom Action Bar: Edit on Left, Move/Duplicate/Delete on Right */}
                        <div className="flex items-center justify-between border-t border-[#D4AF37]/20 pt-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBlockId(b.id);
                              setActiveTab('edit-block');
                            }}
                            aria-label={`${t('edit')} ${b.label}`}
                            data-testid={`button-edit-block-${b.id}`}
                            className="focus-ring inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-[#D4AF37]/50 bg-white text-xs font-semibold text-[#0A2E23] hover:bg-[#FAF7F2]"
                          >
                            <Edit3 size={13} />
                            <span>{t('edit')}</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleMoveBlock(idx, -1)}
                              disabled={idx === 0}
                              data-testid={`button-move-up-${b.id}`}
                              aria-label={`${t('moveUp')} ${b.label}`}
                              className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4AF37]/40 text-[#0A2E23] disabled:opacity-25 hover:bg-white"
                              title="Move Up"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveBlock(idx, 1)}
                              disabled={idx === blocks.length - 1}
                              data-testid={`button-move-down-${b.id}`}
                              aria-label={`${t('moveDown')} ${b.label}`}
                              className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4AF37]/40 text-[#0A2E23] disabled:opacity-25 hover:bg-white"
                              title="Move Down"
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateBlock(b.id)}
                              data-testid={`button-duplicate-${b.id}`}
                              aria-label={`${t('duplicate')} ${b.label}`}
                              className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4AF37]/40 text-[#0A2E23] hover:bg-white"
                              title="Duplicate"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBlock(b.id)}
                              data-testid={`button-delete-${b.id}`}
                              aria-label={`${t('delete')} ${b.label}`}
                              className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4AF37]/40 text-[#8C302B] hover:bg-white"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SHEET D: UPGRADED CUSTOM BLOCK EDITORS */}
              {activeTab === 'edit-block' && activeBlock && (
                <div className="mt-5 space-y-4">
                  <label className="block text-xs font-bold text-[#0A2E23]">
                    <span>{t('heading')}</span>
                    <input
                      value={activeBlock.content.heading}
                      onChange={(e) =>
                        handleUpdateBlockContent(activeBlock.id, { heading: e.target.value })
                      }
                      data-testid="input-block-heading"
                      className="qr-field mt-1.5"
                    />
                  </label>

                  {/* 1. SCHEDULE / TIMELINE EDITOR */}
                  {activeBlock.key === 'schedule' && (
                    <div className="space-y-3 rounded-2xl border border-[#D4AF37]/40 bg-white/70 p-4">
                      <span className="block text-xs font-bold text-[#0A2E23]">
                        ⏱️ {isArabic ? 'صياغات وجداول جاهزة' : 'Timeline Presets'}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          {
                            label: 'مؤتمر وملتقى',
                            items: [
                              { time: '8:00 AM', title: 'التسجيل والاستقبال' },
                              { time: '9:00 AM', title: 'الجلسة الافتتاحية' },
                              { time: '11:30 AM', title: 'استراحة القهوة' },
                              { time: '1:00 PM', title: 'الغداء والختام' },
                            ],
                          },
                          {
                            label: 'عشاء وتكريم',
                            items: [
                              { time: '8:30 PM', title: 'الاستقبال والقهوة' },
                              { time: '9:30 PM', title: 'العشاء والتكريم' },
                              { time: '10:30 PM', title: 'الختام' },
                            ],
                          },
                          {
                            label: 'احتفال مسائي',
                            items: [
                              { time: '8:00 PM', title: 'وصول الضيوف' },
                              { time: '9:00 PM', title: 'مراسم الحفل' },
                              { time: '10:00 PM', title: 'مأدبة العشاء' },
                            ],
                          },
                        ].map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              handleUpdateBlockContent(activeBlock.id, {
                                scheduleItems: preset.items,
                              })
                            }
                            className="px-3 py-1 rounded-full border border-[#D4AF37]/40 bg-white text-[11px] font-semibold text-[#0A2E23] hover:bg-[#FAF7F2]"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2 pt-2">
                        <span className="block text-xs font-bold text-[#0A2E23]">
                          {isArabic ? 'فقرات البرنامج' : 'Timeline Rows'}
                        </span>
                        {(
                          activeBlock.content.scheduleItems || [
                            { time: '8:30 PM', title: 'الاستقبال والقهوة السعودية' },
                            { time: '9:30 PM', title: 'مأدبة العشاء الفاخرة' },
                          ]
                        ).map((item, rowIdx) => (
                          <div key={rowIdx} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={item.time}
                              placeholder="8:30 PM"
                              onChange={(e) => {
                                const current = [
                                  ...(activeBlock.content.scheduleItems || [
                                    { time: '8:30 PM', title: 'الاستقبال' },
                                    { time: '9:30 PM', title: 'العشاء' },
                                  ]),
                                ];
                                current[rowIdx] = { ...current[rowIdx], time: e.target.value };
                                handleUpdateBlockContent(activeBlock.id, { scheduleItems: current });
                              }}
                              className="qr-field w-24 text-xs font-mono"
                            />
                            <input
                              type="text"
                              value={item.title}
                              placeholder="عنوان الفقرة"
                              onChange={(e) => {
                                const current = [
                                  ...(activeBlock.content.scheduleItems || [
                                    { time: '8:30 PM', title: 'الاستقبال' },
                                    { time: '9:30 PM', title: 'العشاء' },
                                  ]),
                                ];
                                current[rowIdx] = { ...current[rowIdx], title: e.target.value };
                                handleUpdateBlockContent(activeBlock.id, { scheduleItems: current });
                              }}
                              className="qr-field flex-1 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const current = (
                                  activeBlock.content.scheduleItems || []
                                ).filter((_, i) => i !== rowIdx);
                                handleUpdateBlockContent(activeBlock.id, { scheduleItems: current });
                              }}
                              className="text-[#8C302B] hover:opacity-75 p-1"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const current = [
                              ...(activeBlock.content.scheduleItems || []),
                              { time: '10:00 PM', title: 'فقرة جديدة' },
                            ];
                            handleUpdateBlockContent(activeBlock.id, { scheduleItems: current });
                          }}
                          className="text-xs font-bold text-[#0A2E23] flex items-center gap-1 mt-2"
                        >
                          <Plus size={14} />
                          <span>{isArabic ? 'إضافة فقرة جديدة' : 'Add Item'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. CATERING / HOSPITALITY EDITOR */}
                  {activeBlock.key === 'catering' && (
                    <div className="space-y-3 rounded-2xl border border-[#D4AF37]/40 bg-white/70 p-4">
                      {/* Mode Toggle: Note vs Menu */}
                      <span className="block text-xs font-bold text-[#0A2E23]">
                        🍽️ {isArabic ? 'نوع عرض الضيافة' : 'Hospitality Display Mode'}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateBlockContent(activeBlock.id, { mode: 'note' })
                          }
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                            activeBlock.content.mode === 'note'
                              ? 'bg-[#0A2E23] text-white border-[#0A2E23]'
                              : 'bg-white border-[#D4AF37]/40 text-[#0A2E23]'
                          }`}
                        >
                          {isArabic ? 'رسالة ضيافة وعشاء (بدون خيارات)' : 'Hospitality Note'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateBlockContent(activeBlock.id, { mode: 'menu' })
                          }
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                            activeBlock.content.mode !== 'note'
                              ? 'bg-[#0A2E23] text-white border-[#0A2E23]'
                              : 'bg-white border-[#D4AF37]/40 text-[#0A2E23]'
                          }`}
                        >
                          {isArabic ? 'قائمة أطباق يختار منها الضيف' : 'Selectable Dishes'}
                        </button>
                      </div>

                      {/* Presets */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {[
                          {
                            label: 'مأدبة عشاء فاخرة',
                            note: 'نتشرف بحضوركم وتناول طعام العشاء على مائدتنا العامرة.',
                            dishes: ['القهوة السعودية والضيافة', 'مأدبة العشاء الفاخرة', 'الحلويات والمشروبات'],
                          },
                          {
                            label: 'سحور رمضاني',
                            note: 'يسعدنا لقاؤكم على مائدة السحور المبارك في ليالي الخير.',
                            dishes: ['المقبلات والتمور الفاخرة', 'أطباق السحور الرئيسية', 'الشاي والحلويات الشرقية'],
                          },
                          {
                            label: 'قهوة وضيافة ترحيبية',
                            note: 'نسعد بلقائكم وتقديم أطيب القهوة السعودية والتمور الفاخرة.',
                            dishes: ['قهوة سعودية أصيلة', 'تمور محشوة فاخرة', 'مشروبات باردة منعشة'],
                          },
                        ].map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              handleUpdateBlockContent(activeBlock.id, {
                                note: preset.note,
                                entree: preset.dishes,
                              })
                            }
                            className="px-3 py-1 rounded-full border border-[#D4AF37]/40 bg-white text-[11px] font-semibold text-[#0A2E23] hover:bg-[#FAF7F2]"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      {activeBlock.content.mode === 'note' ? (
                        <label className="block text-xs font-bold text-[#0A2E23] pt-2">
                          <span>{isArabic ? 'نص رسالة الضيافة' : 'Hospitality Note'}</span>
                          <textarea
                            rows={3}
                            value={activeBlock.content.note || ''}
                            onChange={(e) =>
                              handleUpdateBlockContent(activeBlock.id, { note: e.target.value })
                            }
                            className="qr-field mt-1.5"
                          />
                        </label>
                      ) : (
                        <div className="pt-2">
                          <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                            {t('entrees')} ({isArabic ? 'طبق في كل سطر' : 'One dish per line'})
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
                    </div>
                  )}

                  {/* 3. DRESS CODE EDITOR */}
                  {activeBlock.key === 'dress' && (
                    <div className="space-y-3 rounded-2xl border border-[#D4AF37]/40 bg-white/70 p-4">
                      <span className="block text-xs font-bold text-[#0A2E23]">
                        👔 {isArabic ? 'أنماط الزي الجاهزة' : 'Dress Code Presets'}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          {
                            name: 'الزي الرسمي السعودي',
                            note: 'الزي الوطني الرسمي السعودي (ثوب وشماغ أو بشت).',
                            swatches: ['#FFFFFF', '#D4AF37', '#1A1A1A'],
                          },
                          {
                            name: 'Business Formal',
                            note: 'بدلة رسمية للرجال ولباس مهني أنيق للسيدات.',
                            swatches: ['#0F1E2E', '#94A3B8', '#F4F7F9'],
                          },
                          {
                            name: 'Black Tie',
                            note: 'ملابس سهرة فاخرة وربطة عنق سوداء.',
                            swatches: ['#0A0A0A', '#D4AF37', '#FFFFFF'],
                          },
                          {
                            name: 'كاجوال أنيق',
                            note: 'إطلالة أنيقة وعصرية تناسب الأمسية.',
                            swatches: ['#3E2723', '#C28B55', '#EFEBE9'],
                          },
                        ].map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              handleUpdateBlockContent(activeBlock.id, {
                                dressPreset: preset.name,
                                note: preset.note,
                                swatches: preset.swatches,
                              })
                            }
                            className="px-3 py-1 rounded-full border border-[#D4AF37]/40 bg-white text-[11px] font-semibold text-[#0A2E23] hover:bg-[#FAF7F2]"
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>

                      <label className="block text-xs font-bold text-[#0A2E23] pt-2">
                        <span>{t('description')}</span>
                        <textarea
                          rows={3}
                          value={activeBlock.content.note || ''}
                          onChange={(e) =>
                            handleUpdateBlockContent(activeBlock.id, { note: e.target.value })
                          }
                          className="qr-field mt-1.5"
                        />
                      </label>
                    </div>
                  )}

                  {/* 4. FAQ / ACCESS EDITOR */}
                  {activeBlock.key === 'faq' && (
                    <div className="space-y-3 rounded-2xl border border-[#D4AF37]/40 bg-white/70 p-4">
                      <span className="block text-xs font-bold text-[#0A2E23]">
                        ❓ {isArabic ? 'إعداد الأسئلة الشائعة وتفاصيل الوصول' : 'Access & FAQ'}
                      </span>
                      <div className="space-y-3">
                        {(
                          activeBlock.content.questions || [
                            {
                              q: 'هل تتوفر خدمة صف السيارات (Valet)؟',
                              a: 'نعم، تتوفر خدمة صف السيارات عند البوابة الرئيسية.',
                            },
                          ]
                        ).map((item, qIdx) => (
                          <div key={qIdx} className="p-3 rounded-xl border bg-white space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase text-[#0A2E23]">
                                السؤال #{qIdx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextQ = (
                                    activeBlock.content.questions || []
                                  ).filter((_, i) => i !== qIdx);
                                  handleUpdateBlockContent(activeBlock.id, { questions: nextQ });
                                }}
                                className="text-[#8C302B] hover:opacity-75"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <input
                              value={item.q}
                              onChange={(e) => {
                                const nextQ = [
                                  ...(activeBlock.content.questions || []),
                                ];
                                nextQ[qIdx] = { ...nextQ[qIdx], q: e.target.value };
                                handleUpdateBlockContent(activeBlock.id, { questions: nextQ });
                              }}
                              className="qr-field text-xs font-semibold"
                              placeholder="السؤال"
                            />
                            <textarea
                              rows={2}
                              value={item.a}
                              onChange={(e) => {
                                const nextQ = [
                                  ...(activeBlock.content.questions || []),
                                ];
                                nextQ[qIdx] = { ...nextQ[qIdx], a: e.target.value };
                                handleUpdateBlockContent(activeBlock.id, { questions: nextQ });
                              }}
                              className="qr-field text-xs"
                              placeholder="الإجابة"
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const nextQ = [
                              ...(activeBlock.content.questions || []),
                              { q: 'سؤال جديد', a: 'تفاصيل الإجابة' },
                            ];
                            handleUpdateBlockContent(activeBlock.id, { questions: nextQ });
                          }}
                          className="text-xs font-bold text-[#0A2E23] flex items-center gap-1"
                        >
                          <Plus size={14} />
                          <span>{isArabic ? 'إضافة سؤال جديد' : 'Add Question'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Note / Description for other blocks */}
                  {!['catering', 'faq', 'schedule', 'dress', 'divider', 'spacer'].includes(
                    activeBlock.key
                  ) && (
                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>{t('description')}</span>
                      <textarea
                        rows={3}
                        value={activeBlock.content.note || ''}
                        onChange={(e) =>
                          handleUpdateBlockContent(activeBlock.id, { note: e.target.value })
                        }
                        className="qr-field mt-1.5"
                      />
                    </label>
                  )}

                  {/* CTA or Registry Link URL */}
                  {(activeBlock.key === 'cta' || activeBlock.key === 'registry') && (
                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>Link URL</span>
                      <input
                        type="url"
                        value={activeBlock.content.url || ''}
                        onChange={(e) =>
                          handleUpdateBlockContent(activeBlock.id, { url: e.target.value })
                        }
                        placeholder="https://..."
                        className="qr-field mt-1.5"
                      />
                    </label>
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
