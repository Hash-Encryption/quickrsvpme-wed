import type { InvitationLocale } from '../i18n/locale.ts';

export type PartyTemplateId = 'corporate' | 'birthday' | 'baby-shower' | 'custom';
export type PartyTypography = 'display' | 'modern';
export type PartyLayout = 'centered' | 'editorial';
export type PartyMotion = 'gentle' | 'none';

export type PartyEventData = {
  title: string;
  invitationWording: string;
  date: string;
  startTime: string;
  venue: string;
  city: string;
  rsvpDeadline: string;
  templateId: PartyTemplateId;
  backgroundColor: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  typography: PartyTypography;
  layout: PartyLayout;
  motion: PartyMotion;
  decorations: boolean;
};

export const partyTemplates: Record<PartyTemplateId, { id: PartyTemplateId; name: string; nameAr: string; description: string; descriptionAr: string }> = {
  corporate: { id: 'corporate', name: 'Corporate', nameAr: 'شركة وأعمال', description: 'Clear, composed, and brand-ready.', descriptionAr: 'واضح ومتزن وجاهز لهوية العلامة.' },
  birthday: { id: 'birthday', name: 'Birthday', nameAr: 'عيد ميلاد', description: 'Bright, warm, and celebratory.', descriptionAr: 'مشرق ودافئ ومليء بالاحتفال.' },
  'baby-shower': { id: 'baby-shower', name: 'Baby Shower', nameAr: 'استقبال مولود', description: 'Soft, joyful, and welcoming.', descriptionAr: 'ناعم ومبهج ومفعم بالترحيب.' },
  custom: { id: 'custom', name: 'Custom celebration', nameAr: 'احتفال مخصص', description: 'A flexible start for any occasion.', descriptionAr: 'بداية مرنة لأي مناسبة.' },
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
  return typeof value === 'string' && Object.hasOwn(partyTemplates, value) ? value as PartyTemplateId : defaultPartyEvent.templateId;
}

export function mergePartyEvent(value: Partial<PartyEventData> | null | undefined): PartyEventData {
  const color = (candidate: unknown) => typeof candidate === 'string' && /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : null;
  return {
    ...defaultPartyEvent,
    ...value,
    templateId: resolvePartyTemplateId(value?.templateId),
    backgroundColor: color(value?.backgroundColor),
    primaryColor: color(value?.primaryColor),
    accentColor: color(value?.accentColor),
    typography: value?.typography === 'modern' ? 'modern' : 'display',
    layout: value?.layout === 'editorial' ? 'editorial' : 'centered',
    motion: value?.motion === 'none' ? 'none' : 'gentle',
    decorations: value?.decorations !== false,
  };
}

export function formatPartyDate(value: string, locale: InvitationLocale): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
