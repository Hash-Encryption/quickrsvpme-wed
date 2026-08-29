-- Run manually after both backend migrations, two non-admin Client identities,
-- and one platform_admin assignment exist. Every mutation rolls back.
begin;

create temporary table phase2_test_identities as
select
  (select i.user_id from public.client_identities i where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id) order by i.created_at limit 1) as client_a_user_id,
  (select i.client_id from public.client_identities i where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id) order by i.created_at limit 1) as client_a_id,
  (select i.user_id from public.client_identities i where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id) order by i.created_at offset 1 limit 1) as client_b_user_id,
  (select i.client_id from public.client_identities i where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id) order by i.created_at offset 1 limit 1) as client_b_id,
  (select user_id from public.platform_admins order by created_at limit 1) as admin_user_id;

do $$
begin
  if exists (select 1 from phase2_test_identities where client_a_user_id is null or client_a_id is null or client_b_user_id is null or client_b_id is null or admin_user_id is null) then
    raise exception 'Prerequisite: create two non-admin Client identities and assign one platform_admin.';
  end if;
end;
$$;

insert into public.client_entitlements(client_id, product_id, status)
select client_id, product_id, 'active'
from (select client_a_id as client_id from phase2_test_identities union all select client_b_id from phase2_test_identities) clients
cross join (values ('wedding'), ('party')) products(product_id)
on conflict (client_id, product_id) do update set status = 'active', starts_at = now(), ends_at = null;

update public.product_policies set configuration = configuration || '{"design_draft_limit":2,"archive_replay_enabled":true,"archive_replay_days":30}'::jsonb where product_id = 'wedding';

create temporary table phase2_test_data (
  wedding_event_id uuid,
  party_event_id uuid,
  guest_id uuid,
  personal_token text,
  general_token text,
  private_asset_id uuid,
  private_asset_path text,
  published_asset_id uuid,
  published_asset_path text
);
insert into phase2_test_data default values;
grant all on phase2_test_identities, phase2_test_data to authenticated, anon;

select set_config('request.jwt.claim.sub', (select client_a_user_id::text from phase2_test_identities), true);
set local role authenticated;

do $$
declare
  wedding_event public.events;
  party_event public.events;
  wedding_template public.platform_templates;
  party_template public.platform_templates;
  guest_result jsonb;
  source_asset public.invitation_assets;
  delivery_asset public.invitation_assets;
  first_save public.wedding_event_configs;
  draft public.design_drafts;
begin
  wedding_event := public.create_event('wedding', 'Phase 2 Wedding', 'ar', now(), now() + interval '1 day', now() + interval '12 hours');
  party_event := public.create_event('party', 'Phase 2 Party', 'en', now(), now() + interval '1 day', now() + interval '12 hours');
  update public.events set lifecycle_status = 'active', request_companion_names = true, general_invite_allowed_companions = 2 where id in (wedding_event.id, party_event.id);

  select * into wedding_template from public.platform_templates where product_id = 'wedding' and renderer_key = 'soft-floral-garden' and version = 1;
  select * into party_template from public.platform_templates where product_id = 'party' and renderer_key = 'garden-glow' and version = 1;
  first_save := public.save_wedding_event_config(wedding_event.id, '{"brideName":"ريم","presentation":{"layoutPresetId":"centered-elegance"},"visual":{"uploadedBackground":{"dataUrl":"data:image/webp;base64,PRIVATE"}}}', wedding_template.id, wedding_template.render_snapshot, null, 0);
  perform public.save_party_event_config(party_event.id, '{"title":"Party","templateId":"garden-glow"}', party_template.id, party_template.render_snapshot, 0);
  if first_save.version <> 1 then raise exception 'FAIL: first Wedding save version is not 1.'; end if;
  begin
    perform public.save_wedding_event_config(wedding_event.id, '{}', wedding_template.id, wedding_template.render_snapshot, null, 0);
    raise exception 'FAIL: stale Wedding autosave was accepted.';
  exception when serialization_failure then null;
  end;

  draft := public.create_design_draft('wedding', 'Draft only', '{"templateId":"soft-floral-garden"}', wedding_template.id, wedding_template.render_snapshot);
  draft := public.save_design_draft(draft.id, 'Updated Draft', '{"templateId":"soft-floral-garden"}', wedding_template.id, wedding_template.render_snapshot, 1);
  if draft.version <> 2 then raise exception 'FAIL: Draft optimistic version did not advance.'; end if;
  begin
    perform public.save_design_draft(draft.id, 'Stale Draft', '{}', wedding_template.id, wedding_template.render_snapshot, 1);
    raise exception 'FAIL: stale Draft save was accepted.';
  exception when serialization_failure then null;
  end;

  source_asset := public.reserve_invitation_asset('event', wedding_event.id, 'private_source', 'image/webp', 1024, null);
  delivery_asset := public.reserve_invitation_asset('event', wedding_event.id, 'published_delivery', 'image/webp', 1024, source_asset.id);
  update public.invitation_assets set status = 'uploaded' where id in (source_asset.id, delivery_asset.id);
  perform public.save_wedding_event_config(wedding_event.id, '{"brideName":"ريم","visual":{"uploadedBackground":{"dataUrl":"data:image/webp;base64,PRIVATE"}}}', wedding_template.id, wedding_template.render_snapshot, delivery_asset.id, 1);

  guest_result := public.create_event_guest(wedding_event.id, 'Ahmed', '+966500000000', 2, null);
  update phase2_test_data set
    wedding_event_id = wedding_event.id,
    party_event_id = party_event.id,
    guest_id = (guest_result -> 'guest' ->> 'id')::uuid,
    personal_token = guest_result ->> 'token',
    general_token = public.create_general_invitation(wedding_event.id),
    private_asset_id = source_asset.id,
    private_asset_path = source_asset.object_path,
    published_asset_id = delivery_asset.id,
    published_asset_path = delivery_asset.object_path;

  if length(guest_result ->> 'token') <> 64 then raise exception 'FAIL: personal token is not high entropy.'; end if;
  if exists (select 1 from public.personal_invitations where token_hash = guest_result ->> 'token') then raise exception 'FAIL: raw personal token was stored.'; end if;

  insert into public.event_guest_tags(event_id, name) values (wedding_event.id, 'Family');
  insert into public.event_guest_tag_assignments(event_id, guest_id, tag_id)
  select wedding_event.id, (guest_result -> 'guest' ->> 'id')::uuid, id from public.event_guest_tags where event_id = wedding_event.id and name = 'Family';

  begin
    perform public.reserve_invitation_asset('event', wedding_event.id, 'private_source', 'image/gif', 100, null);
    raise exception 'FAIL: unsupported asset type was accepted.';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.reserve_invitation_asset('event', wedding_event.id, 'private_source', 'image/webp', 12582913, null);
    raise exception 'FAIL: oversized asset was accepted.';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select client_b_user_id::text from phase2_test_identities), true);
set local role authenticated;

do $$
begin
  if exists (select 1 from public.wedding_event_configs where event_id = (select wedding_event_id from phase2_test_data)) then raise exception 'FAIL: Client B read Client A Wedding config.'; end if;
  if exists (select 1 from public.party_event_configs where event_id = (select party_event_id from phase2_test_data)) then raise exception 'FAIL: Client B read Client A Party config.'; end if;
  if exists (select 1 from public.event_guests where event_id = (select wedding_event_id from phase2_test_data)) then raise exception 'FAIL: Client B read Client A guests.'; end if;
  if exists (select 1 from public.design_drafts where client_id = (select client_a_id from phase2_test_identities)) then raise exception 'FAIL: Client B read Client A drafts.'; end if;
  if exists (select 1 from public.invitation_assets where id = (select private_asset_id from phase2_test_data)) then raise exception 'FAIL: Client B read Client A private asset metadata.'; end if;
  if exists (select 1 from public.personal_invitations where event_id = (select wedding_event_id from phase2_test_data)) then raise exception 'FAIL: Client B read Client A invitations.'; end if;

  update public.event_guests set name = 'stolen' where id = (select guest_id from phase2_test_data);
  if found then raise exception 'FAIL: Client B modified Client A guest.'; end if;
  begin
    update public.personal_invitations set revoked_at = now() where guest_id = (select guest_id from phase2_test_data);
    raise exception 'FAIL: Client B had direct invitation update permission.';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_event_guest((select wedding_event_id from phase2_test_data), 'Spoofed');
    raise exception 'FAIL: Client B added a guest to Client A Event.';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reserve_invitation_asset('event', (select wedding_event_id from phase2_test_data), 'private_source', 'image/webp', 10, null);
    raise exception 'FAIL: Client B reserved an asset for Client A Event.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $$
declare
  resolved jsonb;
  response jsonb;
  general_guest_id uuid;
  request_id uuid := gen_random_uuid();
begin
  begin perform 1 from public.event_guests; raise exception 'FAIL: anon read Event Guests.'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.personal_invitations; raise exception 'FAIL: anon read token records.'; exception when insufficient_privilege then null; end;

  resolved := public.resolve_invitation((select personal_token from phase2_test_data));
  if resolved ->> 'status' <> 'active' or resolved ->> 'kind' <> 'personal' then raise exception 'FAIL: valid personal invitation did not resolve.'; end if;
  if resolved::text ~ 'client_id|token_hash|phone' then raise exception 'FAIL: public personal DTO leaked private fields.'; end if;
  if resolved::text like '%PRIVATE%' then raise exception 'FAIL: public DTO exposed private source upload data.'; end if;
  if public.resolve_invitation('malformed') ->> 'status' <> 'invalid' then raise exception 'FAIL: invalid token resolved.'; end if;
  if public.resolve_invitation((select wedding_event_id::text from phase2_test_data)) ->> 'status' <> 'invalid' then raise exception 'FAIL: predictable Event ID resolved as a token.'; end if;
  if public.resolve_invitation((select general_token from phase2_test_data)) ->> 'kind' <> 'general' then raise exception 'FAIL: general token impersonated a personal invitation.'; end if;
  begin
    perform public.submit_personal_rsvp((select general_token from phase2_test_data), 'accepted', 1, '{}', null);
    raise exception 'FAIL: general token was accepted by personal RSVP.';
  exception when insufficient_privilege then null;
  end;

  if public.record_invitation_open((select personal_token from phase2_test_data)) <> 'active' then raise exception 'FAIL: meaningful open was not recorded.'; end if;
  response := public.submit_personal_rsvp((select personal_token from phase2_test_data), 'accepted', 3, array['Sara','Mona'], 'See you there');
  if response ->> 'status' <> 'accepted' then raise exception 'FAIL: accepted personal RSVP was not stored.'; end if;
  begin
    perform public.submit_personal_rsvp((select personal_token from phase2_test_data), 'accepted', 4, array['A','B','C'], null);
    raise exception 'FAIL: over-limit personal RSVP was accepted.';
  exception when invalid_parameter_value then null;
  end;
  response := public.submit_personal_rsvp((select personal_token from phase2_test_data), 'declined', 0, '{}', null);
  if response ->> 'status' <> 'declined' then raise exception 'FAIL: personal response change was not stored.'; end if;

  begin
    perform public.submit_general_rsvp((select general_token from phase2_test_data), request_id, '', 'accepted', 1, '{}', null);
    raise exception 'FAIL: general RSVP accepted an empty name.';
  exception when invalid_parameter_value then null;
  end;
  response := public.submit_general_rsvp((select general_token from phase2_test_data), request_id, 'General Guest', 'accepted', 2, array['Companion'], 'Hello');
  general_guest_id := (response ->> 'guest_id')::uuid;
  if general_guest_id is null then raise exception 'FAIL: general RSVP did not create an EventGuest.'; end if;
  if (public.submit_general_rsvp((select general_token from phase2_test_data), request_id, 'General Guest', 'accepted', 2, array['Companion'], 'Hello') ->> 'guest_id')::uuid <> general_guest_id then raise exception 'FAIL: general RSVP request was not idempotent.'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select client_a_user_id::text from phase2_test_identities), true);
set local role authenticated;

do $$
begin
  if (select open_count from public.personal_invitations where guest_id = (select guest_id from phase2_test_data)) <> 1 then raise exception 'FAIL: personal meaningful open count is wrong.'; end if;
  if not exists (select 1 from public.event_guests where event_id = (select wedding_event_id from phase2_test_data) and source = 'general_invite' and name = 'General Guest') then raise exception 'FAIL: general guest is not in the real Event guest list.'; end if;
end;
$$;

-- Backend cutoffs and Event settings must reject direct public RPC calls.
update public.events set rsvp_deadline = now() - interval '1 minute' where id = (select wedding_event_id from phase2_test_data);
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  begin perform public.submit_personal_rsvp((select personal_token from phase2_test_data), 'accepted', 1, '{}', null); raise exception 'FAIL: expired RSVP was accepted.'; exception when insufficient_privilege then null; end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select client_a_user_id::text from phase2_test_identities), true);
set local role authenticated;
update public.events set rsvp_deadline = now() + interval '1 day', request_companion_names = false where id = (select wedding_event_id from phase2_test_data);
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  begin perform public.submit_personal_rsvp((select personal_token from phase2_test_data), 'accepted', 2, array['Companion'], null); raise exception 'FAIL: companion names were accepted while disabled.'; exception when invalid_parameter_value then null; end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select client_a_user_id::text from phase2_test_identities), true);
set local role authenticated;
update public.events set request_companion_names = true, allow_custom_messages = false where id = (select wedding_event_id from phase2_test_data);
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  begin perform public.submit_personal_rsvp((select personal_token from phase2_test_data), 'accepted', 1, '{}', 'blocked'); raise exception 'FAIL: custom message was accepted while disabled.'; exception when invalid_parameter_value then null; end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select client_a_user_id::text from phase2_test_identities), true);
set local role authenticated;
update public.events set allow_custom_messages = true, allow_rsvp_changes = false where id = (select wedding_event_id from phase2_test_data);
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  begin perform public.submit_personal_rsvp((select personal_token from phase2_test_data), 'accepted', 1, '{}', null); raise exception 'FAIL: RSVP change was accepted while disabled.'; exception when insufficient_privilege then null; end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select client_a_user_id::text from phase2_test_identities), true);
set local role authenticated;
update public.events set allow_rsvp_changes = true, lifecycle_status = 'planning' where id = (select wedding_event_id from phase2_test_data);
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  if public.resolve_invitation((select personal_token from phase2_test_data)) <> '{"status":"planning"}'::jsonb then raise exception 'FAIL: planning Event exposed invitation data.'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select client_a_user_id::text from phase2_test_identities), true);
set local role authenticated;
update public.events set lifecycle_status = 'active' where id = (select wedding_event_id from phase2_test_data);
reset role;
update public.client_entitlements set status = 'suspended' where client_id = (select client_a_id from phase2_test_identities) and product_id = 'wedding';
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  if public.resolve_invitation((select personal_token from phase2_test_data)) <> '{"status":"subscription_unavailable"}'::jsonb then raise exception 'FAIL: inactive entitlement exposed invitation data.'; end if;
end;
$$;

reset role;
update public.client_entitlements set status = 'active' where client_id = (select client_a_id from phase2_test_identities) and product_id = 'wedding';

-- A disabled catalog entry is no longer selectable, but the Event-owned snapshot remains.
update public.platform_templates set active = false where product_id = 'wedding' and renderer_key = 'soft-floral-garden' and version = 1;
select set_config('request.jwt.claim.sub', (select client_a_user_id::text from phase2_test_identities), true);
set local role authenticated;
do $$
declare disabled_template_id uuid := (select template_version_id from public.wedding_event_configs where event_id = (select wedding_event_id from phase2_test_data));
begin
  if exists (select 1 from public.platform_templates where id = disabled_template_id) then raise exception 'FAIL: disabled template remains selectable.'; end if;
  begin
    perform public.create_design_draft('wedding', 'Disabled template', '{}', disabled_template_id, '{}');
    raise exception 'FAIL: disabled template was accepted for a new Draft.';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $$
declare resolved jsonb;
begin
  resolved := public.resolve_invitation((select personal_token from phase2_test_data));
  if resolved -> 'configuration' -> 'template_snapshot' ->> 'templateId' <> 'soft-floral-garden' then raise exception 'FAIL: disabled template broke the existing Event snapshot.'; end if;
  begin
    perform public.submit_personal_rsvp((select personal_token from phase2_test_data), 'accepted', 1, '{}', null);
  exception when others then
    raise exception 'FAIL: active Event RSVP unexpectedly failed after template disable: %', sqlerrm;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select client_a_user_id::text from phase2_test_identities), true);
set local role authenticated;
update public.events set lifecycle_status = 'archived' where id = (select wedding_event_id from phase2_test_data);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  if public.resolve_invitation((select personal_token from phase2_test_data)) ->> 'status' <> 'archived_read_only' then raise exception 'FAIL: configured Wedding archive replay is unavailable.'; end if;
  begin
    perform public.submit_personal_rsvp((select personal_token from phase2_test_data), 'accepted', 1, '{}', null);
    raise exception 'FAIL: archived Wedding accepted RSVP.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select client_a_user_id::text from phase2_test_identities), true);
set local role authenticated;
update public.events set lifecycle_status = 'cancelled' where id = (select wedding_event_id from phase2_test_data);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  if public.resolve_invitation((select personal_token from phase2_test_data)) <> '{"status":"cancelled"}'::jsonb then raise exception 'FAIL: cancelled Event exposed invitation data.'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select client_a_user_id::text from phase2_test_identities), true);
set local role authenticated;
update public.events set deleted_at = now() where id = (select wedding_event_id from phase2_test_data);
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  if public.resolve_invitation((select personal_token from phase2_test_data)) <> '{"status":"unavailable"}'::jsonb then raise exception 'FAIL: soft-deleted Event exposed invitation data.'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select client_a_user_id::text from phase2_test_identities), true);
set local role authenticated;
select public.revoke_personal_invitation((select guest_id from phase2_test_data));
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  if public.resolve_invitation((select personal_token from phase2_test_data)) <> '{"status":"invalid"}'::jsonb then raise exception 'FAIL: revoked personal token still resolved.'; end if;
end;
$$;

reset role;
rollback;
