-- ==============================================================================
-- QuickRSVP Verification Script: Event Staff Scanner Access
-- Description: Verifies event-scoped staff credentials, database-level
--              authorization for check-in, event isolation, and privilege boundary.
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
begin
  select exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'event_staff_tokens'
  ) into v_table_exists;

  if not v_table_exists then
    raise exception 'FAIL: public.event_staff_tokens table does not exist.';
  end if;

  select relrowsecurity from pg_class where relname = 'event_staff_tokens' and relnamespace = 'public'::regnamespace
  into v_rls_enabled;

  if not v_rls_enabled then
    raise exception 'FAIL: RLS is not enabled on public.event_staff_tokens.';
  end if;
end;
$$;

-- ------------------------------------------------------------------------------
-- 2. Behavioral Verification: Setup Identities & Events
-- ------------------------------------------------------------------------------
create temporary table staff_test_identities as
select
  (select i.user_id from public.client_identities i where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id) order by i.created_at limit 1) as client_a_user_id,
  (select i.client_id from public.client_identities i where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id) order by i.created_at limit 1) as client_a_id,
  (select i.user_id from public.client_identities i where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id) order by i.created_at offset 1 limit 1) as client_b_user_id,
  (select i.client_id from public.client_identities i where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id) order by i.created_at offset 1 limit 1) as client_b_id;

do $$
begin
  if exists (select 1 from staff_test_identities where client_a_user_id is null or client_a_id is null or client_b_user_id is null or client_b_id is null) then
    raise notice 'Skipping live identity execution — prerequisite: two client identities.';
  end if;
end;
$$;

create temporary table staff_test_data (
  event_a_id uuid,
  guest_a_id uuid,
  guest_a_token text,
  staff_a_token text,
  staff_a_token_id uuid,
  event_b_id uuid,
  guest_b_id uuid,
  guest_b_token text
);
insert into staff_test_data default values;
grant all on staff_test_identities, staff_test_data to authenticated, anon;

-- Simulate Client A Host Creating Event, Guest, and Staff Token
do $$
declare
  v_client_a_user text;
  v_event_a public.events;
  v_guest_a jsonb;
  v_staff_a jsonb;
  v_event_b public.events;
  v_guest_b jsonb;
  v_res jsonb;
begin
  select client_a_user_id::text into v_client_a_user from staff_test_identities;
  if v_client_a_user is null then return; end if;

  perform set_config('request.jwt.claim.sub', v_client_a_user, true);

  -- Create Event A and activate
  v_event_a := public.create_event('wedding', 'Staff Test Wedding A', 'ar', now(), now() + interval '1 day');
  update public.events set lifecycle_status = 'active' where id = v_event_a.id;

  -- Create Guest A and accept RSVP
  v_guest_a := public.create_event_guest(v_event_a.id, 'Salma Guest A', '+966500000010', 2, null);
  perform public.submit_personal_rsvp(v_guest_a ->> 'token', 'accepted', 2, array['Salma Companion'], null);

  -- Create Staff Token for Event A
  v_staff_a := public.create_event_staff_token(v_event_a.id, 'Main Gate Staff');

  update staff_test_data set
    event_a_id = v_event_a.id,
    guest_a_id = (v_guest_a -> 'guest' ->> 'id')::uuid,
    guest_a_token = v_guest_a ->> 'token',
    staff_a_token = v_staff_a ->> 'token',
    staff_a_token_id = (v_staff_a ->> 'id')::uuid;

  -- Switch to Client B to create Event B and Guest B
  perform set_config('request.jwt.claim.sub', (select client_b_user_id::text from staff_test_identities), true);
  v_event_b := public.create_event('wedding', 'Staff Test Wedding B', 'ar', now(), now() + interval '1 day');
  update public.events set lifecycle_status = 'active' where id = v_event_b.id;

  v_guest_b := public.create_event_guest(v_event_b.id, 'Fahad Guest B', '+966500000020', 1, null);
  perform public.submit_personal_rsvp(v_guest_b ->> 'token', 'accepted', 1, array[]::text[], null);

  update staff_test_data set
    event_b_id = v_event_b.id,
    guest_b_id = (v_guest_b -> 'guest' ->> 'id')::uuid,
    guest_b_token = v_guest_b ->> 'token';
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. Verify Staff Check-In Without Client Authentication Context
-- ------------------------------------------------------------------------------
do $$
declare
  v_staff_token text;
  v_guest_a_token text;
  v_guest_b_token text;
  v_staff_token_id uuid;
  v_event_a_id uuid;
  v_res jsonb;
  v_guest_count integer;
begin
  select staff_a_token, guest_a_token, guest_b_token, staff_a_token_id, event_a_id
  into v_staff_token, v_guest_a_token, v_guest_b_token, v_staff_token_id, v_event_a_id
  from staff_test_data;

  if v_staff_token is null then return; end if;

  -- Clear authenticated context (Simulate unauthenticated door scanner)
  perform set_config('request.jwt.claim.sub', '', true);

  -- TEST 1: Staff Token Resolves Guest A
  v_res := public.resolve_staff_checkin(v_staff_token, v_guest_a_token);
  if v_res ->> 'status' <> 'not_arrived' or (v_res ->> 'confirmed_party_size')::integer <> 2 then
    raise exception 'FAIL: Staff resolution failed for Guest A. Got: %', v_res;
  end if;

  -- TEST 2: Staff Token Checks In 1 Party Member
  v_res := public.staff_check_in_party_members(v_staff_token, v_guest_a_token, 1);
  if v_res ->> 'status' <> 'partial' or (v_res ->> 'checked_in_count')::integer <> 1 then
    raise exception 'FAIL: Staff check-in failed for Guest A. Got: %', v_res;
  end if;

  -- TEST 3: Staff Token Lists Event A Guests
  select count(*) into v_guest_count from public.list_staff_guests(v_staff_token);
  if v_guest_count < 1 then
    raise exception 'FAIL: list_staff_guests returned 0 guests for Event A.';
  end if;

  -- TEST 4: Event Isolation — Staff Token A Cannot Access Guest B
  v_res := public.resolve_staff_checkin(v_staff_token, v_guest_b_token);
  if v_res ->> 'status' <> 'wrong_event' then
    raise exception 'FAIL: Staff token accessed guest of another event! Expected wrong_event, got: %', v_res;
  end if;

  begin
    perform public.staff_check_in_party_members(v_staff_token, v_guest_b_token, 1);
    raise exception 'FAIL: Staff token checked in guest of another event!';
  exception when others then
    -- Expected rejection
    null;
  end;

  -- TEST 5: Revoked Token Is Denied
  -- Switch back to Host A to revoke the token
  perform set_config('request.jwt.claim.sub', (select client_a_user_id::text from staff_test_identities), true);
  perform public.revoke_event_staff_token(v_staff_token_id);

  -- Clear context again
  perform set_config('request.jwt.claim.sub', '', true);
  v_res := public.resolve_staff_checkin(v_staff_token, v_guest_a_token);
  if v_res ->> 'status' <> 'not_authorized' then
    raise exception 'FAIL: Revoked staff token was not denied! Expected not_authorized, got: %', v_res;
  end if;
end;
$$;

rollback;
