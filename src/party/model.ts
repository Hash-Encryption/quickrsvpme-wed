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
};

export const partyStyles: Record<string, PartyStyleDefinition> = {
  // Corporate styles
  'executive-navy': {
    id: 'executive-navy',
    templateId: 'corporate',
    name: 'Executive Navy',
    nameAr: 'أزرق تنفيذي',
    description: 'Deep navy with bronze copper accents and clean architectural structure.',
    descriptionAr: 'كحلي داكن مع لمسات نحاسية وتخطيط معماري رصين.',
    backgroundColor: '#0F1E2E',
    surfaceColor: '#172B3E',
    primaryColor: '#F4F7F9',
    accentColor: '#C28B55',
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

  // Birthday styles
  'celebration-berry': {
    id: 'celebration-berry',
    templateId: 'birthday',
    name: 'Celebration Berry',
    nameAr: 'توتي احتفالي',
    description: 'Rich berry and warm champagne with festive balloon arch framing.',
    descriptionAr: 'توتي دافئ مع ذهب شامبين وقوس بالونات احتفالي.',
    backgroundColor: '#4A1525',
    surfaceColor: '#632135',
    primaryColor: '#FFF5F2',
    accentColor: '#E5A93C',
    typography: 'display',
    layout: 'centered',
    motion: 'gentle',
    decorations: true,
    motif: 'balloons',
  },
  'golden-midnight': {
    id: 'golden-midnight',
    templateId: 'birthday',
    name: 'Golden Midnight',
    nameAr: 'منتصف الليل الذهبي',
    description: 'Deep midnight charcoal with glowing gold party accents.',
    descriptionAr: 'فحم داكن مع لمسات ذهبية متألقة لأعياد الميلاد المسائية.',
    backgroundColor: '#1A181E',
    surfaceColor: '#292530',
    primaryColor: '#FBF9F5',
    accentColor: '#F3C053',
    typography: 'display',
    layout: 'centered',
    motion: 'gentle',
    decorations: true,
    motif: 'balloons',
  },
  'vibrant-citrus': {
    id: 'vibrant-citrus',
    templateId: 'birthday',
    name: 'Vibrant Coral',
    nameAr: 'مرجاني مشرق',
    description: 'Joyful coral and warm gold for energetic gatherings.',
    descriptionAr: 'مرجاني مبهج ودفء الذهب للمناسبات المليئة بالحيوية.',
    backgroundColor: '#FFF7F2',
    surfaceColor: '#FFEBE3',
    primaryColor: '#6E1E28',
    accentColor: '#E05D5D',
    typography: 'modern',
    layout: 'centered',
    motion: 'gentle',
    decorations: true,
    motif: 'balloons',
  },

  // Baby shower styles
  'sage-botanical': {
    id: 'sage-botanical',
    templateId: 'baby-shower',
    name: 'Sage Botanical',
    nameAr: 'مرمية نباتية',
    description: 'Soft sage and warm ivory with delicate botanical leaves.',
    descriptionAr: 'أخضر ميرمية ناعم وعاجي دافئ مع أوراق نباتية رقيقة.',
    backgroundColor: '#435B4E',
    surfaceColor: '#536E60',
    primaryColor: '#F7FAF8',
    accentColor: '#D9C18F',
    typography: 'display',
    layout: 'centered',
    motion: 'gentle',
    decorations: true,
    motif: 'botanical',
  },
  'blush-cloud': {
    id: 'blush-cloud',
    templateId: 'baby-shower',
    name: 'Blush Cloud',
    nameAr: 'سحاب وردي',
    description: 'Gentle blush rose with cloud-soft surfaces and warm gold.',
    descriptionAr: 'وردي هادئ مع أسطح ناعمة كالسحاب ولمسات ذهبية رقيقة.',
    backgroundColor: '#FAF5F3',
    surfaceColor: '#F5E8E4',
    primaryColor: '#52343A',
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
    name: 'Celestial Sky',
    nameAr: 'سماء سماوية',
    description: 'Soft mist blue and cream with delicate star accents.',
    descriptionAr: 'أزرق سماوي ناعم مع كريمي وتطريز نجمي لطيف.',
    backgroundColor: '#EBF2F7',
    surfaceColor: '#DCE7EF',
    primaryColor: '#2D4452',
    accentColor: '#5B86A2',
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
    name: 'Luxury Emerald',
    nameAr: 'زمرد فاخر',
    description: 'Deep forest emerald, warm sand, and radiant gold threads.',
    descriptionAr: 'أخضر غابي عميق مع رمل دافئ وخيوط ذهبية متقنة.',
    backgroundColor: '#0A2E23',
    surfaceColor: '#133D30',
    primaryColor: '#FFFDF9',
    accentColor: '#D4AF37',
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
