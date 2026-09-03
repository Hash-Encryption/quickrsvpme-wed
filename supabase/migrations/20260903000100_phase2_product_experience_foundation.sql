begin;

alter table public.entitlement_admin_activity
  add column previous_starts_at timestamptz,
  add column new_starts_at timestamptz,
  add column previous_policy_overrides jsonb,
  add column new_policy_overrides jsonb,
  add constraint entitlement_admin_activity_previous_policy_object
    check (previous_policy_overrides is null or jsonb_typeof(previous_policy_overrides) = 'object'),
  add constraint entitlement_admin_activity_new_policy_object
    check (new_policy_overrides is null or jsonb_typeof(new_policy_overrides) = 'object');

create function public.admin_set_entitlement(
  p_client_id uuid,
  p_product_id text,
  p_status text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_policy_overrides jsonb
)
returns public.client_entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous public.client_entitlements;
  result public.client_entitlements;
  next_starts_at timestamptz;
  next_policy_overrides jsonb;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'Platform administrator access is required.' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended', 'cancelled', 'expired') then
    raise exception 'Entitlement status is invalid.' using errcode = '22023';
  end if;
  if p_policy_overrides is not null and jsonb_typeof(p_policy_overrides) <> 'object' then
    raise exception 'Entitlement policy overrides must be an object.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id)
    or not exists (select 1 from public.products where id = p_product_id)
  then
    raise exception 'Client or product was not found.' using errcode = '22023';
  end if;

  select * into previous
  from public.client_entitlements
  where client_id = p_client_id and product_id = p_product_id
  for update;

  next_starts_at := coalesce(p_starts_at, previous.starts_at, now());
  next_policy_overrides := coalesce(p_policy_overrides, previous.policy_overrides, '{}'::jsonb);

  if p_ends_at is not null and p_ends_at <= next_starts_at then
    raise exception 'Entitlement expiry must follow its start.' using errcode = '22023';
  end if;
  if p_status = 'active' and p_ends_at is not null and p_ends_at <= now() then
    raise exception 'An active entitlement cannot already be expired.' using errcode = '22023';
  end if;

  if previous.id is null then
    insert into public.client_entitlements(
      client_id, product_id, status, starts_at, ends_at, policy_overrides, created_by
    ) values (
      p_client_id, p_product_id, p_status, next_starts_at, p_ends_at,
      next_policy_overrides, auth.uid()
    ) returning * into result;
  else
    update public.client_entitlements
    set status = p_status,
        starts_at = next_starts_at,
        ends_at = p_ends_at,
        policy_overrides = next_policy_overrides
    where id = previous.id
    returning * into result;
  end if;

  insert into public.entitlement_admin_activity(
    entitlement_id, client_id, product_id, actor_user_id,
    previous_status, new_status,
    previous_starts_at, new_starts_at,
    previous_ends_at, new_ends_at,
    previous_policy_overrides, new_policy_overrides
  ) values (
    result.id, result.client_id, result.product_id, auth.uid(),
    previous.status, result.status,
    previous.starts_at, result.starts_at,
    previous.ends_at, result.ends_at,
    previous.policy_overrides, result.policy_overrides
  );

  return result;
end;
$$;

create or replace function public.admin_set_entitlement(
  p_client_id uuid,
  p_product_id text,
  p_status text,
  p_ends_at timestamptz default null
)
returns public.client_entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.client_entitlements;
begin
  select public.admin_set_entitlement(
    p_client_id,
    p_product_id,
    p_status,
    null::timestamptz,
    p_ends_at,
    null::jsonb
  ) into result;
  return result;
end;
$$;

create function private.require_mutable_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid;
  event_row public.events;
begin
  target_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  if target_event_id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select * into event_row from public.events where id = target_event_id;
  if event_row.id is null then
    raise exception 'Event was not found.' using errcode = '23503';
  end if;
  if event_row.deleted_at is not null
    or event_row.lifecycle_status not in ('planning', 'active')
  then
    raise exception 'Ended, archived, cancelled, and soft-deleted Events are read-only.' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.protect_event_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.client_id is distinct from old.client_id
    or new.product_id is distinct from old.product_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Event identity, owner, product, and creation time are immutable.' using errcode = '42501';
  end if;

  if old.deleted_at is not null then
    raise exception 'A soft-deleted Event is read-only.' using errcode = '42501';
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    if new.deleted_at is null
      or (to_jsonb(new) - 'deleted_at' - 'updated_at')
         is distinct from (to_jsonb(old) - 'deleted_at' - 'updated_at')
    then
      raise exception 'Event soft delete cannot be combined with another change or reversed.' using errcode = '42501';
    end if;
    new.deleted_at := now();
    return new;
  end if;

  if old.lifecycle_status in ('archived', 'cancelled') then
    raise exception 'Archived and cancelled Events are read-only.' using errcode = '42501';
  end if;

  if old.lifecycle_status = 'ended' then
    if new.lifecycle_status not in ('ended', 'archived', 'cancelled')
      or (to_jsonb(new) - 'lifecycle_status' - 'archived_at' - 'updated_at')
         is distinct from (to_jsonb(old) - 'lifecycle_status' - 'archived_at' - 'updated_at')
    then
      raise exception 'An ended Event may only be archived or cancelled.' using errcode = '42501';
    end if;
  end if;

  if new.lifecycle_status = 'archived' then
    new.archived_at := coalesce(old.archived_at, now());
  else
    new.archived_at := null;
  end if;
  return new;
end;
$$;

create trigger wedding_event_configs_require_mutable_event
before insert or update or delete on public.wedding_event_configs
for each row execute function private.require_mutable_event();

create trigger party_event_configs_require_mutable_event
before insert or update or delete on public.party_event_configs
for each row execute function private.require_mutable_event();

create trigger event_guests_require_mutable_event
before insert or update or delete on public.event_guests
for each row execute function private.require_mutable_event();

create trigger event_guest_tags_require_mutable_event
before insert or update or delete on public.event_guest_tags
for each row execute function private.require_mutable_event();

create trigger event_guest_tag_assignments_require_mutable_event
before insert or update or delete on public.event_guest_tag_assignments
for each row execute function private.require_mutable_event();

create trigger personal_invitations_require_mutable_event
before insert or update or delete on public.personal_invitations
for each row execute function private.require_mutable_event();

create trigger general_invitations_require_mutable_event
before insert or update or delete on public.general_invitations
for each row execute function private.require_mutable_event();

create trigger invitation_assets_require_mutable_event
before insert or update or delete on public.invitation_assets
for each row execute function private.require_mutable_event();

drop policy invitation_objects_insert on storage.objects;
create policy invitation_objects_insert on storage.objects
for insert to authenticated
with check (
  bucket_id in ('invitation-assets-private', 'invitation-assets-public')
  and exists (
    select 1
    from public.invitation_assets a
    where a.bucket_id = storage.objects.bucket_id
      and a.object_path = storage.objects.name
      and a.client_id = public.current_client_id()
      and a.status = 'reserved'
      and (
        a.draft_id is not null
        or exists (
          select 1 from public.events e
          where e.id = a.event_id
            and e.deleted_at is null
            and e.lifecycle_status in ('planning', 'active')
        )
      )
  )
);

drop policy invitation_objects_update on storage.objects;
create policy invitation_objects_update on storage.objects
for update to authenticated
using (
  bucket_id in ('invitation-assets-private', 'invitation-assets-public')
  and exists (
    select 1
    from public.invitation_assets a
    where a.bucket_id = storage.objects.bucket_id
      and a.object_path = storage.objects.name
      and a.client_id = public.current_client_id()
      and (
        a.draft_id is not null
        or exists (
          select 1 from public.events e
          where e.id = a.event_id
            and e.deleted_at is null
            and e.lifecycle_status in ('planning', 'active')
        )
      )
  )
)
with check (
  bucket_id in ('invitation-assets-private', 'invitation-assets-public')
  and exists (
    select 1
    from public.invitation_assets a
    where a.bucket_id = storage.objects.bucket_id
      and a.object_path = storage.objects.name
      and a.client_id = public.current_client_id()
      and (
        a.draft_id is not null
        or exists (
          select 1 from public.events e
          where e.id = a.event_id
            and e.deleted_at is null
            and e.lifecycle_status in ('planning', 'active')
        )
      )
  )
);

drop policy invitation_objects_delete on storage.objects;
create policy invitation_objects_delete on storage.objects
for delete to authenticated
using (
  bucket_id in ('invitation-assets-private', 'invitation-assets-public')
  and exists (
    select 1
    from public.invitation_assets a
    where a.bucket_id = storage.objects.bucket_id
      and a.object_path = storage.objects.name
      and a.client_id = public.current_client_id()
      and (
        a.draft_id is not null
        or exists (
          select 1 from public.events e
          where e.id = a.event_id
            and e.deleted_at is null
            and e.lifecycle_status in ('planning', 'active')
        )
      )
  )
);

insert into public.platform_templates(
  product_id, renderer_key, version, active, render_snapshot, metadata
)
values
  ('party', 'corporate', 1, true, '{"templateId":"corporate"}', '{"category":"corporate","phase":"party_v2","source":"frontend_registry"}'),
  ('party', 'birthday', 1, true, '{"templateId":"birthday"}', '{"category":"birthday","phase":"party_v2","source":"frontend_registry"}'),
  ('party', 'baby-shower', 1, true, '{"templateId":"baby-shower"}', '{"category":"baby_shower","phase":"party_v2","source":"frontend_registry"}'),
  ('party', 'custom', 1, true, '{"templateId":"custom"}', '{"category":"general_celebration","phase":"party_v2","source":"frontend_registry"}')
on conflict (product_id, renderer_key, version) do nothing;

revoke all on function private.require_mutable_event() from public, anon, authenticated;
revoke all on function public.admin_set_entitlement(uuid, text, text, timestamptz, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.admin_set_entitlement(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_set_entitlement(uuid, text, text, timestamptz, timestamptz, jsonb) to authenticated;
grant execute on function public.admin_set_entitlement(uuid, text, text, timestamptz) to authenticated;

commit;
