-- Run manually after all three backend phases, two non-admin Client identities,
-- and one platform_admin assignment exist. Every mutation rolls back.
begin;

create temporary table phase3_test_identities as
select
  (select i.user_id from public.client_identities i where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id) order by i.created_at limit 1) as client_a_user_id,
  (select i.client_id from public.client_identities i where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id) order by i.created_at limit 1) as client_a_id,
  (select i.user_id from public.client_identities i where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id) order by i.created_at offset 1 limit 1) as client_b_user_id,
  (select i.client_id from public.client_identities i where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id) order by i.created_at offset 1 limit 1) as client_b_id,
  (select user_id from public.platform_admins order by created_at limit 1) as admin_user_id;

do $$
begin
  if exists (select 1 from phase3_test_identities where client_a_user_id is null or client_a_id is null or client_b_user_id is null or client_b_id is null or admin_user_id is null) then
    raise exception 'Prerequisite: create two non-admin Client identities and assign one platform_admin.';
  end if;
end;
$$;

insert into public.client_entitlements(client_id, product_id, status)
select client_id, 'wedding', 'active'
from (select client_a_id as client_id from phase3_test_identities union all select client_b_id from phase3_test_identities) clients
on conflict (client_id, product_id) do update set status = 'active', starts_at = now(), ends_at = null;

create temporary table phase3_test_data (
  client_a_event_id uuid,
  client_a_guest_id uuid,
  client_a_token text,
  client_b_event_id uuid,
  client_b_guest_id uuid,
  client_b_token text
);
insert into phase3_test_data default values;
grant all on phase3_test_identities, phase3_test_data to authenticated, anon;

select set_config('request.jwt.claim.sub', (select client_a_user_id::text from phase3_test_identities), true);
set local role authenticated;
do $$
declare event_row public.events; guest_result jsonb; result jsonb; summary jsonb;
begin
  event_row := public.create_event('wedding', 'Phase 3 Client A', 'ar', now(), now() + interval '1 day', now() + interval '12 hours');
  update public.events set lifecycle_status = 'active', request_companion_names = true where id = event_row.id;
  guest_result := public.create_event_guest(event_row.id, 'Ahmed', '+966500000001', 2, null);
  perform public.submit_personal_rsvp(guest_result ->> 'token', 'accepted', 3, array['Sara','Mona'], null);
  update phase3_test_data set client_a_event_id = event_row.id, client_a_guest_id = (guest_result -> 'guest' ->> 'id')::uuid, client_a_token = guest_result ->> 'token';

  result := public.resolve_checkin(guest_result ->> 'token', event_row.id);
  if result ->> 'status' <> 'not_arrived' or (result ->> 'confirmed_party_size')::integer <> 3 or (result ->> 'remaining_expected')::integer <> 3 then raise exception 'FAIL: accepted Guest did not resolve for check-in.'; end if;

  result := public.check_in_party_members(guest_result ->> 'token', 2, event_row.id);
  if result ->> 'status' <> 'partial' or (result ->> 'checked_in_count')::integer <> 2 or (result ->> 'remaining_expected')::integer <> 1 then raise exception 'FAIL: partial check-in is incorrect.'; end if;
  if (public.resolve_checkin(guest_result ->> 'token', event_row.id) ->> 'checked_in_count')::integer <> 2 then raise exception 'FAIL: repeated resolution changed check-in state.'; end if;

  begin
    perform public.check_in_party_members(guest_result ->> 'token', 2, event_row.id);
    raise exception 'FAIL: stale concurrent-style arrival exceeded the party limit.';
  exception when invalid_parameter_value then null;
  end;

  result := public.check_in_party_members(guest_result ->> 'token', 1, event_row.id);
  if result ->> 'status' <> 'complete' or (result ->> 'checked_in_count')::integer <> 3 then raise exception 'FAIL: later arrival did not complete check-in.'; end if;
  result := public.set_guest_checkin_count((guest_result -> 'guest' ->> 'id')::uuid, 2);
  if result ->> 'status' <> 'partial' or (result ->> 'checked_in_count')::integer <> 2 then raise exception 'FAIL: correction did not reduce check-in.'; end if;

  begin perform public.set_guest_checkin_count((guest_result -> 'guest' ->> 'id')::uuid, -1); raise exception 'FAIL: negative check-in was accepted.'; exception when invalid_parameter_value then null; end;
  begin perform public.set_guest_checkin_count((guest_result -> 'guest' ->> 'id')::uuid, 4); raise exception 'FAIL: over-limit correction was accepted.'; exception when invalid_parameter_value then null; end;
  begin update public.event_guests set checked_in_count = 1 where id = (guest_result -> 'guest' ->> 'id')::uuid; raise exception 'FAIL: direct check-in mutation was accepted.'; exception when insufficient_privilege then null; end;

  summary := public.event_operational_summary(event_row.id);
  if (summary ->> 'guest_records')::integer <> 1 or (summary ->> 'accepted')::integer <> 1 or (summary ->> 'confirmed_headcount')::integer <> 3 or (summary ->> 'checked_in_headcount')::integer <> 2 or (summary ->> 'remaining_expected')::integer <> 1 then raise exception 'FAIL: Event operational mathematics are incorrect: %', summary; end if;
  if (select count(*) from public.event_checkin_activity where event_id = event_row.id) <> 3 then raise exception 'FAIL: check-in activity history is incomplete.'; end if;

  guest_result := public.create_event_guest(event_row.id, 'Pending Guest', null, 0, null);
  begin perform public.set_guest_checkin_count((guest_result -> 'guest' ->> 'id')::uuid, 1); raise exception 'FAIL: pending Guest was checked in.'; exception when insufficient_privilege then null; end;
  guest_result := public.create_event_guest(event_row.id, 'Declined Guest', null, 0, null);
  perform public.submit_personal_rsvp(guest_result ->> 'token', 'declined', 0, '{}', null);
  begin perform public.check_in_party_members(guest_result ->> 'token', 1, event_row.id); raise exception 'FAIL: declined Guest was checked in.'; exception when insufficient_privilege then null; end;
  perform public.revoke_personal_invitation((guest_result -> 'guest' ->> 'id')::uuid);
  if public.resolve_checkin(guest_result ->> 'token', event_row.id) ->> 'status' <> 'invalid' then raise exception 'FAIL: revoked check-in token resolved.'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select client_b_user_id::text from phase3_test_identities), true);
set local role authenticated;
do $$
declare event_row public.events; guest_result jsonb;
begin
  event_row := public.create_event('wedding', 'Phase 3 Client B', 'en', now(), now() + interval '1 day', now() + interval '12 hours');
  update public.events set lifecycle_status = 'active' where id = event_row.id;
  guest_result := public.create_event_guest(event_row.id, 'Faisal', '+966500000002', 0, null);
  perform public.submit_personal_rsvp(guest_result ->> 'token', 'accepted', 1, '{}', null);
  update phase3_test_data set client_b_event_id = event_row.id, client_b_guest_id = (guest_result -> 'guest' ->> 'id')::uuid, client_b_token = guest_result ->> 'token';

  if public.resolve_checkin((select client_a_token from phase3_test_data), (select client_a_event_id from phase3_test_data)) ->> 'status' <> 'not_authorized' then raise exception 'FAIL: Client B resolved Client A token.'; end if;
  if public.resolve_checkin(guest_result ->> 'token', (select client_a_event_id from phase3_test_data)) ->> 'status' <> 'wrong_event' then raise exception 'FAIL: wrong Event context was accepted.'; end if;
  begin perform public.check_in_party_members(guest_result ->> 'token', 1, (select client_a_event_id from phase3_test_data)); raise exception 'FAIL: malicious Event ID bypassed scanner scope.'; exception when insufficient_privilege then null; end;
  begin perform public.check_in_party_members((select client_a_token from phase3_test_data), 1, (select client_a_event_id from phase3_test_data)); raise exception 'FAIL: Client B checked in Client A Guest.'; exception when insufficient_privilege then null; end;
  begin perform public.set_guest_checkin_count((select client_a_guest_id from phase3_test_data), 1); raise exception 'FAIL: Client B corrected Client A Guest.'; exception when insufficient_privilege then null; end;
  begin perform public.event_operational_summary((select client_a_event_id from phase3_test_data)); raise exception 'FAIL: Client B read Client A Event summary.'; exception when insufficient_privilege then null; end;
  if exists (select 1 from public.event_checkin_activity where event_id = (select client_a_event_id from phase3_test_data)) then raise exception 'FAIL: Client B read Client A check-in history.'; end if;
  begin perform public.admin_set_entitlement((select client_b_id from phase3_test_identities), 'wedding', 'suspended', null); raise exception 'FAIL: Client granted or changed an entitlement.'; exception when insufficient_privilege then null; end;
  if exists (select 1 from public.entitlement_admin_activity) then raise exception 'FAIL: Client read Admin entitlement history.'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  begin perform public.check_in_party_members((select client_a_token from phase3_test_data), 1, (select client_a_event_id from phase3_test_data)); raise exception 'FAIL: anonymous check-in mutation succeeded.'; exception when insufficient_privilege then null; end;
  begin perform public.set_guest_checkin_count((select client_a_guest_id from phase3_test_data), 1); raise exception 'FAIL: anonymous correction succeeded.'; exception when insufficient_privilege then null; end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select client_a_user_id::text from phase3_test_identities), true);
set local role authenticated;
do $$
declare result jsonb;
begin
  update public.events set lifecycle_status = 'planning' where id = (select client_a_event_id from phase3_test_data);
  if public.resolve_checkin((select client_a_token from phase3_test_data), (select client_a_event_id from phase3_test_data)) ->> 'status' <> 'planning' then raise exception 'FAIL: planning Event resolved as operational.'; end if;
  update public.events set lifecycle_status = 'ended' where id = (select client_a_event_id from phase3_test_data);
  if public.resolve_checkin((select client_a_token from phase3_test_data), (select client_a_event_id from phase3_test_data)) ->> 'status' <> 'ended' then raise exception 'FAIL: ended Event resolved as operational.'; end if;
  update public.events set lifecycle_status = 'cancelled' where id = (select client_a_event_id from phase3_test_data);
  result := public.resolve_checkin((select client_a_token from phase3_test_data), (select client_a_event_id from phase3_test_data));
  if result ->> 'status' <> 'cancelled' then raise exception 'FAIL: cancelled Event resolved as operational.'; end if;
  begin perform public.check_in_party_members((select client_a_token from phase3_test_data), 1, (select client_a_event_id from phase3_test_data)); raise exception 'FAIL: cancelled Event accepted check-in.'; exception when insufficient_privilege then null; end;

  update public.events set lifecycle_status = 'archived' where id = (select client_a_event_id from phase3_test_data);
  if public.resolve_checkin((select client_a_token from phase3_test_data), (select client_a_event_id from phase3_test_data)) ->> 'status' <> 'archived' then raise exception 'FAIL: archived Event resolved as operational.'; end if;

  update public.events set lifecycle_status = 'active', deleted_at = now() where id = (select client_a_event_id from phase3_test_data);
  if public.resolve_checkin((select client_a_token from phase3_test_data), (select client_a_event_id from phase3_test_data)) ->> 'status' <> 'soft_deleted' then raise exception 'FAIL: soft-deleted Event resolved as operational.'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select admin_user_id::text from phase3_test_identities), true);
set local role authenticated;
do $$
declare entitlement public.client_entitlements;
begin
  entitlement := public.admin_set_entitlement((select client_b_id from phase3_test_identities), 'wedding', 'suspended', null);
  if entitlement.status <> 'suspended' then raise exception 'FAIL: Admin entitlement suspension failed.'; end if;
  entitlement := public.admin_set_entitlement((select client_b_id from phase3_test_identities), 'wedding', 'active', now() + interval '30 days');
  if entitlement.status <> 'active' or entitlement.ends_at is null then raise exception 'FAIL: Admin entitlement activation/expiry failed.'; end if;
  if not exists (select 1 from public.clients where id = (select client_a_id from phase3_test_identities)) then raise exception 'FAIL: Admin cannot inspect canonical Clients.'; end if;
  if not exists (select 1 from public.events where id = (select client_a_event_id from phase3_test_data)) then raise exception 'FAIL: Admin cannot inspect canonical Events.'; end if;
  if not exists (select 1 from public.event_guests where id = (select client_a_guest_id from phase3_test_data)) then raise exception 'FAIL: Admin cannot inspect canonical Guests.'; end if;
  if (select count(*) from public.entitlement_admin_activity where client_id = (select client_b_id from phase3_test_identities)) <> 2 then raise exception 'FAIL: Admin entitlement audit is incomplete.'; end if;
end;
$$;

reset role;
rollback;
