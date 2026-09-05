begin;

do $$
declare
  target record;
begin
  for target in
    select *
    from (values
      ('event_guest_tags', 'event_guest_tags_client_id_idx'),
      ('event_guest_tag_assignments', 'event_guest_tag_assignments_client_id_idx'),
      ('personal_invitations', 'personal_invitations_client_id_idx'),
      ('general_invitations', 'general_invitations_client_id_idx'),
      ('event_checkin_activity', 'event_checkin_activity_client_id_idx')
    ) as targets(table_name, index_name)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_index i
      join pg_catalog.pg_class table_class on table_class.oid = i.indrelid
      join pg_catalog.pg_class index_class on index_class.oid = i.indexrelid
      join pg_catalog.pg_namespace table_namespace on table_namespace.oid = table_class.relnamespace
      join pg_catalog.pg_am access_method on access_method.oid = index_class.relam
      join pg_catalog.pg_attribute first_key
        on first_key.attrelid = table_class.oid
       and first_key.attnum = i.indkey[0]
      where table_namespace.nspname = 'public'
        and table_class.relname = target.table_name
        and access_method.amname = 'btree'
        and i.indisvalid
        and i.indisready
        and i.indnkeyatts >= 1
        and i.indpred is null
        and i.indexprs is null
        and first_key.attname = 'client_id'
    ) then
      execute format(
        'create index %I on public.%I (client_id)',
        target.index_name,
        target.table_name
      );
    end if;
  end loop;
end;
$$;

drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated
using (id = (select public.current_client_id()) or (select public.is_platform_admin()));

drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated
using (id = (select public.current_client_id()) or (select public.is_platform_admin()))
with check (id = (select public.current_client_id()) or (select public.is_platform_admin()));

drop policy if exists client_identities_select on public.client_identities;
create policy client_identities_select on public.client_identities for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_platform_admin()));

drop policy if exists platform_admins_select on public.platform_admins;
create policy platform_admins_select on public.platform_admins for select to authenticated
using ((select public.is_platform_admin()));

drop policy if exists products_select on public.products;
create policy products_select on public.products for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists product_policies_select on public.product_policies;
create policy product_policies_select on public.product_policies for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists product_policies_admin_insert on public.product_policies;
create policy product_policies_admin_insert on public.product_policies for insert to authenticated
with check ((select public.is_platform_admin()));

drop policy if exists product_policies_admin_update on public.product_policies;
create policy product_policies_admin_update on public.product_policies for update to authenticated
using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

drop policy if exists product_policies_admin_delete on public.product_policies;
create policy product_policies_admin_delete on public.product_policies for delete to authenticated
using ((select public.is_platform_admin()));

drop policy if exists client_entitlements_select on public.client_entitlements;
create policy client_entitlements_select on public.client_entitlements for select to authenticated
using (client_id = (select public.current_client_id()) or (select public.is_platform_admin()));

drop policy if exists client_entitlements_admin_insert on public.client_entitlements;
create policy client_entitlements_admin_insert on public.client_entitlements for insert to authenticated
with check ((select public.is_platform_admin()));

drop policy if exists client_entitlements_admin_update on public.client_entitlements;
create policy client_entitlements_admin_update on public.client_entitlements for update to authenticated
using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

drop policy if exists client_entitlements_admin_delete on public.client_entitlements;
create policy client_entitlements_admin_delete on public.client_entitlements for delete to authenticated
using ((select public.is_platform_admin()));

drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated
using (client_id = (select public.current_client_id()) or (select public.is_platform_admin()));

drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
using (client_id = (select public.current_client_id()) or (select public.is_platform_admin()))
with check (client_id = (select public.current_client_id()) or (select public.is_platform_admin()));

drop policy if exists platform_templates_select on public.platform_templates;
create policy platform_templates_select on public.platform_templates for select to authenticated
using (active or (select public.is_platform_admin()));

drop policy if exists platform_templates_admin_all on public.platform_templates;
create policy platform_templates_admin_all on public.platform_templates for all to authenticated
using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

drop policy if exists wedding_event_configs_owner_all on public.wedding_event_configs;
create policy wedding_event_configs_owner_all on public.wedding_event_configs for all to authenticated
using (client_id = (select public.current_client_id()) or (select public.is_platform_admin()))
with check (client_id = (select public.current_client_id()) or (select public.is_platform_admin()));

drop policy if exists party_event_configs_owner_all on public.party_event_configs;
create policy party_event_configs_owner_all on public.party_event_configs for all to authenticated
using (client_id = (select public.current_client_id()) or (select public.is_platform_admin()))
with check (client_id = (select public.current_client_id()) or (select public.is_platform_admin()));

drop policy if exists design_drafts_owner_all on public.design_drafts;
create policy design_drafts_owner_all on public.design_drafts for all to authenticated
using (client_id = (select public.current_client_id()) or (select public.is_platform_admin()))
with check (client_id = (select public.current_client_id()) or (select public.is_platform_admin()));

drop policy if exists invitation_assets_owner_all on public.invitation_assets;
create policy invitation_assets_owner_all on public.invitation_assets for all to authenticated
using (client_id = (select public.current_client_id()) or (select public.is_platform_admin()))
with check (client_id = (select public.current_client_id()) or (select public.is_platform_admin()));

drop policy if exists event_guests_owner_all on public.event_guests;
create policy event_guests_owner_all on public.event_guests for all to authenticated
using (client_id = (select public.current_client_id()) or (select public.is_platform_admin()))
with check (client_id = (select public.current_client_id()) or (select public.is_platform_admin()));

drop policy if exists event_guest_tags_owner_all on public.event_guest_tags;
create policy event_guest_tags_owner_all on public.event_guest_tags for all to authenticated
using (client_id = (select public.current_client_id()) or (select public.is_platform_admin()))
with check (client_id = (select public.current_client_id()) or (select public.is_platform_admin()));

drop policy if exists event_guest_tag_assignments_owner_all on public.event_guest_tag_assignments;
create policy event_guest_tag_assignments_owner_all on public.event_guest_tag_assignments for all to authenticated
using (client_id = (select public.current_client_id()) or (select public.is_platform_admin()))
with check (client_id = (select public.current_client_id()) or (select public.is_platform_admin()));

drop policy if exists personal_invitations_owner_all on public.personal_invitations;
create policy personal_invitations_owner_all on public.personal_invitations for all to authenticated
using (client_id = (select public.current_client_id()) or (select public.is_platform_admin()))
with check (client_id = (select public.current_client_id()) or (select public.is_platform_admin()));

drop policy if exists general_invitations_owner_all on public.general_invitations;
create policy general_invitations_owner_all on public.general_invitations for all to authenticated
using (client_id = (select public.current_client_id()) or (select public.is_platform_admin()))
with check (client_id = (select public.current_client_id()) or (select public.is_platform_admin()));

drop policy if exists event_checkin_activity_select on public.event_checkin_activity;
create policy event_checkin_activity_select on public.event_checkin_activity for select to authenticated
using (client_id = (select public.current_client_id()) or (select public.is_platform_admin()));

drop policy if exists entitlement_admin_activity_select on public.entitlement_admin_activity;
create policy entitlement_admin_activity_select on public.entitlement_admin_activity for select to authenticated
using ((select public.is_platform_admin()));

drop policy if exists invitation_private_objects_select on storage.objects;
create policy invitation_private_objects_select on storage.objects for select to authenticated
using (
  bucket_id = 'invitation-assets-private'
  and exists (
    select 1 from public.invitation_assets a
    where a.bucket_id = storage.objects.bucket_id
      and a.object_path = storage.objects.name
      and a.client_id = (select public.current_client_id())
  )
);

drop policy if exists invitation_objects_insert on storage.objects;
create policy invitation_objects_insert on storage.objects for insert to authenticated
with check (
  bucket_id in ('invitation-assets-private', 'invitation-assets-public')
  and exists (
    select 1 from public.invitation_assets a
    where a.bucket_id = storage.objects.bucket_id
      and a.object_path = storage.objects.name
      and a.client_id = (select public.current_client_id())
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

drop policy if exists invitation_objects_update on storage.objects;
create policy invitation_objects_update on storage.objects for update to authenticated
using (
  bucket_id in ('invitation-assets-private', 'invitation-assets-public')
  and exists (
    select 1 from public.invitation_assets a
    where a.bucket_id = storage.objects.bucket_id
      and a.object_path = storage.objects.name
      and a.client_id = (select public.current_client_id())
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
    select 1 from public.invitation_assets a
    where a.bucket_id = storage.objects.bucket_id
      and a.object_path = storage.objects.name
      and a.client_id = (select public.current_client_id())
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

drop policy if exists invitation_objects_delete on storage.objects;
create policy invitation_objects_delete on storage.objects for delete to authenticated
using (
  bucket_id in ('invitation-assets-private', 'invitation-assets-public')
  and exists (
    select 1 from public.invitation_assets a
    where a.bucket_id = storage.objects.bucket_id
      and a.object_path = storage.objects.name
      and a.client_id = (select public.current_client_id())
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

notify pgrst, 'reload schema';

commit;
