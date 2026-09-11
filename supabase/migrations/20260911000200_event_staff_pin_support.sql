-- ==============================================================================
-- QuickRSVP Forward-Only Migration: Event Staff PIN Support & Two-Factor RPCs
-- Description: Adds server-verified PIN support, 3-attempt lockout tracking,
--              centralized private.authorize_staff helper, and mandates BOTH
--              secret staff token + PIN credentials on all staff scanner RPCs.
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
-- 2. Centralized Staff Authorization Helper
-- ------------------------------------------------------------------------------
create or replace function private.authorize_staff(p_staff_token text, p_pin text)
returns public.event_staff_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff_row public.event_staff_tokens;
  v_clean_token text := trim(coalesce(p_staff_token, ''));
  v_clean_pin text := trim(coalesce(p_pin, ''));
begin
  if v_clean_token = '' then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into staff_row
  from public.event_staff_tokens
  where token_hash = private.token_hash(v_clean_token)
    and revoked_at is null
    and (expires_at is null or expires_at > now())
  for update;

  if staff_row.id is null then
    raise exception 'Staff token is invalid or expired.' using errcode = '42501';
  end if;

  -- Check lockout
  if staff_row.pin_locked_until is not null and staff_row.pin_locked_until > now() then
    raise exception 'Staff access is temporarily locked due to failed attempts.' using errcode = '42501';
  end if;

  -- Verify PIN if configured
  if staff_row.pin_hash is not null and staff_row.pin_hash <> '' then
    if v_clean_pin = '' or staff_row.pin_hash <> extensions.crypt(v_clean_pin, staff_row.pin_hash) then
      staff_row.failed_pin_attempts := staff_row.failed_pin_attempts + 1;
      if staff_row.failed_pin_attempts >= 3 then
        update public.event_staff_tokens
        set failed_pin_attempts = staff_row.failed_pin_attempts,
            pin_locked_until = now() + interval '15 minutes'
        where id = staff_row.id;
        raise exception 'Staff access is temporarily locked due to failed attempts.' using errcode = '42501';
      else
        update public.event_staff_tokens
        set failed_pin_attempts = staff_row.failed_pin_attempts
        where id = staff_row.id;
        raise exception 'Incorrect staff PIN.' using errcode = '42501';
      end if;
    end if;
  end if;

  -- Reset failure count on valid credentials
  if staff_row.failed_pin_attempts > 0 or staff_row.pin_locked_until is not null then
    update public.event_staff_tokens
    set failed_pin_attempts = 0,
        pin_locked_until = null
    where id = staff_row.id;
  end if;

  return staff_row;
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
  staff_row public.event_staff_tokens;
  event_row public.events;
  v_locked_remaining integer;
begin
  if p_staff_token is null or trim(p_staff_token) = '' then
    return jsonb_build_object('success', false, 'error', 'invalid_token');
  end if;

  select * into staff_row
  from public.event_staff_tokens
  where token_hash = private.token_hash(trim(p_staff_token))
    and revoked_at is null
    and (expires_at is null or expires_at > now());

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

  begin
    staff_row := private.authorize_staff(p_staff_token, p_pin);
  exception
    when others then
      select * into staff_row
      from public.event_staff_tokens
      where id = staff_row.id;

      if staff_row.pin_locked_until is not null and staff_row.pin_locked_until > now() then
        return jsonb_build_object(
          'success', false,
          'error', 'locked_out',
          'minutes_remaining', 15
        );
      else
        return jsonb_build_object(
          'success', false,
          'error', 'incorrect_pin',
          'attempts_remaining', greatest(0, 3 - staff_row.failed_pin_attempts)
        );
      end if;
  end;

  select * into event_row from public.events where id = staff_row.event_id;

  return jsonb_build_object(
    'success', true,
    'event_id', event_row.id,
    'event_title', event_row.title,
    'product_id', event_row.product_id,
    'label', staff_row.label
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. Drop Old Single-Credential Staff Scanner RPCs (Prevent PIN Bypass)
-- ------------------------------------------------------------------------------
drop function if exists public.resolve_staff_checkin(text, text);
drop function if exists public.staff_check_in_party_members(text, text, integer);
drop function if exists public.list_staff_guests(text);

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
  staff_row public.event_staff_tokens;
  invitation public.personal_invitations;
  guest_row public.event_guests;
  event_row public.events;
  event_state text;
begin
  begin
    staff_row := private.authorize_staff(p_staff_token, p_pin);
  exception
    when others then
      return jsonb_build_object('status', 'not_authorized');
  end;

  if staff_row.id is null then
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

  if invitation.event_id <> staff_row.event_id then
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
  where id = staff_row.event_id;

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
  staff_row public.event_staff_tokens;
  invitation public.personal_invitations;
  guest_row public.event_guests;
  event_row public.events;
  previous_count integer;
  target_count integer;
  activity_action text;
begin
  staff_row := private.authorize_staff(p_staff_token, p_pin);

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

  if invitation.event_id <> staff_row.event_id then
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
  where id = staff_row.event_id;

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
returns table (
  id uuid,
  name text,
  phone text,
  allowed_companions integer,
  rsvp_status text,
  confirmed_party_size integer,
  checked_in_count integer,
  first_checked_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  staff_row public.event_staff_tokens;
begin
  staff_row := private.authorize_staff(p_staff_token, p_pin);

  return query
  select
    g.id,
    g.name,
    g.phone,
    g.allowed_companions,
    g.rsvp_status,
    g.confirmed_party_size,
    g.checked_in_count,
    g.first_checked_in_at
  from public.event_guests g
  where g.event_id = staff_row.event_id
    and g.deleted_at is null
  order by g.name;
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
