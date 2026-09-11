-- ==============================================================================
-- QuickRSVP Verification Script: Event Staff PIN Support & Lockout Policy
-- Description: Self-contained transactional verification of server-side PIN
--              verification, 3-attempt failure policy, 15-minute lockout,
--              and event metadata unlocking.
-- Test: supabase/tests/event_staff_pin_support_verification.sql
-- Status: Transactional verifier — all mutations roll back automatically.
-- ==============================================================================

begin;

-- 1. Apply Schema Changes Transactionally For Testing
alter table public.event_staff_tokens
  add column if not exists pin_hash text default null,
  add column if not exists failed_pin_attempts integer not null default 0,
  add column if not exists pin_locked_until timestamptz default null;

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

create or replace function public.verify_staff_pin(p_staff_token text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff_row public.event_staff_tokens;
  event_row public.events;
  v_clean_token text := trim(coalesce(p_staff_token, ''));
  v_clean_pin text := trim(coalesce(p_pin, ''));
  v_locked_remaining integer;
begin
  if v_clean_token = '' then
    return jsonb_build_object('success', false, 'error', 'invalid_token');
  end if;

  select * into staff_row
  from public.event_staff_tokens
  where token_hash = private.token_hash(v_clean_token)
    and revoked_at is null
    and (expires_at is null or expires_at > now())
  for update;

  if staff_row.id is null then
    return jsonb_build_object('success', false, 'error', 'invalid_or_expired');
  end if;

  if staff_row.pin_locked_until is not null and staff_row.pin_locked_until > now() then
    v_locked_remaining := greatest(1, ceil(extract(epoch from (staff_row.pin_locked_until - now())) / 60)::integer);
    return jsonb_build_object(
      'success', false,
      'error', 'locked_out',
      'locked_until', staff_row.pin_locked_until,
      'minutes_remaining', v_locked_remaining
    );
  end if;

  if staff_row.pin_hash is null or staff_row.pin_hash = '' then
    select * into event_row from public.events where id = staff_row.event_id;
    return jsonb_build_object(
      'success', true,
      'event_id', event_row.id,
      'event_title', event_row.title,
      'product_id', event_row.product_id,
      'label', staff_row.label
    );
  end if;

  if v_clean_pin <> '' and staff_row.pin_hash = extensions.crypt(v_clean_pin, staff_row.pin_hash) then
    update public.event_staff_tokens
    set failed_pin_attempts = 0,
        pin_locked_until = null
    where id = staff_row.id;

    select * into event_row from public.events where id = staff_row.event_id;

    return jsonb_build_object(
      'success', true,
      'event_id', event_row.id,
      'event_title', event_row.title,
      'product_id', event_row.product_id,
      'label', staff_row.label
    );
  end if;

  staff_row.failed_pin_attempts := staff_row.failed_pin_attempts + 1;

  if staff_row.failed_pin_attempts >= 3 then
    update public.event_staff_tokens
    set failed_pin_attempts = staff_row.failed_pin_attempts,
        pin_locked_until = now() + interval '15 minutes'
    where id = staff_row.id;

    return jsonb_build_object(
      'success', false,
      'error', 'locked_out',
      'locked_until', now() + interval '15 minutes',
      'minutes_remaining', 15
    );
  else
    update public.event_staff_tokens
    set failed_pin_attempts = staff_row.failed_pin_attempts
    where id = staff_row.id;

    return jsonb_build_object(
      'success', false,
      'error', 'incorrect_pin',
      'attempts_remaining', (3 - staff_row.failed_pin_attempts)
    );
  end if;
end;
$$;

revoke all on function public.verify_staff_pin(text, text) from public, anon, authenticated;
grant execute on function public.verify_staff_pin(text, text) to anon, authenticated;

-- 2. Test Scenarios Execution
do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_event public.events;
  v_token_res jsonb;
  v_raw_token text;
  v_verify_res jsonb;
begin
  -- Setup test host identity
  insert into public.clients (display_name, status)
  values ('PIN Verifier Test Client', 'active')
  returning id into v_client_id;

  insert into public.client_identities (user_id, client_id)
  values (v_user_id, v_client_id);

  insert into public.client_entitlements (client_id, product_id, status)
  values (v_client_id, 'wedding', 'active');

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  set local role authenticated;

  -- Create event
  v_event := public.create_event('wedding', 'PIN Security Test Wedding', 'ar', now(), now() + interval '1 day');
  update public.events set lifecycle_status = 'active' where id = v_event.id;

  -- Create staff token with PIN "4829"
  v_token_res := public.create_event_staff_token(v_event.id, 'Main Gate PIN Test', null, '4829');
  v_raw_token := v_token_res ->> 'token';

  -- Switch to anon door staff context
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);

  -- 1. Attempt 1: Wrong PIN
  v_verify_res := public.verify_staff_pin(v_raw_token, '0000');
  if (v_verify_res ->> 'success')::boolean <> false or v_verify_res ->> 'error' <> 'incorrect_pin' or (v_verify_res ->> 'attempts_remaining')::integer <> 2 then
    raise exception 'FAIL [PIN Test 1]: Attempt 1 did not register failure properly. Got: %', v_verify_res;
  end if;

  -- 2. Attempt 2: Wrong PIN
  v_verify_res := public.verify_staff_pin(v_raw_token, '1111');
  if (v_verify_res ->> 'success')::boolean <> false or v_verify_res ->> 'error' <> 'incorrect_pin' or (v_verify_res ->> 'attempts_remaining')::integer <> 1 then
    raise exception 'FAIL [PIN Test 2]: Attempt 2 did not decrement remaining properly. Got: %', v_verify_res;
  end if;

  -- 3. Attempt 3: Wrong PIN -> Lockout
  v_verify_res := public.verify_staff_pin(v_raw_token, '2222');
  if (v_verify_res ->> 'success')::boolean <> false or v_verify_res ->> 'error' <> 'locked_out' or (v_verify_res ->> 'minutes_remaining')::integer <> 15 then
    raise exception 'FAIL [PIN Test 3]: Attempt 3 did not trigger 15-minute lockout. Got: %', v_verify_res;
  end if;

  -- 4. Attempt 4: Even correct PIN rejected while locked out
  v_verify_res := public.verify_staff_pin(v_raw_token, '4829');
  if (v_verify_res ->> 'success')::boolean <> false or v_verify_res ->> 'error' <> 'locked_out' then
    raise exception 'FAIL [PIN Test 4]: Correct PIN should be rejected during active lockout. Got: %', v_verify_res;
  end if;

  -- 5. Test Lockout Expiry / Reset
  update public.event_staff_tokens
  set pin_locked_until = now() - interval '1 second'
  where token_hash = private.token_hash(v_raw_token);

  -- 6. Attempt with Correct PIN after lockout period
  v_verify_res := public.verify_staff_pin(v_raw_token, '4829');
  if (v_verify_res ->> 'success')::boolean <> true or v_verify_res ->> 'event_title' <> 'PIN Security Test Wedding' then
    raise exception 'FAIL [PIN Test 5]: Correct PIN failed after lockout expiration. Got: %', v_verify_res;
  end if;

  raise notice 'PASS: All Event Staff PIN verification and lockout tests passed.';
end;
$$;

rollback;
