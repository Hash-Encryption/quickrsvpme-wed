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
export type AdminDraft = { id: string; client_id: string; product_id: ProductId; title: string; version: number; updated_at: string };
export type AdminPolicy = { product_id: ProductId; configuration: Record<string, unknown>; updated_at: string };
export type AdminEntitlementActivity = { id: string; client_id: string; product_id: ProductId; previous_status: EntitlementStatus | null; new_status: EntitlementStatus; previous_starts_at: string | null; new_starts_at: string; previous_ends_at: string | null; new_ends_at: string | null; previous_policy_overrides: Record<string, unknown> | null; new_policy_overrides: Record<string, unknown>; created_at: string };
export type AdminAsset = { id: string; client_id: string; event_id: string | null; draft_id: string | null; purpose: string; bucket_id: string; object_path: string; content_type: string; byte_size: number; status: string; created_at: string };
export type AdminActivity = { id: string; event_id: string; client_id: string; guest_id: string; action: string; previous_count: number; new_count: number; created_at: string };
export type AdminSnapshot = {
  clients: ClientAccount[];
  entitlements: ClientEntitlement[];
  events: BackendEvent[];
  drafts: AdminDraft[];
  guests: EventGuest[];
  templates: AdminTemplate[];
  policies: AdminPolicy[];
  assets: AdminAsset[];
  activity: AdminActivity[];
  entitlementActivity: AdminEntitlementActivity[];
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

export async function loadAdminSection(section: string): Promise<AdminSnapshot> {
  const client = getSupabase();
  const snapshot: AdminSnapshot = { clients: [], entitlements: [], events: [], drafts: [], guests: [], templates: [], policies: [], assets: [], activity: [], entitlementActivity: [] };
  const read = async <T,>(request: PromiseLike<unknown>): Promise<T[]> => {
    const result = await request as { data: unknown[] | null; error: unknown };
    if (result.error) fail(result.error);
    return (result.data ?? []) as T[];
  };
  const tasks: Promise<unknown>[] = [];
  if (['customers', 'subscriptions', 'usage'].includes(section)) tasks.push(read<ClientAccount>(client.from('clients').select('id, display_name, status, created_at, updated_at').order('created_at', { ascending: false }).limit(100)).then((rows) => { snapshot.clients = rows; }));
  if (['customers', 'subscriptions'].includes(section)) tasks.push(read<ClientEntitlement>(client.from('client_entitlements').select('id, client_id, product_id, status, starts_at, ends_at, policy_overrides').order('updated_at', { ascending: false }).limit(200)).then((rows) => { snapshot.entitlements = rows; }));
  if (['customers', 'events', 'usage'].includes(section)) tasks.push(read<BackendEvent>(client.from('events').select('id, client_id, product_id, title, lifecycle_status, invitation_locale, starts_at, ends_at, rsvp_deadline, venue_name, city, request_companion_names, allow_custom_messages, allow_rsvp_changes, general_invite_allowed_companions, archived_at, deleted_at, created_at, updated_at').order('created_at', { ascending: false }).limit(200)).then((rows) => { snapshot.events = rows; }));
  if (['events', 'usage'].includes(section)) tasks.push(read<EventGuest>(client.from('event_guests').select('id, event_id, name, phone, source, allowed_companions, invitation_variant_override, rsvp_status, confirmed_party_size, companion_names, custom_message, responded_at, checked_in_count, first_checked_in_at, last_checkin_activity_at, personal_invitations(id, open_count, first_opened_at, last_opened_at, revoked_at)').order('created_at', { ascending: false }).limit(1000)).then((rows) => { snapshot.guests = rows; }));
  if (section === 'drafts') tasks.push(read<AdminDraft>(client.from('design_drafts').select('id, client_id, product_id, title, version, updated_at').order('updated_at', { ascending: false }).limit(200)).then((rows) => { snapshot.drafts = rows; }));
  if (section === 'templates') tasks.push(read<AdminTemplate>(client.from('platform_templates').select('id, product_id, renderer_key, version, active, metadata, updated_at').order('product_id').order('renderer_key').limit(200)).then((rows) => { snapshot.templates = rows; }));
  if (section === 'policies') tasks.push(read<AdminPolicy>(client.from('product_policies').select('product_id, configuration, updated_at').order('product_id')).then((rows) => { snapshot.policies = rows; }));
  if (['assets', 'support'].includes(section)) tasks.push(read<AdminAsset>(client.from('invitation_assets').select('id, client_id, event_id, draft_id, purpose, bucket_id, object_path, content_type, byte_size, status, created_at').order('created_at', { ascending: false }).limit(200)).then((rows) => { snapshot.assets = rows; }));
  if (section === 'support') tasks.push(read<AdminActivity>(client.from('event_checkin_activity').select('id, event_id, client_id, guest_id, action, previous_count, new_count, created_at').order('created_at', { ascending: false }).limit(100)).then((rows) => { snapshot.activity = rows; }));
  if (section === 'subscriptions') tasks.push(read<AdminEntitlementActivity>(client.from('entitlement_admin_activity').select('id, client_id, product_id, previous_status, new_status, previous_starts_at, new_starts_at, previous_ends_at, new_ends_at, previous_policy_overrides, new_policy_overrides, created_at').order('created_at', { ascending: false }).limit(200)).then((rows) => { snapshot.entitlementActivity = rows; }));
  await Promise.all(tasks);
  return snapshot;
}

export async function setAdminEntitlement(clientId: string, productId: ProductId, status: EntitlementStatus, startsAt: string | null, endsAt: string | null, policyOverrides: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabase().rpc('admin_set_entitlement', { p_client_id: clientId, p_product_id: productId, p_status: status, p_starts_at: startsAt, p_ends_at: endsAt, p_policy_overrides: policyOverrides });
  if (error) fail(error);
}

export async function setProductPolicy(productId: ProductId, configuration: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabase().from('product_policies').update({ configuration }).eq('product_id', productId);
  if (error) fail(error);
}

export async function retireAsset(assetId: string): Promise<void> {
  const { error } = await getSupabase().from('invitation_assets').update({ status: 'retired' }).eq('id', assetId);
  if (error) fail(error);
}

export async function setTemplateActive(templateId: string, active: boolean): Promise<void> {
  const { error } = await getSupabase().from('platform_templates').update({ active }).eq('id', templateId);
  if (error) fail(error);
}
