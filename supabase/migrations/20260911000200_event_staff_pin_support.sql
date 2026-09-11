-- ==============================================================================
-- QuickRSVP Forward-Only Migration: Event Staff PIN Support & Two-Factor RPCs
-- Description: Adds server-verified PIN support, 3-attempt lockout tracking,
--              centralized private.authorize_staff helper returning structured
--              status, and mandates BOTH secret staff token + PIN credentials
--              on all staff scanner RPCs.
-- Migration: 20260911000200_event_staff_pin_support.sql
-- Status: PREPARED FORWARD-ONLY — DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL
-- ==============================================================================

alter table public.event_staff_tokens
  add column if not exists pin_hash text default null,
  add column if not exists failed_pin_attempts integer not null default 0,
  add column if not exists pin_locked_until timestamptz default null;

-- ------------------------------------------------------------------------------
-- 1. Create Event Staff Token (Host Management)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 2. Centralized Staff Authorization Helper (Non-Raising Structured Status)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 3. Dedicated Staff PIN Verification / Unlock RPC
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 4. Drop Old Single-Credential Staff Scanner RPCs (Prevent PIN Bypass)
-- ------------------------------------------------------------------------------
drop function if exists public.resolve_staff_checkin(text, text);
drop function if exists public.staff_check_in_party_members(text, text, integer);
drop function if exists public.list_staff_guests(text);
drop function if exists public.list_staff_guests(text, text);

-- ------------------------------------------------------------------------------
-- 5. Staff Check-in Token Resolution (Requires Token + PIN)
-- ------------------------------------------------------------------------------
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
  where id = invitation.guest_id
    and deleted_at is null;

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

-- ------------------------------------------------------------------------------
-- 6. Staff Arrival Check-in (Requires Token + PIN)
-- ------------------------------------------------------------------------------
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
    and deleted_at is null
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

-- ------------------------------------------------------------------------------
-- 7. Staff Guest List (Requires Token + PIN)
-- ------------------------------------------------------------------------------
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
  where g.event_id = v_auth.event_id
    and g.deleted_at is null;

  return jsonb_build_object(
    'status', 'authorized',
    'guests', v_guests
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 8. Permissions
-- ------------------------------------------------------------------------------
revoke all on function public.verify_staff_pin(text, text) from public, anon, authenticated;
grant execute on function public.verify_staff_pin(text, text) to anon, authenticated;

revoke all on function public.resolve_staff_checkin(text, text, text) from public, anon, authenticated;
grant execute on function public.resolve_staff_checkin(text, text, text) to anon, authenticated;

revoke all on function public.staff_check_in_party_members(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.staff_check_in_party_members(text, text, text, integer) to anon, authenticated;

revoke all on function public.list_staff_guests(text, text) from public, anon, authenticated;
grant execute on function public.list_staff_guests(text, text) to anon, authenticated;
