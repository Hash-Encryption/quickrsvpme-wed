-- Migration: 20261007000100_invitation_publication_state.sql
-- Status: SQL PENDING — USER APPROVAL REQUIRED (DO NOT EXECUTE AUTOMATICALLY)
-- Purpose:
--   1. Separate Event Lifecycle from Invitation Publication.
--   2. Allow planning Events to have published, accessible guest invitations with RSVP capabilities.
--   3. Add public.publish_event_invitation and public.unpublish_event_invitation RPCs.
--   4. Update private.event_public_state to enforce invitation publication for planning and active events.

begin;

-- 1. Add invitation publication timestamp to events table
alter table public.events
  add column if not exists invitation_published_at timestamptz;

create index if not exists events_invitation_published_idx
  on public.events(id, invitation_published_at);

-- 2. Update private.event_public_state
-- Disentangles Event lifecycle from Invitation publication.
-- An Event in 'planning' state whose invitation is published is accessible to guests and accepts RSVPs.
-- Staff check-in remains strictly bound to lifecycle_status = 'active' via private.checkin_event_state.
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

  -- Archived Wedding replay policy:
  if event_row.lifecycle_status = 'archived' then
    if event_row.product_id <> 'wedding' then return 'unavailable'; end if;
    select configuration into policy from public.product_policies where product_id = event_row.product_id;
    if coalesce((policy ->> 'archive_replay_enabled')::boolean, false) is not true then return 'unavailable'; end if;
    if policy ->> 'archive_replay_days' is null then return 'archived_read_only'; end if;
    if policy ->> 'archive_replay_days' !~ '^\d{1,6}$' then return 'unavailable'; end if;
    replay_days := (policy ->> 'archive_replay_days')::integer;
    if event_row.archived_at + make_interval(days => replay_days) > now() then return 'archived_read_only'; end if;
    return 'unavailable';
  end if;

  -- For planning or active events: invitation must be published
  if event_row.lifecycle_status in ('planning', 'active') then
    if event_row.invitation_published_at is null then
      return 'unavailable';
    end if;
    if not private.has_product_access(event_row.client_id, event_row.product_id) then
      return 'subscription_unavailable';
    end if;
    return 'active';
  end if;

  return 'unavailable';
exception when invalid_text_representation then
  return 'unavailable';
end;
$$;

-- 3. Authoritative Host RPC to publish an Event Invitation
create or replace function public.publish_event_invitation(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_client_id uuid := public.current_client_id();
  event_row public.events;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into event_row from public.events where id = p_event_id and deleted_at is null;
  if event_row.id is null then
    raise exception 'Event was not found.' using errcode = '42501';
  end if;

  if event_row.client_id <> caller_client_id and not public.is_platform_admin() then
    raise exception 'Unauthorized event update.' using errcode = '42501';
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
create or replace function public.unpublish_event_invitation(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_client_id uuid := public.current_client_id();
  event_row public.events;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into event_row from public.events where id = p_event_id and deleted_at is null;
  if event_row.id is null then
    raise exception 'Event was not found.' using errcode = '42501';
  end if;

  if event_row.client_id <> caller_client_id and not public.is_platform_admin() then
    raise exception 'Unauthorized event update.' using errcode = '42501';
  end if;

  update public.events
  set invitation_published_at = null
  where id = p_event_id
  returning * into event_row;

  return event_row;
end;
$$;

-- 5. Revoke and Grant Permissions
revoke all on function public.publish_event_invitation(uuid) from public, anon, authenticated;
revoke all on function public.unpublish_event_invitation(uuid) from public, anon, authenticated;

grant execute on function public.publish_event_invitation(uuid) to authenticated;
grant execute on function public.unpublish_event_invitation(uuid) to authenticated;

commit;
