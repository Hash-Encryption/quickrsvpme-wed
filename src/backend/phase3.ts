import { toBackendError } from './errors';
import { getSupabase } from './supabase';
import { checkinStatus, extractScanToken, scannerCameraFailure, type CheckinStatus } from './phase3-model';
import type { BackendEvent, ClientAccount, ClientEntitlement, EntitlementStatus, EventGuest, ProductId } from './types';

export { checkinStatus, extractScanToken, scannerCameraFailure, type CheckinStatus };
export type CheckinFailureStatus = 'invalid' | 'not_authorized' | 'wrong_event' | 'planning' | 'ended' | 'archived' | 'cancelled' | 'soft_deleted' | 'subscription_unavailable';
export type CheckinResolution = {
  status: CheckinStatus | CheckinFailureStatus;
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
};

export type EventOperationalSummary = {
  guest_records: number;
  invitation_not_opened: number;
  opened_no_rsvp: number;
  accepted: number;
  declined: number;
  pending: number;
  confirmed_headcount: number;
  checked_in_headcount: number;
  remaining_expected: number;
  custom_messages: number;
};

export type AdminTemplate = { id: string; product_id: ProductId; renderer_key: string; version: number; active: boolean; metadata: Record<string, unknown>; updated_at: string };
export type AdminAsset = { id: string; client_id: string; event_id: string | null; purpose: string; content_type: string; byte_size: number; status: string; created_at: string };
export type AdminActivity = { id: string; event_id: string; client_id: string; guest_id: string; action: string; previous_count: number; new_count: number; created_at: string };
export type AdminSnapshot = {
  clients: ClientAccount[];
  entitlements: ClientEntitlement[];
  events: BackendEvent[];
  guests: EventGuest[];
  templates: AdminTemplate[];
  assets: AdminAsset[];
  activity: AdminActivity[];
};

const fail = (error: unknown): never => { throw toBackendError(error); };

export async function resolveCheckin(value: string, eventId: string): Promise<CheckinResolution> {
  const token = extractScanToken(value);
  if (!token) return { status: 'invalid' };
  const { data, error } = await getSupabase().rpc('resolve_checkin', { p_token: token, p_event_id: eventId });
  if (error) fail(error);
  return data as CheckinResolution;
}

export async function checkInPartyMembers(value: string, eventId: string, arrivingCount: number): Promise<CheckinResolution> {
  const token = extractScanToken(value);
  const { data, error } = await getSupabase().rpc('check_in_party_members', { p_token: token, p_arriving_count: arrivingCount, p_event_id: eventId });
  if (error) fail(error);
  return data as CheckinResolution;
}

export async function setGuestCheckinCount(guestId: string, checkedInCount: number): Promise<CheckinResolution> {
  const { data, error } = await getSupabase().rpc('set_guest_checkin_count', { p_guest_id: guestId, p_checked_in_count: checkedInCount });
  if (error) fail(error);
  return data as CheckinResolution;
}

export async function getEventOperationalSummary(eventId: string): Promise<EventOperationalSummary> {
  const { data, error } = await getSupabase().rpc('event_operational_summary', { p_event_id: eventId });
  if (error) fail(error);
  return data as EventOperationalSummary;
}

export async function loadAdminSnapshot(): Promise<AdminSnapshot> {
  const client = getSupabase();
  const [clients, entitlements, events, guests, templates, assets, activity] = await Promise.all([
    client.from('clients').select('id, display_name, status, created_at, updated_at').order('created_at', { ascending: false }).limit(100),
    client.from('client_entitlements').select('id, client_id, product_id, status, starts_at, ends_at, policy_overrides').order('updated_at', { ascending: false }).limit(200),
    client.from('events').select('id, client_id, product_id, title, lifecycle_status, invitation_locale, starts_at, ends_at, rsvp_deadline, venue_name, city, request_companion_names, allow_custom_messages, allow_rsvp_changes, general_invite_allowed_companions, archived_at, deleted_at, created_at, updated_at').order('created_at', { ascending: false }).limit(200),
    client.from('event_guests').select('id, event_id, name, phone, source, allowed_companions, invitation_variant_override, rsvp_status, confirmed_party_size, companion_names, custom_message, responded_at, checked_in_count, first_checked_in_at, last_checkin_activity_at, personal_invitations(id, open_count, first_opened_at, last_opened_at, revoked_at)').order('created_at', { ascending: false }).limit(1000),
    client.from('platform_templates').select('id, product_id, renderer_key, version, active, metadata, updated_at').order('product_id').order('renderer_key').limit(200),
    client.from('invitation_assets').select('id, client_id, event_id, purpose, content_type, byte_size, status, created_at').order('created_at', { ascending: false }).limit(200),
    client.from('event_checkin_activity').select('id, event_id, client_id, guest_id, action, previous_count, new_count, created_at').order('created_at', { ascending: false }).limit(100),
  ]);
  for (const result of [clients, entitlements, events, guests, templates, assets, activity]) if (result.error) fail(result.error);
  return {
    clients: (clients.data ?? []) as ClientAccount[],
    entitlements: (entitlements.data ?? []) as ClientEntitlement[],
    events: (events.data ?? []) as BackendEvent[],
    guests: (guests.data ?? []) as EventGuest[],
    templates: (templates.data ?? []) as AdminTemplate[],
    assets: (assets.data ?? []) as AdminAsset[],
    activity: (activity.data ?? []) as AdminActivity[],
  };
}

export async function setAdminEntitlement(clientId: string, productId: ProductId, status: EntitlementStatus, endsAt: string | null): Promise<void> {
  const { error } = await getSupabase().rpc('admin_set_entitlement', { p_client_id: clientId, p_product_id: productId, p_status: status, p_ends_at: endsAt });
  if (error) fail(error);
}

export async function setTemplateActive(templateId: string, active: boolean): Promise<void> {
  const { error } = await getSupabase().from('platform_templates').update({ active }).eq('id', templateId);
  if (error) fail(error);
}
