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
  error?: 'incorrect_pin' | 'locked_out' | 'invalid_token' | 'invalid_or_expired' | 'backend_pending' | 'network_error';
  attempts_remaining?: number;
  minutes_remaining?: number;
  event_id?: string;
  event_title?: string;
  product_id?: ProductId;
  label?: string;
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
    // Fallback to baseline RPC signature if extended signature fails
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
// 2. Staff Unlock / Server-Verified PIN Authentication
// ==============================================================================

export async function verifyStaffPin(
  staffToken: string,
  pin: string
): Promise<VerifyStaffPinResult> {
  const cleanToken = staffToken.trim();
  const cleanPin = pin.trim();

  if (!cleanToken) {
    return { success: false, error: 'invalid_token' };
  }

  try {
    const { data, error } = await getSupabase().rpc('verify_staff_pin', {
      p_staff_token: cleanToken,
      p_pin: cleanPin,
    });

    if (error) {
      // If verify_staff_pin RPC is not yet present on backend
      return {
        success: false,
        error: 'backend_pending',
      };
    }

    return (data ?? { success: false, error: 'invalid_or_expired' }) as VerifyStaffPinResult;
  } catch {
    return {
      success: false,
      error: 'backend_pending',
    };
  }
}

// ==============================================================================
// 3. Staff Door Scanner Operations (Requires BOTH Token + PIN)
// ==============================================================================

export async function resolveStaffCheckin(
  staffToken: string,
  pin: string,
  guestToken: string
): Promise<StaffCheckinResolution> {
  const token = extractScanToken(guestToken);
  if (!token) return { status: 'invalid' };

  try {
    const { data, error } = await getSupabase().rpc('resolve_staff_checkin', {
      p_staff_token: staffToken.trim(),
      p_pin: pin.trim(),
      p_guest_token: token,
    });

    if (error) {
      if (error.code === '42501' || error.message?.includes('42501') || error.message?.includes('not_authorized')) {
        return { status: 'not_authorized' };
      }
      fail(error);
    }

    return data as StaffCheckinResolution;
  } catch (caught) {
    const err = toBackendError(caught);
    if (err.code === 'unauthorized') {
      return { status: 'not_authorized' };
    }
    throw err;
  }
}

export async function staffCheckInPartyMembers(
  staffToken: string,
  pin: string,
  guestToken: string,
  arrivingCount: number
): Promise<StaffCheckinResolution> {
  const token = extractScanToken(guestToken);
  const { data, error } = await getSupabase().rpc('staff_check_in_party_members', {
    p_staff_token: staffToken.trim(),
    p_pin: pin.trim(),
    p_guest_token: token,
    p_arriving_count: arrivingCount,
  });

  if (error) fail(error);
  return data as StaffCheckinResolution;
}

export async function listStaffGuests(
  staffToken: string,
  pin: string
): Promise<StaffGuestRecord[]> {
  const { data, error } = await getSupabase().rpc('list_staff_guests', {
    p_staff_token: staffToken.trim(),
    p_pin: pin.trim(),
  });

  if (error) fail(error);
  return (data ?? []) as StaffGuestRecord[];
}
