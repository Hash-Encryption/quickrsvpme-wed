begin;

alter table public.event_guests
  add column checked_in_count integer not null default 0,
  add column first_checked_in_at timestamptz,
  add column last_checkin_activity_at timestamptz,
  add constraint event_guests_checked_in_count_bounds
    check (checked_in_count between 0 and confirmed_party_size);

create table public.event_checkin_activity (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  guest_id uuid not null references public.event_guests(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('arrival_added', 'checkin_completed', 'checkin_corrected')),
  previous_count integer not null check (previous_count >= 0),
  new_count integer not null check (new_count >= 0),
  created_at timestamptz not null default now(),
  check (previous_count <> new_count)
);

create table public.entitlement_admin_activity (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.client_entitlements(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  product_id text not null references public.products(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  previous_status text check (previous_status is null or previous_status in ('active', 'suspended', 'cancelled', 'expired')),
  new_status text not null check (new_status in ('active', 'suspended', 'cancelled', 'expired')),
  previous_ends_at timestamptz,
  new_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create index event_guests_event_checkin_idx on public.event_guests(event_id, checked_in_count);
create index event_checkin_activity_event_created_idx on public.event_checkin_activity(event_id, created_at desc);
create index entitlement_admin_activity_client_created_idx on public.entitlement_admin_activity(client_id, created_at desc);

create function private.checkin_event_state(p_event_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare event_row public.events;
begin
  select * into event_row from public.events where id = p_event_id;
  if event_row.id is null then return 'invalid'; end if;
  if event_row.deleted_at is not null then return 'soft_deleted'; end if;
  if event_row.lifecycle_status <> 'active' then return event_row.lifecycle_status; end if;
  if not private.has_product_access(event_row.client_id, event_row.product_id) then return 'subscription_unavailable'; end if;
  return 'active';
end;
$$;

create function private.checkin_guest_payload(p_guest public.event_guests, p_event public.events)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'status', case
      when p_guest.checked_in_count = 0 then 'not_arrived'
      when p_guest.checked_in_count = p_guest.confirmed_party_size and p_guest.confirmed_party_size > 0 then 'complete'
      else 'partial'
    end,
    'guest_id', p_guest.id,
    'guest_name', p_guest.name,
    'event_id', p_event.id,
    'event_title', p_event.title,
    'product_id', p_event.product_id,
    'rsvp_status', p_guest.rsvp_status,
    'confirmed_party_size', p_guest.confirmed_party_size,
    'allowed_companions', p_guest.allowed_companions,
    'companion_names', p_guest.companion_names,
    'checked_in_count', p_guest.checked_in_count,
    'remaining_expected', greatest(p_guest.confirmed_party_size - p_guest.checked_in_count, 0),
    'first_checked_in_at', p_guest.first_checked_in_at,
    'last_checkin_activity_at', p_guest.last_checkin_activity_at
  )
$$;

create function private.apply_guest_checkin(p_guest_id uuid, p_new_count integer, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  guest_row public.event_guests;
  event_row public.events;
  previous_count integer;
  target_count integer;
  activity_action text;
begin
  if auth.uid() is null or public.current_client_id() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_kind not in ('arrival', 'correction') then
    raise exception 'Check-in operation is invalid.' using errcode = '22023';
  end if;

  select * into guest_row from public.event_guests where id = p_guest_id for update;
  if guest_row.id is null or guest_row.client_id <> public.current_client_id() then
    raise exception 'Guest was not found for this Client.' using errcode = '42501';
  end if;
  select * into event_row from public.events where id = guest_row.event_id;
  if private.checkin_event_state(event_row.id) <> 'active' then
    raise exception 'Check-in is unavailable for this Event.' using errcode = '42501';
  end if;
  if guest_row.rsvp_status <> 'accepted' then
    raise exception 'Only accepted Guests may be checked in.' using errcode = '42501';
  end if;
  target_count := case when p_kind = 'arrival' then guest_row.checked_in_count + p_new_count else p_new_count end;
  if p_new_count is null or (p_kind = 'arrival' and p_new_count <= 0)
    or target_count < 0 or target_count > guest_row.confirmed_party_size
  then
    raise exception 'Checked-in count is outside the confirmed party size.' using errcode = '22023';
  end if;
  if target_count = guest_row.checked_in_count then
    return private.checkin_guest_payload(guest_row, event_row);
  end if;

  previous_count := guest_row.checked_in_count;
  update public.event_guests
  set checked_in_count = target_count,
      first_checked_in_at = case when target_count > 0 then coalesce(first_checked_in_at, now()) else first_checked_in_at end,
      last_checkin_activity_at = now()
  where id = guest_row.id
  returning * into guest_row;

  activity_action := case
    when p_kind = 'correction' then 'checkin_corrected'
    when target_count = guest_row.confirmed_party_size then 'checkin_completed'
    else 'arrival_added'
  end;
  insert into public.event_checkin_activity(event_id, client_id, guest_id, actor_user_id, action, previous_count, new_count)
  values (guest_row.event_id, guest_row.client_id, guest_row.id, auth.uid(), activity_action, previous_count, guest_row.checked_in_count);

  return private.checkin_guest_payload(guest_row, event_row);
end;
$$;

create function public.resolve_checkin(p_token text, p_event_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  invitation public.personal_invitations;
  guest_row public.event_guests;
  event_row public.events;
  event_state text;
begin
  if auth.uid() is null or public.current_client_id() is null then return jsonb_build_object('status', 'not_authorized'); end if;
  select * into invitation from public.personal_invitations where token_hash = private.token_hash(p_token) and revoked_at is null;
  if invitation.id is null then return jsonb_build_object('status', 'invalid'); end if;
  if invitation.client_id <> public.current_client_id() then return jsonb_build_object('status', 'not_authorized'); end if;
  if p_event_id is not null and invitation.event_id <> p_event_id then return jsonb_build_object('status', 'wrong_event'); end if;
  select * into guest_row from public.event_guests where id = invitation.guest_id;
  select * into event_row from public.events where id = invitation.event_id;
  event_state := private.checkin_event_state(event_row.id);
  if event_state <> 'active' then return jsonb_build_object('status', event_state); end if;
  return private.checkin_guest_payload(guest_row, event_row);
end;
$$;

create function public.check_in_party_members(p_token text, p_arriving_count integer, p_event_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.personal_invitations;
  guest_row public.event_guests;
begin
  if auth.uid() is null or public.current_client_id() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_arriving_count is null or p_arriving_count <= 0 then
    raise exception 'Arriving count must be positive.' using errcode = '22023';
  end if;
  select * into invitation from public.personal_invitations where token_hash = private.token_hash(p_token) and revoked_at is null;
  if invitation.id is null or invitation.client_id <> public.current_client_id() then
    raise exception 'Invitation was not found for this Client.' using errcode = '42501';
  end if;
  if p_event_id is not null and invitation.event_id <> p_event_id then
    raise exception 'Invitation belongs to another Event.' using errcode = '42501';
  end if;
  select * into guest_row from public.event_guests where id = invitation.guest_id;
  return private.apply_guest_checkin(guest_row.id, p_arriving_count, 'arrival');
end;
$$;

create function public.set_guest_checkin_count(p_guest_id uuid, p_checked_in_count integer)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.apply_guest_checkin(p_guest_id, p_checked_in_count, 'correction')
$$;

create function public.event_operational_summary(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.events e
    where e.id = p_event_id and (e.client_id = public.current_client_id() or public.is_platform_admin())
  ) then
    raise exception 'Event was not found.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'guest_records', count(*),
    'invitation_not_opened', count(*) filter (where g.rsvp_status = 'pending' and coalesce(i.open_count, 0) = 0),
    'opened_no_rsvp', count(*) filter (where g.rsvp_status = 'pending' and coalesce(i.open_count, 0) > 0),
    'accepted', count(*) filter (where g.rsvp_status = 'accepted'),
    'declined', count(*) filter (where g.rsvp_status = 'declined'),
    'pending', count(*) filter (where g.rsvp_status = 'pending'),
    'confirmed_headcount', coalesce(sum(g.confirmed_party_size), 0),
    'checked_in_headcount', coalesce(sum(g.checked_in_count), 0),
    'remaining_expected', coalesce(sum(g.confirmed_party_size - g.checked_in_count), 0),
    'custom_messages', count(*) filter (where g.custom_message is not null)
  ) into result
  from public.event_guests g
  left join public.personal_invitations i on i.guest_id = g.id
  where g.event_id = p_event_id;
  return result;
end;
$$;

create function public.admin_set_entitlement(p_client_id uuid, p_product_id text, p_status text, p_ends_at timestamptz default null)
returns public.client_entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous public.client_entitlements;
  result public.client_entitlements;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'Platform administrator access is required.' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended', 'cancelled', 'expired') then
    raise exception 'Entitlement status is invalid.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id) or not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'Client or product was not found.' using errcode = '22023';
  end if;

  select * into previous from public.client_entitlements where client_id = p_client_id and product_id = p_product_id for update;
  if previous.id is null then
    if p_ends_at is not null and p_ends_at <= now() then raise exception 'Entitlement expiry must be in the future.' using errcode = '22023'; end if;
    insert into public.client_entitlements(client_id, product_id, status, ends_at, created_by)
    values (p_client_id, p_product_id, p_status, p_ends_at, auth.uid())
    returning * into result;
  else
    if p_ends_at is not null and p_ends_at <= previous.starts_at then raise exception 'Entitlement expiry must follow its start.' using errcode = '22023'; end if;
    update public.client_entitlements
    set status = p_status, ends_at = p_ends_at
    where id = previous.id
    returning * into result;
  end if;

  insert into public.entitlement_admin_activity(entitlement_id, client_id, product_id, actor_user_id, previous_status, new_status, previous_ends_at, new_ends_at)
  values (result.id, result.client_id, result.product_id, auth.uid(), previous.status, result.status, previous.ends_at, result.ends_at);
  return result;
end;
$$;

alter table public.event_checkin_activity enable row level security;
alter table public.entitlement_admin_activity enable row level security;

create policy event_checkin_activity_select on public.event_checkin_activity
for select to authenticated
using (client_id = public.current_client_id() or public.is_platform_admin());

create policy entitlement_admin_activity_select on public.entitlement_admin_activity
for select to authenticated
using (public.is_platform_admin());

revoke all on table public.event_checkin_activity, public.entitlement_admin_activity from anon, authenticated;
grant select on table public.event_checkin_activity, public.entitlement_admin_activity to authenticated;
revoke update on table public.event_guests from authenticated;
grant update (name, phone, allowed_companions) on table public.event_guests to authenticated;

revoke all on function private.checkin_event_state(uuid), private.checkin_guest_payload(public.event_guests, public.events), private.apply_guest_checkin(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.resolve_checkin(text, uuid), public.check_in_party_members(text, integer, uuid), public.set_guest_checkin_count(uuid, integer), public.event_operational_summary(uuid), public.admin_set_entitlement(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.resolve_checkin(text, uuid), public.check_in_party_members(text, integer, uuid), public.set_guest_checkin_count(uuid, integer), public.event_operational_summary(uuid), public.admin_set_entitlement(uuid, text, text, timestamptz) to authenticated;

commit;
