import { normalizeLocale, type InvitationLocale } from './locale.ts';

export function resolvePartyInvitationLocale(state: { invitationLocale?: unknown } | null | undefined): InvitationLocale {
  return normalizeLocale(state?.invitationLocale);
}
