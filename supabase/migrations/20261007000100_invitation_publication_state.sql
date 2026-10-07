-- ==============================================================================
-- QuickRSVP Forward-Only Migration: Invitation Publication State
-- Description: Disentangles Event lifecycle from Invitation publication.
--              Allows planning Events to publish invitations and receive RSVPs
--              while keeping scanner/check-in bound to active lifecycle.
--              Implements client-owned publish/unpublish RPCs and updates
--              private.event_public_state preserving all product access and
--              archive replay rules.
-- Migration: 20261007000100_invitation_publication_state.sql
-- Status: PREPARED FORWARD-ONLY — DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL
-- ==============================================================================

begin;

-- 1. Add invitation publication timestamp to events table
alter table public.events
  add column if not exists invitation_published_at timestamptz;

create index if not exists events_invitation_published_idx
  on public.events(id, invitation_published_at);

-- 2. Update private.event_public_state
-- Preserves ALL existing business rules:
-- - deleted -> 'unavailable'
-- - cancelled -> 'cancelled'
-- - ended -> 'ended'
-- - planning + unpublished -> 'planning'
-- - planning + published -> requires has_product_access:
--     if entitled -> 'active'
--     else -> 'subscription_unavailable'
-- - active + published -> requires has_product_access:
--     if entitled -> 'active'
--     else -> 'subscription_unavailable'
-- - active + unpublished -> 'unpublished'
-- - archived Wedding -> obeys archive_replay_enabled & archive_replay_days
-- - archived Party / non-Wedding -> 'unavailable'
-- - invalid archive policy -> 'unavailable'
create or replace function private.event_public_state(p_event_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  event_row public.events;
  policy jsonb;
  replay_days integer;
begin
  select * into event_row from public.events where id = p_event_id;
  if event_row.id is null or event_row.deleted_at is not null then return 'unavailable'; end if;
  if event_row.lifecycle_status = 'cancelled' then return 'cancelled'; end if;
  if event_row.lifecycle_status = 'ended' then return 'ended'; end if;

  if event_row.lifecycle_status = 'planning' then
    if event_row.invitation_published_at is not null then
      if private.has_product_access(event_row.client_id, event_row.product_id) then
        return 'active';
      end if;
      return 'subscription_unavailable';
    end if;
    return 'planning';
  end if;

  if event_row.lifecycle_status = 'active' then
    if event_row.invitation_published_at is null then
      return 'unpublished';
    end if;
    if private.has_product_access(event_row.client_id, event_row.product_id) then
      return 'active';
    end if;
    return 'subscription_unavailable';
  end if;

  if event_row.lifecycle_status <> 'archived' or event_row.product_id <> 'wedding' then return 'unavailable'; end if;
  select configuration into policy from public.product_policies where product_id = event_row.product_id;
  if coalesce((policy ->> 'archive_replay_enabled')::boolean, false) is not true then return 'unavailable'; end if;
  if policy ->> 'archive_replay_days' is null then return 'archived_read_only'; end if;
  if policy ->> 'archive_replay_days' !~ '^\d{1,6}$' then return 'unavailable'; end if;
  replay_days := (policy ->> 'archive_replay_days')::integer;
  if event_row.archived_at + make_interval(days => replay_days) > now() then return 'archived_read_only'; end if;
  return 'unavailable';
exception when invalid_text_representation then
  return 'unavailable';
end;
$$;

-- 3. Authoritative Host RPC to publish an Event Invitation
-- Relies on public.current_client_id() ownership
create or replace function public.publish_event_invitation(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_client_id uuid := public.current_client_id();
  is_admin boolean := public.is_platform_admin();
  event_row public.events;
begin
  if auth.uid() is null or (caller_client_id is null and not is_admin) then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into event_row
  from public.events
  where id = p_event_id
    and (client_id = caller_client_id or is_admin)
    and deleted_at is null;

  if event_row.id is null then
    raise exception 'Event was not found.' using errcode = '42501';
  end if;

  if event_row.lifecycle_status in ('cancelled', 'ended', 'archived') then
    raise exception 'Cannot publish an invitation for a closed event.' using errcode = '22023';
  end if;

  if not private.has_product_access(event_row.client_id, event_row.product_id) then
    raise exception 'Subscription or entitlement required.' using errcode = '42501';
  end if;

  update public.events
  set invitation_published_at = coalesce(invitation_published_at, now())
  where id = p_event_id
  returning * into event_row;

  return event_row;
end;
$$;

-- 4. Authoritative Host RPC to unpublish an Event Invitation
-- Relies on public.current_client_id() ownership
create or replace function public.unpublish_event_invitation(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_client_id uuid := public.current_client_id();
  is_admin boolean := public.is_platform_admin();
  event_row public.events;
begin
  if auth.uid() is null or (caller_client_id is null and not is_admin) then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into event_row
  from public.events
  where id = p_event_id
    and (client_id = caller_client_id or is_admin)
    and deleted_at is null;

  if event_row.id is null then
    raise exception 'Event was not found.' using errcode = '42501';
  end if;

  update public.events
  set invitation_published_at = null
  where id = p_event_id
  returning * into event_row;

  return event_row;
end;
$$;

-- 5. Revoke and Grant Permissions
revoke all on function private.event_public_state(uuid) from public, anon, authenticated;
revoke all on function public.publish_event_invitation(uuid) from public, anon, authenticated;
revoke all on function public.unpublish_event_invitation(uuid) from public, anon, authenticated;

grant execute on function public.publish_event_invitation(uuid) to authenticated;
grant execute on function public.unpublish_event_invitation(uuid) to authenticated;

commit;
