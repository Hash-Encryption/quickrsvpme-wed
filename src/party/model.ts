import type { InvitationLocale } from '../i18n/locale.ts';

export type PartyTemplateId = 'garden-glow' | 'confetti-pop' | 'skyline-toast';

export type PartyEventData = {
  title: string;
  invitationWording: string;
  date: string;
  startTime: string;
  venue: string;
  city: string;
  rsvpDeadline: string;
  templateId: PartyTemplateId;
};

export const partyTemplates: Record<PartyTemplateId, { id: PartyTemplateId; name: string; nameAr: string; description: string; descriptionAr: string }> = {
  'garden-glow': { id: 'garden-glow', name: 'Garden Glow', nameAr: 'وهج الحديقة', description: 'Warm ivory, botanical green, and gold.', descriptionAr: 'عاجي دافئ وأخضر نباتي ولمسة ذهبية.' },
  'confetti-pop': { id: 'confetti-pop', name: 'Confetti Pop', nameAr: 'فرحة ملونة', description: 'Soft blush, plum, and lively coral.', descriptionAr: 'وردي هادئ وبرقوقي ومرجاني مبهج.' },
  'skyline-toast': { id: 'skyline-toast', name: 'Skyline Toast', nameAr: 'نخب المساء', description: 'Cool blue, midnight ink, and copper.', descriptionAr: 'أزرق هادئ وحبر ليلي ولمسة نحاسية.' },
};

export const defaultPartyEvent: PartyEventData = {
  title: 'Maya & Liam Celebration',
  invitationWording: 'Join us for an evening made for celebrating together.',
  date: '2026-10-14',
  startTime: '19:00',
  venue: 'The Grand Palace Hall',
  city: 'Jeddah, Saudi Arabia',
  rsvpDeadline: '2026-09-20',
  templateId: 'garden-glow',
};

export function resolvePartyTemplateId(value: unknown): PartyTemplateId {
  return typeof value === 'string' && Object.hasOwn(partyTemplates, value) ? value as PartyTemplateId : defaultPartyEvent.templateId;
}

export function mergePartyEvent(value: Partial<PartyEventData> | null | undefined): PartyEventData {
  return {
    ...defaultPartyEvent,
    ...value,
    templateId: resolvePartyTemplateId(value?.templateId),
  };
}

export function formatPartyDate(value: string, locale: InvitationLocale): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
