-- ==============================================================================
-- QuickRSVP Forward-Only Migration: Event Staff Scanner Access
-- Description: Establishes event-scoped staff credentials and database-level
--              authorization for event-day door scanning and check-in without
--              granting broader host/client privileges.
-- Migration: 20260911000100_event_staff_scanner_access.sql
-- Status: PREPARED FORWARD-ONLY — DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL
-- ==============================================================================

create table if not exists public.event_staff_tokens (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  label text not null default 'Door Staff',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz default null,
  expires_at timestamptz default null
);

create index if not exists idx_event_staff_tokens_hash
  on public.event_staff_tokens(token_hash)
  where revoked_at is null;

create index if not exists idx_event_staff_tokens_event
  on public.event_staff_tokens(event_id, revoked_at);

alter table public.event_staff_tokens enable row level security;

-- Client hosts can view and revoke their own event staff tokens
create policy event_staff_tokens_client_access on public.event_staff_tokens
  for all
  to authenticated
  using (client_id = public.current_client_id() or public.is_platform_admin())
  with check (client_id = public.current_client_id() or public.is_platform_admin());

-- ------------------------------------------------------------------------------
-- 1. Staff Check-in Token Resolution
-- ------------------------------------------------------------------------------
create or replace function public.resolve_staff_checkin(p_staff_token text, p_guest_token text)
returns jsonb
language plpgsql
stable
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
  if p_staff_token is null or trim(p_staff_token) = '' then
    return jsonb_build_object('status', 'not_authorized');
  end if;

  select * into staff_row
  from public.event_staff_tokens
  where token_hash = private.token_hash(p_staff_token)
    and revoked_at is null
    and (expires_at is null or expires_at > now());

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
-- 2. Staff Arrival Check-in
-- ------------------------------------------------------------------------------
create or replace function public.staff_check_in_party_members(p_staff_token text, p_guest_token text, p_arriving_count integer)
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
  if p_staff_token is null or trim(p_staff_token) = '' then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into staff_row
  from public.event_staff_tokens
  where token_hash = private.token_hash(p_staff_token)
    and revoked_at is null
    and (expires_at is null or expires_at > now());

  if staff_row.id is null then
    raise exception 'Staff token is invalid or expired.' using errcode = '42501';
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
-- 3. Staff Guest List (Door Lookup Scoped to Event)
-- ------------------------------------------------------------------------------
create or replace function public.list_staff_guests(p_staff_token text)
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
  if p_staff_token is null or trim(p_staff_token) = '' then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into staff_row
  from public.event_staff_tokens
  where token_hash = private.token_hash(p_staff_token)
    and revoked_at is null
    and (expires_at is null or expires_at > now());

  if staff_row.id is null then
    raise exception 'Staff token is invalid or expired.' using errcode = '42501';
  end if;

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
-- 4. Host Staff Token Management
-- ------------------------------------------------------------------------------
create or replace function public.create_event_staff_token(p_event_id uuid, p_label text default 'Door Staff', p_expires_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events;
  raw_token text;
  token_id uuid;
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

  insert into public.event_staff_tokens(event_id, client_id, label, token_hash, expires_at)
  values (event_row.id, event_row.client_id, coalesce(nullif(trim(p_label), ''), 'Door Staff'), private.token_hash(raw_token), p_expires_at)
  returning id into token_id;

  return jsonb_build_object(
    'id', token_id,
    'token', raw_token,
    'event_id', event_row.id,
    'label', coalesce(nullif(trim(p_label), ''), 'Door Staff'),
    'created_at', now()
  );
end;
$$;

create or replace function public.revoke_event_staff_token(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_client_id() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  update public.event_staff_tokens
  set revoked_at = now()
  where id = p_token_id
    and (client_id = public.current_client_id() or public.is_platform_admin())
    and revoked_at is null;
end;
$$;

revoke all on function public.resolve_staff_checkin(text, text) from public, anon, authenticated;
revoke all on function public.staff_check_in_party_members(text, text, integer) from public, anon, authenticated;
revoke all on function public.list_staff_guests(text) from public, anon, authenticated;
revoke all on function public.create_event_staff_token(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.revoke_event_staff_token(uuid) from public, anon, authenticated;

grant execute on function public.resolve_staff_checkin(text, text) to anon, authenticated;
grant execute on function public.staff_check_in_party_members(text, text, integer) to anon, authenticated;
grant execute on function public.list_staff_guests(text) to anon, authenticated;
grant execute on function public.create_event_staff_token(uuid, text, timestamptz) to authenticated;
grant execute on function public.revoke_event_staff_token(uuid) to authenticated;
