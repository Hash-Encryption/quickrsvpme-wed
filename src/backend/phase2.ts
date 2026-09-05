import { toBackendError } from './errors';
import { getSupabase } from './supabase';
import type { BackendEvent, EventGuest, GeneralInvitationRequest, GeneralInvitationRequestLookup, GeneralInvitationRequestStatus, InvitationResolution, ProductId } from './types';

export type EventConfig<T> = {
  event_id: string;
  configuration: T;
  template_version_id: string | null;
  template_snapshot: Record<string, unknown>;
  artwork_asset_id?: string | null;
  version: number;
};

export type DesignDraft<T> = { id: string; product_id: ProductId; title: string; configuration: T; template_version_id: string | null; template_snapshot: Record<string, unknown>; artwork_asset_id: string | null; version: number; created_at: string; updated_at: string };

export type DesignDraftPublishAccess = Record<string, unknown> & {
  allowed?: boolean;
  can_publish?: boolean;
  reason?: string;
  code?: string;
  event_id?: string | null;
};

const fail = (error: unknown) => { throw toBackendError(error); };

export async function listEventConfigs<T>(product: ProductId): Promise<EventConfig<T>[]> {
  const table = product === 'wedding' ? 'wedding_event_configs' : 'party_event_configs';
  const fields = product === 'wedding' ? 'event_id, configuration, template_version_id, template_snapshot, artwork_asset_id, version' : 'event_id, configuration, template_version_id, template_snapshot, version';
  const { data, error } = await getSupabase().from(table).select(fields);
  if (error) fail(error);
  return (data ?? []) as unknown as EventConfig<T>[];
}

export async function listDesignDrafts<T>(product?: ProductId): Promise<DesignDraft<T>[]> {
  let request = getSupabase().from('design_drafts').select('id, product_id, title, configuration, template_version_id, template_snapshot, artwork_asset_id, version, created_at, updated_at');
  if (product) request = request.eq('product_id', product);
  const { data, error } = await request.order('updated_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as DesignDraft<T>[];
}

export async function createDesignDraft(product: ProductId, title: string, configuration: Record<string, unknown>): Promise<DesignDraft<Record<string, unknown>>> {
  const rendererKey = typeof configuration.templateId === 'string' ? configuration.templateId : '';
  const template = await templateVersion(product, rendererKey);
  const { data, error } = await getSupabase().rpc('create_design_draft', { p_product_id: product, p_title: title, p_configuration: configuration, p_template_version_id: template?.id ?? null, p_template_snapshot: template?.render_snapshot ?? {} });
  if (error) fail(error);
  return data as DesignDraft<Record<string, unknown>>;
}

export async function updateDesignDraft(draft: DesignDraft<Record<string, unknown>>, title: string, configuration: Record<string, unknown>): Promise<DesignDraft<Record<string, unknown>>> {
  if (draft.title === title && JSON.stringify(draft.configuration) === JSON.stringify(configuration)) return draft;
  const templateChanged = configuration.templateId !== draft.configuration.templateId;
  const template = templateChanged && typeof configuration.templateId === 'string' ? await templateVersion(draft.product_id, configuration.templateId) : null;
  const { data, error } = await getSupabase().rpc('save_design_draft', { p_draft_id: draft.id, p_title: title, p_configuration: configuration, p_template_version_id: templateChanged ? template?.id ?? null : draft.template_version_id, p_template_snapshot: templateChanged ? template?.render_snapshot ?? {} : draft.template_snapshot, p_expected_version: draft.version });
  if (error) fail(error);
  return data as DesignDraft<Record<string, unknown>>;
}

export async function getDesignDraftPublishAccess(id: string): Promise<DesignDraftPublishAccess> {
  const { data, error } = await getSupabase().rpc('get_design_draft_publish_access', { p_draft_id: id });
  if (error) fail(error);
  return (Array.isArray(data) ? data[0] : data ?? {}) as DesignDraftPublishAccess;
}

export async function publishDesignDraft(id: string): Promise<BackendEvent> {
  const { data, error } = await getSupabase().rpc('publish_design_draft', { p_draft_id: id });
  if (error) fail(error);
  const value = Array.isArray(data) ? data[0] : data;
  if (typeof value === 'string') return { id: value } as BackendEvent;
  const record = value as Record<string, unknown>;
  if (record?.event && typeof record.event === 'object') return record.event as BackendEvent;
  return { ...record, id: typeof record?.id === 'string' ? record.id : record?.event_id } as BackendEvent;
}

export async function setDesignDraftArtwork(draftId: string, assetId: string): Promise<void> {
  const { error } = await getSupabase().rpc('set_design_draft_artwork', { p_draft_id: draftId, p_artwork_asset_id: assetId });
  if (error) fail(error);
}

export async function uploadDraftArtwork(draftId: string, dataUrl: string, mimeType: string): Promise<string> {
  const blob = await fetch(dataUrl).then((response) => response.blob());
  const { data, error } = await getSupabase().rpc('reserve_invitation_asset', { p_owner_kind: 'draft', p_owner_id: draftId, p_purpose: 'private_source', p_content_type: mimeType, p_byte_size: blob.size, p_source_asset_id: null });
  if (error) fail(error);
  const asset = data as { id: string; bucket_id: string; object_path: string };
  const uploaded = await getSupabase().storage.from(asset.bucket_id).upload(asset.object_path, blob, { contentType: mimeType, upsert: false });
  if (uploaded.error) fail(uploaded.error);
  const status = await getSupabase().from('invitation_assets').update({ status: 'uploaded' }).eq('id', asset.id);
  if (status.error) fail(status.error);
  await setDesignDraftArtwork(draftId, asset.id);
  return asset.id;
}

export async function deleteDesignDraft(id: string): Promise<void> {
  const { error } = await getSupabase().from('design_drafts').delete().eq('id', id);
  if (error) fail(error);
}

async function templateVersion(product: ProductId, rendererKey: string): Promise<{ id: string; render_snapshot: Record<string, unknown> } | null> {
  const { data, error } = await getSupabase().from('platform_templates').select('id, render_snapshot').eq('product_id', product).eq('renderer_key', rendererKey).eq('active', true).order('version', { ascending: false }).limit(1).maybeSingle();
  if (error) fail(error);
  return data as { id: string; render_snapshot: Record<string, unknown> } | null;
}

export async function saveWeddingConfig(eventId: string, configuration: Record<string, unknown>, expectedVersion: number, artworkAssetId: string | null, existingTemplateVersionId?: string | null): Promise<EventConfig<Record<string, unknown>>> {
  const rendererKey = typeof configuration.templateId === 'string' ? configuration.templateId : '';
  const template = existingTemplateVersionId ? null : await templateVersion('wedding', rendererKey);
  const { data, error } = await getSupabase().rpc('save_wedding_event_config', {
    p_event_id: eventId,
    p_configuration: configuration,
    p_template_version_id: existingTemplateVersionId ?? template?.id ?? null,
    p_template_snapshot: template?.render_snapshot ?? {},
    p_artwork_asset_id: artworkAssetId,
    p_expected_version: expectedVersion,
  });
  if (error) fail(error);
  return data as EventConfig<Record<string, unknown>>;
}

export async function savePartyConfig(eventId: string, configuration: Record<string, unknown>, expectedVersion: number, existingTemplateVersionId?: string | null): Promise<EventConfig<Record<string, unknown>>> {
  const rendererKey = typeof configuration.templateId === 'string' ? configuration.templateId : '';
  const template = existingTemplateVersionId ? null : await templateVersion('party', rendererKey);
  const { data, error } = await getSupabase().rpc('save_party_event_config', {
    p_event_id: eventId,
    p_configuration: configuration,
    p_template_version_id: existingTemplateVersionId ?? template?.id ?? null,
    p_template_snapshot: template?.render_snapshot ?? {},
    p_expected_version: expectedVersion,
  });
  if (error) fail(error);
  return data as EventConfig<Record<string, unknown>>;
}

export async function listGuests(eventId: string): Promise<EventGuest[]> {
  const { data, error } = await getSupabase().from('event_guests').select('id, event_id, source, name, phone, allowed_companions, invitation_variant_override, rsvp_status, confirmed_party_size, companion_names, custom_message, responded_at, checked_in_count, first_checked_in_at, last_checkin_activity_at, personal_invitations(id, open_count, first_opened_at, last_opened_at, revoked_at), event_guest_tag_assignments(event_guest_tags(name))').eq('event_id', eventId).order('created_at');
  if (error) fail(error);
  return (data ?? []) as unknown as EventGuest[];
}

export async function createGuest(eventId: string, name: string, phone: string, allowedCompanions: number): Promise<{ guest: EventGuest; token: string }> {
  const { data, error } = await getSupabase().rpc('create_event_guest', { p_event_id: eventId, p_name: name, p_phone: phone || null, p_allowed_companions: allowedCompanions, p_invitation_variant_override: null });
  if (error) fail(error);
  return data as { guest: EventGuest; token: string };
}

export async function tagGuest(eventId: string, guestId: string, name: string): Promise<void> {
  const client = getSupabase();
  let { data: tag, error } = await client.from('event_guest_tags').select('id').eq('event_id', eventId).eq('name', name.trim()).maybeSingle();
  if (error) fail(error);
  if (!tag) {
    const created = await client.from('event_guest_tags').insert({ event_id: eventId, name: name.trim() }).select('id').single();
    if (created.error) fail(created.error);
    tag = created.data;
  }
  if (!tag) throw new Error('Unable to create guest tag');
  const assigned = await client.from('event_guest_tag_assignments').upsert({ event_id: eventId, guest_id: guestId, tag_id: tag.id }, { onConflict: 'guest_id,tag_id' });
  if (assigned.error) fail(assigned.error);
}

export async function updateGuest(guestId: string, patch: Partial<Pick<EventGuest, 'name' | 'phone' | 'allowed_companions'>>): Promise<void> {
  const { error } = await getSupabase().from('event_guests').update(patch).eq('id', guestId);
  if (error) fail(error);
}

export async function rotatePersonalInvitation(guestId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('rotate_personal_invitation', { p_guest_id: guestId });
  if (error) fail(error);
  return data as string;
}

export async function createGeneralInvitation(eventId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('create_general_invitation', { p_event_id: eventId });
  if (error) fail(error);
  return data as string;
}

export async function resolveInvitation(token: string): Promise<InvitationResolution> {
  const { data, error } = await getSupabase().rpc('resolve_invitation', { p_token: token });
  if (error) fail(error);
  const result = data as InvitationResolution;
  const artwork = result.configuration?.published_artwork as { bucket?: string; path?: string; content_type?: string } | null | undefined;
  if (artwork?.bucket && artwork.path && result.configuration) {
    const publicUrl = getSupabase().storage.from(artwork.bucket).getPublicUrl(artwork.path).data.publicUrl;
    const visual = (result.configuration.visual ?? {}) as Record<string, unknown>;
    result.configuration = { ...result.configuration, visual: { ...visual, source: 'uploaded-background', uploadedBackground: { dataUrl: publicUrl, fileName: 'published-artwork', mimeType: artwork.content_type ?? 'image/webp' } } };
  }
  return result;
}

export async function recordInvitationOpen(token: string): Promise<void> {
  const { error } = await getSupabase().rpc('record_invitation_open', { p_token: token });
  if (error) fail(error);
}

export async function submitPersonalRsvp(token: string, status: 'accepted' | 'declined', partySize: number, message = '', companionNames: string[] = []): Promise<void> {
  const { error } = await getSupabase().rpc('submit_personal_rsvp', { p_token: token, p_status: status, p_party_size: partySize, p_companion_names: companionNames, p_message: message || null });
  if (error) fail(error);
}

export async function submitGeneralInvitationRequest(token: string, requestId: string, name: string, phone: string): Promise<GeneralInvitationRequestStatus> {
  const { data, error } = await getSupabase().rpc('submit_general_invitation_request', { p_token: token, p_request_id: requestId, p_name: name, p_phone: phone });
  if (error) fail(error);
  return data as GeneralInvitationRequestStatus;
}

export async function getGeneralInvitationRequestStatus(token: string, requestId: string): Promise<GeneralInvitationRequestLookup> {
  const { data, error } = await getSupabase().rpc('get_general_invitation_request_status', { p_token: token, p_request_id: requestId });
  if (error) fail(error);
  return data as GeneralInvitationRequestLookup;
}

export async function listGeneralInvitationRequests(eventId: string): Promise<GeneralInvitationRequest[]> {
  const { data, error } = await getSupabase().rpc('list_general_invitation_requests', { p_event_id: eventId });
  if (error) fail(error);
  return (data ?? []) as GeneralInvitationRequest[];
}

export async function reviewGeneralInvitationRequest(eventId: string, requestId: string, decision: 'approved' | 'rejected'): Promise<void> {
  const { error } = await getSupabase().rpc('review_general_invitation_request', { p_event_id: eventId, p_request_id: requestId, p_decision: decision });
  if (error) fail(error);
}

export async function publishArtwork(eventId: string, dataUrl: string, mimeType: string): Promise<{ id: string; publicUrl: string }> {
  const blob = await fetch(dataUrl).then((response) => response.blob());
  const reserve = async (purpose: 'private_source' | 'published_delivery', sourceId: string | null) => {
    const { data, error } = await getSupabase().rpc('reserve_invitation_asset', { p_owner_kind: 'event', p_owner_id: eventId, p_purpose: purpose, p_content_type: mimeType, p_byte_size: blob.size, p_source_asset_id: sourceId });
    if (error) fail(error);
    return data as { id: string; bucket_id: string; object_path: string };
  };
  const upload = async (asset: { id: string; bucket_id: string; object_path: string }) => {
    const { error } = await getSupabase().storage.from(asset.bucket_id).upload(asset.object_path, blob, { contentType: mimeType, upsert: false });
    if (error) fail(error);
    const { error: statusError } = await getSupabase().from('invitation_assets').update({ status: 'uploaded' }).eq('id', asset.id);
    if (statusError) fail(statusError);
  };
  const source = await reserve('private_source', null); await upload(source);
  const delivery = await reserve('published_delivery', source.id); await upload(delivery);
  return { id: delivery.id, publicUrl: getSupabase().storage.from(delivery.bucket_id).getPublicUrl(delivery.object_path).data.publicUrl };
}
