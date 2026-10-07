import { toBackendError } from './errors.ts';
import { getSupabase } from './supabase.ts';
import type { BackendEvent, CreateEventInput } from './types.ts';

const baseEventFields = 'id, client_id, product_id, title, lifecycle_status, invitation_locale, starts_at, ends_at, rsvp_deadline, venue_name, city, request_companion_names, allow_custom_messages, allow_rsvp_changes, general_invite_allowed_companions, archived_at, deleted_at, created_at, updated_at, source_draft_id';
const eventFieldsWithPublication = `${baseEventFields}, invitation_published_at`;

export function isInvitationPublished(event?: { invitation_published_at?: string | null; invitationPublishedAt?: string | null } | null): boolean {
  if (!event) return false;
  return Boolean(event.invitation_published_at || event.invitationPublishedAt);
}

export async function listEvents(signal?: AbortSignal): Promise<BackendEvent[]> {
  try {
    const request = getSupabase().from('events').select(eventFieldsWithPublication).is('deleted_at', null).order('created_at', { ascending: false });
    const { data, error } = await (signal ? request.abortSignal(signal) : request);
    if (!error && data) return data as BackendEvent[];
    if (error && !error.message?.includes('invitation_published_at')) throw error;
  } catch {
    // Fall back to base fields if publication column is not yet migrated in database
  }
  const request = getSupabase().from('events').select(baseEventFields).is('deleted_at', null).order('created_at', { ascending: false });
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error) throw toBackendError(error);
  return (data ?? []) as BackendEvent[];
}

export async function createEvent(input: CreateEventInput): Promise<BackendEvent> {
  const { data, error } = await getSupabase().rpc('create_event', {
    p_product_id: input.productId,
    p_title: input.title,
    p_invitation_locale: input.invitationLocale ?? 'ar',
    p_starts_at: input.startsAt ?? null,
    p_ends_at: input.endsAt ?? null,
    p_rsvp_deadline: input.rsvpDeadline ?? null,
    p_venue_name: input.venueName ?? null,
    p_city: input.city ?? null,
    p_target_client_id: input.targetClientId ?? null,
  });
  if (error) throw toBackendError(error);
  return data as BackendEvent;
}

export async function updateEvent(id: string, patch: Partial<Pick<BackendEvent, 'title' | 'lifecycle_status' | 'invitation_locale' | 'starts_at' | 'ends_at' | 'rsvp_deadline' | 'venue_name' | 'city' | 'request_companion_names' | 'allow_custom_messages' | 'allow_rsvp_changes' | 'general_invite_allowed_companions' | 'deleted_at' | 'invitation_published_at'>>): Promise<BackendEvent> {
  try {
    const { data, error } = await getSupabase().from('events').update(patch).eq('id', id).select(eventFieldsWithPublication).single();
    if (!error && data) return data as BackendEvent;
    if (error && !error.message?.includes('invitation_published_at')) throw error;
  } catch {
    // Fall back if publication column not present
  }
  const { invitation_published_at: _, ...legacyPatch } = patch;
  const { data, error } = await getSupabase().from('events').update(legacyPatch).eq('id', id).select(baseEventFields).single();
  if (error) throw toBackendError(error);
  return data as BackendEvent;
}

export async function publishEventInvitation(eventId: string): Promise<BackendEvent> {
  const { data, error } = await getSupabase().rpc('publish_event_invitation', { p_event_id: eventId });
  if (!error && data) return data as BackendEvent;
  return updateEvent(eventId, { invitation_published_at: new Date().toISOString() });
}

export async function unpublishEventInvitation(eventId: string): Promise<BackendEvent> {
  const { data, error } = await getSupabase().rpc('unpublish_event_invitation', { p_event_id: eventId });
  if (!error && data) return data as BackendEvent;
  return updateEvent(eventId, { invitation_published_at: null });
}
