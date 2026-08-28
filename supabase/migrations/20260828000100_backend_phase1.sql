begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  client_id uuid not null unique references public.clients(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table public.products (
  id text primary key check (id = lower(id) and id ~ '^[a-z][a-z0-9_-]*$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_policies (
  product_id text primary key references public.products(id) on delete restrict,
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table public.client_entitlements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  product_id text not null references public.products(id) on delete restrict,
  status text not null check (status in ('active', 'suspended', 'cancelled', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  policy_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(policy_overrides) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (client_id, product_id),
  check (ends_at is null or ends_at > starts_at)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  product_id text not null references public.products(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 200),
  lifecycle_status text not null default 'planning'
    check (lifecycle_status in ('planning', 'active', 'ended', 'archived', 'cancelled')),
  invitation_locale text not null default 'ar' check (invitation_locale in ('ar', 'en')),
  starts_at timestamptz,
  ends_at timestamptz,
  rsvp_deadline timestamptz,
  venue_name text,
  city text,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index client_entitlements_client_id_idx on public.client_entitlements(client_id);
create index events_client_id_idx on public.events(client_id);
create index events_client_product_idx on public.events(client_id, product_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select identity.client_id
  from public.client_identities as identity
  where identity.user_id = auth.uid()
$$;

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins as admin
    where admin.user_id = auth.uid()
  )
$$;

create function private.has_product_access(p_client_id uuid, p_product_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clients as client
    join public.client_entitlements as entitlement on entitlement.client_id = client.id
    join public.products as product on product.id = entitlement.product_id
    where client.id = p_client_id
      and client.status = 'active'
      and product.id = p_product_id
      and product.enabled
      and entitlement.status = 'active'
      and entitlement.starts_at <= now()
      and (entitlement.ends_at is null or entitlement.ends_at > now())
  )
$$;

create function private.protect_client_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Client identity and creation time are immutable.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
    and current_user <> 'postgres'
    and not public.is_platform_admin()
  then
    raise exception 'Only a platform administrator may change Client status.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function private.protect_event_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.client_id is distinct from old.client_id
    or new.product_id is distinct from old.product_id
  then
    raise exception 'Event identity, owner, and product are immutable.' using errcode = '42501';
  end if;
  if new.lifecycle_status = 'archived' then
    new.archived_at := coalesce(new.archived_at, now());
  else
    new.archived_at := null;
  end if;
  return new;
end;
$$;

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_client_id uuid;
  client_name text;
begin
  client_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'QuickRSVP Client'
  );

  insert into public.clients (display_name)
  values (left(client_name, 160))
  returning id into new_client_id;

  insert into public.client_identities (user_id, client_id)
  values (new.id, new_client_id);

  return new;
end;
$$;

create function public.ensure_client_account(p_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user_id uuid := auth.uid();
  existing_client_id uuid;
  new_client_id uuid;
  client_name text;
begin
  if auth_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select identity.client_id into existing_client_id
  from public.client_identities as identity
  where identity.user_id = auth_user_id;

  if existing_client_id is not null then
    return existing_client_id;
  end if;

  select coalesce(
    nullif(btrim(p_display_name), ''),
    nullif(split_part(coalesce(auth_user.email, ''), '@', 1), ''),
    'QuickRSVP Client'
  ) into client_name
  from auth.users as auth_user
  where auth_user.id = auth_user_id;

  if client_name is null then
    raise exception 'Authenticated user was not found.' using errcode = '42501';
  end if;

  begin
    insert into public.clients (display_name)
    values (left(client_name, 160))
    returning id into new_client_id;

    insert into public.client_identities (user_id, client_id)
    values (auth_user_id, new_client_id);
  exception when unique_violation then
    select identity.client_id into new_client_id
    from public.client_identities as identity
    where identity.user_id = auth_user_id;
    if new_client_id is null then
      raise;
    end if;
  end;

  return new_client_id;
end;
$$;

create function public.create_event(
  p_product_id text,
  p_title text,
  p_invitation_locale text default 'ar',
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_rsvp_deadline timestamptz default null,
  p_venue_name text default null,
  p_city text default null,
  p_target_client_id uuid default null
)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_client_id uuid := public.current_client_id();
  target_client_id uuid;
  created_event public.events;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_target_client_id is null then
    target_client_id := caller_client_id;
  elsif public.is_platform_admin() then
    target_client_id := p_target_client_id;
  elsif p_target_client_id = caller_client_id then
    target_client_id := caller_client_id;
  else
    raise exception 'A Client cannot create an Event for another Client.' using errcode = '42501';
  end if;

  if target_client_id is null then
    raise exception 'No Client account is associated with this identity.' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'Event title is required.' using errcode = '22023';
  end if;
  if p_invitation_locale not in ('ar', 'en') then
    raise exception 'Invitation locale must be ar or en.' using errcode = '22023';
  end if;
  if not private.has_product_access(target_client_id, p_product_id) then
    raise exception 'An active matching product entitlement is required.' using errcode = '42501';
  end if;

  insert into public.events (
    client_id, product_id, title, invitation_locale, starts_at, ends_at,
    rsvp_deadline, venue_name, city
  ) values (
    target_client_id, p_product_id, btrim(p_title), p_invitation_locale,
    p_starts_at, p_ends_at, p_rsvp_deadline, nullif(btrim(p_venue_name), ''),
    nullif(btrim(p_city), '')
  ) returning * into created_event;

  return created_event;
end;
$$;

create trigger clients_set_updated_at
before update on public.clients
for each row execute function private.set_updated_at();

create trigger clients_protect_fields
before update on public.clients
for each row execute function private.protect_client_fields();

create trigger products_set_updated_at
before update on public.products
for each row execute function private.set_updated_at();

create trigger product_policies_set_updated_at
before update on public.product_policies
for each row execute function private.set_updated_at();

create trigger client_entitlements_set_updated_at
before update on public.client_entitlements
for each row execute function private.set_updated_at();

create trigger events_protect_fields
before update on public.events
for each row execute function private.protect_event_fields();

create trigger events_set_updated_at
before update on public.events
for each row execute function private.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

insert into public.products (id) values ('wedding'), ('party');
insert into public.product_policies (product_id) values ('wedding'), ('party');

alter table public.clients enable row level security;
alter table public.client_identities enable row level security;
alter table public.platform_admins enable row level security;
alter table public.products enable row level security;
alter table public.product_policies enable row level security;
alter table public.client_entitlements enable row level security;
alter table public.events enable row level security;

create policy clients_select on public.clients
for select to authenticated
using (id = public.current_client_id() or public.is_platform_admin());

create policy clients_update on public.clients
for update to authenticated
using (id = public.current_client_id() or public.is_platform_admin())
with check (id = public.current_client_id() or public.is_platform_admin());

create policy client_identities_select on public.client_identities
for select to authenticated
using (user_id = auth.uid() or public.is_platform_admin());

create policy platform_admins_select on public.platform_admins
for select to authenticated
using (public.is_platform_admin());

create policy products_select on public.products
for select to authenticated
using (auth.uid() is not null);

create policy product_policies_select on public.product_policies
for select to authenticated
using (auth.uid() is not null);

create policy product_policies_admin_insert on public.product_policies
for insert to authenticated
with check (public.is_platform_admin());

create policy product_policies_admin_update on public.product_policies
for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy product_policies_admin_delete on public.product_policies
for delete to authenticated
using (public.is_platform_admin());

create policy client_entitlements_select on public.client_entitlements
for select to authenticated
using (client_id = public.current_client_id() or public.is_platform_admin());

create policy client_entitlements_admin_insert on public.client_entitlements
for insert to authenticated
with check (public.is_platform_admin());

create policy client_entitlements_admin_update on public.client_entitlements
for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy client_entitlements_admin_delete on public.client_entitlements
for delete to authenticated
using (public.is_platform_admin());

create policy events_select on public.events
for select to authenticated
using (client_id = public.current_client_id() or public.is_platform_admin());

create policy events_update on public.events
for update to authenticated
using (client_id = public.current_client_id() or public.is_platform_admin())
with check (client_id = public.current_client_id() or public.is_platform_admin());

revoke all on table public.clients from anon, authenticated;
revoke all on table public.client_identities from anon, authenticated;
revoke all on table public.platform_admins from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.product_policies from anon, authenticated;
revoke all on table public.client_entitlements from anon, authenticated;
revoke all on table public.events from anon, authenticated;

grant select, update on table public.clients to authenticated;
grant select on table public.client_identities to authenticated;
grant select on table public.platform_admins to authenticated;
grant select on table public.products to authenticated;
grant select, insert, update, delete on table public.product_policies to authenticated;
grant select, insert, update, delete on table public.client_entitlements to authenticated;
grant select, update on table public.events to authenticated;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.has_product_access(uuid, text) from public, anon, authenticated;
revoke all on function private.protect_client_fields() from public, anon, authenticated;
revoke all on function private.protect_event_fields() from public, anon, authenticated;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.current_client_id() from public, anon, authenticated;
revoke all on function public.is_platform_admin() from public, anon, authenticated;
revoke all on function public.ensure_client_account(text) from public, anon, authenticated;
revoke all on function public.create_event(text, text, text, timestamptz, timestamptz, timestamptz, text, text, uuid) from public, anon, authenticated;

grant execute on function public.current_client_id() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.ensure_client_account(text) to authenticated;
grant execute on function public.create_event(text, text, text, timestamptz, timestamptz, timestamptz, text, text, uuid) to authenticated;

commit;
