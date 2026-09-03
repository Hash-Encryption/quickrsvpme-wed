import { toBackendError } from './errors';
import { getSupabase } from './supabase';
import type { BackendEvent, CreateEventInput } from './types';

const eventFields = 'id, client_id, product_id, title, lifecycle_status, invitation_locale, starts_at, ends_at, rsvp_deadline, venue_name, city, request_companion_names, allow_custom_messages, allow_rsvp_changes, general_invite_allowed_companions, archived_at, deleted_at, created_at, updated_at, source_draft_id';

export async function listEvents(signal?: AbortSignal): Promise<BackendEvent[]> {
  const request = getSupabase().from('events').select(eventFields).is('deleted_at', null).order('created_at', { ascending: false });
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

export async function updateEvent(id: string, patch: Partial<Pick<BackendEvent, 'title' | 'lifecycle_status' | 'invitation_locale' | 'starts_at' | 'ends_at' | 'rsvp_deadline' | 'venue_name' | 'city' | 'request_companion_names' | 'allow_custom_messages' | 'allow_rsvp_changes' | 'general_invite_allowed_companions' | 'deleted_at'>>): Promise<BackendEvent> {
  const { data, error } = await getSupabase().from('events').update(patch).eq('id', id).select(eventFields).single();
  if (error) throw toBackendError(error);
  return data as BackendEvent;
}
