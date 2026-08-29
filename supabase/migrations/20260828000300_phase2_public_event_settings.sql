begin;

create or replace function public.resolve_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_digest text := private.token_hash(p_token);
  personal public.personal_invitations;
  general public.general_invitations;
  guest public.event_guests;
  event_row public.events;
  state text;
  config jsonb;
  public_event jsonb;
begin
  select * into personal from public.personal_invitations where token_hash = token_digest and revoked_at is null;
  if personal.id is not null then
    select * into event_row from public.events where id = personal.event_id;
    state := private.event_public_state(event_row.id);
    if state not in ('active', 'archived_read_only') then return jsonb_build_object('status', state); end if;
    select * into guest from public.event_guests where id = personal.guest_id;
    if event_row.product_id = 'wedding' then select private.public_invitation_configuration(c.configuration) || jsonb_build_object('template_snapshot', c.template_snapshot, 'published_artwork', case when a.id is null then null else jsonb_build_object('bucket', a.bucket_id, 'path', a.object_path, 'content_type', a.content_type) end) into config from public.wedding_event_configs c left join public.invitation_assets a on a.id = c.artwork_asset_id and a.purpose = 'published_delivery' and a.status = 'uploaded' where c.event_id = event_row.id;
    else select private.public_invitation_configuration(configuration) || jsonb_build_object('template_snapshot', template_snapshot) into config from public.party_event_configs where event_id = event_row.id;
    end if;
    public_event := jsonb_build_object('product_id', event_row.product_id, 'title', event_row.title, 'invitation_locale', event_row.invitation_locale, 'starts_at', event_row.starts_at, 'ends_at', event_row.ends_at, 'rsvp_deadline', event_row.rsvp_deadline, 'venue_name', event_row.venue_name, 'city', event_row.city, 'request_companion_names', event_row.request_companion_names, 'allow_custom_messages', event_row.allow_custom_messages, 'allow_rsvp_changes', event_row.allow_rsvp_changes, 'general_invite_allowed_companions', event_row.general_invite_allowed_companions);
    return jsonb_build_object('status', state, 'kind', 'personal', 'event', public_event, 'configuration', coalesce(config, '{}'::jsonb), 'guest', jsonb_build_object('name', guest.name, 'allowed_companions', guest.allowed_companions, 'invitation_variant_override', guest.invitation_variant_override, 'rsvp_status', guest.rsvp_status, 'confirmed_party_size', guest.confirmed_party_size, 'companion_names', guest.companion_names, 'custom_message', guest.custom_message));
  end if;

  select * into general from public.general_invitations where token_hash = token_digest and active and revoked_at is null;
  if general.id is null then return jsonb_build_object('status', 'invalid'); end if;
  select * into event_row from public.events where id = general.event_id;
  state := private.event_public_state(event_row.id);
  if state <> 'active' then return jsonb_build_object('status', state); end if;
  if event_row.product_id = 'wedding' then select private.public_invitation_configuration(c.configuration) || jsonb_build_object('template_snapshot', c.template_snapshot, 'published_artwork', case when a.id is null then null else jsonb_build_object('bucket', a.bucket_id, 'path', a.object_path, 'content_type', a.content_type) end) into config from public.wedding_event_configs c left join public.invitation_assets a on a.id = c.artwork_asset_id and a.purpose = 'published_delivery' and a.status = 'uploaded' where c.event_id = event_row.id;
  else select private.public_invitation_configuration(configuration) || jsonb_build_object('template_snapshot', template_snapshot) into config from public.party_event_configs where event_id = event_row.id;
  end if;
  public_event := jsonb_build_object('product_id', event_row.product_id, 'title', event_row.title, 'invitation_locale', event_row.invitation_locale, 'starts_at', event_row.starts_at, 'ends_at', event_row.ends_at, 'rsvp_deadline', event_row.rsvp_deadline, 'venue_name', event_row.venue_name, 'city', event_row.city, 'request_companion_names', event_row.request_companion_names, 'allow_custom_messages', event_row.allow_custom_messages, 'allow_rsvp_changes', event_row.allow_rsvp_changes, 'general_invite_allowed_companions', event_row.general_invite_allowed_companions);
  return jsonb_build_object('status', state, 'kind', 'general', 'event', public_event, 'configuration', coalesce(config, '{}'::jsonb));
end;
$$;

revoke all on function public.resolve_invitation(text) from public, anon, authenticated;
grant execute on function public.resolve_invitation(text) to anon, authenticated;

commit;
