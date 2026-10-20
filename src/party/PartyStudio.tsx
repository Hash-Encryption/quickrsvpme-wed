import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  CalendarDays,
  Camera,
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
  getTemplateDefaultBlocks,
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
import { SAUDI_TIME_ANCHORS, formatDualDateSummary } from '../utils/saudiCalendar.ts';
import {
  deriveBrandTheme,
  extractColorsFromImageDataUrl,
  hexToRgb,
  getRelativeLuminance,
  mixColors,
  processLogoDataUrl,
  SAUDI_LUXURY_PALETTES,
  type ExtractedPalette,
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

function getBlockDefaultLabel(key: BlockKey, isArabic: boolean): string {
  switch (key) {
    case 'schedule':
      return isArabic ? 'برنامج الحفل والجدول الزمني' : 'Event Agenda & Timeline';
    case 'catering':
      return isArabic ? 'قائمة الضيافة وتفاصيل البوفيه' : 'Hospitality & Dining';
    case 'dress':
      return isArabic ? 'الزي المعتمد والمظهر' : 'Dress Code & Attire';
    case 'venue':
      return isArabic ? 'موقع القاعة ومخطط الوصول' : 'Venue & Location';
    case 'host':
      return isArabic ? 'كلمة المضيف والترحيب' : 'Host Greeting';
    case 'faq':
      return isArabic ? 'المواقف، البوابات ومعلومات الوصول' : 'Valet, Gates & Access';
    case 'text':
      return isArabic ? 'قسم مخصص ذكي' : 'Custom Smart Section';
    case 'cta':
      return isArabic ? 'رابط تفاعلي' : 'External Action Link';
    case 'registry':
      return isArabic ? 'مميزات المناسبة' : 'Highlights & Gifts';
    case 'song':
      return isArabic ? 'ركن تهاني الضيوف' : 'Guest Wishes';
    case 'divider':
      return isArabic ? 'فاصل زخرفي' : 'Ornamental Divider';
    case 'spacer':
      return isArabic ? 'مسافة تباعد' : 'Spacing';
    default:
      return key;
  }
}

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

const LUXURY_BG_PRESETS = [
  {
    name: 'نجدي تراثي',
    nameEn: 'Najdi Sandstone',
    url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'حرير وذهب',
    nameEn: 'Midnight Silk',
    url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'زمرد دمقسي',
    nameEn: 'Emerald Damask',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'رخام لؤلؤي',
    nameEn: 'Pearl Marble',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
  },
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
  const [autoRemoveWhiteBg, setAutoRemoveWhiteBg] = useState(true);
  const [rawLogoUrl, setRawLogoUrl] = useState<string | null>(initialEvent.logoUrl || null);
  const [extractedPalette, setExtractedPalette] = useState<ExtractedPalette | null>(null);
  const [replayEnvelope, setReplayEnvelope] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1024;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = (e: MediaQueryListEvent | MediaQueryList) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const currentTab: DrawerTab = activeTab || (isDesktop ? 'info' : null);

  // Sync props when initial changes externally
  useEffect(() => {
    setEvent(initialEvent);
    setBlocks(initialBlocks);
    setInvitationLocale(initialLocale);
    if (initialEvent.logoUrl && !rawLogoUrl) {
      setRawLogoUrl(initialEvent.logoUrl);
    }
  }, [initialEvent, initialBlocks, initialLocale, rawLogoUrl]);

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Auto-Scroll live invitation canvas to active section or block
  useEffect(() => {
    if (!currentTab) return;
    if (currentTab === 'info' || currentTab === 'design') {
      canvasContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (currentTab === 'edit-block' && selectedBlockId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`party-block-${selectedBlockId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentTab, selectedBlockId]);

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
    const updatedBlocks = getTemplateDefaultBlocks(tplId, blocks);
    setEvent(updated);
    setBlocks(updatedBlocks);
    void onSave?.(updated, updatedBlocks, invitationLocale);
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

    // Enable recommended sections for clean luxury layout
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
      label: getBlockDefaultLabel(key, isArabic),
      eyebrow: key.toUpperCase(),
      content: {
        heading: getBlockDefaultLabel(key, isArabic),
        note: '',
        entree: key === 'catering' ? ['Signature Dish 1', 'Signature Dish 2'] : undefined,
        swatches:
          key === 'catering' || key === 'dress'
            ? ['#0A2E23', '#D4AF37', '#C28B55']
            : undefined,
        questions: key === 'faq' ? [{ q: 'Question 1', a: 'Answer 1' }] : undefined,
        customLayout: key === 'text' ? 'editorial-card' : undefined,
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

  const handleSelectSectionFromPreview = (sec: string) => {
    setSelectedBlockId(null);
    if (sec === 'design') {
      setActiveTab('design');
    } else {
      setActiveTab('info');
    }
    canvasContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Logo file upload handler with auto white-background removal and immediate brand color extraction & application
  const handleLogoUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setRawLogoUrl(dataUrl);
        setIsExtractingColors(true);
        try {
          const processed = autoRemoveWhiteBg
            ? await processLogoDataUrl(dataUrl, true)
            : dataUrl;
          const palette = await extractColorsFromImageDataUrl(processed || dataUrl);
          setExtractedPalette(palette);

          // Auto-apply Brand Dark theme immediately upon upload
          const defaultTheme =
            palette.themes?.dark ||
            deriveBrandTheme(palette.dominantHex || palette.background, palette.accentHex || palette.accent, 'dark');

          updateEventFields({
            logoUrl: processed,
            backgroundColor: defaultTheme.backgroundColor,
            primaryColor: defaultTheme.primaryColor,
            accentColor: defaultTheme.accentColor,
            brandPalette: palette.swatches,
          });
        } finally {
          setIsExtractingColors(false);
        }
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

  // Brand color extraction
  const extractBrandColors = async (logoUrl: string) => {
    setIsExtractingColors(true);
    try {
      const palette = await extractColorsFromImageDataUrl(logoUrl);
      setExtractedPalette(palette);
      updateEventFields({
        brandPalette: palette.swatches,
      });
    } finally {
      setIsExtractingColors(false);
    }
  };

  const handleApplyLogoTheme = (mode: 'dark' | 'light' | 'bold' | 'vibrant') => {
    if (!extractedPalette) return;
    const themeKey = mode === 'vibrant' ? 'bold' : mode;
    const theme =
      (mode === 'vibrant' ? (extractedPalette.themes?.vibrant || extractedPalette.themes?.bold) : extractedPalette.themes?.[themeKey]) ||
      deriveBrandTheme(
        extractedPalette.dominantHex || extractedPalette.background,
        extractedPalette.accentHex || extractedPalette.accent,
        mode
      );

    updateEventFields({
      backgroundColor: theme.backgroundColor,
      primaryColor: theme.primaryColor,
      accentColor: theme.accentColor,
      brandPalette: extractedPalette.swatches,
    });
  };

  const handleResetToTemplateColors = () => {
    updateEventFields({
      backgroundColor: null,
      primaryColor: null,
      accentColor: null,
    });
  };

  const handleApplyLogoColors = async () => {
    if (!event.logoUrl) return;
    setIsExtractingColors(true);
    try {
      const palette = await extractColorsFromImageDataUrl(event.logoUrl);
      setExtractedPalette(palette);
      const theme =
        palette.themes?.dark ||
        deriveBrandTheme(palette.dominantHex || palette.background, palette.accent, 'dark');

      updateEventFields({
        backgroundColor: theme.backgroundColor,
        primaryColor: theme.primaryColor,
        accentColor: theme.accentColor,
        brandPalette: palette.swatches,
      });
    } finally {
      setIsExtractingColors(false);
    }
  };

  const activeBlock = blocks.find((b) => b.id === selectedBlockId);

  // Active theme colors for studio previews
  const styleKey = resolvePartyStyleId(event.templateId, event.styleId);
  const activeStyle = partyStyles[styleKey] ?? partyStyles['luxury-emerald'];
  const activeBg = event.backgroundColor || activeStyle.backgroundColor;
  const activePrimary = event.primaryColor || activeStyle.primaryColor;
  const activeAccent = event.accentColor || activeStyle.accentColor;

  const isDarkCanvas = useMemo(() => {
    try {
      const [r, g, b] = hexToRgb(activeBg);
      return getRelativeLuminance(r, g, b) < 0.45;
    } catch {
      return true;
    }
  }, [activeBg]);

  const activeSurface = useMemo(() => {
    if (!event.backgroundColor) return activeStyle.surfaceColor;
    return isDarkCanvas
      ? mixColors(activeBg, '#FFFFFF', 0.08)
      : mixColors(activeBg, '#000000', 0.05);
  }, [event.backgroundColor, activeBg, isDarkCanvas, activeStyle.surfaceColor]);

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-[#FAF7F2] text-[#17251F] font-sans select-none"
      dir={dir}
    >
      {/* 1. ZONE A1: Single 56px Frosted App Bar */}
      <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-[#D4AF37]/35 bg-[#FAF7F2]/90 px-3 sm:px-6 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href={backHref}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-[#17251F] transition hover:bg-black/[0.08] active:scale-95"
            aria-label={backLabel || (isArabic ? 'رجوع' : 'Back')}
          >
            {dir === 'rtl' ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
          </Link>

          <div className="min-w-0">
            <h1 className="truncate text-xs sm:text-sm font-semibold text-[#17251F]">
              {draftTitle || event.title || (isArabic ? 'حفلة جديدة' : 'Untitled Party')}
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-[#2D2421]/60">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1B6B46]" />
              <span>
                {saveStatus === 'saving'
                  ? (isArabic ? 'جاري الحفظ...' : 'Saving...')
                  : saveStatus === 'error'
                  ? (isArabic ? 'تعذر الحفظ' : 'Error saving')
                  : (isArabic ? 'تم الحفظ' : 'Saved')}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls: Undo/Redo + Preview + Publish */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Undo / Redo */}
          <div className="hidden sm:flex items-center gap-1 border-e border-[#D4AF37]/30 pe-2 me-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              aria-label={t('undo')}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] bg-white/80 text-[#17251F] transition hover:bg-white disabled:opacity-30"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              aria-label={t('redo')}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] bg-white/80 text-[#17251F] transition hover:bg-white disabled:opacity-30"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={14} />
            </button>
          </div>

          {/* Language Switch */}
          <AppLanguageControl />

          {/* Toggle Preview Only */}
          <button
            type="button"
            onClick={() => setIsPreviewOnly(!isPreviewOnly)}
            data-testid="button-preview-mode"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
              isPreviewOnly
                ? 'border-[#0A2E23] bg-[#0A2E23] text-white'
                : 'border-black/[0.08] bg-white/80 text-[#17251F] hover:bg-white'
            }`}
          >
            {isPreviewOnly ? <Edit3 size={13} /> : <Eye size={13} />}
            <span className="hidden sm:inline">
              {isPreviewOnly ? t('edit') : t('previewTab')}
            </span>
          </button>

          {/* Publish Button */}
          {onPublish && (
            <button
              type="button"
              onClick={onPublish}
              disabled={isPublishing || !publishAllowed}
              data-testid="button-publish-party"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#0A2E23] text-white text-xs font-bold hover:brightness-110 disabled:opacity-40 transition shadow-xs"
            >
              <PartyPopper size={13} />
              <span>{publishLabel || t('publishDraft')}</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. ZONE A2: Card vs. VIP Gate Pass Switcher */}
      <div className="w-full max-w-md mx-auto px-4 pt-3 flex justify-center">
        <div className="inline-flex items-center p-1 rounded-full bg-black/[0.05] border border-[#D4AF37]/30 shadow-inner">
          <button
            type="button"
            onClick={() => setViewMode('invitation')}
            data-testid="tab-view-invitation"
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition ${
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
            data-testid="tab-view-pass"
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              viewMode === 'pass'
                ? 'bg-[#0A2E23] text-white shadow-xs'
                : 'text-[#2D2421]/70 hover:text-[#0A2E23]'
            }`}
          >
            <span>🎟️</span>
            <span>{isArabic ? 'بطاقة الدخول QR' : 'VIP Gate Pass'}</span>
          </button>
        </div>
      </div>

      {/* 3. ZONE B1: Streamlined Quick Fill Example Bar */}
      <div className="w-full max-w-2xl mx-auto px-4 mt-2.5 mb-1">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0A2E23] bg-[#0A2E23]/8 px-2.5 py-1 rounded-full shrink-0 border border-[#0A2E23]/15 select-none">
            <Sparkles size={12} className="text-[#D4AF37]" />
            <span>{isArabic ? '✨ تعبئة نموذج جاهز:' : '✨ Quick Fill Example:'}</span>
          </div>
          {OCCASION_BLUEPRINTS.map((bp) => {
            const isSelected = event.occasionPresetId === bp.id;
            return (
              <button
                key={bp.id}
                type="button"
                onClick={() => handleApplyBlueprint(bp)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold whitespace-nowrap transition shrink-0 active:scale-95 ${
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

      {/* 4. MAIN STUDIO WORKSPACE: Desktop Split-Screen & Mobile Stack */}
      <main className="relative flex-1 overflow-y-auto px-3 sm:px-6 py-4 pb-28 sm:pb-32 lg:pb-12 max-w-7xl mx-auto w-full">
        <div className="w-full lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
          {/* Canvas Column (lg:col-span-7) */}
          <div className="lg:col-span-7 flex flex-col items-center lg:sticky lg:top-20">
            {/* Action Bar above Canvas (Replay Envelope) */}
            <div className="mb-2.5 flex items-center justify-between w-full max-w-[430px] px-1">
              <button
                type="button"
                onClick={() => setReplayEnvelope(true)}
                data-testid="button-replay-envelope"
                className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[#D4AF37]/50 bg-white/90 hover:bg-white text-xs font-bold text-[#0A2E23] transition shadow-2xs active:scale-95"
              >
                <span>✉️</span>
                <span>{isArabic ? 'تجربة فتح الظرف الملكي' : 'Replay Envelope'}</span>
              </button>

              <span className="text-[11px] font-semibold text-[#2D2421]/60">
                {viewMode === 'invitation'
                  ? (isArabic ? 'معاينة حية ومباشرة' : 'Live Interactive Canvas')
                  : (isArabic ? 'بطاقة الدخول' : 'Gate Pass')}
              </span>
            </div>

            <div
              ref={canvasContainerRef}
              data-testid="party-studio-canvas"
              className={`party-device-frame relative w-full max-w-[430px] rounded-[36px] border-[6px] border-[#2A3B32]/80 bg-white shadow-2xl overflow-hidden transition-all duration-300 overflow-y-auto pointer-events-auto ${
                !isDesktop && currentTab ? 'h-[52vh] max-h-[52vh]' : 'max-h-[85vh]'
              }`}
            >
              {viewMode === 'pass' ? (
                /* Standalone VIP Gate Pass View with Dynamic Surface / Colors */
                <div
                  className="min-h-[100dvh] text-white p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-colors"
                  style={{ backgroundColor: activeBg }}
                >
                  <div
                    className="party-pass-card relative w-full overflow-hidden rounded-[28px] border p-6 sm:p-8 text-center shadow-2xl backdrop-blur-md"
                    style={{
                      backgroundColor: activeSurface,
                      borderColor: `${activeAccent}60`,
                      color: activePrimary,
                    }}
                  >
                    <div className="absolute top-0 inset-x-0 mx-auto h-3 w-16 rounded-b-xl bg-black/40 border-b border-x border-[var(--party-accent)]/30" />
                    <div
                      className="pt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        borderColor: `${activeAccent}50`,
                        color: activeAccent,
                      }}
                    >
                      <Sparkles size={11} />
                      <span>{isArabic ? 'بطاقة الدخول الرقمية · VIP' : 'DIGITAL GATE PASS'}</span>
                    </div>
                    <h3 className="mt-4 font-display text-2xl font-bold" style={{ color: activePrimary }}>
                      {event.title}
                    </h3>
                    {event.hostName && (
                      <p className="mt-1 text-xs opacity-75">{event.hostName}</p>
                    )}
                    <div className="mx-auto mt-6 w-fit">
                      <QRPassMark label="VIP Pass QR" />
                    </div>
                    <div
                      className="mt-5 rounded-2xl border p-4 text-xs text-start"
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        borderColor: `${activeAccent}35`,
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold tracking-widest" style={{ color: activeAccent }}>
                          VIP-2026-PASS
                        </span>
                        <span
                          className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${activeAccent}25`,
                            color: activeAccent,
                          }}
                        >
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
                  forceEnvelopeOpen={replayEnvelope}
                  onEnvelopeOpened={() => setReplayEnvelope(false)}
                />
              )}
            </div>
          </div>

          {/* 6. CONTEXTUAL DRAWER (DESKTOP DOCK & UNBLURRED MOBILE SHEET) */}
          <AnimatePresence>
            {!isPreviewOnly && currentTab && (
              <>
                <motion.aside
                  initial={isDesktop ? undefined : { y: '100%' }}
                  animate={isDesktop ? undefined : { y: 0 }}
                  exit={isDesktop ? undefined : { y: '100%' }}
                  transition={{ type: 'spring', damping: 26, stiffness: 280 }}
                  className="fixed bottom-0 inset-x-0 z-40 max-h-[46vh] overflow-y-auto rounded-t-3xl border-t border-black/10 bg-[#FAF7F2] p-5 sm:p-6 shadow-[0_-12px_36px_rgba(0,0,0,0.16)] pb-16 lg:pb-6 lg:static lg:z-auto lg:col-span-5 lg:max-h-[85vh] lg:rounded-[32px] lg:border lg:border-[#D4AF37]/40 lg:shadow-xl lg:sticky lg:top-20"
                  aria-labelledby="party-sheet-title"
                >
                  {/* Drawer Header */}
                  <div className="border-b border-[#D4AF37]/25 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {currentTab === 'edit-block' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('sections');
                              setSelectedBlockId(null);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#0A2E23] hover:underline"
                          >
                            <ArrowLeft size={14} className={isArabic ? 'rotate-180' : ''} />
                            <span>{isArabic ? '← العودة للأقسام' : '← Back to Sections'}</span>
                          </button>
                        ) : (
                          <>
                            <span className="h-2 w-2 rounded-full bg-[#0A2E23]" />
                            <h2 id="party-sheet-title" className="text-base font-bold text-[#0A2E23]">
                              {currentTab === 'info' && t('infoTab')}
                              {currentTab === 'design' && (isArabic ? 'الهوية والتصميم والمظهر' : 'Brand & Design')}
                              {currentTab === 'sections' && (isArabic ? 'أقسام وفقرات الدعوة' : 'Invitation Modules')}
                              {currentTab === 'add-block' && (isArabic ? 'دليل الأقسام والوحدات' : 'Section Catalog')}
                            </h2>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab(null)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-[#2D2421] hover:bg-black/10 transition lg:hidden"
                        aria-label={isArabic ? 'إغلاق' : 'Close'}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Quick Tab Switcher inside Drawer/Dock */}
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-black/[0.04] border border-[#D4AF37]/25 text-xs font-semibold mt-2.5">
                      <button
                        type="button"
                        onClick={() => setActiveTab('info')}
                        className={`flex-1 py-1.5 rounded-lg transition ${
                          currentTab === 'info' ? 'bg-[#0A2E23] text-white shadow-xs' : 'text-[#2D2421]/70 hover:text-[#0A2E23]'
                        }`}
                      >
                        {t('infoTab')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('design')}
                        className={`flex-1 py-1.5 rounded-lg transition ${
                          currentTab === 'design' ? 'bg-[#0A2E23] text-white shadow-xs' : 'text-[#2D2421]/70 hover:text-[#0A2E23]'
                        }`}
                      >
                        {t('designTab')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('sections')}
                        className={`flex-1 py-1.5 rounded-lg transition ${
                          currentTab === 'sections' || currentTab === 'edit-block' ? 'bg-[#0A2E23] text-white shadow-xs' : 'text-[#2D2421]/70 hover:text-[#0A2E23]'
                        }`}
                      >
                        {t('sectionsTab')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('add-block')}
                        className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                          currentTab === 'add-block' ? 'bg-[#0A2E23] text-white shadow-xs' : 'text-[#0A2E23] hover:bg-black/5'
                        }`}
                      >
                        <Plus size={14} strokeWidth={2.5} />
                        <span>{t('addSection')}</span>
                      </button>
                    </div>
                  </div>

              {/* SHEET A: DETAILS (EVENT INFO) */}
              {currentTab === 'info' && (
                <div className="mt-5 space-y-4">
                  {/* Title Scale Selector */}
                  <div>
                    <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                      📏 {isArabic ? 'حجم عنوان الدعوة' : 'Title Scale'}
                    </span>
                    <div className="flex gap-2">
                      {(['sm', 'md', 'lg', 'xl'] as const).map((scale) => (
                        <button
                          key={scale}
                          type="button"
                          onClick={() => updateEventFields({ titleScale: scale })}
                          className={`flex-1 py-1.5 rounded-xl border text-xs font-bold uppercase transition ${
                            (event.titleScale || 'lg') === scale
                              ? 'border-[#0A2E23] bg-[#0A2E23] text-white shadow-xs'
                              : 'border-[#D4AF37]/40 bg-white/70 hover:bg-white text-[#0A2E23]'
                          }`}
                        >
                          {scale}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 1-Tap Wording Presets */}
                  <div>
                    <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                      ✨ {isArabic ? 'صيغ دعوة جاهزة وراقية' : 'Wording Presets'}
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
                      className="qr-field mt-1.5 font-display text-sm font-bold"
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>{t('hostNameLabel')}</span>
                      <input
                        value={event.hostName || ''}
                        onChange={(e) => updateEventFields({ hostName: e.target.value })}
                        data-testid="input-party-host"
                        placeholder={t('hostNamePlaceholder')}
                        className="qr-field mt-1.5"
                      />
                    </label>

                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>{t('subtitleLabel')}</span>
                      <input
                        value={event.subtitle || ''}
                        onChange={(e) => updateEventFields({ subtitle: e.target.value })}
                        data-testid="input-party-subtitle"
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
                      data-testid="input-party-wording"
                      className="qr-field mt-1.5 leading-relaxed"
                    />
                  </label>

                  {/* Dual Hijri & Gregorian Calendar */}
                  <div className="rounded-2xl border border-[#D4AF37]/40 bg-white/70 p-4">
                    <span className="block text-xs font-bold text-[#0A2E23] mb-3">
                      📅 {isArabic ? 'التقويم المزدوج (هجري وميلادي)' : 'Dual Hijri & Gregorian Date'}
                    </span>
                    <DualHijriCalendar
                      value={event.date}
                      onChange={(greg: string) => {
                        const hijriSummary = formatDualDateSummary(greg, isArabic ? 'ar' : 'en');
                        updateEventFields({
                          date: greg,
                          hijriDate: hijriSummary,
                          showHijriDate: true,
                        });
                      }}
                      locale={isArabic ? 'ar' : 'en'}
                    />

                    <div className="mt-4 flex items-center justify-between border-t border-[#D4AF37]/20 pt-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(event.showHijriDate)}
                          onChange={(e) => updateEventFields({ showHijriDate: e.target.checked })}
                          className="h-4 w-4 rounded text-[#0A2E23]"
                        />
                        <span className="text-xs font-bold text-[#0A2E23]">
                          {isArabic ? 'إظهار التاريخ الهجري في بطاقة الدعوة' : 'Show Hijri date on card'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Countdown & Month Calendar Toggle */}
                  <div className="rounded-2xl border border-[#D4AF37]/40 bg-white/70 p-4">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={event.showCountdownCalendar !== false}
                        onChange={(e) => updateEventFields({ showCountdownCalendar: e.target.checked })}
                        data-testid="input-toggle-countdown-calendar"
                        className="h-4 w-4 rounded text-[#0A2E23]"
                      />
                      <span className="text-xs font-bold text-[#0A2E23]">
                        ⏳ {isArabic ? 'إظهار العداد التنازلي المباشر وتقويم الشهر الدائري' : 'Show Live Countdown & Circled Month Calendar'}
                      </span>
                    </label>
                  </div>

                  {/* Saudi Time Anchors */}
                  <div>
                    <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                      ⏰ {isArabic ? 'توقيت المناسبة (صلوات وفترات سعودية)' : 'Timing & Anchors'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {SAUDI_TIME_ANCHORS.map((anchor) => (
                        <button
                          key={anchor.id}
                          type="button"
                          onClick={() =>
                            updateEventFields({
                              timeLabel: isArabic ? anchor.labelAr : anchor.labelEn,
                              startTime: anchor.time,
                            })
                          }
                          className="px-3 py-1 rounded-full border border-[#D4AF37]/40 bg-white/70 hover:bg-white text-[11px] font-semibold text-[#0A2E23] transition"
                        >
                          {isArabic ? anchor.labelAr : anchor.labelEn}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reception & Event Start Times */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>☕ {isArabic ? 'وقت استقبال الضيوف والترحيب' : 'Guest Reception Time'}</span>
                      <input
                        value={event.receptionTime || ''}
                        onChange={(e) => updateEventFields({ receptionTime: e.target.value })}
                        data-testid="input-party-reception-time"
                        placeholder={isArabic ? 'مثال: 7:30 م' : 'e.g. 7:30 PM'}
                        className="qr-field mt-1.5"
                      />
                    </label>

                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>✨ {isArabic ? 'توقيت بدء الفعالية والعشاء' : 'Event Start Time'}</span>
                      <input
                        value={event.startTime || ''}
                        onChange={(e) => updateEventFields({ startTime: e.target.value })}
                        data-testid="input-party-start-time"
                        placeholder={isArabic ? 'مثال: 8:30 م' : 'e.g. 8:30 PM'}
                        className="qr-field mt-1.5"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>{t('venue')}</span>
                      <input
                        value={event.venue}
                        onChange={(e) => updateEventFields({ venue: e.target.value })}
                        data-testid="input-party-venue"
                        className="qr-field mt-1.5"
                      />
                    </label>

                    <label className="block text-xs font-bold text-[#0A2E23]">
                      <span>{t('city')}</span>
                      <input
                        value={event.city}
                        onChange={(e) => updateEventFields({ city: e.target.value })}
                        data-testid="input-party-city"
                        className="qr-field mt-1.5"
                      />
                    </label>
                  </div>

                  <label className="block text-xs font-bold text-[#0A2E23]">
                    <span>📍 {isArabic ? 'رابط خرائط Google للموقع' : 'Google Maps Link'}</span>
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

              {/* SHEET B: REVAMPED DESIGN (4 SLEEK STUDIO CARDS) */}
              {currentTab === 'design' && (
                <div className="mt-5 space-y-6">
                  {/* CARD 1: 🏛️ LAYOUT ARCHITECTURE (4 GRAPHICAL WIREFRAME CARDS) */}
                  <div className="rounded-2xl border border-[#D4AF37]/40 bg-white/80 p-4 shadow-xs">
                    <span className="block text-xs font-bold text-[#0A2E23] mb-1">
                      🏛️ {isArabic ? 'تخطيط وهندسة الدعوة' : 'Layout Architecture'}
                    </span>
                    <p className="text-[11px] text-[#2D2421]/65 mb-3">
                      {isArabic
                        ? 'اختر الهيكل المعماري والنمط البصري الذي يناسب طابع المناسبة'
                        : 'Choose the visual architecture for your event poster'}
                    </p>

                    <div className="grid grid-cols-2 gap-3">
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
                            className={`focus-ring rounded-2xl border p-3 text-start transition flex flex-col justify-between ${
                              isChosen
                                ? 'border-[#0A2E23] bg-[#0A2E23] text-white shadow-md'
                                : 'border-[#D4AF37]/40 bg-white hover:bg-[#FAF7F2] text-[#17251F]'
                            }`}
                          >
                            {/* Graphical Wireframe Mini-Preview */}
                            <div
                              className={`w-full h-20 rounded-xl mb-2.5 p-2 flex flex-col justify-between border ${
                                isChosen ? 'bg-black/30 border-white/20' : 'bg-black/[0.03] border-black/10'
                              }`}
                            >
                              {tpl.id === 'corporate' && (
                                <div className="space-y-1.5 h-full flex flex-col justify-between">
                                  <div className="flex items-center justify-between border-b border-current/20 pb-1">
                                    <span className="h-1.5 w-7 rounded-full bg-current opacity-70" />
                                    <span className="h-1.5 w-4 rounded-full bg-current opacity-85" />
                                  </div>
                                  <div className="h-2 w-3/4 rounded bg-current opacity-90 mx-auto" />
                                  <div className="grid grid-cols-2 gap-1 pt-0.5">
                                    <div className="h-3.5 rounded bg-current opacity-20" />
                                    <div className="h-3.5 rounded bg-current opacity-20" />
                                  </div>
                                </div>
                              )}
                              {tpl.id === 'custom' && (
                                <div className="h-full border border-dashed border-current/40 rounded-lg p-1 flex flex-col items-center justify-between">
                                  <span className="text-[9px] opacity-80 leading-none">❖</span>
                                  <div className="h-2 w-2/3 rounded bg-current opacity-90" />
                                  <span className="text-[8px] opacity-60 select-none leading-none">── ✦ ──</span>
                                  <div className="h-3 w-4/5 rounded bg-current opacity-20" />
                                </div>
                              )}
                              {tpl.id === 'birthday' && (
                                <div className="h-full flex flex-col items-center justify-center relative">
                                  <div className="w-full h-10 rounded-lg border border-current/30 bg-current/10 p-1 flex flex-col items-center justify-center shadow-xs">
                                    <div className="h-2 w-3/4 rounded bg-current opacity-90 mb-1" />
                                    <div className="h-1.5 w-1/2 rounded bg-current opacity-60" />
                                  </div>
                                  <div className="flex gap-1 mt-1">
                                    <span className="h-1.5 w-4 rounded-full bg-current opacity-40" />
                                    <span className="h-1.5 w-4 rounded-full bg-current opacity-40" />
                                  </div>
                                </div>
                              )}
                              {tpl.id === 'baby-shower' && (
                                <div className="h-full border border-current/30 rounded-t-[28px] rounded-b-md p-1 flex flex-col items-center justify-between bg-current/[0.04]">
                                  <span className="text-[9px] opacity-70 leading-none">🌿</span>
                                  <div className="h-2 w-3/4 rounded bg-current opacity-90" />
                                  <div className="h-1.5 w-1/2 rounded bg-current opacity-40" />
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between">
                              <strong className="block text-xs font-bold">{name}</strong>
                              {isChosen && <Check size={14} className="text-[#D4AF37]" />}
                            </div>
                            <p className={`text-[10px] line-clamp-1 mt-0.5 ${isChosen ? 'opacity-75' : 'text-[#2D2421]/60'}`}>
                              {isArabic ? tpl.descriptionAr : tpl.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CARD 2: 🎨 COLOR PALETTE & THEME MOOD */}
                  <div className="rounded-2xl border border-[#D4AF37]/40 bg-white/80 p-4 shadow-xs space-y-4">
                    <div>
                      <span className="block text-xs font-bold text-[#0A2E23] mb-1">
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
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-[#0A2E23] truncate">
                                {isArabic ? pal.nameAr.split('·')[0].trim() : pal.name}
                              </p>
                            </div>
                            <div className="flex -space-x-1 shrink-0">
                              <span
                                className="h-4 w-4 rounded-full border border-white"
                                style={{ backgroundColor: pal.backgroundColor }}
                              />
                              <span
                                className="h-4 w-4 rounded-full border border-white"
                                style={{ backgroundColor: pal.accentColor }}
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Template Visual Styles */}
                    <div>
                      <span className="block text-xs font-bold text-[#0A2E23] mb-1">
                        {t('stylePreset')}
                      </span>
                      <div className="grid grid-cols-3 gap-2">
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
                              className={`focus-ring rounded-xl border p-2 text-start transition flex flex-col justify-between ${
                                isCurrent
                                  ? 'border-[#0A2E23] bg-white ring-2 ring-[#0A2E23] shadow-xs'
                                  : 'border-[#D4AF37]/35 bg-white/60 hover:bg-white'
                              }`}
                            >
                              <div className="flex items-center gap-1 mb-1.5">
                                <span
                                  className="h-3.5 w-3.5 rounded-full border border-black/20"
                                  style={{ backgroundColor: s.backgroundColor }}
                                />
                                <span
                                  className="h-3.5 w-3.5 rounded-full border border-black/20"
                                  style={{ backgroundColor: s.accentColor }}
                                />
                              </div>
                              <span className="text-[11px] font-bold text-[#0A2E23] truncate">{name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* CARD 3: 🏢 BRAND & LOGO STUDIO */}
                  <div className="rounded-2xl border border-[#D4AF37]/40 bg-white/80 p-4 shadow-xs space-y-4">
                    <span className="block text-xs font-bold text-[#0A2E23]">
                      🏢 {isArabic ? 'الشعار والهوية المؤسسية' : 'Brand Logo & Theme Studio'}
                    </span>

                    <div className="flex items-center gap-3">
                      {event.logoUrl ? (
                        <div className="relative">
                          <img
                            src={event.logoUrl}
                            alt="Logo"
                            className="h-14 w-14 rounded-xl object-contain border p-1 bg-white shadow-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setRawLogoUrl(null);
                              updateEventFields({ logoUrl: null, brandPalette: undefined });
                            }}
                            className="absolute -top-1.5 -end-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#B4534B] text-white text-[10px]"
                          >
                            &times;
                          </button>
                        </div>
                      ) : (
                        <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#D4AF37] bg-white text-[#D4AF37] hover:bg-black/5 transition shadow-xs">
                          <Upload size={20} />
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleLogoUpload(f);
                            }}
                          />
                        </label>
                      )}

                      <div className="flex-1">
                        <label className="inline-block text-xs font-bold text-[#0A2E23] cursor-pointer">
                          <span className="underline">{isArabic ? 'رفع شعار المؤسسة' : 'Upload Logo'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleLogoUpload(f);
                            }}
                          />
                        </label>
                        <p className="text-[11px] text-[#2D2421]/60">PNG, SVG, JPG, WebP</p>

                        {/* Auto white background removal toggle */}
                        <label className="flex items-center gap-2 cursor-pointer mt-1.5 text-[11px] font-semibold text-[#0A2E23]">
                          <input
                            type="checkbox"
                            checked={autoRemoveWhiteBg}
                            onChange={async (e) => {
                              const checked = e.target.checked;
                              setAutoRemoveWhiteBg(checked);
                              if (rawLogoUrl) {
                                const processed = checked
                                  ? await processLogoDataUrl(rawLogoUrl, true)
                                  : rawLogoUrl;
                                updateEventFields({ logoUrl: processed });
                              }
                            }}
                            className="h-3.5 w-3.5 rounded text-[#0A2E23]"
                          />
                          <span>{isArabic ? 'إزالة الخلفية البيضاء للشعار تلقائياً' : 'Auto-remove white background'}</span>
                        </label>
                      </div>
                    </div>

                    {event.logoUrl && (
                      <div className="pt-3 border-t border-[#D4AF37]/20 space-y-3">
                        {/* Logo Container Style */}
                        <div>
                          <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                            {isArabic ? 'نمط عرض الشعار' : 'Logo Container'}:
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {(
                              [
                                ['auto-clean', isArabic ? 'تلقائي شفاف' : 'Auto-Clean'],
                                ['glass-crest', isArabic ? 'درع زجاجي فاخر' : 'Luxury Crest'],
                                ['white-pill', isArabic ? 'وسادة بيضاء' : 'White Pill'],
                                ['raw', isArabic ? 'الأصلي' : 'Raw'],
                              ] as const
                            ).map(([mode, label]) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => updateEventFields({ logoContainer: mode })}
                                className={`px-2 py-1.5 rounded-xl text-[10px] font-bold transition text-center ${
                                  (event.logoContainer || 'auto-clean') === mode
                                    ? 'bg-[#0A2E23] text-white shadow-xs'
                                    : 'bg-white border text-[#0A2E23]'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Logo Placement */}
                        <div>
                          <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                            {isArabic ? 'موضع الشعار' : 'Logo Placement'}:
                          </span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(
                              [
                                ['top-center', isArabic ? 'أعلى المنتصف' : 'Top Center'],
                                ['header-bar', isArabic ? 'شريط العنوان' : 'Header Bar'],
                                ['both-footer', isArabic ? 'أعلى + ختم أسفل' : 'Top & Footer'],
                              ] as const
                            ).map(([plc, label]) => (
                              <button
                                key={plc}
                                type="button"
                                onClick={() => updateEventFields({ logoPlacement: plc })}
                                className={`px-2 py-1.5 rounded-xl text-[10px] font-bold transition text-center ${
                                  (event.logoPlacement || 'top-center') === plc
                                    ? 'bg-[#0A2E23] text-white shadow-xs'
                                    : 'bg-white border text-[#0A2E23]'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Logo Size */}
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>{isArabic ? 'الحجم' : 'Size'}:</span>
                          <div className="flex gap-1.5">
                            {(['sm', 'md', 'lg'] as const).map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => updateEventFields({ logoSize: sz })}
                                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition ${
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

                        {/* Real Pixel-Extracted Colors & 3 Brand Theme Buttons + Reset */}
                        <div className="pt-3 border-t border-[#D4AF37]/30 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="block text-xs font-bold text-[#0A2E23]">
                              🎨 {isArabic ? 'ألوان الشعار المستخرجة' : 'Extracted Logo Colors'}:
                            </span>
                            <button
                              type="button"
                              onClick={handleResetToTemplateColors}
                              className="text-[11px] font-semibold text-[#0A2E23] hover:underline inline-flex items-center gap-1"
                            >
                              <span>↺</span>
                              <span>{isArabic ? 'استعادة ألوان القالب' : 'Reset to Template Colors'}</span>
                            </button>
                          </div>

                          {/* Swatches with hex codes */}
                          <div className="flex flex-wrap items-center gap-2">
                            {(extractedPalette?.swatches || event.brandPalette || ['#0B1522', '#D4AF37', '#FAF8F5']).slice(0, 5).map((hex, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/5 border border-black/10 text-[10px] font-mono font-bold"
                              >
                                <span
                                  className="h-3.5 w-3.5 rounded-full border border-white shadow-2xs"
                                  style={{ backgroundColor: hex }}
                                />
                                <span>{hex.toUpperCase()}</span>
                              </div>
                            ))}
                          </div>

                          {/* 3 1-tap Theme Buttons + Reset Button */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleApplyLogoTheme('dark')}
                              disabled={isExtractingColors}
                              className="px-2.5 py-2 rounded-xl bg-[#0B1522] text-white text-[10px] font-bold border border-[#D4AF37]/40 shadow-xs hover:brightness-110 active:scale-95 transition text-center"
                            >
                              🌙 {isArabic ? 'داكن بالشعار' : 'Brand Dark'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyLogoTheme('light')}
                              disabled={isExtractingColors}
                              className="px-2.5 py-2 rounded-xl bg-[#FAF8F5] text-[#17251F] text-[10px] font-bold border border-[#D4AF37]/40 shadow-xs hover:brightness-95 active:scale-95 transition text-center"
                            >
                              ☀️ {isArabic ? 'فاتح بالشعار' : 'Brand Light'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyLogoTheme('vibrant')}
                              disabled={isExtractingColors}
                              className="px-2.5 py-2 rounded-xl bg-[#D4AF37] text-black text-[10px] font-bold shadow-xs hover:brightness-105 active:scale-95 transition text-center"
                            >
                              ✨ {isArabic ? 'هوية كاملة' : 'Brand Vibrant'}
                            </button>
                            <button
                              type="button"
                              onClick={handleResetToTemplateColors}
                              className="px-2.5 py-2 rounded-xl bg-white text-[#0A2E23] text-[10px] font-bold border border-[#D4AF37]/40 shadow-xs hover:bg-black/5 active:scale-95 transition text-center"
                            >
                              ↺ {isArabic ? 'ألوان القالب' : 'Template Colors'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CARD 4: 🖼️ BACKDROP & LIGHTING */}
                  <div className="rounded-2xl border border-[#D4AF37]/40 bg-white/80 p-4 shadow-xs space-y-4">
                    <span className="block text-xs font-bold text-[#0A2E23]">
                      🖼️ {isArabic ? 'الخلفية والإضاءة' : 'Backdrop & Lighting'}
                    </span>

                    <div className="flex items-center gap-3">
                      {event.backgroundImageUrl ? (
                        <div className="relative">
                          <img
                            src={event.backgroundImageUrl}
                            alt="Background"
                            className="h-14 w-14 rounded-xl object-cover border p-1 bg-white shadow-xs"
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
                        <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#D4AF37] bg-white text-[#D4AF37] hover:bg-black/5 transition shadow-xs">
                          <ImageIcon size={20} />
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
                          <span className="underline">{isArabic ? 'رفع صورة أو إطار مخصص' : 'Upload Photo or Frame'}</span>
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

                    {/* Curated Luxury Background Presets */}
                    <div>
                      <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                        {isArabic ? 'أو اختر خلفية راقية جاهزة:' : 'Or choose luxury preset:'}
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {LUXURY_BG_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => updateEventFields({ backgroundImageUrl: preset.url })}
                            className="p-1.5 rounded-xl border border-[#D4AF37]/40 bg-white hover:bg-black/5 transition text-center"
                          >
                            <img
                              src={preset.url}
                              alt={preset.name}
                              className="h-10 w-full object-cover rounded-lg mb-1"
                            />
                            <span className="block text-[10px] font-bold text-[#0A2E23] truncate">
                              {isArabic ? preset.name : preset.nameEn}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {event.backgroundImageUrl && (
                      <div className="pt-3 border-t border-[#D4AF37]/20 space-y-3">
                        {/* 3 Visual Fill Mode Pills */}
                        <div>
                          <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                            {isArabic ? 'طريقة تثبيت الخلفية (بدون أي تكرار)' : 'Fill Mode (No Tiling)'}:
                          </span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(
                              [
                                ['full-pinned', isArabic ? 'ملء كامل' : 'Full Cover'],
                                ['frame-9-16', isArabic ? 'إطار دعوة' : 'Border Frame'],
                                ['hero-banner', isArabic ? 'غلاف علوي' : 'Top Banner'],
                              ] as const
                            ).map(([mode, label]) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => updateEventFields({ backgroundMode: mode })}
                                className={`px-2 py-1.5 rounded-xl text-[10px] font-bold transition text-center ${
                                  (event.backgroundMode || 'full-pinned') === mode
                                    ? 'bg-[#0A2E23] text-white shadow-xs'
                                    : 'bg-white border text-[#0A2E23]'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Readability Dimmer Slider */}
                        <div>
                          <div className="flex justify-between text-xs font-semibold mb-1">
                            <span>{isArabic ? 'تعتيم الخلفية لضمان القراءة' : 'Readability Dimmer'}:</span>
                            <span className="font-mono">
                              {Math.round((event.backgroundOverlayOpacity ?? 0.55) * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="0.85"
                            step="0.05"
                            value={event.backgroundOverlayOpacity ?? 0.55}
                            onChange={(e) =>
                              updateEventFields({ backgroundOverlayOpacity: parseFloat(e.target.value) })
                            }
                            className="w-full accent-[#0A2E23]"
                          />
                        </div>

                        {/* Glass Blur Slider */}
                        <div>
                          <div className="flex justify-between text-xs font-semibold mb-1">
                            <span>{isArabic ? 'تغبيش زجاجي للخلفية (Apple Invites)' : 'Glass Blur'}:</span>
                            <span className="font-mono">{event.backgroundBlur ?? 0}px</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="16"
                            step="1"
                            value={event.backgroundBlur ?? 0}
                            onChange={(e) =>
                              updateEventFields({ backgroundBlur: parseInt(e.target.value, 10) })
                            }
                            className="w-full accent-[#0A2E23]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CARD 5: 📐 HERO TEXT ALIGNMENT */}
                  <div className="rounded-2xl border border-[#D4AF37]/40 bg-white/80 p-4 shadow-xs space-y-2">
                    <span className="block text-xs font-bold text-[#0A2E23]">
                      📐 {isArabic ? 'محاذاة نصوص الغلاف' : 'Hero Text Alignment'}
                    </span>
                    <p className="text-[11px] text-[#2D2421]/65 mb-2">
                      {isArabic
                        ? 'اختر طريقة ترتيب ومحاذاة الشعار وعناوين الدعوة'
                        : 'Choose alignment for your cover title, logo, and wording'}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateEventFields({ layout: 'centered' })}
                        className={`p-3 rounded-xl border text-start transition ${
                          event.layout === 'centered'
                            ? 'border-[#0A2E23] bg-[#0A2E23] text-white shadow-xs'
                            : 'border-[#D4AF37]/40 bg-white text-[#17251F] hover:bg-black/5'
                        }`}
                      >
                        <strong className="block text-xs font-bold">
                          {isArabic ? 'توسيط كلاسيكي' : 'Centered Classic'}
                        </strong>
                        <p className={`text-[10px] mt-0.5 ${event.layout === 'centered' ? 'opacity-80' : 'text-[#2D2421]/60'}`}>
                          {isArabic ? 'توسيط الشعار وعنوان الدعوة والنصوص' : 'Centers the logo, title, and wording'}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateEventFields({ layout: 'editorial' })}
                        className={`p-3 rounded-xl border text-start transition ${
                          event.layout === 'editorial'
                            ? 'border-[#0A2E23] bg-[#0A2E23] text-white shadow-xs'
                            : 'border-[#D4AF37]/40 bg-white text-[#17251F] hover:bg-black/5'
                        }`}
                      >
                        <strong className="block text-xs font-bold">
                          {isArabic ? 'محاذاة جانبية عصرية' : 'Side Editorial'}
                        </strong>
                        <p className={`text-[10px] mt-0.5 ${event.layout === 'editorial' ? 'opacity-80' : 'text-[#2D2421]/60'}`}>
                          {isArabic ? 'محاذاة جانبية للنصوص بأسلوب المجلات والمؤتمرات' : 'Aligns header text to the side like a magazine'}
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* CARD 6: ✍️ FONT STYLE */}
                  <div className="rounded-2xl border border-[#D4AF37]/40 bg-white/80 p-4 shadow-xs space-y-2">
                    <span className="block text-xs font-bold text-[#0A2E23]">
                      ✍️ {isArabic ? 'نوع خط الدعوة' : 'Font Style'}
                    </span>
                    <p className="text-[11px] text-[#2D2421]/65 mb-2">
                      {isArabic ? 'اختر الطابع المطبعي لعناوين ونصوص بطاقة الدعوة' : 'Select typeface character for the invitation'}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateEventFields({ typography: 'display' })}
                        className={`p-3 rounded-xl border text-start transition ${
                          event.typography === 'display'
                            ? 'border-[#0A2E23] bg-[#0A2E23] text-white shadow-xs'
                            : 'border-[#D4AF37]/40 bg-white text-[#17251F] hover:bg-black/5'
                        }`}
                      >
                        <strong className="block text-sm font-serif font-bold">
                          {isArabic ? 'خط كلاسيكي فخم' : 'Royal Calligraphic / Serif'}
                        </strong>
                        <p className={`text-[10px] mt-0.5 ${event.typography === 'display' ? 'opacity-80' : 'text-[#2D2421]/60'}`}>
                          {isArabic ? 'خط فخم ومائل للمناسبات الملكية والزواجات' : 'Classical luxury serif calligraphy'}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateEventFields({ typography: 'modern' })}
                        className={`p-3 rounded-xl border text-start transition ${
                          event.typography === 'modern'
                            ? 'border-[#0A2E23] bg-[#0A2E23] text-white shadow-xs'
                            : 'border-[#D4AF37]/40 bg-white text-[#17251F] hover:bg-black/5'
                        }`}
                      >
                        <strong className="block text-sm font-sans font-bold">
                          {isArabic ? 'خط عصري واضح' : 'Modern Clean Sans'}
                        </strong>
                        <p className={`text-[10px] mt-0.5 ${event.typography === 'modern' ? 'opacity-80' : 'text-[#2D2421]/60'}`}>
                          {isArabic ? 'خط هندسي عصري بسيط وواضح للشركات والمؤتمرات' : 'Clean, geometric modern sans-serif'}
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* CARD 7: ✨ SCROLL & SPARKLE MOTION */}
                  <div className="rounded-2xl border border-[#D4AF37]/40 bg-white/80 p-4 shadow-xs space-y-2">
                    <span className="block text-xs font-bold text-[#0A2E23]">
                      ✨ {isArabic ? 'تأثيرات الحركة واللمعان' : 'Scroll & Sparkle Effects'}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateEventFields({ motion: 'gentle' })}
                        className={`p-3 rounded-xl border text-start transition ${
                          event.motion === 'gentle'
                            ? 'border-[#0A2E23] bg-[#0A2E23] text-white shadow-xs'
                            : 'border-[#D4AF37]/40 bg-white text-[#17251F] hover:bg-black/5'
                        }`}
                      >
                        <strong className="block text-xs font-bold">
                          {isArabic ? 'متحرك مع السحب ✨' : 'Animated Scroll & Shimmer ✨'}
                        </strong>
                        <p className={`text-[10px] mt-0.5 ${event.motion === 'gentle' ? 'opacity-80' : 'text-[#2D2421]/60'}`}>
                          {isArabic ? 'حركة ناعمة وظهور تدريجي مع التمرير' : 'Smooth reveal transitions and light reflections'}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateEventFields({ motion: 'none' })}
                        className={`p-3 rounded-xl border text-start transition ${
                          event.motion === 'none'
                            ? 'border-[#0A2E23] bg-[#0A2E23] text-white shadow-xs'
                            : 'border-[#D4AF37]/40 bg-white text-[#17251F] hover:bg-black/5'
                        }`}
                      >
                        <strong className="block text-xs font-bold">
                          {isArabic ? 'ثابت بدون حركة' : 'Static / Simple'}
                        </strong>
                        <p className={`text-[10px] mt-0.5 ${event.motion === 'none' ? 'opacity-80' : 'text-[#2D2421]/60'}`}>
                          {isArabic ? 'عرض فوري ثابت لجميع العناصر بدون مؤثرات' : 'All elements instantly visible with zero animations'}
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* CARD 8: ❖ ORNAMENTAL BORDERS & DIVIDERS */}
                  <div className="rounded-2xl border border-[#D4AF37]/40 bg-white/80 p-4 shadow-xs">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={event.decorations !== false}
                        onChange={(e) => updateEventFields({ decorations: e.target.checked })}
                        className="mt-0.5 h-4 w-4 rounded text-[#0A2E23]"
                      />
                      <div className="flex-1">
                        <span className="block text-xs font-bold text-[#0A2E23]">
                          ❖ {isArabic ? 'الزخارف والإطارات الذهبية' : 'Ornamental Borders & Dividers'}
                        </span>
                        <p className="text-[11px] text-[#2D2421]/65 mt-0.5">
                          {isArabic
                            ? 'إظهار الإطارات الذهبية المزخرفة وفواصل ✦ الأنيقة بين الأقسام'
                            : 'Shows decorative corner frames and ✦ section dividers on the card'}
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* CARD 9: 🎟️ INTERACTIVE GUEST FEATURES */}
                  <div className="rounded-2xl border border-[#D4AF37]/40 bg-white/80 p-4 shadow-xs space-y-3">
                    <span className="block text-xs font-bold text-[#0A2E23]">
                      🎟️ {isArabic ? 'مميزات تفاعلية للضيف' : 'Interactive Guest Features'}
                    </span>
                    <p className="text-[11px] text-[#2D2421]/65">
                      {isArabic
                        ? 'ميزات حية تضيف بعداً تفاعلياً مبشراً للضيف عند استلام الرابط'
                        : 'Engaging real-time features visible to guests on the web invitation'}
                    </p>

                    <div className="space-y-3 pt-1">
                      {/* 1. Countdown & Month Calendar */}
                      <label className="flex items-start gap-3 cursor-pointer p-2.5 rounded-xl border border-black/10 bg-black/[0.02]">
                        <input
                          type="checkbox"
                          checked={event.showCountdownCalendar !== false}
                          onChange={(e) => updateEventFields({ showCountdownCalendar: e.target.checked })}
                          data-testid="input-toggle-countdown-calendar"
                          className="mt-0.5 h-4 w-4 rounded text-[#0A2E23]"
                        />
                        <div className="flex-1">
                          <span className="block text-xs font-bold text-[#0A2E23]">
                            ⏳ {isArabic ? 'العداد التنازلي وتقويم الشهر' : 'Live Countdown & Month Calendar'}
                          </span>
                          <p className="text-[10px] text-[#2D2421]/60 mt-0.5">
                            {isArabic
                              ? 'عداد تنازلي رقمي حي وتقويم شهري يبرز يوم المناسبة بدائرة متوهجة'
                              : 'Real-time countdown tiles and highlighted month calendar card'}
                          </p>
                        </div>
                      </label>

                      {/* 2. 3D Wax Seal Envelope Intro with inline Preview button */}
                      <div className="p-2.5 rounded-xl border border-black/10 bg-black/[0.02] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-start gap-3 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={Boolean(event.enableEnvelopeOpener)}
                              onChange={(e) => updateEventFields({ enableEnvelopeOpener: e.target.checked })}
                              data-testid="input-toggle-envelope-opener"
                              className="mt-0.5 h-4 w-4 rounded text-[#0A2E23]"
                            />
                            <div className="flex-1">
                              <span className="block text-xs font-bold text-[#0A2E23]">
                                ✉️ {isArabic ? 'ظرف ملكي بالختم عند فتح الرابط' : '3D Wax Seal Envelope Intro'}
                              </span>
                              <p className="text-[10px] text-[#2D2421]/60 mt-0.5">
                                {isArabic
                                  ? 'مقدمة سينمائية تظهر للضيف بختم شمعي ثلاثي الأبعاد ينكسر عند اللمس'
                                  : 'Cinematic opening experience where guests tap an embossed 3D wax seal to reveal the invitation'}
                              </p>
                            </div>
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              setReplayEnvelope(true);
                              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                                setActiveTab(null);
                              }
                            }}
                            data-testid="button-preview-envelope"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#D4AF37]/50 bg-white hover:bg-black/5 text-[11px] font-bold text-[#0A2E23] transition shrink-0 ms-2 shadow-2xs active:scale-95"
                          >
                            <span>✉️</span>
                            <span>{isArabic ? 'معاينة الآن' : 'Preview Now'}</span>
                          </button>
                        </div>

                        {event.enableEnvelopeOpener && (
                          <div className="pt-2 border-t border-black/10 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <label className="block text-[11px] font-bold text-[#0A2E23]">
                                <span>{isArabic ? 'حرف أو رمز الختم الشمعي' : 'Wax Seal Monogram'}</span>
                                <input
                                  value={event.waxSealText || ''}
                                  onChange={(e) => updateEventFields({ waxSealText: e.target.value.slice(0, 4) })}
                                  data-testid="input-wax-seal-text"
                                  placeholder={isArabic ? 'مثال: VIP أو رمز' : 'e.g. VIP'}
                                  maxLength={4}
                                  className="qr-field mt-1 text-xs font-bold uppercase tracking-widest text-center"
                                />
                              </label>

                              <div className="flex items-end">
                                <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-[#0A2E23] pb-2">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(event.useLogoOnWaxSeal)}
                                    onChange={(e) => updateEventFields({ useLogoOnWaxSeal: e.target.checked })}
                                    data-testid="input-toggle-seal-logo"
                                    disabled={!event.logoUrl}
                                    className="h-3.5 w-3.5 rounded text-[#0A2E23]"
                                  />
                                  <span>{isArabic ? 'طباعة الشعار على الختم' : 'Emboss Brand Logo on Wax Seal'}</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SHEET C: SECTIONS (MODULAR BLOCKS LIST) */}
              {currentTab === 'sections' && (
                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#2D2421]/70">
                      {isArabic
                        ? 'أعد ترتيب أو تخصيص فقرات الحفل بالضغط على أي قسم:'
                        : 'Reorder, edit, or customize event modules:'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('add-block')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#0A2E23] hover:underline"
                    >
                      <Plus size={14} />
                      <span>{t('addSection')}</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {blocks.map((b, idx) => (
                      <div
                        key={b.id}
                        className={`rounded-2xl border p-3.5 transition flex flex-col justify-between gap-3 ${
                          b.enabled
                            ? 'border-[#D4AF37]/45 bg-white shadow-2xs'
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
                              {b.key === 'catering' && <Utensils size={16} />}
                              {b.key === 'schedule' && <CalendarDays size={16} />}
                              {b.key === 'dress' && <Shirt size={16} />}
                              {b.key === 'registry' && <Gift size={16} />}
                              {b.key === 'song' && <Music2 size={16} />}
                              {b.key === 'faq' && <HelpCircle size={16} />}
                              {b.key === 'venue' && <MapPin size={16} />}
                              {b.key === 'host' && <User size={16} />}
                              {b.key === 'text' && <Sparkles size={16} />}
                              {b.key === 'cta' && <ExternalLink size={16} />}
                              {b.key === 'divider' && <Minus size={16} />}
                              {b.key === 'spacer' && <Layers size={16} />}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-[#0A2E23]">
                                {b.label || getBlockDefaultLabel(b.key, isArabic)}
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
                            aria-label={isArabic ? (b.enabled ? 'إخفاء القسم' : 'إظهار القسم') : (b.enabled ? 'Hide' : 'Show')}
                            className={`focus-ring inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition ${
                              b.enabled
                                ? 'bg-[#0A2E23] text-white shadow-xs'
                                : 'bg-black/10 text-black/50'
                            }`}
                          >
                            {b.enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                            <span>{isArabic ? (b.enabled ? 'ظاهر' : 'مخفي') : (b.enabled ? 'Visible' : 'Hidden')}</span>
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

              {/* SHEET D: UPGRADED CUSTOM BLOCK EDITORS & 4-LAYOUT CUSTOM SECTION BUILDER */}
              {currentTab === 'edit-block' && activeBlock && (
                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#D4AF37]/25">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('sections');
                        setSelectedBlockId(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#D4AF37]/40 bg-white text-xs font-bold text-[#0A2E23] hover:bg-black/5 transition shadow-2xs active:scale-95"
                    >
                      <ArrowLeft size={13} className={isArabic ? 'rotate-180' : ''} />
                      <span>{isArabic ? '← العودة للأقسام' : '← Back to Sections'}</span>
                    </button>
                    <span className="text-xs font-bold text-[#0A2E23]">
                      {activeBlock.label}
                    </span>
                  </div>
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
                              { time: '10:00 PM', title: isArabic ? 'فقرة جديدة' : 'New Agenda Item' },
                            ];
                            handleUpdateBlockContent(activeBlock.id, { scheduleItems: current });
                          }}
                          className="text-xs font-bold text-[#0A2E23] flex items-center gap-1 mt-2"
                        >
                          <Plus size={14} />
                          <span>{isArabic ? 'إضافة فقرة جديدة' : 'Add Agenda Row'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. CATERING / HOSPITALITY EDITOR */}
                  {activeBlock.key === 'catering' && (
                    <div className="space-y-3 rounded-2xl border border-[#D4AF37]/40 bg-white/70 p-4">
                      <span className="block text-xs font-bold text-[#0A2E23]">
                        🍽️ {isArabic ? 'نوع عرض الضيافة' : 'Hospitality Mode'}
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateBlockContent(activeBlock.id, { mode: 'note' })
                          }
                          className={`p-2.5 rounded-xl border text-xs font-bold transition text-center ${
                            activeBlock.content.mode !== 'menu'
                              ? 'bg-[#0A2E23] text-white border-[#0A2E23]'
                              : 'bg-white border-[#D4AF37]/40 text-[#0A2E23]'
                          }`}
                        >
                          ☕ {isArabic ? 'كلمة ضيافة وترحيب' : 'Hospitality Note'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateBlockContent(activeBlock.id, { mode: 'menu' })
                          }
                          className={`p-2.5 rounded-xl border text-xs font-bold transition text-center ${
                            activeBlock.content.mode === 'menu'
                              ? 'bg-[#0A2E23] text-white border-[#0A2E23]'
                              : 'bg-white border-[#D4AF37]/40 text-[#0A2E23]'
                          }`}
                        >
                          🍴 {isArabic ? 'قائمة أطباق يختار منها' : 'Selectable Menu'}
                        </button>
                      </div>

                      {activeBlock.content.mode !== 'menu' ? (
                        <div className="pt-2">
                          <label className="block text-xs font-bold text-[#0A2E23]">
                            <span>{isArabic ? 'نص الضيافة الكريمة' : 'Hospitality Note'}</span>
                            <textarea
                              rows={3}
                              value={
                                activeBlock.content.note ||
                                (isArabic
                                  ? 'نتشرف بضيافتكم الكريمة وتقديم القهوة السعودية الأصيلة ومأدبة العشاء الفاخرة.'
                                  : 'We are honored to welcome you with authentic hospitality.')
                              }
                              onChange={(e) =>
                                handleUpdateBlockContent(activeBlock.id, { note: e.target.value })
                              }
                              className="qr-field mt-1.5"
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="space-y-2 pt-2">
                          <span className="block text-xs font-bold text-[#0A2E23]">
                            {isArabic ? 'أطباق وقائمة العشاء' : 'Menu Dishes'}
                          </span>
                          {(
                            activeBlock.content.entree || [
                              'القهوة والضيافة',
                              'مأدبة العشاء',
                              'الحلويات والمشروبات',
                            ]
                          ).map((dish, dIdx) => (
                            <div key={dIdx} className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={dish}
                                onChange={(e) => {
                                  const current = [
                                    ...(activeBlock.content.entree || [
                                      'طبق 1',
                                      'طبق 2',
                                    ]),
                                  ];
                                  current[dIdx] = e.target.value;
                                  handleUpdateBlockContent(activeBlock.id, { entree: current });
                                }}
                                className="qr-field flex-1 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const current = (activeBlock.content.entree || []).filter(
                                    (_, i) => i !== dIdx
                                  );
                                  handleUpdateBlockContent(activeBlock.id, { entree: current });
                                }}
                                className="text-[#8C302B] hover:opacity-75 p-1"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. DRESS CODE EDITOR */}
                  {activeBlock.key === 'dress' && (
                    <div className="space-y-3 rounded-2xl border border-[#D4AF37]/40 bg-white/70 p-4">
                      <span className="block text-xs font-bold text-[#0A2E23]">
                        👔 {isArabic ? 'صيغ الزي الموصى به' : 'Dress Code Presets'}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'الزي الرسمي السعودي', en: 'Saudi National Formal' },
                          { label: 'كاجوال أنيق', en: 'Smart Casual' },
                          { label: 'سهرة وبلاك تاي', en: 'Black Tie / Evening' },
                          { label: 'بدلة أعمال رسمية', en: 'Business Formal' },
                        ].map((dPreset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              handleUpdateBlockContent(activeBlock.id, {
                                dressPreset: isArabic ? dPreset.label : dPreset.en,
                                note: isArabic
                                  ? `الزي المعتمد للمناسبة: ${dPreset.label}`
                                  : `Recommended attire: ${dPreset.en}`,
                                swatches: ['#0F1E2E', '#94A3B8', '#F4F7F9'],
                              })
                            }
                            className="px-3 py-1 rounded-full border border-[#D4AF37]/40 bg-white text-[11px] font-semibold text-[#0A2E23] hover:bg-[#FAF7F2]"
                          >
                            {isArabic ? dPreset.label : dPreset.en}
                          </button>
                        ))}
                      </div>

                      <label className="block text-xs font-bold text-[#0A2E23] pt-2">
                        <span>{isArabic ? 'تفاصيل الزي' : 'Attire Details'}</span>
                        <input
                          type="text"
                          value={activeBlock.content.note || ''}
                          onChange={(e) =>
                            handleUpdateBlockContent(activeBlock.id, { note: e.target.value })
                          }
                          className="qr-field mt-1.5"
                        />
                      </label>
                    </div>
                  )}

                  {/* 4. FAQ / ACCESS & GATES EDITOR */}
                  {activeBlock.key === 'faq' && (
                    <div className="space-y-3 rounded-2xl border border-[#D4AF37]/40 bg-white/70 p-4">
                      <span className="block text-xs font-bold text-[#0A2E23]">
                        🚗 {isArabic ? 'أسئلة الوصول والمواقف' : 'Access & Valet Q&A'}
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
                          <div key={qIdx} className="space-y-1.5 rounded-xl border border-black/10 p-2.5 bg-white">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase text-[#0A2E23]">
                                {isArabic ? `سؤال ${qIdx + 1}` : `Question ${qIdx + 1}`}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextQ = (activeBlock.content.questions || []).filter(
                                    (_, i) => i !== qIdx
                                  );
                                  handleUpdateBlockContent(activeBlock.id, { questions: nextQ });
                                }}
                                className="text-[#8C302B] hover:opacity-75"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={item.q}
                              placeholder="السؤال"
                              onChange={(e) => {
                                const nextQ = [...(activeBlock.content.questions || [])];
                                nextQ[qIdx] = { ...nextQ[qIdx], q: e.target.value };
                                handleUpdateBlockContent(activeBlock.id, { questions: nextQ });
                              }}
                              className="qr-field text-xs"
                            />
                            <textarea
                              rows={2}
                              value={item.a}
                              placeholder="الإجابة"
                              onChange={(e) => {
                                const nextQ = [...(activeBlock.content.questions || [])];
                                nextQ[qIdx] = { ...nextQ[qIdx], a: e.target.value };
                                handleUpdateBlockContent(activeBlock.id, { questions: nextQ });
                              }}
                              className="qr-field text-xs"
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const nextQ = [
                              ...(activeBlock.content.questions || []),
                              {
                                q: isArabic ? 'سؤال جديد' : 'New Question',
                                a: isArabic ? 'الإجابة والتوضيح هنا' : 'Answer details here',
                              },
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

                  {/* 5. TRUE CUSTOM SMART SECTION BUILDER (FOR 'text' OR CUSTOM BLOCKS) */}
                  {activeBlock.key === 'text' && (
                    <div className="space-y-4 rounded-2xl border border-[#D4AF37]/40 bg-white/70 p-4">
                      {/* Visual Layout Style Selector */}
                      <div>
                        <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                          🧩 {isArabic ? 'النمط البصري للقسم المخصص' : 'Custom Section Layout'}:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {(
                            [
                              ['editorial-card', isArabic ? '📝 بطاقة نصية' : 'Editorial'],
                              ['bullet-grid', isArabic ? '✨ قائمة مميزات' : 'Feature Grid'],
                              ['image-spotlight', isArabic ? '🖼️ صورة بارزة' : 'Image Spotlight'],
                              ['stats-highlights', isArabic ? '🎤 بطاقة متحدث' : 'Speaker Card'],
                            ] as const
                          ).map(([layoutKey, label]) => (
                            <button
                              key={layoutKey}
                              type="button"
                              onClick={() =>
                                handleUpdateBlockContent(activeBlock.id, { customLayout: layoutKey })
                              }
                              className={`p-2 rounded-xl border text-[11px] font-bold transition text-center ${
                                (activeBlock.content.customLayout || 'editorial-card') === layoutKey
                                  ? 'bg-[#0A2E23] text-white border-[#0A2E23] shadow-xs'
                                  : 'bg-white border-[#D4AF37]/40 text-[#0A2E23]'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 1-Tap Saudi Custom Templates */}
                      <div>
                        <span className="block text-xs font-bold text-[#0A2E23] mb-1.5">
                          ⚡ {isArabic ? 'نماذج سعودية جاهزة بنقرة واحدة' : '1-Tap Section Templates'}:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            {
                              label: '🎤 المتحدث الرئيسي',
                              layout: 'stats-highlights' as const,
                              patch: {
                                heading: 'د. خالد المنصور',
                                badge: 'المتحدث الرئيسي',
                                note: 'الرئيس التنفيذي ومستشار الابتكار · كلمة افتتاحية حول مستقبل الاستثمار والتحول الرقمي.',
                              },
                            },
                            {
                              label: '🏆 فئات الجوائز',
                              layout: 'bullet-grid' as const,
                              patch: {
                                heading: 'فئات التكريم والجوائز',
                                note: 'سيتم خلال الحفل تكريم الإنجازات الاستثنائية للعام 2026:',
                                bullets: [
                                  'جائزة التميز المؤسسي والابتكار',
                                  'جائزة أفضل شريك استراتيجي',
                                  'جائزة القيادة الملهمة',
                                ],
                              },
                            },
                            {
                              label: '🚗 تعليمات المواقف والبوابات',
                              layout: 'bullet-grid' as const,
                              patch: {
                                heading: 'تعليمات الوصول والبوابات',
                                note: 'لضمان انسيابية وصولكم يرجى اتباع الإرشادات التالية:',
                                bullets: [
                                  'دخول كبار الشخصيات عبر البوابة رقم 1',
                                  'تتوفر خدمة صف السيارات (Valet) مجاناً عند المدخل',
                                  'يرجى إبراز رمز QR الخاص بالدعوة عند مكتب الاستقبال',
                                ],
                              },
                            },
                            {
                              label: '🎓 سيرة الخريج المحتفى به',
                              layout: 'image-spotlight' as const,
                              patch: {
                                heading: 'الخريج: فيصل بن عبدالعزيز',
                                note: 'خريج كلية الطب والجراحة بمرتبة الشرف الأولى. نسعد بمشاركتكم فخرنا بهذا الإنجاز المبارك.',
                                buttonLabel: 'عرض إهداءات الحفل',
                              },
                            },
                            {
                              label: '🌙 قائمة السحور الرمضاني',
                              layout: 'bullet-grid' as const,
                              patch: {
                                heading: 'مائدة السحور الرمضاني المبارك',
                                note: 'نتشرف بضيافتكم الكريمة وتناول وجبة السحور معاً:',
                                bullets: [
                                  'الرطب والتمر السكري والقهوة السعودية',
                                  'أطباق شعبية وحجازية فاخرة',
                                  'مشروبات رمضانية وحلويات طازجة',
                                ],
                              },
                            },
                            {
                              label: '🎁 معلومات الإهداء والحساب',
                              layout: 'editorial-card' as const,
                              patch: {
                                heading: 'معلومات الإهداء ومشاركتنا الفرحة',
                                note: 'حضوركم هو أجمل وأثمن هدية تسعدنا وتكتمل بها فرحتنا. لمن يرغب بمشاركتنا الإهداء:\nIBAN: SA0380000000608010167519',
                              },
                            },
                          ].map((tPreset, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                handleUpdateBlockContent(activeBlock.id, {
                                  customLayout: tPreset.layout,
                                  ...tPreset.patch,
                                });
                              }}
                              className="px-2.5 py-1 rounded-full border border-[#D4AF37]/40 bg-white text-[11px] font-semibold text-[#0A2E23] hover:bg-[#FAF7F2] transition"
                            >
                              {tPreset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Bullet Grid items manager */}
                      {activeBlock.content.customLayout === 'bullet-grid' && (
                        <div className="space-y-2 pt-2 border-t border-[#D4AF37]/20">
                          <span className="block text-xs font-bold text-[#0A2E23]">
                            {isArabic ? 'قائمة النقاط والمميزات' : 'Bullet Items'}:
                          </span>
                          {(
                            activeBlock.content.bullets || [
                              'الميزة أو النقطة الأولى',
                              'الميزة أو النقطة الثانية',
                            ]
                          ).map((bullet, bIdx) => (
                            <div key={bIdx} className="flex gap-2 items-center">
                              <span className="text-xs text-[#0A2E23]">✦</span>
                              <input
                                type="text"
                                value={bullet}
                                onChange={(e) => {
                                  const current = [...(activeBlock.content.bullets || [])];
                                  current[bIdx] = e.target.value;
                                  handleUpdateBlockContent(activeBlock.id, { bullets: current });
                                }}
                                className="qr-field flex-1 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const current = (activeBlock.content.bullets || []).filter(
                                    (_, i) => i !== bIdx
                                  );
                                  handleUpdateBlockContent(activeBlock.id, { bullets: current });
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
                                ...(activeBlock.content.bullets || []),
                                isArabic ? 'نقطة جديدة' : 'New bullet item',
                              ];
                              handleUpdateBlockContent(activeBlock.id, { bullets: current });
                            }}
                            className="text-xs font-bold text-[#0A2E23] flex items-center gap-1 mt-1"
                          >
                            <Plus size={14} />
                            <span>{isArabic ? 'إضافة نقطة جديدة' : 'Add Bullet Item'}</span>
                          </button>
                        </div>
                      )}

                      {/* Image spotlight / Speaker image upload */}
                      {(activeBlock.content.customLayout === 'image-spotlight' ||
                        activeBlock.content.customLayout === 'stats-highlights') && (
                        <div className="space-y-2 pt-2 border-t border-[#D4AF37]/20">
                          <span className="block text-xs font-bold text-[#0A2E23]">
                            {activeBlock.content.customLayout === 'stats-highlights'
                              ? isArabic
                                ? 'صورة المتحدث أو الرمز'
                                : 'Speaker Photo / Avatar'
                              : isArabic
                              ? 'صورة القسم البارزة'
                              : 'Spotlight Image'}
                          </span>
                          <div className="flex items-center gap-3">
                            {activeBlock.content.imageUrl && (
                              <img
                                src={activeBlock.content.imageUrl}
                                alt="Section Image"
                                className="h-12 w-12 rounded-xl object-cover border"
                              />
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  const reader = new FileReader();
                                  reader.onload = (re) => {
                                    handleUpdateBlockContent(activeBlock.id, {
                                      imageUrl: re.target?.result as string,
                                    });
                                  };
                                  reader.readAsDataURL(f);
                                }
                              }}
                              className="text-xs text-[#0A2E23]"
                            />
                          </div>

                          {activeBlock.content.customLayout === 'stats-highlights' && (
                            <label className="block text-xs font-bold text-[#0A2E23] pt-1">
                              <span>{isArabic ? 'شارة الصفة (مثال: المتحدث الرئيسي)' : 'Role Badge'}</span>
                              <input
                                type="text"
                                value={activeBlock.content.badge || ''}
                                onChange={(e) =>
                                  handleUpdateBlockContent(activeBlock.id, { badge: e.target.value })
                                }
                                placeholder="المتحدث الرئيسي"
                                className="qr-field mt-1 text-xs"
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Note / Description for blocks that need it */}
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
                  {(activeBlock.key === 'cta' ||
                    activeBlock.key === 'registry' ||
                    activeBlock.content.customLayout === 'image-spotlight' ||
                    activeBlock.content.customLayout === 'editorial-card') && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[#0A2E23]">
                        <span>{isArabic ? 'رابط الزر (URL)' : 'Button Link URL'}</span>
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
                      {activeBlock.content.url && (
                        <label className="block text-xs font-bold text-[#0A2E23]">
                          <span>{isArabic ? 'نص الزر' : 'Button Label'}</span>
                          <input
                            type="text"
                            value={activeBlock.content.buttonLabel || ''}
                            onChange={(e) =>
                              handleUpdateBlockContent(activeBlock.id, { buttonLabel: e.target.value })
                            }
                            placeholder={isArabic ? 'فتح الرابط' : 'Open Link'}
                            className="qr-field mt-1.5"
                          />
                        </label>
                      )}
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

              {/* SHEET E: CATEGORIZED SECTION CATALOG FOR SAUDI & CORPORATE EVENTS */}
              {currentTab === 'add-block' && (
                <div className="mt-5 space-y-5">
                  {/* Top Featured Hero Card: Create Custom Smart Section */}
                  <div
                    onClick={() => handleAddBlock('text')}
                    className="cursor-pointer rounded-2xl border-2 border-[#D4AF37] bg-gradient-to-r from-[#0A2E23] to-[#144436] p-4 text-white shadow-md hover:scale-[1.01] transition flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-[#D4AF37]">
                        <Sparkles size={22} />
                      </span>
                      <div>
                        <h3 className="font-bold text-sm text-[#FAF7F2]">
                          🧩 {isArabic ? 'إنشاء قسم مخصص بالكامل' : 'Create Custom Smart Section'}
                        </h3>
                        <p className="text-xs text-white/80 mt-0.5">
                          {isArabic
                            ? 'أضف قسماً حراً بـ 4 أنماط: بطاقة نصية، قائمة مميزات، صورة بارزة، أو متحدث'
                            : 'Build any section: text cards, feature bullets, image spotlight, or VIP speaker'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black text-xs font-bold shrink-0 shadow-xs"
                    >
                      {isArabic ? '+ إنشاء الآن' : '+ Create'}
                    </button>
                  </div>

                  {/* Category 1: Event Essentials */}
                  <div className="space-y-2.5">
                    <span className="block text-xs font-bold text-[#0A2E23]">
                      1. {isArabic ? 'أساسيات الحفل والمناسبة' : 'Event Essentials'}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        {
                          key: 'schedule' as const,
                          icon: CalendarDays,
                          title: isArabic ? 'برنامج الحفل والأجندة' : 'Agenda & Timeline',
                          desc: isArabic ? 'جدول زمني لفقرات ومراسم الحفل' : 'Interactive schedule of proceedings',
                        },
                        {
                          key: 'catering' as const,
                          icon: Utensils,
                          title: isArabic ? 'الضيافة ومأدبة العشاء' : 'Hospitality & Dining',
                          desc: isArabic ? 'القهوة السعودية، مأدبة العشاء أو الأطباق' : 'Saudi coffee, gala dinner or menu',
                        },
                        {
                          key: 'dress' as const,
                          icon: Shirt,
                          title: isArabic ? 'الزي المطلوب' : 'Dress Code & Attire',
                          desc: isArabic ? 'الزي الرسمي السعودي، كاجوال أنيق أو سهرة' : 'Official attire and dress code',
                        },
                        {
                          key: 'venue' as const,
                          icon: MapPin,
                          title: isArabic ? 'الموقع والاتجاهات' : 'Location & Directions',
                          desc: isArabic ? 'تفاصيل القاعة ورابط خرائط Google' : 'Hall location & Google Maps pin',
                        },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => handleAddBlock(item.key)}
                            data-testid={`button-add-catalog-${item.key}`}
                            className="focus-ring flex items-center gap-3 p-3.5 rounded-2xl border border-[#D4AF37]/40 bg-white hover:bg-[#FAF7F2] hover:border-[#0A2E23] transition shadow-xs text-start"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0A2E23]/10 text-[#0A2E23]">
                              <Icon size={18} />
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-[#0A2E23] truncate">{item.title}</h4>
                              <p className="text-[11px] text-[#2D2421]/65 truncate mt-0.5">{item.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category 2: Corporate, Speakers & Access */}
                  <div className="space-y-2.5">
                    <span className="block text-xs font-bold text-[#0A2E23]">
                      2. {isArabic ? 'الشركات والوصول والمتحدثون' : 'Corporate, Speakers & Access'}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        {
                          key: 'host' as const,
                          icon: User,
                          title: isArabic ? 'المتحدثون / الضيوف / الداعون' : 'Speakers & VIP Hosts',
                          desc: isArabic ? 'إبراز المتحدثين، ضيوف الشرف أو الجهة المنظمة' : 'Keynote speakers, VIPs or hosts',
                        },
                        {
                          key: 'faq' as const,
                          icon: HelpCircle,
                          title: isArabic ? 'المواقف، البوابات ومعلومات الوصول' : 'Valet, Gates & Access',
                          desc: isArabic ? 'خدمة صف السيارات، البوابات وتعليمات الدخول' : 'Valet parking, gate numbers & entry',
                        },
                        {
                          key: 'cta' as const,
                          icon: ExternalLink,
                          title: isArabic ? 'زر ورابط تفاعلي' : 'External Action Link',
                          desc: isArabic ? 'رابط ملف الحفل، كتيب أو واتساب' : 'Brochure PDF, website or WhatsApp',
                        },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => handleAddBlock(item.key)}
                            data-testid={`button-add-catalog-${item.key}`}
                            className="focus-ring flex items-center gap-3 p-3.5 rounded-2xl border border-[#D4AF37]/40 bg-white hover:bg-[#FAF7F2] hover:border-[#0A2E23] transition shadow-xs text-start"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0A2E23]/10 text-[#0A2E23]">
                              <Icon size={18} />
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-[#0A2E23] truncate">{item.title}</h4>
                              <p className="text-[11px] text-[#2D2421]/65 truncate mt-0.5">{item.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category 3: Interactive & Layout */}
                  <div className="space-y-2.5">
                    <span className="block text-xs font-bold text-[#0A2E23]">
                      3. {isArabic ? 'تفاعلي وتنسيق البطاقة' : 'Interactive & Layout'}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {[
                        {
                          key: 'registry' as const,
                          icon: Gift,
                          title: isArabic ? 'مميزات المناسبة' : 'Highlights & Gifts',
                        },
                        {
                          key: 'song' as const,
                          icon: Music2,
                          title: isArabic ? 'ركن تهاني الضيوف' : 'Guest Wishes',
                        },
                        {
                          key: 'divider' as const,
                          icon: Minus,
                          title: isArabic ? 'فاصل ذهبي مزخرف' : 'Ornamental Divider',
                        },
                        {
                          key: 'spacer' as const,
                          icon: Layers,
                          title: isArabic ? 'مسافة تباعد إضافية' : 'Spacing Gap',
                        },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => handleAddBlock(item.key)}
                            data-testid={`button-add-catalog-${item.key}`}
                            className="focus-ring flex flex-col items-center justify-center p-3 rounded-2xl border border-[#D4AF37]/40 bg-white hover:bg-[#FAF7F2] transition shadow-xs text-center"
                          >
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0A2E23]/10 text-[#0A2E23] mb-1.5">
                              <Icon size={16} />
                            </span>
                            <h4 className="text-[11px] font-bold text-[#0A2E23] truncate w-full">{item.title}</h4>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
        </div>
      </main>

      {/* 5. ZONE C: 4 Organized Studio Bottom Tabs (Mobile Only) */}
      {!isPreviewOnly && (
        <nav
          className="fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t border-[#D4AF37]/35 bg-[#FAF7F2]/95 px-4 py-2.5 backdrop-blur-md shadow-lg lg:hidden"
          aria-label={t('guestExperience')}
        >
          {/* Details / Information Tab */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'info' ? null : 'info')}
            data-testid="tab-party-info"
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition ${
              currentTab === 'info'
                ? 'text-[#0A2E23] font-bold'
                : 'text-[#2D2421]/65 hover:text-[#0A2E23]'
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                currentTab === 'info' ? 'bg-[#0A2E23] text-white shadow-xs' : 'bg-transparent'
              }`}
            >
              <FileText size={18} />
            </span>
            <span className="text-[11px] font-semibold">{t('infoTab')}</span>
          </button>

          {/* Design / Brand Tab */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'design' ? null : 'design')}
            data-testid="tab-party-design"
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition ${
              currentTab === 'design'
                ? 'text-[#0A2E23] font-bold'
                : 'text-[#2D2421]/65 hover:text-[#0A2E23]'
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                currentTab === 'design' ? 'bg-[#0A2E23] text-white shadow-xs' : 'bg-transparent'
              }`}
            >
              <Palette size={18} />
            </span>
            <span className="text-[11px] font-semibold">{t('designTab')}</span>
          </button>

          {/* Sections List Tab */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'sections' ? null : 'sections')}
            data-testid="tab-party-sections"
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition ${
              currentTab === 'sections'
                ? 'text-[#0A2E23] font-bold'
                : 'text-[#2D2421]/65 hover:text-[#0A2E23]'
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                currentTab === 'sections' ? 'bg-[#0A2E23] text-white shadow-xs' : 'bg-transparent'
              }`}
            >
              <Layers size={18} />
            </span>
            <span className="text-[11px] font-semibold">{t('sectionsTab')}</span>
          </button>

          {/* Add Section Tab */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'add-block' ? null : 'add-block')}
            data-testid="button-add-section"
            className="flex flex-col items-center gap-1 p-2 rounded-2xl text-[#0A2E23] hover:opacity-85 transition"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0A2E23] text-white shadow-xs">
              <Plus size={20} strokeWidth={2.5} />
            </span>
            <span className="text-[11px] font-bold">{t('addSection')}</span>
          </button>
        </nav>
      )}
    </div>
  );
}
