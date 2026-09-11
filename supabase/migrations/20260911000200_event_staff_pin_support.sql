-- ==============================================================================
-- QuickRSVP Forward-Only Migration: Event Staff PIN Support & Lockout Policy
-- Description: Adds server-verified PIN support, 3-attempt lockout tracking,
--              and verify_staff_pin RPC for staff scanner access.
-- Migration: 20260911000200_event_staff_pin_support.sql
-- Status: PREPARED FORWARD-ONLY — DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL
-- ==============================================================================

alter table public.event_staff_tokens
  add column if not exists pin_hash text default null,
  add column if not exists failed_pin_attempts integer not null default 0,
  add column if not exists pin_locked_until timestamptz default null;

-- Update create_event_staff_token to support optional PIN
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
-- Dedicated Staff PIN Verification / Unlock RPC
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
    -- Do not leak whether token exists or is expired
    return jsonb_build_object('success', false, 'error', 'invalid_or_expired');
  end if;

  -- Check if currently locked out
  if staff_row.pin_locked_until is not null and staff_row.pin_locked_until > now() then
    v_locked_remaining := greatest(1, ceil(extract(epoch from (staff_row.pin_locked_until - now())) / 60)::integer);
    return jsonb_build_object(
      'success', false,
      'error', 'locked_out',
      'locked_until', staff_row.pin_locked_until,
      'minutes_remaining', v_locked_remaining
    );
  end if;

  -- If token has no PIN required
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

  -- Validate PIN using crypt
  if v_clean_pin <> '' and staff_row.pin_hash = extensions.crypt(v_clean_pin, staff_row.pin_hash) then
    -- Correct PIN: reset failure tracking
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

  -- Incorrect PIN: increment failure attempts
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
