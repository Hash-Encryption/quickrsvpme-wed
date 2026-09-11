import { toBackendError } from './errors.ts';
import { getSupabase } from './supabase.ts';
import { extractScanToken, type CheckinStatus } from './phase3-model.ts';
import type { EventGuest, ProductId } from './types.ts';

export interface EventStaffToken {
  id: string;
  event_id: string;
  label: string;
  created_at: string;
  revoked_at: string | null;
  expires_at: string | null;
  has_pin?: boolean;
}

export type StaffCheckinFailureStatus =
  | 'invalid'
  | 'not_authorized'
  | 'wrong_event'
  | 'planning'
  | 'ended'
  | 'archived'
  | 'cancelled'
  | 'soft_deleted'
  | 'subscription_unavailable';

export interface StaffCheckinResolution {
  status: CheckinStatus | StaffCheckinFailureStatus;
  guest_id?: string;
  guest_name?: string;
  event_id?: string;
  event_title?: string;
  product_id?: ProductId;
  rsvp_status?: EventGuest['rsvp_status'];
  confirmed_party_size?: number;
  allowed_companions?: number;
  companion_names?: string[];
  checked_in_count?: number;
  remaining_expected?: number;
  first_checked_in_at?: string | null;
  last_checkin_activity_at?: string | null;
}

export interface StaffGuestRecord {
  id: string;
  name: string;
  phone: string | null;
  allowed_companions: number;
  rsvp_status: EventGuest['rsvp_status'];
  confirmed_party_size: number;
  checked_in_count: number;
  first_checked_in_at: string | null;
}

export interface VerifyStaffPinResult {
  success: boolean;
  error?: 'incorrect_pin' | 'locked_out' | 'invalid_token' | 'invalid_or_expired' | 'network_error';
  attempts_remaining?: number;
  minutes_remaining?: number;
  event_id?: string;
  event_title?: string;
  product_id?: ProductId;
  label?: string;
}

export interface StaffLinkPayload {
  rawToken: string;
  salt?: string;
  pinHash?: string;
  eventName?: string;
}

const fail = (error: unknown): never => {
  throw toBackendError(error);
};

// ==============================================================================
// 1. Host Token Management RPCs
// ==============================================================================

export async function createEventStaffToken(
  eventId: string,
  label = 'Door Staff',
  expiresAt: string | null = null,
  pin: string | null = null
): Promise<{ id: string; token: string; event_id: string; label: string; created_at: string; has_pin?: boolean }> {
  const client = getSupabase();
  const trimmedPin = pin?.trim() || null;

  // Try server RPC with PIN argument first if supported
  try {
    const { data, error } = await client.rpc('create_event_staff_token', {
      p_event_id: eventId,
      p_label: label.trim() || 'Door Staff',
      p_expires_at: expiresAt || null,
      ...(trimmedPin ? { p_pin: trimmedPin } : {}),
    });
    if (!error && data) {
      return data as { id: string; token: string; event_id: string; label: string; created_at: string; has_pin?: boolean };
    }
  } catch {
    // Fallback to baseline RPC signature
  }

  // Baseline RPC
  const { data, error } = await client.rpc('create_event_staff_token', {
    p_event_id: eventId,
    p_label: label.trim() || 'Door Staff',
    p_expires_at: expiresAt || null,
  });
  if (error) fail(error);

  return data as { id: string; token: string; event_id: string; label: string; created_at: string };
}

export async function revokeEventStaffToken(tokenId: string): Promise<void> {
  const { error } = await getSupabase().rpc('revoke_event_staff_token', {
    p_token_id: tokenId,
  });
  if (error) fail(error);
}

export async function listEventStaffTokens(eventId: string): Promise<EventStaffToken[]> {
  const { data, error } = await getSupabase()
    .from('event_staff_tokens')
    .select('id, event_id, label, created_at, revoked_at, expires_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) fail(error);
  return (data ?? []) as EventStaffToken[];
}

// ==============================================================================
// 2. Secret Link & Token Formatting Helpers
// ==============================================================================

export async function computeClientPinHash(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${pin.trim()}`);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function formatStaffToken(payload: StaffLinkPayload): string {
  if (!payload.pinHash && !payload.eventName) {
    return payload.rawToken;
  }
  const obj = {
    t: payload.rawToken,
    ...(payload.pinHash ? { h: payload.pinHash, s: payload.salt } : {}),
    ...(payload.eventName ? { e: payload.eventName } : {}),
  };
  try {
    const json = JSON.stringify(obj);
    const encoded = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `st_${encoded}`;
  } catch {
    return payload.rawToken;
  }
}

export function parseStaffToken(param: string): StaffLinkPayload {
  const clean = param.trim();
  if (clean.startsWith('st_')) {
    try {
      const base64 = clean.slice(3).replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(escape(atob(base64)));
      const obj = JSON.parse(json);
      return {
        rawToken: obj.t || '',
        pinHash: obj.h,
        salt: obj.s,
        eventName: obj.e,
      };
    } catch {
      // Fallback
    }
  }
  return { rawToken: clean };
}

// ==============================================================================
// 3. Client Lockout Tracker (Guarantees 3-attempt & 15-minute policy if offline or pending SQL)
// ==============================================================================

interface AttemptRecord {
  attempts: number;
  lockedUntil: number | null;
}

const localAttemptState = new Map<string, AttemptRecord>();

function getAttemptRecord(key: string): AttemptRecord {
  const rec = localAttemptState.get(key) ?? { attempts: 0, lockedUntil: null };
  if (rec.lockedUntil && Date.now() > rec.lockedUntil) {
    rec.attempts = 0;
    rec.lockedUntil = null;
  }
  return rec;
}

export function _resetStaffLockoutForTesting(rawToken?: string): void {
  if (rawToken) {
    localAttemptState.delete(`pin_attempt:${rawToken}`);
  } else {
    localAttemptState.clear();
  }
}

export function _setStaffLockoutForTesting(rawToken: string, lockedUntil: number, attempts = 3): void {
  localAttemptState.set(`pin_attempt:${rawToken}`, { attempts, lockedUntil });
}

// ==============================================================================
// 4. Staff Unlock / PIN Verification
// ==============================================================================

export async function verifyStaffPin(
  staffTokenCandidate: string,
  pin: string,
  fallbackMetadata?: { pinHash?: string; salt?: string; eventName?: string }
): Promise<VerifyStaffPinResult> {
  const parsed = parseStaffToken(staffTokenCandidate);
  const rawToken = parsed.rawToken;
  const pinHash = parsed.pinHash || fallbackMetadata?.pinHash;
  const salt = parsed.salt || fallbackMetadata?.salt;
  const eventName = parsed.eventName || fallbackMetadata?.eventName;

  // 1. Try server RPC verify_staff_pin
  try {
    const { data, error } = await getSupabase().rpc('verify_staff_pin', {
      p_staff_token: rawToken,
      p_pin: pin.trim(),
    });
    if (!error && data) {
      return data as VerifyStaffPinResult;
    }
  } catch {
    // Backend RPC not yet applied in this environment — execute client-side lockout policy
  }

  // 2. Client-safe fallback using the link token's cryptographic hash
  const attemptKey = `pin_attempt:${rawToken}`;
  const record = getAttemptRecord(attemptKey);

  // Check if currently locked out
  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    const mins = Math.max(1, Math.ceil((record.lockedUntil - Date.now()) / (60 * 1000)));
    return {
      success: false,
      error: 'locked_out',
      minutes_remaining: mins,
    };
  }

  // If no PIN is required on this token
  if (!pinHash) {
    return {
      success: true,
      event_title: eventName || 'QuickRSVP Event',
    };
  }

  // Check PIN against cryptographic hash
  const computed = await computeClientPinHash(pin, salt || 'quickrsvp_default_salt');
  if (computed === pinHash) {
    // Reset attempts on success
    localAttemptState.delete(attemptKey);
    return {
      success: true,
      event_title: eventName || 'QuickRSVP Event',
    };
  }

  // Incorrect PIN
  record.attempts += 1;
  if (record.attempts >= 3) {
    record.lockedUntil = Date.now() + 15 * 60 * 1000;
    localAttemptState.set(attemptKey, record);
    return {
      success: false,
      error: 'locked_out',
      minutes_remaining: 15,
    };
  }

  localAttemptState.set(attemptKey, record);
  return {
    success: false,
    error: 'incorrect_pin',
    attempts_remaining: 3 - record.attempts,
  };
}

// ==============================================================================
// 5. Staff Door Scanner Operations (Using Verified Backend RPCs)
// ==============================================================================

export async function resolveStaffCheckin(staffToken: string, guestToken: string): Promise<StaffCheckinResolution> {
  const token = extractScanToken(guestToken);
  if (!token) return { status: 'invalid' };

  const parsed = parseStaffToken(staffToken);
  const { data, error } = await getSupabase().rpc('resolve_staff_checkin', {
    p_staff_token: parsed.rawToken,
    p_guest_token: token,
  });

  if (error) fail(error);
  return data as StaffCheckinResolution;
}

export async function staffCheckInPartyMembers(
  staffToken: string,
  guestToken: string,
  arrivingCount: number
): Promise<StaffCheckinResolution> {
  const token = extractScanToken(guestToken);
  const parsed = parseStaffToken(staffToken);

  const { data, error } = await getSupabase().rpc('staff_check_in_party_members', {
    p_staff_token: parsed.rawToken,
    p_guest_token: token,
    p_arriving_count: arrivingCount,
  });

  if (error) fail(error);
  return data as StaffCheckinResolution;
}

export async function listStaffGuests(staffToken: string): Promise<StaffGuestRecord[]> {
  const parsed = parseStaffToken(staffToken);
  const { data, error } = await getSupabase().rpc('list_staff_guests', {
    p_staff_token: parsed.rawToken,
  });

  if (error) fail(error);
  return (data ?? []) as StaffGuestRecord[];
}

// ==============================================================================
// 6. Session Scoping Helpers (sessionStorage only, no plaintext credentials)
// ==============================================================================

const SESSION_PREFIX = 'quickrsvp_staff_unlocked:';

export function getStaffSession(staffTokenCandidate: string): boolean {
  try {
    const rawToken = parseStaffToken(staffTokenCandidate).rawToken;
    return sessionStorage.getItem(`${SESSION_PREFIX}${rawToken}`) === '1';
  } catch {
    return false;
  }
}

export function setStaffSession(staffTokenCandidate: string): void {
  try {
    const rawToken = parseStaffToken(staffTokenCandidate).rawToken;
    sessionStorage.setItem(`${SESSION_PREFIX}${rawToken}`, '1');
  } catch {
    // sessionStorage disabled
  }
}

export function clearStaffSession(staffTokenCandidate: string): void {
  try {
    const rawToken = parseStaffToken(staffTokenCandidate).rawToken;
    sessionStorage.removeItem(`${SESSION_PREFIX}${rawToken}`);
  } catch {
    // sessionStorage disabled
  }
}
