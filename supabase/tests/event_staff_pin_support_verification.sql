-- ==============================================================================
-- QuickRSVP Verification Script: Event Staff PIN Support & Cross-RPC Persistence
-- Description: Self-contained transactional verification proving that:
--              1. Baseline: correct token + PIN works across all 4 RPCs
--              2. Attack Surface A: verify_staff_pin wrong PIN increments DB counter
--              3. Attack Surface B: resolve_staff_checkin wrong PIN increments DB counter
--              4. Attack Surface C: staff_check_in_party_members wrong PIN increments DB counter
--              5. Attack Surface D: list_staff_guests wrong PIN increments DB counter
--              6. Cross-RPC lockout: resolve -> list -> checkin triggers 15m lockout in DB
--              7. Lockout enforcement: correct PIN rejected across all 4 RPCs during lockout
--              8. Lockout recovery: expired lockout permits correct PIN & resets DB counters
--              9. Post-auth validation: business errors still raise after authorization
--              10. Revocation enforcement: revoked token denied across all 4 RPCs
--              11. Expiry enforcement: expired token denied across all 4 RPCs
--              12. Cross-event isolation: Event A token cannot access Event B guest
--              13. Raw token alone: null PIN denied across all 4 RPCs
-- Test: supabase/tests/event_staff_pin_support_verification.sql
-- Status: Transactional verifier — all mutations roll back automatically.
-- ==============================================================================

begin;

-- 1. Apply Schema Changes Transactionally For Testing
alter table public.event_staff_tokens
  add column if not exists pin_hash text default null,
  add column if not exists failed_pin_attempts integer not null default 0,
  add column if not exists pin_locked_until timestamptz default null;

-- Helper: Token Creator
create or replace function public.create_event_staff_token(
  p_event_id uuid,
  p_label text default 'Door Staff',
  p_expires_at timestamptz default null,
  p_pin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events;
  raw_token text;
  token_id uuid;
  v_pin_hash text := null;
begin
  if auth.uid() is null or public.current_client_id() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into event_row
  from public.events
  where id = p_event_id
    and (client_id = public.current_client_id() or public.is_platform_admin())
    and deleted_at is null;

  if event_row.id is null then
    raise exception 'Event was not found.' using errcode = '42501';
  end if;

  raw_token := encode(gen_random_bytes(24), 'hex');

  if p_pin is not null and trim(p_pin) <> '' then
    v_pin_hash := extensions.crypt(trim(p_pin), extensions.gen_salt('bf', 8));
  end if;

  insert into public.event_staff_tokens(event_id, client_id, label, token_hash, expires_at, pin_hash)
  values (
    event_row.id,
    event_row.client_id,
    coalesce(nullif(trim(p_label), ''), 'Door Staff'),
    private.token_hash(raw_token),
    p_expires_at,
    v_pin_hash
  )
  returning id into token_id;

  return jsonb_build_object(
    'id', token_id,
    'token', raw_token,
    'event_id', event_row.id,
    'label', coalesce(nullif(trim(p_label), ''), 'Door Staff'),
    'created_at', now(),
    'has_pin', (v_pin_hash is not null)
  );
end;
$$;

-- Helper: Non-Raising Structured Status Staff Authorization
create or replace function private.authorize_staff(
  p_staff_token text,
  p_pin text
)
returns table(
  status text,
  staff_id uuid,
  event_id uuid,
  client_id uuid,
  label text,
  attempts_remaining integer,
  minutes_remaining integer,
  locked_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_row public.event_staff_tokens;
  v_clean_token text := trim(coalesce(p_staff_token, ''));
  v_clean_pin text := trim(coalesce(p_pin, ''));
  v_locked_mins integer;
begin
  if v_clean_token = '' then
    status := 'invalid_or_expired';
    return next;
    return;
  end if;

  select * into v_staff_row
  from public.event_staff_tokens
  where token_hash = private.token_hash(v_clean_token)
    and revoked_at is null
    and (expires_at is null or expires_at > now())
  for update;

  if v_staff_row.id is null then
    status := 'invalid_or_expired';
    return next;
    return;
  end if;

  staff_id := v_staff_row.id;
  event_id := v_staff_row.event_id;
  client_id := v_staff_row.client_id;
  label := v_staff_row.label;

  -- 1. Check if currently locked out
  if v_staff_row.pin_locked_until is not null and v_staff_row.pin_locked_until > now() then
    v_locked_mins := greatest(1, ceil(extract(epoch from (v_staff_row.pin_locked_until - now())) / 60)::integer);
    status := 'locked_out';
    minutes_remaining := v_locked_mins;
    attempts_remaining := 0;
    locked_until := v_staff_row.pin_locked_until;
    return next;
    return;
  end if;

  -- 2. Verify PIN if configured on token
  if v_staff_row.pin_hash is not null and v_staff_row.pin_hash <> '' then
    if v_clean_pin = '' or v_staff_row.pin_hash <> extensions.crypt(v_clean_pin, v_staff_row.pin_hash) then
      -- Increment and persist failed attempts without raising exception
      v_staff_row.failed_pin_attempts := v_staff_row.failed_pin_attempts + 1;

      if v_staff_row.failed_pin_attempts >= 3 then
        update public.event_staff_tokens
        set failed_pin_attempts = 3,
            pin_locked_until = now() + interval '15 minutes'
        where id = v_staff_row.id;

        status := 'locked_out';
        minutes_remaining := 15;
        attempts_remaining := 0;
        locked_until := now() + interval '15 minutes';
        return next;
        return;
      else
        update public.event_staff_tokens
        set failed_pin_attempts = v_staff_row.failed_pin_attempts,
            pin_locked_until = null
        where id = v_staff_row.id;

        status := 'incorrect_pin';
        attempts_remaining := greatest(0, 3 - v_staff_row.failed_pin_attempts);
        locked_until := null;
        return next;
        return;
      end if;
    end if;
  end if;

  -- 3. Correct PIN: reset failure tracking and persist
  if v_staff_row.failed_pin_attempts > 0 or v_staff_row.pin_locked_until is not null then
    update public.event_staff_tokens
    set failed_pin_attempts = 0,
        pin_locked_until = null
    where id = v_staff_row.id;
  end if;

  status := 'authorized';
  attempts_remaining := 3;
  minutes_remaining := 0;
  locked_until := null;
  return next;
  return;
end;
$$;

-- Dedicated Staff PIN Verification / Unlock RPC
create or replace function public.verify_staff_pin(p_staff_token text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth record;
  event_row public.events;
begin
  select * into v_auth from private.authorize_staff(p_staff_token, p_pin);

  if v_auth.status = 'invalid_or_expired' then
    return jsonb_build_object('success', false, 'error', 'invalid_or_expired');
  end if;

  if v_auth.status = 'locked_out' then
    return jsonb_build_object(
      'success', false,
      'error', 'locked_out',
      'minutes_remaining', coalesce(v_auth.minutes_remaining, 15),
      'locked_until', v_auth.locked_until
    );
  end if;

  if v_auth.status = 'incorrect_pin' then
    return jsonb_build_object(
      'success', false,
      'error', 'incorrect_pin',
      'attempts_remaining', coalesce(v_auth.attempts_remaining, 0)
    );
  end if;

  select * into event_row from public.events where id = v_auth.event_id;

  return jsonb_build_object(
    'success', true,
    'event_id', event_row.id,
    'event_title', event_row.title,
    'product_id', event_row.product_id,
    'label', v_auth.label
  );
end;
$$;

drop function if exists public.resolve_staff_checkin(text, text);
drop function if exists public.staff_check_in_party_members(text, text, integer);
drop function if exists public.list_staff_guests(text);
drop function if exists public.list_staff_guests(text, text);

create or replace function public.resolve_staff_checkin(
  p_staff_token text,
  p_pin text,
  p_guest_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth record;
  invitation public.personal_invitations;
  guest_row public.event_guests;
  event_row public.events;
  event_state text;
begin
  select * into v_auth from private.authorize_staff(p_staff_token, p_pin);

  if v_auth.status <> 'authorized' then
    return jsonb_build_object('status', 'not_authorized');
  end if;

  if p_guest_token is null or trim(p_guest_token) = '' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into invitation
  from public.personal_invitations
  where token_hash = private.token_hash(p_guest_token)
    and revoked_at is null;

  if invitation.id is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  if invitation.event_id <> v_auth.event_id then
    return jsonb_build_object('status', 'wrong_event');
  end if;

  select * into guest_row
  from public.event_guests
  where id = invitation.guest_id;

  if guest_row.id is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into event_row
  from public.events
  where id = v_auth.event_id;

  event_state := private.checkin_event_state(event_row.id);
  if event_state <> 'active' then
    return jsonb_build_object('status', event_state);
  end if;

  return private.checkin_guest_payload(guest_row, event_row);
end;
$$;

create or replace function public.staff_check_in_party_members(
  p_staff_token text,
  p_pin text,
  p_guest_token text,
  p_arriving_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth record;
  invitation public.personal_invitations;
  guest_row public.event_guests;
  event_row public.events;
  previous_count integer;
  target_count integer;
  activity_action text;
begin
  select * into v_auth from private.authorize_staff(p_staff_token, p_pin);

  if v_auth.status <> 'authorized' then
    return jsonb_build_object('status', 'not_authorized');
  end if;

  if p_arriving_count is null or p_arriving_count <= 0 then
    raise exception 'Arriving count must be positive.' using errcode = '22023';
  end if;

  select * into invitation
  from public.personal_invitations
  where token_hash = private.token_hash(p_guest_token)
    and revoked_at is null;

  if invitation.id is null then
    raise exception 'Invitation was not found.' using errcode = '42501';
  end if;

  if invitation.event_id <> v_auth.event_id then
    raise exception 'Invitation belongs to another Event.' using errcode = '42501';
  end if;

  select * into guest_row
  from public.event_guests
  where id = invitation.guest_id
  for update;

  if guest_row.id is null then
    raise exception 'Guest was not found.' using errcode = '42501';
  end if;

  select * into event_row
  from public.events
  where id = v_auth.event_id;

  if private.checkin_event_state(event_row.id) <> 'active' then
    raise exception 'Check-in is unavailable for this Event.' using errcode = '42501';
  end if;

  if guest_row.rsvp_status <> 'accepted' then
    raise exception 'Only accepted Guests may be checked in.' using errcode = '42501';
  end if;

  target_count := guest_row.checked_in_count + p_arriving_count;
  if target_count > guest_row.confirmed_party_size then
    raise exception 'Checked-in count is outside the confirmed party size.' using errcode = '22023';
  end if;

  if target_count = guest_row.checked_in_count then
    return private.checkin_guest_payload(guest_row, event_row);
  end if;

  previous_count := guest_row.checked_in_count;
  update public.event_guests
  set checked_in_count = target_count,
      first_checked_in_at = coalesce(first_checked_in_at, now()),
      last_checkin_activity_at = now()
  where id = guest_row.id
  returning * into guest_row;

  activity_action := case
    when target_count = guest_row.confirmed_party_size then 'checkin_completed'
    else 'arrival_added'
  end;

  insert into public.event_checkin_activity(event_id, client_id, guest_id, actor_user_id, action, previous_count, new_count)
  values (guest_row.event_id, guest_row.client_id, guest_row.id, null, activity_action, previous_count, guest_row.checked_in_count);

  return private.checkin_guest_payload(guest_row, event_row);
end;
$$;

create or replace function public.list_staff_guests(
  p_staff_token text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth record;
  v_guests jsonb;
begin
  select * into v_auth from private.authorize_staff(p_staff_token, p_pin);

  if v_auth.status <> 'authorized' then
    return jsonb_build_object(
      'status', 'not_authorized',
      'guests', jsonb_build_array()
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'phone', g.phone,
        'allowed_companions', g.allowed_companions,
        'rsvp_status', g.rsvp_status,
        'confirmed_party_size', g.confirmed_party_size,
        'checked_in_count', g.checked_in_count,
        'first_checked_in_at', g.first_checked_in_at
      ) order by g.name
    ),
    jsonb_build_array()
  ) into v_guests
  from public.event_guests g
  where g.event_id = v_auth.event_id;

  return jsonb_build_object(
    'status', 'authorized',
    'guests', v_guests
  );
end;
$$;

revoke all on function public.verify_staff_pin(text, text) from public, anon, authenticated;
grant execute on function public.verify_staff_pin(text, text) to anon, authenticated;

revoke all on function public.resolve_staff_checkin(text, text, text) from public, anon, authenticated;
grant execute on function public.resolve_staff_checkin(text, text, text) to anon, authenticated;

revoke all on function public.staff_check_in_party_members(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.staff_check_in_party_members(text, text, text, integer) to anon, authenticated;

revoke all on function public.list_staff_guests(text, text) from public, anon, authenticated;
grant execute on function public.list_staff_guests(text, text) to anon, authenticated;

-- 2. Execute Verification Assertions
do $$
declare
  v_instance_id uuid;
  v_client_id uuid;
  v_user_id uuid;
  v_event_a uuid;
  v_event_b uuid;
  v_guest_a uuid;
  v_guest_b uuid;
  v_guest_token_a text := 'g_token_alpha_' || encode(gen_random_bytes(12), 'hex');
  v_guest_token_b text := 'g_token_beta_' || encode(gen_random_bytes(12), 'hex');
  v_raw_staff_token_a text := 'st_alpha_' || encode(gen_random_bytes(16), 'hex');
  v_staff_token_id uuid;
  v_pin text := '4829';
  v_pin_hash text;
  v_res jsonb;
  v_caught boolean;
  v_staff_attempts integer;
  v_staff_locked_until timestamptz;
begin
  -- Setup test auth & client
  -- Discover existing non-admin Client first
  select i.user_id, i.client_id into v_user_id, v_client_id
  from public.client_identities i
  where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id)
  order by i.created_at, i.user_id
  limit 1;

  if v_user_id is null or v_client_id is null then
    begin
      select instance_id into v_instance_id from auth.users where instance_id is not null limit 1;
    exception when others then
      v_instance_id := null;
    end;
    v_instance_id := coalesce(v_instance_id, '00000000-0000-0000-0000-000000000000'::uuid);

    v_user_id := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      v_user_id, v_instance_id, 'authenticated', 'authenticated',
      'test-staff-' || v_user_id || '@quickrsvp.test', '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', 'Test Client Host'),
      now(), now()
    );

    select client_id into v_client_id from public.client_identities where user_id = v_user_id;
    if v_client_id is null then
      insert into public.clients (display_name, status)
      values ('Test Client Host', 'active')
      returning id into v_client_id;

      insert into public.client_identities (user_id, client_id)
      values (v_user_id, v_client_id);
    end if;
  end if;

  -- Ensure active product entitlements for the client
  insert into public.client_entitlements (client_id, product_id, status)
  values
    (v_client_id, 'wedding', 'active'),
    (v_client_id, 'party', 'active')
  on conflict (client_id, product_id) do update
  set status = 'active', starts_at = now(), ends_at = null;

  -- Impersonate client host
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_id::text)::text, true);
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  -- Setup active events A and B
  insert into public.events (client_id, title, product_id, lifecycle_status, starts_at)
  values (v_client_id, 'Event A Wedding', 'wedding', 'active', now())
  returning id into v_event_a;

  insert into public.events (client_id, title, product_id, lifecycle_status, starts_at)
  values (v_client_id, 'Event B Party', 'party', 'active', now())
  returning id into v_event_b;

  -- Setup guests
  insert into public.event_guests (event_id, client_id, name, rsvp_status, confirmed_party_size, allowed_companions)
  values (v_event_a, v_client_id, 'Guest Alpha', 'accepted', 3, 2)
  returning id into v_guest_a;

  insert into public.event_guests (event_id, client_id, name, rsvp_status, confirmed_party_size, allowed_companions)
  values (v_event_b, v_client_id, 'Guest Beta', 'accepted', 2, 1)
  returning id into v_guest_b;

  -- Setup personal invitations
  insert into public.personal_invitations (event_id, client_id, guest_id, token_hash)
  values (v_event_a, v_client_id, v_guest_a, private.token_hash(v_guest_token_a));

  insert into public.personal_invitations (event_id, client_id, guest_id, token_hash)
  values (v_event_b, v_client_id, v_guest_b, private.token_hash(v_guest_token_b));

  -- Create staff token for Event A with PIN '4829'
  v_pin_hash := extensions.crypt(v_pin, extensions.gen_salt('bf', 8));
  insert into public.event_staff_tokens (event_id, client_id, label, token_hash, pin_hash)
  values (v_event_a, v_client_id, 'Main Entrance Staff', private.token_hash(v_raw_staff_token_a), v_pin_hash)
  returning id into v_staff_token_id;

  -- Assert initial token state
  select failed_pin_attempts, pin_locked_until into v_staff_attempts, v_staff_locked_until
  from public.event_staff_tokens where id = v_staff_token_id;
  if v_staff_attempts <> 0 or v_staff_locked_until is not null then
    raise exception 'FAIL: Token must initialize with 0 failed attempts and null lockout.';
  end if;

  -- Switch to unauthenticated / anon role to test staff scanner access
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  -- ============================================================================
  -- Assertion 1: Baseline Authorized Access (token + PIN) across all 4 RPCs
  -- ============================================================================
  v_res := public.verify_staff_pin(v_raw_staff_token_a, v_pin);
  if (v_res->>'success')::boolean is not true or v_res->>'event_id' <> v_event_a::text then
    raise exception 'FAIL [Assertion 1]: verify_staff_pin must succeed with correct token and PIN. Got: %', v_res;
  end if;

  v_res := public.resolve_staff_checkin(v_raw_staff_token_a, v_pin, v_guest_token_a);
  if v_res->>'status' = 'not_authorized' or v_res->>'guest_id' is null then
    raise exception 'FAIL [Assertion 1]: resolve_staff_checkin must resolve guest with correct token and PIN. Got: %', v_res;
  end if;

  v_res := public.list_staff_guests(v_raw_staff_token_a, v_pin);
  if v_res->>'status' <> 'authorized' or jsonb_array_length(v_res->'guests') < 1 then
    raise exception 'FAIL [Assertion 1]: list_staff_guests must return authorized with guests. Got: %', v_res;
  end if;

  v_res := public.staff_check_in_party_members(v_raw_staff_token_a, v_pin, v_guest_token_a, 1);
  if (v_res->>'checked_in_count')::integer <> 1 then
    raise exception 'FAIL [Assertion 1]: staff_check_in_party_members must check in guest with correct credentials.';
  end if;

  select failed_pin_attempts, pin_locked_until into v_staff_attempts, v_staff_locked_until
  from public.event_staff_tokens where id = v_staff_token_id;
  if v_staff_attempts <> 0 or v_staff_locked_until is not null then
    raise exception 'FAIL [Assertion 1]: Successful authentication must leave counter at 0.';
  end if;

  -- ============================================================================
  -- Assertion 2: Attack Surface A (verify_staff_pin) wrong PIN persists counter
  -- ============================================================================
  v_res := public.verify_staff_pin(v_raw_staff_token_a, '9991');
  if (v_res->>'success')::boolean is not false or v_res->>'error' <> 'incorrect_pin' then
    raise exception 'FAIL [Assertion 2]: verify_staff_pin must reject wrong PIN. Got: %', v_res;
  end if;

  select failed_pin_attempts, pin_locked_until into v_staff_attempts, v_staff_locked_until
  from public.event_staff_tokens where id = v_staff_token_id;
  if v_staff_attempts <> 1 or v_staff_locked_until is not null then
    raise exception 'FAIL [Assertion 2]: verify_staff_pin must persist failed_pin_attempts=1 in DB. Got: attempts=%, locked=%', v_staff_attempts, v_staff_locked_until;
  end if;

  -- Reset counter back to 0 for independent test B
  update public.event_staff_tokens set failed_pin_attempts = 0 where id = v_staff_token_id;

  -- ============================================================================
  -- Assertion 3: Attack Surface B (resolve_staff_checkin) wrong PIN persists counter
  -- ============================================================================
  v_res := public.resolve_staff_checkin(v_raw_staff_token_a, '9992', v_guest_token_a);
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 3]: resolve_staff_checkin must return not_authorized on wrong PIN. Got: %', v_res;
  end if;

  select failed_pin_attempts, pin_locked_until into v_staff_attempts, v_staff_locked_until
  from public.event_staff_tokens where id = v_staff_token_id;
  if v_staff_attempts <> 1 or v_staff_locked_until is not null then
    raise exception 'FAIL [Assertion 3]: resolve_staff_checkin must persist failed_pin_attempts=1 in DB. Got: attempts=%, locked=%', v_staff_attempts, v_staff_locked_until;
  end if;

  -- Reset counter back to 0 for independent test C
  update public.event_staff_tokens set failed_pin_attempts = 0 where id = v_staff_token_id;

  -- ============================================================================
  -- Assertion 4: Attack Surface C (staff_check_in_party_members) wrong PIN persists counter
  -- ============================================================================
  v_res := public.staff_check_in_party_members(v_raw_staff_token_a, '9993', v_guest_token_a, 1);
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 4]: staff_check_in_party_members must return not_authorized on wrong PIN without raising. Got: %', v_res;
  end if;

  select failed_pin_attempts, pin_locked_until into v_staff_attempts, v_staff_locked_until
  from public.event_staff_tokens where id = v_staff_token_id;
  if v_staff_attempts <> 1 or v_staff_locked_until is not null then
    raise exception 'FAIL [Assertion 4]: staff_check_in_party_members must persist failed_pin_attempts=1 in DB. Got: attempts=%, locked=%', v_staff_attempts, v_staff_locked_until;
  end if;

  -- Reset counter back to 0 for independent test D
  update public.event_staff_tokens set failed_pin_attempts = 0 where id = v_staff_token_id;

  -- ============================================================================
  -- Assertion 5: Attack Surface D (list_staff_guests) wrong PIN persists counter
  -- ============================================================================
  v_res := public.list_staff_guests(v_raw_staff_token_a, '9994');
  if v_res->>'status' <> 'not_authorized' or jsonb_array_length(v_res->'guests') <> 0 then
    raise exception 'FAIL [Assertion 5]: list_staff_guests must return not_authorized on wrong PIN without raising. Got: %', v_res;
  end if;

  select failed_pin_attempts, pin_locked_until into v_staff_attempts, v_staff_locked_until
  from public.event_staff_tokens where id = v_staff_token_id;
  if v_staff_attempts <> 1 or v_staff_locked_until is not null then
    raise exception 'FAIL [Assertion 5]: list_staff_guests must persist failed_pin_attempts=1 in DB. Got: attempts=%, locked=%', v_staff_attempts, v_staff_locked_until;
  end if;

  -- Reset counter back to 0 for cross-RPC evasion test
  update public.event_staff_tokens set failed_pin_attempts = 0 where id = v_staff_token_id;

  -- ============================================================================
  -- Assertion 6: Cross-RPC Global 3-Attempt Lockout Evasion Prevention
  --   Step 1: wrong PIN via resolve_staff_checkin   -> counter 1
  --   Step 2: wrong PIN via list_staff_guests       -> counter 2
  --   Step 3: wrong PIN via staff_check_in          -> counter 3 + pin_locked_until set
  -- ============================================================================
  -- Step 1
  v_res := public.resolve_staff_checkin(v_raw_staff_token_a, '1111', v_guest_token_a);
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 6, Step 1]: resolve_staff_checkin must return not_authorized.';
  end if;
  select failed_pin_attempts, pin_locked_until into v_staff_attempts, v_staff_locked_until
  from public.event_staff_tokens where id = v_staff_token_id;
  if v_staff_attempts <> 1 or v_staff_locked_until is not null then
    raise exception 'FAIL [Assertion 6, Step 1]: counter must be 1 in DB. Got: attempts=%, locked=%', v_staff_attempts, v_staff_locked_until;
  end if;

  -- Step 2
  v_res := public.list_staff_guests(v_raw_staff_token_a, '2222');
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 6, Step 2]: list_staff_guests must return not_authorized.';
  end if;
  select failed_pin_attempts, pin_locked_until into v_staff_attempts, v_staff_locked_until
  from public.event_staff_tokens where id = v_staff_token_id;
  if v_staff_attempts <> 2 or v_staff_locked_until is not null then
    raise exception 'FAIL [Assertion 6, Step 2]: counter must be 2 in DB. Got: attempts=%, locked=%', v_staff_attempts, v_staff_locked_until;
  end if;

  -- Step 3
  v_res := public.staff_check_in_party_members(v_raw_staff_token_a, '3333', v_guest_token_a, 1);
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 6, Step 3]: staff_check_in_party_members must return not_authorized.';
  end if;
  select failed_pin_attempts, pin_locked_until into v_staff_attempts, v_staff_locked_until
  from public.event_staff_tokens where id = v_staff_token_id;
  if v_staff_attempts <> 3 or v_staff_locked_until is null or v_staff_locked_until <= now() then
    raise exception 'FAIL [Assertion 6, Step 3]: counter must be 3 and lockout active in DB. Got: attempts=%, locked=%', v_staff_attempts, v_staff_locked_until;
  end if;

  -- ============================================================================
  -- Assertion 7: Correct PIN Blocked Across All 4 RPCs During Lockout
  -- ============================================================================
  v_res := public.verify_staff_pin(v_raw_staff_token_a, v_pin);
  if (v_res->>'success')::boolean is not false or v_res->>'error' <> 'locked_out' then
    raise exception 'FAIL [Assertion 7]: verify_staff_pin must return locked_out during lockout. Got: %', v_res;
  end if;

  v_res := public.resolve_staff_checkin(v_raw_staff_token_a, v_pin, v_guest_token_a);
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 7]: resolve_staff_checkin during lockout must be not_authorized. Got: %', v_res;
  end if;

  v_res := public.list_staff_guests(v_raw_staff_token_a, v_pin);
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 7]: list_staff_guests during lockout must be not_authorized. Got: %', v_res;
  end if;

  v_res := public.staff_check_in_party_members(v_raw_staff_token_a, v_pin, v_guest_token_a, 1);
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 7]: staff_check_in_party_members during lockout must be not_authorized. Got: %', v_res;
  end if;

  -- Lockout remains active in DB
  select failed_pin_attempts, pin_locked_until into v_staff_attempts, v_staff_locked_until
  from public.event_staff_tokens where id = v_staff_token_id;
  if v_staff_attempts <> 3 or v_staff_locked_until is null or v_staff_locked_until <= now() then
    raise exception 'FAIL [Assertion 7]: Lockout must remain active in DB after correct PIN attempts. Got: attempts=%, locked=%', v_staff_attempts, v_staff_locked_until;
  end if;

  -- ============================================================================
  -- Assertion 8: Lockout Expiry Simulation Resets Failure Tracking in DB
  -- ============================================================================
  update public.event_staff_tokens
  set pin_locked_until = now() - interval '1 second'
  where id = v_staff_token_id;

  v_res := public.verify_staff_pin(v_raw_staff_token_a, v_pin);
  if (v_res->>'success')::boolean is not true then
    raise exception 'FAIL [Assertion 8]: verify_staff_pin must succeed after lockout expiry. Got: %', v_res;
  end if;

  select failed_pin_attempts, pin_locked_until into v_staff_attempts, v_staff_locked_until
  from public.event_staff_tokens where id = v_staff_token_id;
  if v_staff_attempts <> 0 or v_staff_locked_until is not null then
    raise exception 'FAIL [Assertion 8]: Correct PIN after lockout must reset failed_pin_attempts=0 and pin_locked_until=null. Got: attempts=%, locked=%', v_staff_attempts, v_staff_locked_until;
  end if;

  -- ============================================================================
  -- Assertion 9: Post-Authorization Business Logic Validation Still Raises
  -- ============================================================================
  v_caught := false;
  begin
    perform public.staff_check_in_party_members(v_raw_staff_token_a, v_pin, v_guest_token_a, 0);
  exception when sqlstate '22023' then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'FAIL [Assertion 9]: Business validation (invalid arriving count) must raise 22023 when authorized.';
  end if;

  -- Failure counter must remain 0 because auth succeeded
  select failed_pin_attempts into v_staff_attempts
  from public.event_staff_tokens where id = v_staff_token_id;
  if v_staff_attempts <> 0 then
    raise exception 'FAIL [Assertion 9]: Authorized business failure must not increment PIN failure counter. Got: %', v_staff_attempts;
  end if;

  -- ============================================================================
  -- Assertion 10: Revoked Token + Correct PIN Denied Across All RPCs
  -- ============================================================================
  update public.event_staff_tokens set revoked_at = now() where id = v_staff_token_id;

  v_res := public.verify_staff_pin(v_raw_staff_token_a, v_pin);
  if (v_res->>'success')::boolean is not false or v_res->>'error' <> 'invalid_or_expired' then
    raise exception 'FAIL [Assertion 10]: revoked token must return invalid_or_expired. Got: %', v_res;
  end if;

  v_res := public.resolve_staff_checkin(v_raw_staff_token_a, v_pin, v_guest_token_a);
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 10]: revoked token must return not_authorized on resolve.';
  end if;

  v_res := public.list_staff_guests(v_raw_staff_token_a, v_pin);
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 10]: revoked token must return not_authorized on list.';
  end if;

  v_res := public.staff_check_in_party_members(v_raw_staff_token_a, v_pin, v_guest_token_a, 1);
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 10]: revoked token must return not_authorized on check-in.';
  end if;

  update public.event_staff_tokens set revoked_at = null where id = v_staff_token_id;

  -- ============================================================================
  -- Assertion 11: Expired Token + Correct PIN Denied Across All RPCs
  -- ============================================================================
  update public.event_staff_tokens set expires_at = now() - interval '1 hour' where id = v_staff_token_id;

  v_res := public.verify_staff_pin(v_raw_staff_token_a, v_pin);
  if (v_res->>'success')::boolean is not false or v_res->>'error' <> 'invalid_or_expired' then
    raise exception 'FAIL [Assertion 11]: expired token must return invalid_or_expired. Got: %', v_res;
  end if;

  v_res := public.resolve_staff_checkin(v_raw_staff_token_a, v_pin, v_guest_token_a);
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 11]: expired token must return not_authorized on resolve.';
  end if;

  v_res := public.list_staff_guests(v_raw_staff_token_a, v_pin);
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 11]: expired token must return not_authorized on list.';
  end if;

  v_res := public.staff_check_in_party_members(v_raw_staff_token_a, v_pin, v_guest_token_a, 1);
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 11]: expired token must return not_authorized on check-in.';
  end if;

  update public.event_staff_tokens set expires_at = null where id = v_staff_token_id;

  -- ============================================================================
  -- Assertion 12: Cross-Event Isolation
  -- ============================================================================
  v_res := public.resolve_staff_checkin(v_raw_staff_token_a, v_pin, v_guest_token_b);
  if v_res->>'status' <> 'wrong_event' then
    raise exception 'FAIL [Assertion 12]: Staff token A must return wrong_event for guest B. Got: %', v_res;
  end if;

  v_caught := false;
  begin
    perform public.staff_check_in_party_members(v_raw_staff_token_a, v_pin, v_guest_token_b, 1);
  exception when sqlstate '42501' then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'FAIL [Assertion 12]: Staff token A checking in guest B must raise 42501 exception.';
  end if;

  -- ============================================================================
  -- Assertion 13: Raw Token Alone (Null PIN) Denied Across All 4 RPCs
  -- ============================================================================
  v_res := public.resolve_staff_checkin(v_raw_staff_token_a, null, v_guest_token_a);
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 13]: resolve_staff_checkin with null PIN must return not_authorized. Got: %', v_res;
  end if;

  v_res := public.list_staff_guests(v_raw_staff_token_a, null);
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 13]: list_staff_guests with null PIN must return not_authorized. Got: %', v_res;
  end if;

  v_res := public.staff_check_in_party_members(v_raw_staff_token_a, null, v_guest_token_a, 1);
  if v_res->>'status' <> 'not_authorized' then
    raise exception 'FAIL [Assertion 13]: staff_check_in_party_members with null PIN must return not_authorized. Got: %', v_res;
  end if;

  v_res := public.verify_staff_pin(v_raw_staff_token_a, null);
  if (v_res->>'success')::boolean is not false then
    raise exception 'FAIL [Assertion 13]: verify_staff_pin with null PIN must be denied. Got: %', v_res;
  end if;

  raise notice 'SUCCESS: All 13 staff scanner cross-RPC PIN security & persistence assertions passed.';
end;
$$;

rollback;
