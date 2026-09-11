-- ==============================================================================
-- QuickRSVP Verification Script: Event Staff Scanner Access
-- Description: Self-contained transactional verification of event-scoped staff
--              credentials, database-level check-in authorization, cross-event
--              isolation, lifecycle restrictions, and privilege boundaries.
-- Test: supabase/tests/event_staff_scanner_access_verification.sql
-- Status: Transactional verifier — all mutations roll back automatically.
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 1. Verify Schema & Privileges
-- ------------------------------------------------------------------------------
do $$
declare
  v_table_exists boolean;
  v_rls_enabled boolean;
  v_proc_record record;
begin
  select exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'event_staff_tokens'
  ) into v_table_exists;

  if not v_table_exists then
    raise exception 'FAIL [Assertion 1]: public.event_staff_tokens table does not exist.';
  end if;

  select relrowsecurity from pg_class where relname = 'event_staff_tokens' and relnamespace = 'public'::regnamespace
  into v_rls_enabled;

  if not v_rls_enabled then
    raise exception 'FAIL [Assertion 1]: RLS is not enabled on public.event_staff_tokens.';
  end if;

  -- Verify security definer functions exist
  for v_proc_record in
    select proname, prosecdef
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'resolve_staff_checkin',
        'staff_check_in_party_members',
        'list_staff_guests',
        'create_event_staff_token',
        'revoke_event_staff_token'
      )
  loop
    if not v_proc_record.prosecdef then
      raise exception 'FAIL [Assertion 1]: Function public.% must be security definer.', v_proc_record.proname;
    end if;
  end loop;

  -- Verify execute privileges
  if not has_function_privilege('anon', 'public.resolve_staff_checkin(text, text)', 'EXECUTE') then
    raise exception 'FAIL [Assertion 1]: anon must have EXECUTE on resolve_staff_checkin.';
  end if;
  if not has_function_privilege('anon', 'public.staff_check_in_party_members(text, text, integer)', 'EXECUTE') then
    raise exception 'FAIL [Assertion 1]: anon must have EXECUTE on staff_check_in_party_members.';
  end if;
  if not has_function_privilege('anon', 'public.list_staff_guests(text)', 'EXECUTE') then
    raise exception 'FAIL [Assertion 1]: anon must have EXECUTE on list_staff_guests.';
  end if;
  if not has_function_privilege('authenticated', 'public.create_event_staff_token(uuid, text, timestamptz)', 'EXECUTE') then
    raise exception 'FAIL [Assertion 1]: authenticated must have EXECUTE on create_event_staff_token.';
  end if;
  if has_function_privilege('anon', 'public.create_event_staff_token(uuid, text, timestamptz)', 'EXECUTE') then
    raise exception 'FAIL [Assertion 1]: anon must NOT have EXECUTE on create_event_staff_token.';
  end if;
  if not has_function_privilege('authenticated', 'public.revoke_event_staff_token(uuid)', 'EXECUTE') then
    raise exception 'FAIL [Assertion 1]: authenticated must have EXECUTE on revoke_event_staff_token.';
  end if;
  if has_function_privilege('anon', 'public.revoke_event_staff_token(uuid)', 'EXECUTE') then
    raise exception 'FAIL [Assertion 1]: anon must NOT have EXECUTE on revoke_event_staff_token.';
  end if;

  raise notice 'PASS: Assertion 1 — Schema, RLS, and RPC privileges certified.';
end;
$$;

-- ------------------------------------------------------------------------------
-- 2. Self-Contained Identity & Entitlement Provisioning
-- ------------------------------------------------------------------------------
create temporary table staff_test_identities (
  client_a_user_id uuid,
  client_a_id uuid,
  client_b_user_id uuid,
  client_b_id uuid,
  client_a_is_synthetic boolean default false,
  client_b_is_synthetic boolean default false
);

insert into staff_test_identities default values;

do $$
declare
  v_instance_id uuid;
  v_user_a uuid;
  v_client_a uuid;
  v_user_b uuid;
  v_client_b uuid;
  v_a_synth boolean := false;
  v_b_synth boolean := false;
begin
  begin
    select instance_id into v_instance_id from auth.users where instance_id is not null limit 1;
  exception when others then
    v_instance_id := null;
  end;
  v_instance_id := coalesce(v_instance_id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- 1. Discover existing non-admin Client A
  select i.user_id, i.client_id into v_user_a, v_client_a
  from public.client_identities i
  where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id)
  order by i.created_at, i.user_id
  limit 1;

  -- 2. Discover existing non-admin Client B (guaranteed distinct client)
  if v_client_a is not null then
    select i.user_id, i.client_id into v_user_b, v_client_b
    from public.client_identities i
    where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id)
      and i.client_id <> v_client_a
    order by i.created_at, i.user_id
    limit 1;
  end if;

  -- 3. Provision synthetic Client A if absent
  if v_user_a is null or v_client_a is null then
    v_user_a := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      v_user_a, v_instance_id, 'authenticated', 'authenticated',
      'test-synth-a-' || v_user_a || '@quickrsvp.test', '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', 'Synthetic Test Client A'),
      now(), now()
    );

    select client_id into v_client_a from public.client_identities where user_id = v_user_a;
    if v_client_a is null then
      insert into public.clients (display_name, status)
      values ('Synthetic Test Client A', 'active')
      returning id into v_client_a;

      insert into public.client_identities (user_id, client_id)
      values (v_user_a, v_client_a);
    end if;

    v_a_synth := true;
  end if;

  -- 4. Provision synthetic Client B if absent (guarantees cross-client isolation tests always run)
  if v_user_b is null or v_client_b is null then
    v_user_b := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      v_user_b, v_instance_id, 'authenticated', 'authenticated',
      'test-synth-b-' || v_user_b || '@quickrsvp.test', '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', 'Synthetic Test Client B'),
      now(), now()
    );

    select client_id into v_client_b from public.client_identities where user_id = v_user_b;
    if v_client_b is null then
      insert into public.clients (display_name, status)
      values ('Synthetic Test Client B', 'active')
      returning id into v_client_b;

      insert into public.client_identities (user_id, client_id)
      values (v_user_b, v_client_b);
    end if;

    v_b_synth := true;
  end if;

  update staff_test_identities set
    client_a_user_id = v_user_a,
    client_a_id = v_client_a,
    client_b_user_id = v_user_b,
    client_b_id = v_client_b,
    client_a_is_synthetic = v_a_synth,
    client_b_is_synthetic = v_b_synth;

  -- Ensure active wedding entitlements for both Client A and Client B
  insert into public.client_entitlements (client_id, product_id, status)
  select client_a_id, 'wedding', 'active' from staff_test_identities
  on conflict (client_id, product_id) do update
  set status = 'active', starts_at = now(), ends_at = null;

  insert into public.client_entitlements (client_id, product_id, status)
  select client_b_id, 'wedding', 'active' from staff_test_identities
  on conflict (client_id, product_id) do update
  set status = 'active', starts_at = now(), ends_at = null;

  raise notice 'PASS: Assertion 2 — Client A and Client B provisioned (Synthetic A: %, Synthetic B: %).', v_a_synth, v_b_synth;
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. Provision Events, Guests, RSVPs, and Staff Tokens
-- ------------------------------------------------------------------------------
create temporary table staff_test_data (
  event_a_id uuid,
  guest_a_id uuid,
  guest_a_token text,
  staff_a_token text,
  staff_a_token_id uuid,
  event_b_id uuid,
  guest_b_id uuid,
  guest_b_token text,
  staff_b_token text,
  staff_b_token_id uuid
);
insert into staff_test_data default values;
grant all on staff_test_identities, staff_test_data to authenticated, anon;

do $$
declare
  v_user_a text;
  v_user_b text;
  v_event_a public.events;
  v_guest_a jsonb;
  v_staff_a jsonb;
  v_event_b public.events;
  v_guest_b jsonb;
  v_staff_b jsonb;
begin
  select client_a_user_id::text, client_b_user_id::text
  into v_user_a, v_user_b
  from staff_test_identities;

  -- 1. Setup Event A as Client A
  perform set_config('request.jwt.claim.sub', v_user_a, true);
  set local role authenticated;

  v_event_a := public.create_event('wedding', 'Staff Test Wedding A', 'ar', now(), now() + interval '1 day');
  update public.events set lifecycle_status = 'active' where id = v_event_a.id;

  v_guest_a := public.create_event_guest(v_event_a.id, 'Salma Guest A', '+966500000010', 2, null);
  perform public.submit_personal_rsvp(v_guest_a ->> 'token', 'accepted', 2, array['Salma Companion'], null);

  v_staff_a := public.create_event_staff_token(v_event_a.id, 'Main Gate Staff A');

  -- 2. Setup Event B as Client B
  perform set_config('request.jwt.claim.sub', v_user_b, true);
  set local role authenticated;

  v_event_b := public.create_event('wedding', 'Staff Test Wedding B', 'ar', now(), now() + interval '1 day');
  update public.events set lifecycle_status = 'active' where id = v_event_b.id;

  v_guest_b := public.create_event_guest(v_event_b.id, 'Fahad Guest B', '+966500000020', 1, null);
  perform public.submit_personal_rsvp(v_guest_b ->> 'token', 'accepted', 1, array[]::text[], null);

  v_staff_b := public.create_event_staff_token(v_event_b.id, 'Main Gate Staff B');

  update staff_test_data set
    event_a_id = v_event_a.id,
    guest_a_id = (v_guest_a -> 'guest' ->> 'id')::uuid,
    guest_a_token = v_guest_a ->> 'token',
    staff_a_token = v_staff_a ->> 'token',
    staff_a_token_id = (v_staff_a ->> 'id')::uuid,
    event_b_id = v_event_b.id,
    guest_b_id = (v_guest_b -> 'guest' ->> 'id')::uuid,
    guest_b_token = v_guest_b ->> 'token',
    staff_b_token = v_staff_b ->> 'token',
    staff_b_token_id = (v_staff_b ->> 'id')::uuid;

  raise notice 'PASS: Assertion 3 — Events, guests, and staff tokens provisioned.';
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. Cross-Client Staff Token Creation Isolation (Client A cannot access Event B)
-- ------------------------------------------------------------------------------
do $$
declare
  v_user_a text;
  v_event_b_id uuid;
  v_caught boolean := false;
  v_sqlstate text;
begin
  select client_a_user_id::text into v_user_a from staff_test_identities;
  select event_b_id into v_event_b_id from staff_test_data;

  perform set_config('request.jwt.claim.sub', v_user_a, true);
  set local role authenticated;

  begin
    perform public.create_event_staff_token(v_event_b_id, 'Hostile Token For Other Client Event');
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate = '42501' then
      v_caught := true;
    else
      raise exception 'FAIL [Assertion 4]: Expected SQLSTATE 42501 when Client A targets Event B, got %', v_sqlstate;
    end if;
  end;

  if not v_caught then
    raise exception 'FAIL [Assertion 4]: Client A was able to create staff token for Client B event!';
  end if;

  raise notice 'PASS: Assertion 4 — Client A cannot create staff token for Client B event.';
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. Direct DML & Table Enumeration Restrictions on event_staff_tokens
-- ------------------------------------------------------------------------------
do $$
declare
  v_anon_count integer;
  v_event_a_id uuid;
  v_client_a_id uuid;
  v_staff_a_id uuid;
  v_user_a text;
  v_event_b_id uuid;
  v_client_b_id uuid;
  v_caught boolean := false;
  v_sqlstate text;
begin
  select event_a_id, staff_a_token_id, event_b_id into v_event_a_id, v_staff_a_id, v_event_b_id from staff_test_data;
  select client_a_id, client_b_id, client_a_user_id::text into v_client_a_id, v_client_b_id, v_user_a from staff_test_identities;

  -- Test as anon
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);

  -- Anon enumeration must return 0
  select count(*) into v_anon_count from public.event_staff_tokens;
  if v_anon_count <> 0 then
    raise exception 'FAIL [Assertion 5]: anon was able to read % rows from event_staff_tokens!', v_anon_count;
  end if;

  -- Direct insert as anon must be rejected
  begin
    insert into public.event_staff_tokens (event_id, client_id, label, token_hash)
    values (v_event_a_id, v_client_a_id, 'Direct Anon Token', encode(gen_random_bytes(32), 'hex'));
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate = '42501' then
      v_caught := true;
    else
      raise exception 'FAIL [Assertion 5]: Expected SQLSTATE 42501 on anon direct insert, got %', v_sqlstate;
    end if;
  end;

  if not v_caught then
    raise exception 'FAIL [Assertion 5]: Direct insert on event_staff_tokens succeeded as anon!';
  end if;

  -- Direct insert by Client A for Client B's event must fail RLS
  perform set_config('request.jwt.claim.sub', v_user_a, true);
  set local role authenticated;
  v_caught := false;

  begin
    insert into public.event_staff_tokens (event_id, client_id, label, token_hash)
    values (v_event_b_id, v_client_b_id, 'Spoofed Client B Token', encode(gen_random_bytes(32), 'hex'));
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate = '42501' then
      v_caught := true;
    else
      raise exception 'FAIL [Assertion 5]: Expected SQLSTATE 42501 on cross-client direct insert, got %', v_sqlstate;
    end if;
  end;

  if not v_caught then
    raise exception 'FAIL [Assertion 5]: Client A directly inserted token for Client B event!';
  end if;

  raise notice 'PASS: Assertion 5 — Direct DML and enumeration on event_staff_tokens strictly protected by RLS.';
end;
$$;

-- ------------------------------------------------------------------------------
-- 6. Door Scanner Token Resolution & Valid Check-In Flow (Staff A -> Guest A)
-- ------------------------------------------------------------------------------
do $$
declare
  v_staff_token text;
  v_guest_token text;
  v_guest_id uuid;
  v_res jsonb;
  v_count integer;
  v_activity_exists boolean;
begin
  select staff_a_token, guest_a_token, guest_a_id into v_staff_token, v_guest_token, v_guest_id from staff_test_data;

  -- Switch to unauthenticated door staff context
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);

  -- Resolution step
  v_res := public.resolve_staff_checkin(v_staff_token, v_guest_token);
  if v_res ->> 'status' <> 'not_arrived'
     or (v_res ->> 'confirmed_party_size')::integer <> 2
     or (v_res ->> 'remaining_expected')::integer <> 2
     or v_res ->> 'guest_name' <> 'Salma Guest A' then
    raise exception 'FAIL [Assertion 6]: Staff resolution failed for Guest A. Got: %', v_res;
  end if;

  -- Check-in step (arrival of 1 member)
  v_res := public.staff_check_in_party_members(v_staff_token, v_guest_token, 1);
  if v_res ->> 'status' <> 'partial'
     or (v_res ->> 'checked_in_count')::integer <> 1
     or (v_res ->> 'remaining_expected')::integer <> 1 then
    raise exception 'FAIL [Assertion 6]: Staff check-in failed for Guest A. Got: %', v_res;
  end if;

  -- Database verification
  select checked_in_count into v_count from public.event_guests where id = v_guest_id;
  if v_count <> 1 then
    raise exception 'FAIL [Assertion 6]: Database checked_in_count was not updated (expected 1, got %).', v_count;
  end if;

  -- Audit log verification
  select exists (
    select 1 from public.event_checkin_activity
    where guest_id = v_guest_id and action = 'arrival_added' and new_count = 1 and actor_user_id is null
  ) into v_activity_exists;

  if not v_activity_exists then
    raise exception 'FAIL [Assertion 6]: Check-in activity was not recorded in event_checkin_activity.';
  end if;

  raise notice 'PASS: Assertion 6 — Door scanner resolution and partial check-in verified with audit trail.';
end;
$$;

-- ------------------------------------------------------------------------------
-- 7. Cross-Event Isolation: Staff A Cannot Resolve or Check In Guest B
-- ------------------------------------------------------------------------------
do $$
declare
  v_staff_a text;
  v_guest_b text;
  v_guest_b_id uuid;
  v_res jsonb;
  v_caught boolean := false;
  v_sqlstate text;
  v_count integer;
begin
  select staff_a_token, guest_b_token, guest_b_id into v_staff_a, v_guest_b, v_guest_b_id from staff_test_data;

  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);

  -- 1. Resolution of Guest B using Staff A token must return 'wrong_event'
  v_res := public.resolve_staff_checkin(v_staff_a, v_guest_b);
  if v_res ->> 'status' <> 'wrong_event' then
    raise exception 'FAIL [Assertion 7]: Staff A resolving Guest B did not return wrong_event! Got: %', v_res;
  end if;

  -- 2. Check-in of Guest B using Staff A token must be rejected with 42501
  begin
    perform public.staff_check_in_party_members(v_staff_a, v_guest_b, 1);
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate = '42501' then
      v_caught := true;
    else
      raise exception 'FAIL [Assertion 7]: Expected SQLSTATE 42501 on cross-event check-in, got %', v_sqlstate;
    end if;
  end;

  if not v_caught then
    raise exception 'FAIL [Assertion 7]: Staff A was able to check in Guest B from another event!';
  end if;

  -- Ensure Guest B was untouched in DB
  select checked_in_count into v_count from public.event_guests where id = v_guest_b_id;
  if v_count <> 0 then
    raise exception 'FAIL [Assertion 7]: Guest B checked_in_count was modified (expected 0, got %).', v_count;
  end if;

  raise notice 'PASS: Assertion 7 — Cross-event isolation strictly enforced for resolution and check-in.';
end;
$$;

-- ------------------------------------------------------------------------------
-- 8. Staff Door Guest List Scoped Strictly to Event
-- ------------------------------------------------------------------------------
do $$
declare
  v_staff_a text;
  v_total_guests integer;
  v_has_guest_a boolean;
  v_has_guest_b boolean;
begin
  select staff_a_token into v_staff_a from staff_test_data;

  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);

  select
    count(*),
    bool_or(name = 'Salma Guest A'),
    bool_or(name = 'Fahad Guest B')
  into v_total_guests, v_has_guest_a, v_has_guest_b
  from public.list_staff_guests(v_staff_a);

  if v_total_guests < 1 or not v_has_guest_a then
    raise exception 'FAIL [Assertion 8]: Staff A guest list missing Guest A.';
  end if;

  if coalesce(v_has_guest_b, false) then
    raise exception 'FAIL [Assertion 8]: Staff A guest list leaked Guest B from another event!';
  end if;

  raise notice 'PASS: Assertion 8 — list_staff_guests is strictly isolated to the token assigned event.';
end;
$$;

-- ------------------------------------------------------------------------------
-- 9. Expired Staff Token Is Denied
-- ------------------------------------------------------------------------------
do $$
declare
  v_user_a text;
  v_event_a uuid;
  v_guest_a text;
  v_expired_res jsonb;
  v_expired_token text;
  v_res jsonb;
  v_caught boolean := false;
  v_sqlstate text;
begin
  select client_a_user_id::text into v_user_a from staff_test_identities;
  select event_a_id, guest_a_token into v_event_a, v_guest_a from staff_test_data;

  -- Create token with past expiration
  perform set_config('request.jwt.claim.sub', v_user_a, true);
  set local role authenticated;

  v_expired_res := public.create_event_staff_token(v_event_a, 'Expired Staff', now() - interval '1 minute');
  v_expired_token := v_expired_res ->> 'token';

  -- Test as door scanner (anon)
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);

  -- Resolution must return not_authorized
  v_res := public.resolve_staff_checkin(v_expired_token, v_guest_a);
  if v_res ->> 'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 9]: Expired token resolution did not return not_authorized! Got: %', v_res;
  end if;

  -- Check-in must raise 42501
  begin
    perform public.staff_check_in_party_members(v_expired_token, v_guest_a, 1);
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate = '42501' then
      v_caught := true;
    else
      raise exception 'FAIL [Assertion 9]: Expected SQLSTATE 42501 for expired token check-in, got %', v_sqlstate;
    end if;
  end;

  if not v_caught then
    raise exception 'FAIL [Assertion 9]: Expired staff token allowed check-in!';
  end if;

  -- list_staff_guests must raise 42501
  v_caught := false;
  begin
    perform * from public.list_staff_guests(v_expired_token);
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate = '42501' then
      v_caught := true;
    else
      raise exception 'FAIL [Assertion 9]: Expected SQLSTATE 42501 for expired token guest list, got %', v_sqlstate;
    end if;
  end;

  if not v_caught then
    raise exception 'FAIL [Assertion 9]: Expired staff token allowed guest list access!';
  end if;

  raise notice 'PASS: Assertion 9 — Expired staff token is denied across resolution, check-in, and guest list.';
end;
$$;

-- ------------------------------------------------------------------------------
-- 10. Revoked Staff Token Is Denied
-- ------------------------------------------------------------------------------
do $$
declare
  v_user_a text;
  v_staff_a text;
  v_staff_a_id uuid;
  v_guest_a text;
  v_res jsonb;
  v_caught boolean := false;
  v_sqlstate text;
begin
  select client_a_user_id::text into v_user_a from staff_test_identities;
  select staff_a_token, staff_a_token_id, guest_a_token into v_staff_a, v_staff_a_id, v_guest_a from staff_test_data;

  -- Revoke token as Host A
  perform set_config('request.jwt.claim.sub', v_user_a, true);
  set local role authenticated;
  perform public.revoke_event_staff_token(v_staff_a_id);

  -- Test as door scanner (anon)
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);

  -- Resolution must return not_authorized
  v_res := public.resolve_staff_checkin(v_staff_a, v_guest_a);
  if v_res ->> 'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 10]: Revoked staff token resolution did not return not_authorized! Got: %', v_res;
  end if;

  -- Check-in must raise 42501
  begin
    perform public.staff_check_in_party_members(v_staff_a, v_guest_a, 1);
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate = '42501' then
      v_caught := true;
    else
      raise exception 'FAIL [Assertion 10]: Expected SQLSTATE 42501 for revoked token check-in, got %', v_sqlstate;
    end if;
  end;

  if not v_caught then
    raise exception 'FAIL [Assertion 10]: Revoked staff token allowed check-in!';
  end if;

  -- list_staff_guests must raise 42501
  v_caught := false;
  begin
    perform * from public.list_staff_guests(v_staff_a);
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate = '42501' then
      v_caught := true;
    else
      raise exception 'FAIL [Assertion 10]: Expected SQLSTATE 42501 for revoked token guest list, got %', v_sqlstate;
    end if;
  end;

  if not v_caught then
    raise exception 'FAIL [Assertion 10]: Revoked staff token allowed guest list access!';
  end if;

  raise notice 'PASS: Assertion 10 — Revoked staff token is immediately denied.';
end;
$$;

-- ------------------------------------------------------------------------------
-- 11. Event Lifecycle Restrictions (Ended Event Blocks Check-In)
-- ------------------------------------------------------------------------------
do $$
declare
  v_user_a text;
  v_event_a uuid;
  v_guest_a text;
  v_new_staff jsonb;
  v_new_staff_token text;
  v_res jsonb;
  v_caught boolean := false;
  v_sqlstate text;
begin
  select client_a_user_id::text into v_user_a from staff_test_identities;
  select event_a_id, guest_a_token into v_event_a, v_guest_a from staff_test_data;

  -- As Host A: Create fresh staff token, then mark event as ended
  perform set_config('request.jwt.claim.sub', v_user_a, true);
  set local role authenticated;

  v_new_staff := public.create_event_staff_token(v_event_a, 'Ended Event Staff');
  v_new_staff_token := v_new_staff ->> 'token';

  update public.events set lifecycle_status = 'ended', ends_at = now() - interval '1 hour' where id = v_event_a;

  -- As door scanner (anon)
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);

  -- Resolution must report status = 'ended'
  v_res := public.resolve_staff_checkin(v_new_staff_token, v_guest_a);
  if v_res ->> 'status' <> 'ended' then
    raise exception 'FAIL [Assertion 11]: Resolution on ended event did not return ended! Got: %', v_res;
  end if;

  -- Check-in must be blocked with 42501
  begin
    perform public.staff_check_in_party_members(v_new_staff_token, v_guest_a, 1);
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate = '42501' then
      v_caught := true;
    else
      raise exception 'FAIL [Assertion 11]: Expected SQLSTATE 42501 on ended event check-in, got %', v_sqlstate;
    end if;
  end;

  if not v_caught then
    raise exception 'FAIL [Assertion 11]: Check-in was permitted on an ended event!';
  end if;

  raise notice 'PASS: Assertion 11 — Ended event blocks staff check-in.';
end;
$$;

-- ------------------------------------------------------------------------------
-- 12. Host-Only RPCs Inaccessible to Staff / Anon
-- ------------------------------------------------------------------------------
do $$
declare
  v_event_a uuid;
  v_guest_a text;
  v_res jsonb;
  v_caught boolean := false;
  v_sqlstate text;
begin
  select event_a_id, guest_a_token into v_event_a, v_guest_a from staff_test_data;

  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);

  -- 1. create_event_staff_token must reject anon
  begin
    perform public.create_event_staff_token(v_event_a, 'Hacked Staff');
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate = '42501' then
      v_caught := true;
    else
      raise exception 'FAIL [Assertion 12]: Expected SQLSTATE 42501 on anon create_event_staff_token, got %', v_sqlstate;
    end if;
  end;

  if not v_caught then
    raise exception 'FAIL [Assertion 12]: anon was able to call create_event_staff_token!';
  end if;

  -- 2. Host resolve_checkin must reject anon with not_authorized
  v_res := public.resolve_checkin(v_guest_a, v_event_a);
  if v_res ->> 'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 12]: Host resolve_checkin did not return not_authorized for anon. Got: %', v_res;
  end if;

  -- 3. Host check_in_party_members must reject anon with 42501
  v_caught := false;
  begin
    perform public.check_in_party_members(v_guest_a, 1, v_event_a);
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate = '42501' then
      v_caught := true;
    else
      raise exception 'FAIL [Assertion 12]: Expected SQLSTATE 42501 on anon host check_in_party_members, got %', v_sqlstate;
    end if;
  end;

  if not v_caught then
    raise exception 'FAIL [Assertion 12]: anon was able to call host check_in_party_members!';
  end if;

  raise notice 'PASS: Assertion 12 — Host-only RPCs remain strictly inaccessible to staff and anon.';
end;
$$;

-- ------------------------------------------------------------------------------
-- 13. Transaction Rollback & Post-Rollback Cleanliness Verification
-- ------------------------------------------------------------------------------
rollback;

-- Verify strictly that after rollback, no test data remains in any tables
do $$
declare
  v_leaked_tokens integer;
  v_leaked_events integer;
  v_leaked_guests integer;
  v_leaked_synth_users integer;
begin
  select count(*) into v_leaked_tokens
  from public.event_staff_tokens
  where label in ('Main Gate Staff A', 'Main Gate Staff B', 'Expired Staff', 'Ended Event Staff');

  select count(*) into v_leaked_events
  from public.events
  where title in ('Staff Test Wedding A', 'Staff Test Wedding B');

  select count(*) into v_leaked_guests
  from public.event_guests
  where name in ('Salma Guest A', 'Fahad Guest B');

  select count(*) into v_leaked_synth_users
  from auth.users
  where email like 'test-synth-%@quickrsvp.test';

  if v_leaked_tokens <> 0 or v_leaked_events <> 0 or v_leaked_guests <> 0 or v_leaked_synth_users <> 0 then
    raise exception 'FAIL [Post-Rollback Cleanliness]: Leaked test data detected! Tokens: %, Events: %, Guests: %, Synth Users: %',
      v_leaked_tokens, v_leaked_events, v_leaked_guests, v_leaked_synth_users;
  end if;

  raise notice 'PASS: Post-Rollback Cleanliness — 0 test records remain in the database.';
end;
$$;

select
  'ALL 12 VERIFICATION SUITES / ASSERTIONS PASSED (100% SUCCESS)' as verification_result,
  'POST-ROLLBACK CLEAN: 0 TEST RECORDS PERSIST' as cleanliness_result;
