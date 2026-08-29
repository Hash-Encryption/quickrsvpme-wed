begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.events
  add column request_companion_names boolean not null default false,
  add column allow_custom_messages boolean not null default true,
  add column allow_rsvp_changes boolean not null default true,
  add column general_invite_allowed_companions integer not null default 0
    check (general_invite_allowed_companions between 0 and 50);

create table public.platform_templates (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete restrict,
  renderer_key text not null check (renderer_key ~ '^[a-z][a-z0-9-]*$'),
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  render_snapshot jsonb not null check (jsonb_typeof(render_snapshot) = 'object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, renderer_key, version)
);

create table public.wedding_event_configs (
  event_id uuid primary key references public.events(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  configuration jsonb not null check (jsonb_typeof(configuration) = 'object'),
  template_version_id uuid references public.platform_templates(id) on delete restrict,
  template_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(template_snapshot) = 'object'),
  artwork_asset_id uuid,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.party_event_configs (
  event_id uuid primary key references public.events(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  configuration jsonb not null check (jsonb_typeof(configuration) = 'object'),
  template_version_id uuid references public.platform_templates(id) on delete restrict,
  template_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(template_snapshot) = 'object'),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.design_drafts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  product_id text not null references public.products(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 200),
  configuration jsonb not null check (jsonb_typeof(configuration) = 'object'),
  template_version_id uuid references public.platform_templates(id) on delete restrict,
  template_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(template_snapshot) = 'object'),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invitation_assets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  event_id uuid references public.events(id) on delete restrict,
  draft_id uuid references public.design_drafts(id) on delete restrict,
  purpose text not null check (purpose in ('private_source', 'published_delivery')),
  bucket_id text not null check (bucket_id in ('invitation-assets-private', 'invitation-assets-public')),
  object_path text not null,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint not null check (byte_size between 1 and 12582912),
  source_asset_id uuid references public.invitation_assets(id) on delete restrict,
  status text not null default 'reserved' check (status in ('reserved', 'uploaded', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, object_path),
  check ((event_id is not null)::integer + (draft_id is not null)::integer = 1),
  check (
    (purpose = 'private_source' and bucket_id = 'invitation-assets-private' and source_asset_id is null)
    or
    (purpose = 'published_delivery' and bucket_id = 'invitation-assets-public' and source_asset_id is not null)
  )
);

alter table public.wedding_event_configs
  add constraint wedding_event_configs_artwork_asset_fk
  foreign key (artwork_asset_id) references public.invitation_assets(id) on delete restrict;

create table public.event_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  source text not null default 'client' check (source in ('client', 'general_invite')),
  general_request_id uuid unique,
  name text not null check (length(btrim(name)) between 1 and 200),
  phone text check (phone is null or length(phone) <= 80),
  allowed_companions integer not null default 0 check (allowed_companions between 0 and 50),
  invitation_variant_override text check (invitation_variant_override is null or invitation_variant_override in ('women', 'men', 'both', 'family', 'custom')),
  rsvp_status text not null default 'pending' check (rsvp_status in ('pending', 'accepted', 'declined')),
  confirmed_party_size integer not null default 0 check (confirmed_party_size between 0 and 51),
  companion_names text[] not null default '{}',
  custom_message text check (custom_message is null or length(custom_message) <= 2000),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(companion_names) <= allowed_companions),
  check (
    (rsvp_status = 'accepted' and confirmed_party_size between 1 and 1 + allowed_companions)
    or (rsvp_status in ('pending', 'declined') and confirmed_party_size = 0)
  )
);

create table public.event_guest_tags (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (event_id, name),
  unique (id, event_id)
);

create table public.event_guest_tag_assignments (
  event_id uuid not null references public.events(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  guest_id uuid not null references public.event_guests(id) on delete cascade,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (guest_id, tag_id),
  foreign key (tag_id, event_id) references public.event_guest_tags(id, event_id) on delete cascade
);

create table public.personal_invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  guest_id uuid not null unique references public.event_guests(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  revoked_at timestamptz,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  open_count integer not null default 0 check (open_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.general_invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  active boolean not null default true,
  revoked_at timestamptz,
  open_count integer not null default 0 check (open_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index general_invitations_one_active_per_event_idx
  on public.general_invitations(event_id) where active and revoked_at is null;
create index wedding_event_configs_client_idx on public.wedding_event_configs(client_id);
create index party_event_configs_client_idx on public.party_event_configs(client_id);
create index design_drafts_client_product_idx on public.design_drafts(client_id, product_id);
create index invitation_assets_client_idx on public.invitation_assets(client_id);
create index event_guests_event_idx on public.event_guests(event_id, created_at desc);
create index event_guests_client_status_idx on public.event_guests(client_id, rsvp_status);
create index event_guest_tags_event_idx on public.event_guest_tags(event_id);
create index personal_invitations_event_idx on public.personal_invitations(event_id);
create index general_invitations_event_idx on public.general_invitations(event_id);

create function private.token_hash(p_token text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

create function private.new_invitation_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(32), 'hex')
$$;

create function private.public_invitation_configuration(p_configuration jsonb)
returns jsonb
language sql
immutable
strict
set search_path = ''
as $$
  select p_configuration #- '{visual,uploadedBackground,dataUrl}'
$$;

create function private.event_public_state(p_event_id uuid)
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
  if event_row.lifecycle_status = 'planning' then return 'planning'; end if;
  if event_row.lifecycle_status = 'ended' then return 'ended'; end if;
  if event_row.lifecycle_status = 'active' then
    if private.has_product_access(event_row.client_id, event_row.product_id) then return 'active'; end if;
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

create function private.set_event_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events;
begin
  select * into event_row from public.events where id = new.event_id;
  if event_row.id is null then raise exception 'Event was not found.' using errcode = '23503'; end if;
  if tg_table_name = 'wedding_event_configs' and event_row.product_id <> 'wedding' then raise exception 'Wedding configuration requires a Wedding Event.' using errcode = '22023'; end if;
  if tg_table_name = 'party_event_configs' and event_row.product_id <> 'party' then raise exception 'Party configuration requires a Party Event.' using errcode = '22023'; end if;
  if tg_op = 'UPDATE' and new.event_id is distinct from old.event_id then raise exception 'Event ownership is immutable.' using errcode = '42501'; end if;
  new.client_id := event_row.client_id;
  return new;
end;
$$;

create function private.protect_guest_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  guest_row public.event_guests;
begin
  select * into guest_row from public.event_guests where id = new.guest_id;
  if guest_row.id is null or guest_row.event_id <> new.event_id then raise exception 'Guest and tag must belong to the same Event.' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' and (new.guest_id is distinct from old.guest_id or new.tag_id is distinct from old.tag_id) then raise exception 'Tag assignment identity is immutable.' using errcode = '42501'; end if;
  new.client_id := guest_row.client_id;
  return new;
end;
$$;

create function private.protect_asset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_client_id uuid;
  source_row public.invitation_assets;
begin
  if new.event_id is not null then select client_id into owner_client_id from public.events where id = new.event_id;
  else select client_id into owner_client_id from public.design_drafts where id = new.draft_id;
  end if;
  if owner_client_id is null then raise exception 'Asset owner was not found.' using errcode = '23503'; end if;
  if new.source_asset_id is not null then
    select * into source_row from public.invitation_assets where id = new.source_asset_id;
    if source_row.id is null or source_row.client_id <> owner_client_id or source_row.purpose <> 'private_source' or source_row.event_id is distinct from new.event_id or source_row.draft_id is distinct from new.draft_id then raise exception 'Published asset source is invalid.' using errcode = '42501'; end if;
  end if;
  if tg_op = 'UPDATE' and (new.id is distinct from old.id or new.event_id is distinct from old.event_id or new.draft_id is distinct from old.draft_id or new.object_path is distinct from old.object_path or new.purpose is distinct from old.purpose) then raise exception 'Asset identity and owner are immutable.' using errcode = '42501'; end if;
  new.client_id := owner_client_id;
  return new;
end;
$$;

create trigger wedding_event_configs_owner before insert or update on public.wedding_event_configs for each row execute function private.set_event_owner();
create trigger party_event_configs_owner before insert or update on public.party_event_configs for each row execute function private.set_event_owner();
create trigger event_guests_owner before insert or update on public.event_guests for each row execute function private.set_event_owner();
create trigger event_guest_tags_owner before insert or update on public.event_guest_tags for each row execute function private.set_event_owner();
create trigger personal_invitations_owner before insert or update on public.personal_invitations for each row execute function private.set_event_owner();
create trigger general_invitations_owner before insert or update on public.general_invitations for each row execute function private.set_event_owner();
create trigger event_guest_tag_assignments_owner before insert or update on public.event_guest_tag_assignments for each row execute function private.protect_guest_assignment();
create trigger invitation_assets_protect before insert or update on public.invitation_assets for each row execute function private.protect_asset();

create trigger platform_templates_set_updated_at before update on public.platform_templates for each row execute function private.set_updated_at();
create trigger wedding_event_configs_set_updated_at before update on public.wedding_event_configs for each row execute function private.set_updated_at();
create trigger party_event_configs_set_updated_at before update on public.party_event_configs for each row execute function private.set_updated_at();
create trigger design_drafts_set_updated_at before update on public.design_drafts for each row execute function private.set_updated_at();
create trigger invitation_assets_set_updated_at before update on public.invitation_assets for each row execute function private.set_updated_at();
create trigger event_guests_set_updated_at before update on public.event_guests for each row execute function private.set_updated_at();
create trigger personal_invitations_set_updated_at before update on public.personal_invitations for each row execute function private.set_updated_at();
create trigger general_invitations_set_updated_at before update on public.general_invitations for each row execute function private.set_updated_at();

create function public.save_wedding_event_config(p_event_id uuid, p_configuration jsonb, p_template_version_id uuid, p_template_snapshot jsonb, p_artwork_asset_id uuid, p_expected_version bigint)
returns public.wedding_event_configs
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.wedding_event_configs;
  result public.wedding_event_configs;
begin
  if p_configuration is null or jsonb_typeof(p_configuration) <> 'object' or p_template_snapshot is null or jsonb_typeof(p_template_snapshot) <> 'object' then raise exception 'Configuration and template snapshot must be objects.' using errcode = '22023'; end if;
  if not exists (select 1 from public.events e where e.id = p_event_id and e.client_id = public.current_client_id() and e.product_id = 'wedding' and e.deleted_at is null) then raise exception 'Wedding Event was not found.' using errcode = '42501'; end if;
  if p_template_version_id is not null and not exists (
    select 1 from public.platform_templates t
    where t.id = p_template_version_id and t.product_id = 'wedding'
      and (t.active or exists (select 1 from public.wedding_event_configs c where c.event_id = p_event_id and c.template_version_id = t.id))
  ) then raise exception 'Wedding template version is unavailable.' using errcode = '22023'; end if;
  if p_template_version_id is not null then select render_snapshot into p_template_snapshot from public.platform_templates where id = p_template_version_id; end if;
  if p_artwork_asset_id is not null and not exists (select 1 from public.invitation_assets where id = p_artwork_asset_id and event_id = p_event_id and client_id = public.current_client_id() and purpose = 'published_delivery' and status = 'uploaded') then raise exception 'Published Wedding artwork is invalid.' using errcode = '42501'; end if;
  select * into existing from public.wedding_event_configs where event_id = p_event_id for update;
  if existing.event_id is null then
    if p_expected_version <> 0 then raise exception 'Configuration version conflict.' using errcode = '40001'; end if;
    insert into public.wedding_event_configs(event_id, client_id, configuration, template_version_id, template_snapshot, artwork_asset_id)
    values (p_event_id, public.current_client_id(), p_configuration, p_template_version_id, p_template_snapshot, p_artwork_asset_id) returning * into result;
  else
    if existing.version <> p_expected_version then raise exception 'Configuration version conflict.' using errcode = '40001'; end if;
    update public.wedding_event_configs set configuration = p_configuration, template_version_id = p_template_version_id, template_snapshot = p_template_snapshot, artwork_asset_id = p_artwork_asset_id, version = version + 1 where event_id = p_event_id returning * into result;
  end if;
  return result;
end;
$$;

create function public.save_party_event_config(p_event_id uuid, p_configuration jsonb, p_template_version_id uuid, p_template_snapshot jsonb, p_expected_version bigint)
returns public.party_event_configs
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.party_event_configs;
  result public.party_event_configs;
begin
  if p_configuration is null or jsonb_typeof(p_configuration) <> 'object' or p_template_snapshot is null or jsonb_typeof(p_template_snapshot) <> 'object' then raise exception 'Configuration and template snapshot must be objects.' using errcode = '22023'; end if;
  if not exists (select 1 from public.events e where e.id = p_event_id and e.client_id = public.current_client_id() and e.product_id = 'party' and e.deleted_at is null) then raise exception 'Party Event was not found.' using errcode = '42501'; end if;
  if p_template_version_id is not null and not exists (
    select 1 from public.platform_templates t
    where t.id = p_template_version_id and t.product_id = 'party'
      and (t.active or exists (select 1 from public.party_event_configs c where c.event_id = p_event_id and c.template_version_id = t.id))
  ) then raise exception 'Party template version is unavailable.' using errcode = '22023'; end if;
  if p_template_version_id is not null then select render_snapshot into p_template_snapshot from public.platform_templates where id = p_template_version_id; end if;
  select * into existing from public.party_event_configs where event_id = p_event_id for update;
  if existing.event_id is null then
    if p_expected_version <> 0 then raise exception 'Configuration version conflict.' using errcode = '40001'; end if;
    insert into public.party_event_configs(event_id, client_id, configuration, template_version_id, template_snapshot)
    values (p_event_id, public.current_client_id(), p_configuration, p_template_version_id, p_template_snapshot) returning * into result;
  else
    if existing.version <> p_expected_version then raise exception 'Configuration version conflict.' using errcode = '40001'; end if;
    update public.party_event_configs set configuration = p_configuration, template_version_id = p_template_version_id, template_snapshot = p_template_snapshot, version = version + 1 where event_id = p_event_id returning * into result;
  end if;
  return result;
end;
$$;

create function public.create_design_draft(p_product_id text, p_title text, p_configuration jsonb, p_template_version_id uuid default null, p_template_snapshot jsonb default '{}'::jsonb)
returns public.design_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_client_id uuid := public.current_client_id();
  policy jsonb;
  allowance integer;
  result public.design_drafts;
begin
  if caller_client_id is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  select configuration into policy from public.product_policies where product_id = p_product_id;
  if coalesce(policy ->> 'design_draft_limit', '') !~ '^\d{1,6}$' then raise exception 'Design Draft allowance is not configured.' using errcode = '42501'; end if;
  if p_configuration is null or jsonb_typeof(p_configuration) <> 'object' or p_template_snapshot is null or jsonb_typeof(p_template_snapshot) <> 'object' then raise exception 'Draft configuration and template snapshot must be objects.' using errcode = '22023'; end if;
  if p_template_version_id is not null and not exists (select 1 from public.platform_templates where id = p_template_version_id and product_id = p_product_id and active) then raise exception 'Draft template version is unavailable.' using errcode = '22023'; end if;
  if p_template_version_id is not null then select render_snapshot into p_template_snapshot from public.platform_templates where id = p_template_version_id; end if;
  allowance := (policy ->> 'design_draft_limit')::integer;
  if (select count(*) from public.design_drafts draft where draft.client_id = caller_client_id and draft.product_id = p_product_id) >= allowance then raise exception 'Design Draft allowance reached.' using errcode = '42501'; end if;
  insert into public.design_drafts(client_id, product_id, title, configuration, template_version_id, template_snapshot)
  values (caller_client_id, p_product_id, btrim(p_title), p_configuration, p_template_version_id, p_template_snapshot) returning * into result;
  return result;
end;
$$;

create function public.save_design_draft(p_draft_id uuid, p_title text, p_configuration jsonb, p_template_version_id uuid, p_template_snapshot jsonb, p_expected_version bigint)
returns public.design_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.design_drafts;
begin
  select * into draft from public.design_drafts where id = p_draft_id and client_id = public.current_client_id() for update;
  if draft.id is null then raise exception 'Design Draft was not found.' using errcode = '42501'; end if;
  if draft.version <> p_expected_version then raise exception 'Design Draft version conflict.' using errcode = '40001'; end if;
  if nullif(btrim(p_title), '') is null or p_configuration is null or jsonb_typeof(p_configuration) <> 'object' or p_template_snapshot is null or jsonb_typeof(p_template_snapshot) <> 'object' then raise exception 'Draft title, configuration, and template snapshot are invalid.' using errcode = '22023'; end if;
  if p_template_version_id is not null and not exists (
    select 1 from public.platform_templates t
    where t.id = p_template_version_id and t.product_id = draft.product_id
      and (t.active or t.id = draft.template_version_id)
  ) then raise exception 'Draft template version is unavailable.' using errcode = '22023'; end if;
  if p_template_version_id is not null then select render_snapshot into p_template_snapshot from public.platform_templates where id = p_template_version_id; end if;
  update public.design_drafts set title = btrim(p_title), configuration = p_configuration, template_version_id = p_template_version_id, template_snapshot = p_template_snapshot, version = version + 1 where id = p_draft_id returning * into draft;
  return draft;
end;
$$;

create function public.reserve_invitation_asset(p_owner_kind text, p_owner_id uuid, p_purpose text, p_content_type text, p_byte_size bigint, p_source_asset_id uuid default null)
returns public.invitation_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_client_id uuid := public.current_client_id();
  event_id uuid;
  draft_id uuid;
  bucket_id text;
  result public.invitation_assets;
begin
  if caller_client_id is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  if p_content_type not in ('image/jpeg', 'image/png', 'image/webp') or p_byte_size not between 1 and 12582912 then raise exception 'Unsupported asset type or size.' using errcode = '22023'; end if;
  if p_owner_kind = 'event' and exists (select 1 from public.events e where e.id = p_owner_id and e.client_id = caller_client_id and e.deleted_at is null) then event_id := p_owner_id;
  elsif p_owner_kind = 'draft' and exists (select 1 from public.design_drafts d where d.id = p_owner_id and d.client_id = caller_client_id) then draft_id := p_owner_id;
  else raise exception 'Asset owner was not found.' using errcode = '42501';
  end if;
  if p_purpose = 'private_source' and p_source_asset_id is null then bucket_id := 'invitation-assets-private';
  elsif p_purpose = 'published_delivery' and p_source_asset_id is not null then bucket_id := 'invitation-assets-public';
  else raise exception 'Invalid asset publication request.' using errcode = '22023';
  end if;
  insert into public.invitation_assets(client_id, event_id, draft_id, purpose, bucket_id, object_path, content_type, byte_size, source_asset_id)
  values (caller_client_id, event_id, draft_id, p_purpose, bucket_id, gen_random_uuid()::text || '/' || gen_random_uuid()::text, p_content_type, p_byte_size, p_source_asset_id)
  returning * into result;
  return result;
end;
$$;

create function public.create_event_guest(p_event_id uuid, p_name text, p_phone text default null, p_allowed_companions integer default 0, p_invitation_variant_override text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  guest public.event_guests;
  invitation public.personal_invitations;
  raw_token text := private.new_invitation_token();
begin
  if not exists (select 1 from public.events where id = p_event_id and client_id = public.current_client_id() and deleted_at is null) then raise exception 'Event was not found.' using errcode = '42501'; end if;
  insert into public.event_guests(event_id, client_id, name, phone, allowed_companions, invitation_variant_override)
  values (p_event_id, public.current_client_id(), btrim(p_name), nullif(btrim(p_phone), ''), p_allowed_companions, p_invitation_variant_override) returning * into guest;
  insert into public.personal_invitations(event_id, client_id, guest_id, token_hash)
  values (p_event_id, guest.client_id, guest.id, private.token_hash(raw_token)) returning * into invitation;
  return jsonb_build_object('guest', to_jsonb(guest), 'invitation_id', invitation.id, 'token', raw_token);
end;
$$;

create function public.rotate_personal_invitation(p_guest_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare raw_token text := private.new_invitation_token();
begin
  update public.personal_invitations set token_hash = private.token_hash(raw_token), revoked_at = null, first_opened_at = null, last_opened_at = null, open_count = 0
  where guest_id = p_guest_id and client_id = public.current_client_id();
  if not found then raise exception 'Invitation was not found.' using errcode = '42501'; end if;
  return raw_token;
end;
$$;

create function public.create_general_invitation(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare raw_token text := private.new_invitation_token();
begin
  if not exists (select 1 from public.events where id = p_event_id and client_id = public.current_client_id() and deleted_at is null) then raise exception 'Event was not found.' using errcode = '42501'; end if;
  update public.general_invitations set active = false, revoked_at = now() where event_id = p_event_id and active and revoked_at is null;
  insert into public.general_invitations(event_id, client_id, token_hash) values (p_event_id, public.current_client_id(), private.token_hash(raw_token));
  return raw_token;
end;
$$;

create function public.revoke_personal_invitation(p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.personal_invitations set revoked_at = now() where guest_id = p_guest_id and client_id = public.current_client_id();
  if not found then raise exception 'Invitation was not found.' using errcode = '42501'; end if;
end;
$$;

create function public.revoke_general_invitation(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.general_invitations set active = false, revoked_at = now() where event_id = p_event_id and client_id = public.current_client_id() and active and revoked_at is null;
  if not found then raise exception 'General invitation was not found.' using errcode = '42501'; end if;
end;
$$;

create function public.resolve_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_digest text := private.token_hash(p_token);
  personal public.personal_invitations;
  general public.general_invitations;
  guest public.event_guests;
  event_row public.events;
  state text;
  config jsonb;
begin
  select * into personal from public.personal_invitations where token_hash = token_digest and revoked_at is null;
  if personal.id is not null then
    select * into event_row from public.events where id = personal.event_id;
    state := private.event_public_state(event_row.id);
    if state not in ('active', 'archived_read_only') then return jsonb_build_object('status', state); end if;
    select * into guest from public.event_guests where id = personal.guest_id;
    if event_row.product_id = 'wedding' then select private.public_invitation_configuration(c.configuration) || jsonb_build_object('template_snapshot', c.template_snapshot, 'published_artwork', case when a.id is null then null else jsonb_build_object('bucket', a.bucket_id, 'path', a.object_path, 'content_type', a.content_type) end) into config from public.wedding_event_configs c left join public.invitation_assets a on a.id = c.artwork_asset_id and a.purpose = 'published_delivery' and a.status = 'uploaded' where c.event_id = event_row.id;
    else select private.public_invitation_configuration(configuration) || jsonb_build_object('template_snapshot', template_snapshot) into config from public.party_event_configs where event_id = event_row.id;
    end if;
    return jsonb_build_object('status', state, 'kind', 'personal', 'event', jsonb_build_object('product_id', event_row.product_id, 'title', event_row.title, 'invitation_locale', event_row.invitation_locale, 'starts_at', event_row.starts_at, 'ends_at', event_row.ends_at, 'rsvp_deadline', event_row.rsvp_deadline, 'venue_name', event_row.venue_name, 'city', event_row.city, 'request_companion_names', event_row.request_companion_names, 'allow_custom_messages', event_row.allow_custom_messages), 'configuration', coalesce(config, '{}'::jsonb), 'guest', jsonb_build_object('name', guest.name, 'allowed_companions', guest.allowed_companions, 'invitation_variant_override', guest.invitation_variant_override, 'rsvp_status', guest.rsvp_status, 'confirmed_party_size', guest.confirmed_party_size, 'companion_names', guest.companion_names, 'custom_message', guest.custom_message));
  end if;
  select * into general from public.general_invitations where token_hash = token_digest and active and revoked_at is null;
  if general.id is null then return jsonb_build_object('status', 'invalid'); end if;
  select * into event_row from public.events where id = general.event_id;
  state := private.event_public_state(event_row.id);
  if state <> 'active' then return jsonb_build_object('status', state); end if;
  if event_row.product_id = 'wedding' then select private.public_invitation_configuration(c.configuration) || jsonb_build_object('template_snapshot', c.template_snapshot, 'published_artwork', case when a.id is null then null else jsonb_build_object('bucket', a.bucket_id, 'path', a.object_path, 'content_type', a.content_type) end) into config from public.wedding_event_configs c left join public.invitation_assets a on a.id = c.artwork_asset_id and a.purpose = 'published_delivery' and a.status = 'uploaded' where c.event_id = event_row.id;
  else select private.public_invitation_configuration(configuration) || jsonb_build_object('template_snapshot', template_snapshot) into config from public.party_event_configs where event_id = event_row.id;
  end if;
  return jsonb_build_object('status', state, 'kind', 'general', 'event', jsonb_build_object('product_id', event_row.product_id, 'title', event_row.title, 'invitation_locale', event_row.invitation_locale, 'starts_at', event_row.starts_at, 'ends_at', event_row.ends_at, 'rsvp_deadline', event_row.rsvp_deadline, 'venue_name', event_row.venue_name, 'city', event_row.city, 'request_companion_names', event_row.request_companion_names, 'allow_custom_messages', event_row.allow_custom_messages), 'configuration', coalesce(config, '{}'::jsonb));
end;
$$;

create function public.record_invitation_open(p_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare token_digest text := private.token_hash(p_token); invitation_state text;
begin
  select private.event_public_state(event_id) into invitation_state from public.personal_invitations where token_hash = token_digest and revoked_at is null;
  if invitation_state in ('active', 'archived_read_only') then
    update public.personal_invitations set first_opened_at = coalesce(first_opened_at, now()), last_opened_at = now(), open_count = open_count + 1 where token_hash = token_digest and revoked_at is null;
    return invitation_state;
  end if;
  select private.event_public_state(event_id) into invitation_state from public.general_invitations where token_hash = token_digest and active and revoked_at is null;
  if invitation_state = 'active' then update public.general_invitations set open_count = open_count + 1 where token_hash = token_digest and active and revoked_at is null; return invitation_state; end if;
  return coalesce(invitation_state, 'invalid');
end;
$$;

create function private.validate_rsvp(p_event public.events, p_guest public.event_guests, p_status text, p_party_size integer, p_companion_names text[], p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.event_public_state(p_event.id) <> 'active' then raise exception 'RSVP is unavailable.' using errcode = '42501'; end if;
  if p_event.rsvp_deadline is not null and now() > p_event.rsvp_deadline then raise exception 'RSVP deadline has passed.' using errcode = '42501'; end if;
  if p_status not in ('accepted', 'declined') then raise exception 'RSVP status is invalid.' using errcode = '22023'; end if;
  if p_guest.rsvp_status <> 'pending' and not p_event.allow_rsvp_changes then raise exception 'RSVP changes are disabled.' using errcode = '42501'; end if;
  if p_status = 'accepted' and (p_party_size < 1 or p_party_size > 1 + p_guest.allowed_companions) then raise exception 'Confirmed party exceeds allowance.' using errcode = '22023'; end if;
  if p_status = 'declined' and p_party_size <> 0 then raise exception 'Declined RSVP party size must be zero.' using errcode = '22023'; end if;
  if not p_event.request_companion_names and cardinality(coalesce(p_companion_names, '{}')) > 0 then raise exception 'Companion names are disabled.' using errcode = '22023'; end if;
  if cardinality(coalesce(p_companion_names, '{}')) > p_guest.allowed_companions or cardinality(coalesce(p_companion_names, '{}')) > greatest(p_party_size - 1, 0) then raise exception 'Too many companion names.' using errcode = '22023'; end if;
  if not p_event.allow_custom_messages and nullif(btrim(p_message), '') is not null then raise exception 'Custom messages are disabled.' using errcode = '22023'; end if;
end;
$$;

create function public.submit_personal_rsvp(p_token text, p_status text, p_party_size integer, p_companion_names text[] default '{}', p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare invitation public.personal_invitations; guest public.event_guests; event_row public.events;
begin
  select * into invitation from public.personal_invitations where token_hash = private.token_hash(p_token) and revoked_at is null;
  if invitation.id is null then raise exception 'Invitation is invalid.' using errcode = '42501'; end if;
  select * into guest from public.event_guests where id = invitation.guest_id for update;
  select * into event_row from public.events where id = invitation.event_id;
  perform private.validate_rsvp(event_row, guest, p_status, p_party_size, p_companion_names, p_message);
  update public.event_guests set rsvp_status = p_status, confirmed_party_size = case when p_status = 'accepted' then p_party_size else 0 end, companion_names = case when event_row.request_companion_names then coalesce(p_companion_names, '{}') else '{}' end, custom_message = case when event_row.allow_custom_messages then nullif(btrim(p_message), '') else null end, responded_at = now() where id = guest.id returning * into guest;
  return jsonb_build_object('status', guest.rsvp_status, 'confirmed_party_size', guest.confirmed_party_size, 'companion_names', guest.companion_names, 'custom_message', guest.custom_message);
end;
$$;

create function public.submit_general_rsvp(p_token text, p_request_id uuid, p_name text, p_status text, p_party_size integer, p_companion_names text[] default '{}', p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare invitation public.general_invitations; guest public.event_guests; event_row public.events;
begin
  if p_request_id is null then raise exception 'A request ID is required.' using errcode = '22023'; end if;
  if nullif(btrim(p_name), '') is null then raise exception 'Guest name is required.' using errcode = '22023'; end if;
  select * into invitation from public.general_invitations where token_hash = private.token_hash(p_token) and active and revoked_at is null;
  if invitation.id is null then raise exception 'Invitation is invalid.' using errcode = '42501'; end if;
  select * into event_row from public.events where id = invitation.event_id;
  select * into guest from public.event_guests where general_request_id = p_request_id;
  if guest.id is not null then
    if guest.event_id <> event_row.id or guest.source <> 'general_invite' then raise exception 'Request ID is already in use.' using errcode = '42501'; end if;
    return jsonb_build_object('guest_id', guest.id, 'status', guest.rsvp_status, 'confirmed_party_size', guest.confirmed_party_size);
  end if;
  begin
    insert into public.event_guests(event_id, client_id, source, general_request_id, name, allowed_companions) values (event_row.id, event_row.client_id, 'general_invite', p_request_id, btrim(p_name), event_row.general_invite_allowed_companions) returning * into guest;
  exception when unique_violation then
    select * into guest from public.event_guests where general_request_id = p_request_id;
    if guest.id is null or guest.event_id <> event_row.id or guest.source <> 'general_invite' then raise exception 'Request ID is already in use.' using errcode = '42501'; end if;
    return jsonb_build_object('guest_id', guest.id, 'status', guest.rsvp_status, 'confirmed_party_size', guest.confirmed_party_size);
  end;
  perform private.validate_rsvp(event_row, guest, p_status, p_party_size, p_companion_names, p_message);
  update public.event_guests set rsvp_status = p_status, confirmed_party_size = case when p_status = 'accepted' then p_party_size else 0 end, companion_names = case when event_row.request_companion_names then coalesce(p_companion_names, '{}') else '{}' end, custom_message = case when event_row.allow_custom_messages then nullif(btrim(p_message), '') else null end, responded_at = now() where id = guest.id returning * into guest;
  return jsonb_build_object('guest_id', guest.id, 'status', guest.rsvp_status, 'confirmed_party_size', guest.confirmed_party_size);
end;
$$;

insert into public.platform_templates(product_id, renderer_key, render_snapshot, metadata) values
  ('wedding', 'soft-floral-garden', '{"templateId":"soft-floral-garden"}', '{"source":"frontend_registry"}'),
  ('wedding', 'pearl-arch', '{"templateId":"pearl-arch"}', '{"source":"frontend_registry"}'),
  ('wedding', 'midnight-gold', '{"templateId":"midnight-gold"}', '{"source":"frontend_registry"}'),
  ('party', 'garden-glow', '{"templateId":"garden-glow"}', '{"source":"frontend_registry"}'),
  ('party', 'confetti-pop', '{"templateId":"confetti-pop"}', '{"source":"frontend_registry"}'),
  ('party', 'skyline-toast', '{"templateId":"skyline-toast"}', '{"source":"frontend_registry"}');

update public.product_policies set configuration = '{"design_draft_limit":2,"archive_replay_enabled":false}'::jsonb || configuration where product_id = 'wedding';
update public.product_policies set configuration = '{"design_draft_limit":2,"archive_replay_enabled":false}'::jsonb || configuration where product_id = 'party';

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('invitation-assets-private', 'invitation-assets-private', false, 12582912, array['image/jpeg','image/png','image/webp']),
  ('invitation-assets-public', 'invitation-assets-public', true, 12582912, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.platform_templates enable row level security;
alter table public.wedding_event_configs enable row level security;
alter table public.party_event_configs enable row level security;
alter table public.design_drafts enable row level security;
alter table public.invitation_assets enable row level security;
alter table public.event_guests enable row level security;
alter table public.event_guest_tags enable row level security;
alter table public.event_guest_tag_assignments enable row level security;
alter table public.personal_invitations enable row level security;
alter table public.general_invitations enable row level security;

create policy platform_templates_select on public.platform_templates for select to authenticated using (active or public.is_platform_admin());
create policy platform_templates_admin_all on public.platform_templates for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy wedding_event_configs_owner_all on public.wedding_event_configs for all to authenticated using (client_id = public.current_client_id() or public.is_platform_admin()) with check (client_id = public.current_client_id() or public.is_platform_admin());
create policy party_event_configs_owner_all on public.party_event_configs for all to authenticated using (client_id = public.current_client_id() or public.is_platform_admin()) with check (client_id = public.current_client_id() or public.is_platform_admin());
create policy design_drafts_owner_all on public.design_drafts for all to authenticated using (client_id = public.current_client_id() or public.is_platform_admin()) with check (client_id = public.current_client_id() or public.is_platform_admin());
create policy invitation_assets_owner_all on public.invitation_assets for all to authenticated using (client_id = public.current_client_id() or public.is_platform_admin()) with check (client_id = public.current_client_id() or public.is_platform_admin());
create policy event_guests_owner_all on public.event_guests for all to authenticated using (client_id = public.current_client_id() or public.is_platform_admin()) with check (client_id = public.current_client_id() or public.is_platform_admin());
create policy event_guest_tags_owner_all on public.event_guest_tags for all to authenticated using (client_id = public.current_client_id() or public.is_platform_admin()) with check (client_id = public.current_client_id() or public.is_platform_admin());
create policy event_guest_tag_assignments_owner_all on public.event_guest_tag_assignments for all to authenticated using (client_id = public.current_client_id() or public.is_platform_admin()) with check (client_id = public.current_client_id() or public.is_platform_admin());
create policy personal_invitations_owner_all on public.personal_invitations for all to authenticated using (client_id = public.current_client_id() or public.is_platform_admin()) with check (client_id = public.current_client_id() or public.is_platform_admin());
create policy general_invitations_owner_all on public.general_invitations for all to authenticated using (client_id = public.current_client_id() or public.is_platform_admin()) with check (client_id = public.current_client_id() or public.is_platform_admin());

create policy invitation_private_objects_select on storage.objects for select to authenticated using (bucket_id = 'invitation-assets-private' and exists (select 1 from public.invitation_assets a where a.bucket_id = storage.objects.bucket_id and a.object_path = storage.objects.name and a.client_id = public.current_client_id()));
create policy invitation_objects_insert on storage.objects for insert to authenticated with check (bucket_id in ('invitation-assets-private','invitation-assets-public') and exists (select 1 from public.invitation_assets a where a.bucket_id = storage.objects.bucket_id and a.object_path = storage.objects.name and a.client_id = public.current_client_id() and a.status = 'reserved'));
create policy invitation_objects_update on storage.objects for update to authenticated using (bucket_id in ('invitation-assets-private','invitation-assets-public') and exists (select 1 from public.invitation_assets a where a.bucket_id = storage.objects.bucket_id and a.object_path = storage.objects.name and a.client_id = public.current_client_id())) with check (bucket_id in ('invitation-assets-private','invitation-assets-public') and exists (select 1 from public.invitation_assets a where a.bucket_id = storage.objects.bucket_id and a.object_path = storage.objects.name and a.client_id = public.current_client_id()));
create policy invitation_objects_delete on storage.objects for delete to authenticated using (bucket_id in ('invitation-assets-private','invitation-assets-public') and exists (select 1 from public.invitation_assets a where a.bucket_id = storage.objects.bucket_id and a.object_path = storage.objects.name and a.client_id = public.current_client_id()));

revoke all on table public.platform_templates, public.wedding_event_configs, public.party_event_configs, public.design_drafts, public.invitation_assets, public.event_guests, public.event_guest_tags, public.event_guest_tag_assignments, public.personal_invitations, public.general_invitations from anon, authenticated;
grant select, insert, update, delete on table public.platform_templates to authenticated;
grant select on table public.wedding_event_configs, public.party_event_configs, public.personal_invitations, public.general_invitations to authenticated;
grant select, delete on table public.design_drafts to authenticated;
grant select, update, delete on table public.invitation_assets, public.event_guests, public.event_guest_tags, public.event_guest_tag_assignments to authenticated;
grant insert on table public.event_guest_tags, public.event_guest_tag_assignments to authenticated;

revoke all on function private.token_hash(text), private.new_invitation_token(), private.public_invitation_configuration(jsonb), private.event_public_state(uuid), private.set_event_owner(), private.protect_guest_assignment(), private.protect_asset(), private.validate_rsvp(public.events, public.event_guests, text, integer, text[], text) from public, anon, authenticated;
revoke all on function public.save_wedding_event_config(uuid, jsonb, uuid, jsonb, uuid, bigint), public.save_party_event_config(uuid, jsonb, uuid, jsonb, bigint), public.create_design_draft(text, text, jsonb, uuid, jsonb), public.save_design_draft(uuid, text, jsonb, uuid, jsonb, bigint), public.reserve_invitation_asset(text, uuid, text, text, bigint, uuid), public.create_event_guest(uuid, text, text, integer, text), public.rotate_personal_invitation(uuid), public.create_general_invitation(uuid), public.revoke_personal_invitation(uuid), public.revoke_general_invitation(uuid), public.resolve_invitation(text), public.record_invitation_open(text), public.submit_personal_rsvp(text, text, integer, text[], text), public.submit_general_rsvp(text, uuid, text, text, integer, text[], text) from public, anon, authenticated;
grant execute on function public.save_wedding_event_config(uuid, jsonb, uuid, jsonb, uuid, bigint), public.save_party_event_config(uuid, jsonb, uuid, jsonb, bigint), public.create_design_draft(text, text, jsonb, uuid, jsonb), public.save_design_draft(uuid, text, jsonb, uuid, jsonb, bigint), public.reserve_invitation_asset(text, uuid, text, text, bigint, uuid), public.create_event_guest(uuid, text, text, integer, text), public.rotate_personal_invitation(uuid), public.create_general_invitation(uuid), public.revoke_personal_invitation(uuid), public.revoke_general_invitation(uuid) to authenticated;
grant execute on function public.resolve_invitation(text), public.record_invitation_open(text), public.submit_personal_rsvp(text, text, integer, text[], text), public.submit_general_rsvp(text, uuid, text, text, integer, text[], text) to anon, authenticated;

commit;
