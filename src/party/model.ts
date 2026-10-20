import type { InvitationLocale } from '../i18n/locale.ts';

export type PartyTemplateId = 'corporate' | 'birthday' | 'baby-shower' | 'custom';
export type PartyTypography = 'display' | 'modern';
export type PartyLayout = 'centered' | 'editorial';
export type PartyMotion = 'gentle' | 'none';
export type PartyMotif = 'lines' | 'balloons' | 'botanical' | 'luxury-thread';

export type PartyStyleDefinition = {
  id: string;
  templateId: PartyTemplateId;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  backgroundColor: string;
  surfaceColor: string;
  primaryColor: string;
  accentColor: string;
  typography: PartyTypography;
  layout: PartyLayout;
  motion: PartyMotion;
  decorations: boolean;
  motif: PartyMotif;
};

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
  mode?: 'note' | 'menu';
  scheduleItems?: { time: string; title: string }[];
  dressPreset?: string;
  customLayout?: 'editorial-card' | 'bullet-grid' | 'image-spotlight' | 'stats-highlights';
  bullets?: string[];
  imageUrl?: string | null;
  badge?: string;
  buttonLabel?: string;
};

export type StudioBlock = {
  id: string;
  key: BlockKey;
  enabled: boolean;
  label: string;
  eyebrow: string;
  content: BlockContent;
};

export type PartyEventData = {
  title: string;
  hostName?: string;
  subtitle?: string;
  invitationWording: string;
  date: string;
  startTime: string;
  venue: string;
  city: string;
  rsvpDeadline: string;
  templateId: PartyTemplateId;
  styleId?: string | null;
  backgroundColor: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  typography: PartyTypography;
  layout: PartyLayout;
  motion: PartyMotion;
  decorations: boolean;
  badgeText?: string | null;
  occasionPresetId?: string;
  logoUrl?: string | null;
  logoSize?: 'sm' | 'md' | 'lg';
  logoShape?: 'original' | 'circle' | 'rounded';
  logoContainer?: 'auto-clean' | 'glass-crest' | 'white-pill' | 'raw';
  logoPlacement?: 'top-center' | 'header-bar' | 'hero-seal' | 'both-footer';
  backgroundImageUrl?: string | null;
  backgroundFitMode?: 'cover' | 'contain';
  backgroundMode?: 'full-pinned' | 'frame-9-16' | 'hero-banner';
  backgroundBlur?: number;
  backgroundOverlayOpacity?: number;
  brandPalette?: string[];
  titleScale?: 'sm' | 'md' | 'lg' | 'xl';
  hijriDate?: string;
  showHijriDate?: boolean;
  timeLabel?: string;
  receptionTime?: string;
  showCountdownCalendar?: boolean;
  enableEnvelopeOpener?: boolean;
  waxSealText?: string | null;
  useLogoOnWaxSeal?: boolean;
  mapUrl?: string;
  etiquetteBadges?: string[];
};

export const partyStyles: Record<string, PartyStyleDefinition> = {
  // Corporate styles
  'executive-navy': {
    id: 'executive-navy',
    templateId: 'corporate',
    name: 'Executive Obsidian',
    nameAr: 'أزرق تنفيذي سبجي',
    description: 'Deep executive obsidian with brushed gold accents and clean architectural structure.',
    descriptionAr: 'كحلي تنفيذي سبجي داكن مع لمسات ذهبية وتخطيط معماري رصين.',
    backgroundColor: '#0B1522',
    surfaceColor: '#122236',
    primaryColor: '#FFFFFF',
    accentColor: '#D4AF37',
    typography: 'modern',
    layout: 'editorial',
    motion: 'gentle',
    decorations: true,
    motif: 'lines',
  },
  'monochrome-slate': {
    id: 'monochrome-slate',
    templateId: 'corporate',
    name: 'Monochrome Slate',
    nameAr: 'رمادي حجري',
    description: 'Steel slate with crisp silver and restrained geometry.',
    descriptionAr: 'رمادي فولاذي مع فضي ناصع وهندسة متزنة.',
    backgroundColor: '#1E293B',
    surfaceColor: '#283548',
    primaryColor: '#F8FAFC',
    accentColor: '#94A3B8',
    typography: 'modern',
    layout: 'editorial',
    motion: 'none',
    decorations: false,
    motif: 'lines',
  },
  'royal-emerald': {
    id: 'royal-emerald',
    templateId: 'corporate',
    name: 'Royal Emerald',
    nameAr: 'زمردي ملكي',
    description: 'Dark forest emerald with champagne accents for prestige functions.',
    descriptionAr: 'أخضر زمردي داكن مع ذهب شامبين للمناسبات الرفيعة.',
    backgroundColor: '#0A261D',
    surfaceColor: '#13392D',
    primaryColor: '#F2F8F5',
    accentColor: '#D4AF37',
    typography: 'display',
    layout: 'centered',
    motion: 'gentle',
    decorations: true,
    motif: 'lines',
  },

  // Birthday styles (Bright, Joyful & Celebratory Palette)
  'celebration-berry': {
    id: 'celebration-berry',
    templateId: 'birthday',
    name: 'Warm Champagne & Rose',
    nameAr: 'شامبين ومرجاني مبهج',
    description: 'Warm champagne blush canvas, ivory sheet, and festive rose-coral with gold highlights.',
    descriptionAr: 'شامبين مشرق مع أبيض عاجي ولمسات مرجانية وذهبية احتفالية مبهجة.',
    backgroundColor: '#FFF7F4',
    surfaceColor: '#FFFFFF',
    primaryColor: '#241417',
    accentColor: '#E04F67',
    typography: 'display',
    layout: 'centered',
    motion: 'gentle',
    decorations: true,
    motif: 'balloons',
  },
  'golden-midnight': {
    id: 'golden-midnight',
    templateId: 'birthday',
    name: 'Festive Midnight Gold',
    nameAr: 'منتصف الليل الذهبي الاحتفالي',
    description: 'Deep midnight charcoal with glowing festive gold party accents.',
    descriptionAr: 'فحم داكن مع لمسات ذهبية متألقة لأعياد الميلاد المسائية.',
    backgroundColor: '#1A181E',
    surfaceColor: '#292530',
    primaryColor: '#FBF9F5',
    accentColor: '#D4AF37',
    typography: 'display',
    layout: 'centered',
    motion: 'gentle',
    decorations: true,
    motif: 'balloons',
  },
  'vibrant-citrus': {
    id: 'vibrant-citrus',
    templateId: 'birthday',
    name: 'Royal Berry & Champagne',
    nameAr: 'توتي ملكي وشامبين',
    description: 'Rich royal berry with joyful champagne gold highlights.',
    descriptionAr: 'توتي ملكي فاخر مع ذهب شامبين دافئ.',
    backgroundColor: '#4A1525',
    surfaceColor: '#5E1B30',
    primaryColor: '#FFF5F2',
    accentColor: '#E5A93C',
    typography: 'display',
    layout: 'centered',
    motion: 'gentle',
    decorations: true,
    motif: 'balloons',
  },

  // Baby shower styles
  'sage-botanical': {
    id: 'sage-botanical',
    templateId: 'baby-shower',
    name: 'Sage Mist & Gold',
    nameAr: 'مرمية نباتية وذهب',
    description: 'Soft botanical sage mist, cloud pearl sheet, and warm cashmere gold.',
    descriptionAr: 'أخضر ميرمية ناعم ولؤلؤي مع لمسات ذهب كشميري دافئ.',
    backgroundColor: '#F3F7F4',
    surfaceColor: '#FFFFFF',
    primaryColor: '#1B2E24',
    accentColor: '#6E967E',
    typography: 'display',
    layout: 'centered',
    motion: 'gentle',
    decorations: true,
    motif: 'botanical',
  },
  'blush-cloud': {
    id: 'blush-cloud',
    templateId: 'baby-shower',
    name: 'Girl Soft Blush',
    nameAr: 'وردي ناعم · بناتي',
    description: 'Gentle blush rose with cloud-soft pearl surfaces and warm rose gold.',
    descriptionAr: 'وردي هادئ وناعم مع أسطح لؤلؤية كالسحاب لاستقبال المواليد البنات.',
    backgroundColor: '#FDF4F6',
    surfaceColor: '#FFFFFF',
    primaryColor: '#3A1E24',
    accentColor: '#C9828B',
    typography: 'display',
    layout: 'centered',
    motion: 'gentle',
    decorations: true,
    motif: 'botanical',
  },
  'celestial-sky': {
    id: 'celestial-sky',
    templateId: 'baby-shower',
    name: 'Boy Sky Pearl',
    nameAr: 'أزرق لؤلؤي · ولادي',
    description: 'Soft mist blue and cloud pearl with delicate celestial accents.',
    descriptionAr: 'أزرق سماوي ناعم مع أبيض لؤلؤي لاستقبال المواليد الأولاد.',
    backgroundColor: '#F0F6FA',
    surfaceColor: '#FFFFFF',
    primaryColor: '#1D3042',
    accentColor: '#4A82B0',
    typography: 'modern',
    layout: 'centered',
    motion: 'gentle',
    decorations: true,
    motif: 'botanical',
  },

  // Custom styles
  'luxury-emerald': {
    id: 'luxury-emerald',
    templateId: 'custom',
    name: 'Najdi Sandstone & Emerald',
    nameAr: 'رمل نجدي وزمرد ملكي',
    description: 'Najdi sandstone hero with royal Saudi emerald curved sheet and antique gold accents.',
    descriptionAr: 'رمل نجدي تراثي مع زمرد ملكي سعودي وخيوط ذهبية عتيقة.',
    backgroundColor: '#F9F5EB',
    surfaceColor: '#0D2B22',
    primaryColor: '#0D2B22',
    accentColor: '#C89D3C',
    typography: 'display',
    layout: 'centered',
    motion: 'gentle',
    decorations: true,
    motif: 'luxury-thread',
  },
  'obsidian-gold': {
    id: 'obsidian-gold',
    templateId: 'custom',
    name: 'Obsidian Gold',
    nameAr: 'سبج وذهب',
    description: 'Black-tie obsidian with high-contrast gilded typography.',
    descriptionAr: 'أسود سبجي فاخر مع خطوط ذهبية بارزة للسهرات الملكية.',
    backgroundColor: '#121316',
    surfaceColor: '#1E2024',
    primaryColor: '#F8F6F0',
    accentColor: '#E2B842',
    typography: 'display',
    layout: 'editorial',
    motion: 'gentle',
    decorations: true,
    motif: 'luxury-thread',
  },
  'desert-sand': {
    id: 'desert-sand',
    templateId: 'custom',
    name: 'Desert Sand',
    nameAr: 'رمال الصحراء',
    description: 'Warm linen and terracotta with modern editorial typography.',
    descriptionAr: 'كتان دافئ مع فخار وترتيب تحريري معاصر.',
    backgroundColor: '#F5F0E6',
    surfaceColor: '#EADBCA',
    primaryColor: '#2C221E',
    accentColor: '#A86246',
    typography: 'modern',
    layout: 'editorial',
    motion: 'gentle',
    decorations: true,
    motif: 'luxury-thread',
  },
};

export const partyTemplates: Record<PartyTemplateId, {
  id: PartyTemplateId;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  defaultStyleId: string;
  supportedStyles: string[];
}> = {
  corporate: {
    id: 'corporate',
    name: 'Corporate',
    nameAr: 'شركة وأعمال',
    description: 'Clear, composed, and brand-ready.',
    descriptionAr: 'واضح ومتزن وجاهز لهوية العلامة.',
    defaultStyleId: 'executive-navy',
    supportedStyles: ['executive-navy', 'monochrome-slate', 'royal-emerald'],
  },
  birthday: {
    id: 'birthday',
    name: 'Birthday',
    nameAr: 'عيد ميلاد',
    description: 'Bright, warm, and celebratory.',
    descriptionAr: 'مشرق ودافئ ومليء بالاحتفال.',
    defaultStyleId: 'celebration-berry',
    supportedStyles: ['celebration-berry', 'golden-midnight', 'vibrant-citrus'],
  },
  'baby-shower': {
    id: 'baby-shower',
    name: 'Baby Shower',
    nameAr: 'استقبال مولود',
    description: 'Soft, joyful, and welcoming.',
    descriptionAr: 'ناعم ومبهج ومفعم بالترحيب.',
    defaultStyleId: 'sage-botanical',
    supportedStyles: ['sage-botanical', 'blush-cloud', 'celestial-sky'],
  },
  custom: {
    id: 'custom',
    name: 'Custom celebration',
    nameAr: 'احتفال مخصص',
    description: 'A flexible start for any occasion.',
    descriptionAr: 'بداية مرنة لأي مناسبة.',
    defaultStyleId: 'luxury-emerald',
    supportedStyles: ['luxury-emerald', 'obsidian-gold', 'desert-sand'],
  },
};

export const defaultPartyEvent: PartyEventData = {
  title: 'Maya & Liam Celebration',
  invitationWording: 'Join us for an evening made for celebrating together.',
  date: '2026-10-14',
  startTime: '19:00',
  venue: 'The Grand Palace Hall',
  city: 'Jeddah, Saudi Arabia',
  rsvpDeadline: '2026-09-20',
  templateId: 'custom',
  backgroundColor: null,
  primaryColor: null,
  accentColor: null,
  typography: 'display',
  layout: 'centered',
  motion: 'gentle',
  decorations: true,
};

export function resolvePartyTemplateId(value: unknown): PartyTemplateId {
  const legacy: Record<string, PartyTemplateId> = { 'garden-glow': 'custom', 'confetti-pop': 'birthday', 'skyline-toast': 'corporate' };
  if (typeof value === 'string' && Object.hasOwn(legacy, value)) return legacy[value];
  return typeof value === 'string' && Object.hasOwn(partyTemplates, value) ? (value as PartyTemplateId) : defaultPartyEvent.templateId;
}

export function resolvePartyStyleId(templateId: PartyTemplateId, candidate: unknown): string {
  const tpl = partyTemplates[templateId] ?? partyTemplates.custom;
  if (typeof candidate === 'string' && candidate in partyStyles) {
    const style = partyStyles[candidate];
    if (style.templateId === templateId) return candidate;
  }
  return tpl.defaultStyleId;
}

export function mergePartyEvent(value: Partial<PartyEventData> | null | undefined): PartyEventData {
  const color = (candidate: unknown) => (typeof candidate === 'string' && /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : null);
  const resolvedTemplate = resolvePartyTemplateId(value?.templateId);
  const resolvedStyle = resolvePartyStyleId(resolvedTemplate, value?.styleId);

  const result: PartyEventData = {
    ...defaultPartyEvent,
    ...value,
    templateId: resolvedTemplate,
    styleId: resolvedStyle,
    backgroundColor: color(value?.backgroundColor),
    primaryColor: color(value?.primaryColor),
    accentColor: color(value?.accentColor),
    typography: value?.typography === 'modern' ? 'modern' : 'display',
    layout: value?.layout === 'editorial' ? 'editorial' : 'centered',
    motion: value?.motion === 'none' ? 'none' : 'gentle',
    decorations: value?.decorations !== false,
  };

  if (value?.hostName !== undefined) result.hostName = typeof value.hostName === 'string' ? value.hostName : '';
  if (value?.subtitle !== undefined) result.subtitle = typeof value.subtitle === 'string' ? value.subtitle : '';
  if (value?.badgeText !== undefined) result.badgeText = typeof value.badgeText === 'string' ? value.badgeText : '';

  if (value?.occasionPresetId !== undefined) result.occasionPresetId = typeof value.occasionPresetId === 'string' ? value.occasionPresetId : undefined;
  if (value?.logoUrl !== undefined) result.logoUrl = typeof value.logoUrl === 'string' ? value.logoUrl : null;
  if (value?.logoSize !== undefined) result.logoSize = ['sm', 'md', 'lg'].includes(value.logoSize as string) ? (value.logoSize as 'sm' | 'md' | 'lg') : 'md';
  if (value?.logoShape !== undefined) result.logoShape = ['original', 'circle', 'rounded'].includes(value.logoShape as string) ? (value.logoShape as 'original' | 'circle' | 'rounded') : 'original';
  if (value?.logoContainer !== undefined) result.logoContainer = ['auto-clean', 'glass-crest', 'white-pill', 'raw'].includes(value.logoContainer as string) ? (value.logoContainer as 'auto-clean' | 'glass-crest' | 'white-pill' | 'raw') : 'auto-clean';
  if (value?.logoPlacement !== undefined) result.logoPlacement = ['top-center', 'header-bar', 'hero-seal', 'both-footer'].includes(value.logoPlacement as string) ? (value.logoPlacement as 'top-center' | 'header-bar' | 'hero-seal' | 'both-footer') : 'top-center';
  if (value?.backgroundImageUrl !== undefined) result.backgroundImageUrl = typeof value.backgroundImageUrl === 'string' ? value.backgroundImageUrl : null;
  if (value?.backgroundFitMode !== undefined) result.backgroundFitMode = value.backgroundFitMode === 'contain' ? 'contain' : 'cover';
  if (value?.backgroundMode !== undefined) result.backgroundMode = ['full-pinned', 'frame-9-16', 'hero-banner'].includes(value.backgroundMode as string) ? (value.backgroundMode as 'full-pinned' | 'frame-9-16' | 'hero-banner') : 'full-pinned';
  if (value?.backgroundBlur !== undefined) result.backgroundBlur = typeof value.backgroundBlur === 'number' ? Math.max(0, Math.min(16, value.backgroundBlur)) : 0;
  if (value?.backgroundOverlayOpacity !== undefined) result.backgroundOverlayOpacity = typeof value.backgroundOverlayOpacity === 'number' ? Math.max(0, Math.min(0.85, value.backgroundOverlayOpacity)) : 0.45;
  if (value?.brandPalette !== undefined && Array.isArray(value.brandPalette)) result.brandPalette = value.brandPalette.filter((c): c is string => typeof c === 'string');
  if (value?.titleScale !== undefined) result.titleScale = ['sm', 'md', 'lg', 'xl'].includes(value.titleScale as string) ? (value.titleScale as 'sm' | 'md' | 'lg' | 'xl') : 'lg';
  if (value?.hijriDate !== undefined) result.hijriDate = typeof value.hijriDate === 'string' ? value.hijriDate : undefined;
  if (value?.showHijriDate !== undefined) result.showHijriDate = Boolean(value.showHijriDate);
  if (value?.timeLabel !== undefined) result.timeLabel = typeof value.timeLabel === 'string' ? value.timeLabel : undefined;
  if (value?.receptionTime !== undefined) result.receptionTime = typeof value.receptionTime === 'string' ? value.receptionTime : undefined;
  if (value?.showCountdownCalendar !== undefined) result.showCountdownCalendar = Boolean(value.showCountdownCalendar);
  if (value?.enableEnvelopeOpener !== undefined) result.enableEnvelopeOpener = Boolean(value.enableEnvelopeOpener);
  if (value?.waxSealText !== undefined) result.waxSealText = typeof value.waxSealText === 'string' ? value.waxSealText : null;
  if (value?.useLogoOnWaxSeal !== undefined) result.useLogoOnWaxSeal = Boolean(value.useLogoOnWaxSeal);
  if (value?.mapUrl !== undefined) result.mapUrl = typeof value.mapUrl === 'string' ? value.mapUrl : undefined;
  if (value?.etiquetteBadges !== undefined && Array.isArray(value.etiquetteBadges)) result.etiquetteBadges = value.etiquetteBadges.filter((b): b is string => typeof b === 'string');

  // If user hasn't explicitly supplied styleId, hostName, subtitle, badgeText, keep shape identical to defaultPartyEvent
  if (!value?.styleId && value?.templateId === undefined && value?.hostName === undefined && value?.subtitle === undefined && value?.badgeText === undefined) {
    delete result.styleId;
    delete result.hostName;
    delete result.subtitle;
    delete result.badgeText;
  }

  return result;
}

/**
 * Safely changes the Party Template while preserving all entered host content.
 */
export function changePartyTemplate(current: PartyEventData, newTemplateId: PartyTemplateId): PartyEventData {
  const template = partyTemplates[newTemplateId] ?? partyTemplates.custom;
  const newStyle = partyStyles[template.defaultStyleId];

  return {
    ...current,
    templateId: newTemplateId,
    styleId: template.defaultStyleId,
    backgroundColor: null,
    primaryColor: null,
    accentColor: null,
    typography: newStyle.typography,
    layout: newStyle.layout,
    motion: newStyle.motion,
    decorations: newStyle.decorations,
  };
}

export const TEMPLATE_DEFAULT_BLOCK_KEYS: Record<PartyTemplateId, BlockKey[]> = {
  corporate: ['schedule', 'host', 'faq'],
  birthday: ['catering', 'dress', 'song'],
  'baby-shower': ['catering', 'registry', 'song'],
  custom: ['catering', 'faq', 'text'],
};

/**
 * Activates canonical default active sections for a chosen template while preserving block order and custom content.
 */
export function getTemplateDefaultBlocks(templateId: PartyTemplateId, currentBlocks: StudioBlock[]): StudioBlock[] {
  const targetKeys = TEMPLATE_DEFAULT_BLOCK_KEYS[templateId] || TEMPLATE_DEFAULT_BLOCK_KEYS.custom;
  return currentBlocks.map((b) => ({
    ...b,
    enabled: targetKeys.includes(b.key),
  }));
}

/**
 * Safely changes the Party Style within a template without modifying event content.
 */
export function changePartyStyle(current: PartyEventData, newStyleId: string): PartyEventData {
  const style = partyStyles[newStyleId];
  if (!style) return current;

  return {
    ...current,
    templateId: style.templateId,
    styleId: style.id,
    backgroundColor: null,
    primaryColor: null,
    accentColor: null,
    typography: style.typography,
    layout: style.layout,
    motion: style.motion,
    decorations: style.decorations,
  };
}

export function formatPartyDate(value: string, locale: InvitationLocale): string {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/**
 * Safely parses Gregorian event date details and month grid coordinates
 */
export function parseEventDateDetails(dateStr: string, locale: 'ar' | 'en') {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return null;
  }
  const [yStr, mStr, dStr] = dateStr.trim().split('-');
  const year = parseInt(yStr, 10);
  const monthIdx = parseInt(mStr, 10) - 1;
  const day = parseInt(dStr, 10);
  const dateObj = new Date(Date.UTC(year, monthIdx, day, 12, 0, 0));

  const dayOfWeek = dateObj.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  });

  const monthName = dateObj.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    month: 'long',
    timeZone: 'UTC',
  });

  const firstDayOfWeek = new Date(Date.UTC(year, monthIdx, 1, 12, 0, 0)).getUTCDay();
  const totalDays = new Date(Date.UTC(year, monthIdx + 1, 0, 12, 0, 0)).getUTCDate();

  return {
    year,
    monthIdx,
    day,
    dayOfWeek,
    monthName,
    firstDayOfWeek,
    totalDays,
  };
}

export type OccasionBlueprint = {
  id: string;
  icon: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  wordingAr: string;
  wordingEn: string;
  templateId: PartyTemplateId;
  styleId: string;
  badgeTextAr: string;
  badgeTextEn: string;
  recommendedBlockKeys: ('catering' | 'dress' | 'schedule' | 'registry' | 'song' | 'faq' | 'text' | 'venue' | 'host' | 'cta' | 'divider' | 'spacer')[];
  etiquetteBadgesAr?: string[];
  etiquetteBadgesEn?: string[];
};

export const OCCASION_BLUEPRINTS: OccasionBlueprint[] = [
  {
    id: 'corporate-gala',
    icon: '🏢',
    titleAr: 'حفل العشاء السنوي والتكريم',
    titleEn: 'Annual Corporate Gala & Awards',
    subtitleAr: 'احتفاء بالإنجازات والشركاء المتميزين',
    subtitleEn: 'Honoring Excellence & Strategic Partnerships',
    wordingAr: 'يسر مجلس الإدارة دعوتكم لحضور حفل العشاء السنوي وتكريم نخبة الإنجازات والشركاء في أمسية استثنائية تجمع قادة الأعمال.',
    wordingEn: 'The Board of Directors cordially invites you to our Annual Gala Dinner celebrating outstanding achievements and executive leadership.',
    templateId: 'corporate',
    styleId: 'executive-navy',
    badgeTextAr: 'دعوة خاصة · VIP',
    badgeTextEn: 'VIP INVITATION',
    recommendedBlockKeys: ['schedule', 'catering', 'faq'],
    etiquetteBadgesAr: ['الدخول ببطاقة الدعوة', 'خدمة صف السيارات (Valet)'],
    etiquetteBadgesEn: ['Admission by VIP pass', 'Valet parking available'],
  },
  {
    id: 'suhoor-ramadan',
    icon: '🌙',
    titleAr: 'أمسية الغبقة والسحور الرمضاني',
    titleEn: 'Ramadan Suhoor & Ghabga Gathering',
    subtitleAr: 'في ليالي الخير والبركة',
    subtitleEn: 'Blessed Gatherings of the Holy Month',
    wordingAr: 'يسعدنا ويشرفنا لقاؤكم على مائدة السحور الرمضاني المبارك، سائلين المولى عز وجل أن يتقبل منا ومنكم صالح الأعمال.',
    wordingEn: 'We are delighted to invite you to our Ramadan Suhoor evening, celebrating the spirit of community and blessings.',
    templateId: 'corporate',
    styleId: 'royal-emerald',
    badgeTextAr: 'سحور مبارك · غبقة رمضانية',
    badgeTextEn: 'RAMADAN SUHOOR',
    recommendedBlockKeys: ['catering', 'venue'],
    etiquetteBadgesAr: ['الدخول ببطاقة الدعوة'],
    etiquetteBadgesEn: ['Private invitation pass'],
  },
  {
    id: 'medical-tech-forum',
    icon: '🩺',
    titleAr: 'ملتقى الابتكار والريادة المهني',
    titleEn: 'Healthcare & Innovation Summit',
    subtitleAr: 'نحو مستقبل ريادي متقدم',
    subtitleEn: 'Transforming Industry Frontiers',
    wordingAr: 'نتشرف بدعوتكم لحضور ملتقى الابتكار التخصصي، بمشاركة نخبة من المتحدثين والخبراء لمناقشة أحدث الرؤى والتجارب الرائدة.',
    wordingEn: 'Join distinguished industry experts and keynote visionaries at the flagship Professional Forum and Innovation Showcase.',
    templateId: 'corporate',
    styleId: 'monochrome-slate',
    badgeTextAr: 'ملتقى مهني · دعوة رسمية',
    badgeTextEn: 'PROFESSIONAL SUMMIT',
    recommendedBlockKeys: ['schedule', 'venue', 'cta'],
    etiquetteBadgesAr: ['الدخول ببطاقة الدعوة', 'خدمة صف السيارات (Valet)'],
    etiquetteBadgesEn: ['Registration pass required', 'Valet parking available'],
  },
  {
    id: 'brand-opening',
    icon: '☕',
    titleAr: 'حفل التدشين والافتتاح الرسمي',
    titleEn: 'Grand Brand Opening & Launch',
    subtitleAr: 'انطلاقة فصل جديد من الإبداع',
    subtitleEn: 'A New Chapter of Distinction',
    wordingAr: 'يسرنا دعوتكم لمشاركتنا لحظة التدشين والافتتاح الرسمي لفرعنا الجديد، لنحتفي معاً ببداية استثنائية وتجربة فريدة.',
    wordingEn: 'We warmly welcome you to join us for our exclusive Grand Opening and Launch Reception, unveiling an inspiring new experience.',
    templateId: 'corporate',
    styleId: 'executive-navy',
    badgeTextAr: 'تدشين وافتتاح رسمي',
    badgeTextEn: 'GRAND OPENING',
    recommendedBlockKeys: ['venue', 'text', 'cta'],
    etiquetteBadgesAr: ['الدخول ببطاقة الدعوة'],
    etiquetteBadgesEn: ['VIP Guest Pass'],
  },
  {
    id: 'graduation',
    icon: '🎓',
    titleAr: 'حفل تخرج وتكريم الإنجاز',
    titleEn: 'Graduation & Honor Celebration',
    subtitleAr: 'فرحة ثمرة الجهد والنجاح',
    subtitleEn: 'Celebrating Dedication & Bright Futures',
    wordingAr: 'بكل فخر وسرور، نتشرف بدعوتكم لمشاركتنا فرحة التخرج والاحتفاء بمسيرة ملؤها الاجتهاد والتميز.',
    wordingEn: 'With pride and joy, we invite you to celebrate our graduation milestone and the exciting journey ahead.',
    templateId: 'custom',
    styleId: 'obsidian-gold',
    badgeTextAr: 'حفل تخرج وتفوق',
    badgeTextEn: 'GRADUATION GALA',
    recommendedBlockKeys: ['text', 'song'],
    etiquetteBadgesAr: ['جنة الأطفال منازلهم'],
    etiquetteBadgesEn: ['Adults only ceremony'],
  },
  {
    id: 'majlis-gathering',
    icon: '🏡',
    titleAr: 'لقاء المجلس والاستراحة العائلية',
    titleEn: 'Majlis Gathering & Evening Soirée',
    subtitleAr: 'جلسة محبة وألفة تجمع الأحبة',
    subtitleEn: 'An Evening of Warmth & Fellowship',
    wordingAr: 'نتشرف بحضوركم الكريم في مجلسنا العامر ونسعد بطيب اللقاء وتبادل الأحاديث الودية في أجواء أخوية دافئة.',
    wordingEn: 'We look forward to welcoming you to our Majlis gathering for a warm evening of hospitality and companionship.',
    templateId: 'custom',
    styleId: 'desert-sand',
    badgeTextAr: 'مجلس عائلي · لقاء أحبة',
    badgeTextEn: 'MAJLIS RECEPTION',
    recommendedBlockKeys: ['catering', 'venue'],
    etiquetteBadgesAr: [],
    etiquetteBadgesEn: [],
  },
  {
    id: 'birthday-festive',
    icon: '🎂',
    titleAr: 'أمسية عيد ميلاد واحتفال',
    titleEn: 'Birthday Festive Celebration',
    subtitleAr: 'عام جديد من الفرح والذكريات الجميلة',
    subtitleEn: 'Another Year of Joy & Memories',
    wordingAr: 'يسعدني دعوتكم لمشاركتي أجمل اللحظات والاحتفال بذكرى ميلادي في أمسية مليئة بالبهجة والمرح والموسيقى.',
    wordingEn: 'Join us for a vibrant night of laughter, dancing, and celebratory toasts as we mark another wonderful year.',
    templateId: 'birthday',
    styleId: 'celebration-berry',
    badgeTextAr: 'حفل ميلاد مميز',
    badgeTextEn: 'BIRTHDAY BASH',
    recommendedBlockKeys: ['text', 'song'],
    etiquetteBadgesAr: [],
    etiquetteBadgesEn: [],
  },
  {
    id: 'baby-reception',
    icon: '👶',
    titleAr: 'حفاوة واستقبال المولود الجديد',
    titleEn: 'Baby Reception & Welcome Blessing',
    subtitleAr: 'أهلاً بنبض جديد يملأ دنيانا نوراً',
    subtitleEn: 'Welcoming Our Precious Blessing',
    wordingAr: 'الحمد لله على تمام النعمة واكتمال المنة، يسرنا دعوتكم لمشاركتنا فرحة قدوم مولودنا الغالي ومشاركتنا أصدق الدعوات.',
    wordingEn: 'Blessed with love and gratitude, we invite you to celebrate the joyful arrival of our precious little one.',
    templateId: 'baby-shower',
    styleId: 'blush-cloud',
    badgeTextAr: 'استقبال مواليد · فرحة عمر',
    badgeTextEn: 'WELCOME LITTLE ONE',
    recommendedBlockKeys: ['text', 'registry'],
    etiquetteBadgesAr: ['ممنوع التصوير'],
    etiquetteBadgesEn: ['No photography please'],
  },
];
