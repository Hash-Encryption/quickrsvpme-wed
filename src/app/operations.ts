import type { ProjectType } from './projects.ts';
import type { EventMode, WeddingGuestData } from '../wedding/model.ts';

export type OperationalRsvp = 'pending' | 'accepted' | 'declined';

export type OperationalGuest = WeddingGuestData & {
  id: string;
  rsvp: OperationalRsvp;
  guestCount: number;
  message: string;
  checkedIn: boolean;
};

export type OperationalState = {
  version: 1;
  guestsByProject: Record<string, OperationalGuest[]>;
};

export type ScannerState =
  | { status: 'ready' }
  | { status: 'valid'; guestId: string }
  | { status: 'already-checked-in'; guestId: string }
  | { status: 'invalid'; token: string };

export type OperationalStats = {
  guests: number;
  invitedSeats: number;
  accepted: number;
  declined: number;
  pending: number;
  checkedIn: number;
};

type LegacyOperationalState = {
  mode?: EventMode;
  rsvp?: OperationalRsvp;
  checkedIn?: boolean;
  weddingGuest?: Partial<WeddingGuestData>;
  weddingResponse?: { guestCount?: number; message?: string };
};

export const emptyOperationalState = (): OperationalState => ({ version: 1, guestsByProject: {} });

export const projectKey = (type: ProjectType, id: string): string => `${type}:${id}`;

function normalizeGuest(value: unknown): OperationalGuest | null {
  if (!value || typeof value !== 'object') return null;
  const guest = value as Partial<OperationalGuest>;
  if (typeof guest.token !== 'string' || !guest.token.trim() || typeof guest.name !== 'string') return null;
  const allowedCompanions = Math.max(0, Number.isFinite(guest.allowedCompanions) ? Math.round(guest.allowedCompanions!) : 0);
  const rsvp = guest.rsvp === 'accepted' || guest.rsvp === 'declined' ? guest.rsvp : 'pending';
  const guestCount = rsvp === 'accepted'
    ? Math.max(1, Math.min(1 + allowedCompanions, Number.isFinite(guest.guestCount) ? Math.round(guest.guestCount!) : 1))
    : 0;
  return {
    id: typeof guest.id === 'string' && guest.id ? guest.id : guest.token,
    name: guest.name,
    phone: typeof guest.phone === 'string' ? guest.phone : '',
    token: guest.token.trim(),
    allowedCompanions,
    invitationVariantOverride: guest.invitationVariantOverride,
    qrCode: typeof guest.qrCode === 'string' ? guest.qrCode : undefined,
    passId: typeof guest.passId === 'string' ? guest.passId : undefined,
    rsvp,
    guestCount,
    message: typeof guest.message === 'string' ? guest.message : '',
    checkedIn: guest.checkedIn === true,
  };
}

export function normalizeOperationalState(
  value: unknown,
  legacy: LegacyOperationalState,
  activeWeddingId: string,
  partyId: string,
): OperationalState {
  if (value && typeof value === 'object' && (value as Partial<OperationalState>).version === 1) {
    const source = (value as Partial<OperationalState>).guestsByProject;
    if (source && typeof source === 'object') {
      return {
        version: 1,
        guestsByProject: Object.fromEntries(Object.entries(source).map(([key, guests]) => [
          key,
          Array.isArray(guests) ? guests.flatMap((guest) => normalizeGuest(guest) ?? []) : [],
        ])),
      };
    }
  }

  const fallbackGuest = normalizeGuest({
    ...legacy.weddingGuest,
    id: legacy.weddingGuest?.token,
    rsvp: legacy.rsvp,
    guestCount: legacy.weddingResponse?.guestCount,
    message: legacy.weddingResponse?.message,
    checkedIn: legacy.checkedIn,
  });
  if (!fallbackGuest) return emptyOperationalState();
  const key = legacy.mode === 'wedding' ? projectKey('wedding', activeWeddingId) : projectKey('party', partyId);
  return { version: 1, guestsByProject: { [key]: [fallbackGuest] } };
}

export const guestsForProject = (state: OperationalState, key: string): OperationalGuest[] => state.guestsByProject[key] ?? [];

export function updateOperationalGuest(
  state: OperationalState,
  key: string,
  guestId: string,
  patch: Partial<OperationalGuest>,
): OperationalState {
  const guests = guestsForProject(state, key);
  if (!guests.some((guest) => guest.id === guestId)) return state;
  return {
    ...state,
    guestsByProject: {
      ...state.guestsByProject,
      [key]: guests.map((guest) => guest.id === guestId ? normalizeGuest({ ...guest, ...patch }) ?? guest : guest),
    },
  };
}

export function updateOperationalGuestByToken(
  state: OperationalState,
  key: string,
  token: string,
  patch: Partial<OperationalGuest>,
): OperationalState {
  const guest = findProjectGuestByToken(state, key, token);
  return guest ? updateOperationalGuest(state, key, guest.id, patch) : state;
}

export function findProjectGuestByToken(state: OperationalState, key: string, token: string): OperationalGuest | undefined {
  const clean = token.trim().toLowerCase();
  return clean ? guestsForProject(state, key).find((guest) => guest.token.trim().toLowerCase() === clean) : undefined;
}

export function scanProjectGuest(state: OperationalState, key: string, token: string): ScannerState {
  const guest = findProjectGuestByToken(state, key, token);
  if (!guest) return { status: 'invalid', token };
  return guest.checkedIn ? { status: 'already-checked-in', guestId: guest.id } : { status: 'valid', guestId: guest.id };
}

export function checkInOperationalGuest(state: OperationalState, key: string, guestId: string): OperationalState {
  return updateOperationalGuest(state, key, guestId, { checkedIn: true });
}

export function operationalStats(guests: OperationalGuest[]): OperationalStats {
  return guests.reduce<OperationalStats>((stats, guest) => ({
    guests: stats.guests + 1,
    invitedSeats: stats.invitedSeats + 1 + guest.allowedCompanions,
    accepted: stats.accepted + Number(guest.rsvp === 'accepted'),
    declined: stats.declined + Number(guest.rsvp === 'declined'),
    pending: stats.pending + Number(guest.rsvp === 'pending'),
    checkedIn: stats.checkedIn + Number(guest.checkedIn),
  }), { guests: 0, invitedSeats: 0, accepted: 0, declined: 0, pending: 0, checkedIn: 0 });
}

const csvCell = (value: string | number | boolean): string => `"${String(value).replaceAll('"', '""')}"`;

export function guestsCsv(guests: OperationalGuest[]): string {
  return [
    ['Guest', 'Phone', 'Companions', 'Attending party', 'RSVP', 'Token', 'Checked in'],
    ...guests.map((guest) => [guest.name, guest.phone, guest.allowedCompanions, guest.guestCount, guest.rsvp, guest.token, guest.checkedIn]),
  ].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function invitationUrl(origin: string, baseUrl: string, token: string): string {
  return `${origin}${baseUrl.replace(/\/$/, '')}/i/${encodeURIComponent(token)}`;
}
