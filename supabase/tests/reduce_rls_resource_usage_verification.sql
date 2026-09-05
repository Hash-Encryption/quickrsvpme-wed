-- Read-only verifier for 20260905000300_reduce_rls_resource_usage.sql.
-- Run after the migration. Every row must report PASS.

with
expected_policies(schema_name, table_name, policy_name, command, semantic_kind, needs_client, needs_admin, needs_uid) as (
  values
    ('public', 'clients', 'clients_select', 'SELECT', 'client_or_admin', true, true, false),
    ('public', 'clients', 'clients_update', 'UPDATE', 'client_or_admin_both', true, true, false),
    ('public', 'client_identities', 'client_identities_select', 'SELECT', 'user_or_admin', false, true, true),
    ('public', 'platform_admins', 'platform_admins_select', 'SELECT', 'admin', false, true, false),
    ('public', 'products', 'products_select', 'SELECT', 'signed_in', false, false, true),
    ('public', 'product_policies', 'product_policies_select', 'SELECT', 'signed_in', false, false, true),
    ('public', 'product_policies', 'product_policies_admin_insert', 'INSERT', 'admin_check', false, true, false),
    ('public', 'product_policies', 'product_policies_admin_update', 'UPDATE', 'admin_both', false, true, false),
    ('public', 'product_policies', 'product_policies_admin_delete', 'DELETE', 'admin', false, true, false),
    ('public', 'client_entitlements', 'client_entitlements_select', 'SELECT', 'owner_or_admin', true, true, false),
    ('public', 'client_entitlements', 'client_entitlements_admin_insert', 'INSERT', 'admin_check', false, true, false),
    ('public', 'client_entitlements', 'client_entitlements_admin_update', 'UPDATE', 'admin_both', false, true, false),
    ('public', 'client_entitlements', 'client_entitlements_admin_delete', 'DELETE', 'admin', false, true, false),
    ('public', 'events', 'events_select', 'SELECT', 'owner_or_admin', true, true, false),
    ('public', 'events', 'events_update', 'UPDATE', 'owner_or_admin_both', true, true, false),
    ('public', 'platform_templates', 'platform_templates_select', 'SELECT', 'active_or_admin', false, true, false),
    ('public', 'platform_templates', 'platform_templates_admin_all', 'ALL', 'admin_both', false, true, false),
    ('public', 'wedding_event_configs', 'wedding_event_configs_owner_all', 'ALL', 'owner_or_admin_both', true, true, false),
    ('public', 'party_event_configs', 'party_event_configs_owner_all', 'ALL', 'owner_or_admin_both', true, true, false),
    ('public', 'design_drafts', 'design_drafts_owner_all', 'ALL', 'owner_or_admin_both', true, true, false),
    ('public', 'invitation_assets', 'invitation_assets_owner_all', 'ALL', 'owner_or_admin_both', true, true, false),
    ('public', 'event_guests', 'event_guests_owner_all', 'ALL', 'owner_or_admin_both', true, true, false),
    ('public', 'event_guest_tags', 'event_guest_tags_owner_all', 'ALL', 'owner_or_admin_both', true, true, false),
    ('public', 'event_guest_tag_assignments', 'event_guest_tag_assignments_owner_all', 'ALL', 'owner_or_admin_both', true, true, false),
    ('public', 'personal_invitations', 'personal_invitations_owner_all', 'ALL', 'owner_or_admin_both', true, true, false),
    ('public', 'general_invitations', 'general_invitations_owner_all', 'ALL', 'owner_or_admin_both', true, true, false),
    ('public', 'event_checkin_activity', 'event_checkin_activity_select', 'SELECT', 'owner_or_admin', true, true, false),
    ('public', 'entitlement_admin_activity', 'entitlement_admin_activity_select', 'SELECT', 'admin', false, true, false),
    ('storage', 'objects', 'invitation_private_objects_select', 'SELECT', 'storage_private', true, false, false),
    ('storage', 'objects', 'invitation_objects_insert', 'INSERT', 'storage_insert', true, false, false),
    ('storage', 'objects', 'invitation_objects_update', 'UPDATE', 'storage_update', true, false, false),
    ('storage', 'objects', 'invitation_objects_delete', 'DELETE', 'storage_delete', true, false, false)
),
policy_state as (
  select
    expected.*,
    actual.roles,
    actual.cmd,
    actual.qual,
    actual.with_check,
    regexp_replace(lower(coalesce(actual.qual, '')), '\s+', '', 'g') as normalized_qual,
    regexp_replace(lower(coalesce(actual.with_check, '')), '\s+', '', 'g') as normalized_check
  from expected_policies expected
  left join pg_catalog.pg_policies actual
    on actual.schemaname = expected.schema_name
   and actual.tablename = expected.table_name
   and actual.policyname = expected.policy_name
),
policy_contract_checks as (
  select
    'policy_contract'::text as check_group,
    schema_name || '.' || table_name || '.' || policy_name as check_name,
    case
      when cmd is not null
       and cmd = command
       and roles = array['authenticated']::name[]
      then 'PASS' else 'FAIL'
    end as status,
    format('expected command=%s roles={authenticated}; actual command=%s roles=%s', command, coalesce(cmd, '<missing>'), coalesce(roles::text, '<missing>')) as detail
  from policy_state
),
policy_semantic_checks as (
  select
    'policy_predicate'::text as check_group,
    schema_name || '.' || table_name || '.' || policy_name as check_name,
    case semantic_kind
      when 'client_or_admin' then
        case when normalized_qual like '%id=%current_client_id()%'
               and normalized_qual like '%or%is_platform_admin()%'
             then 'PASS' else 'FAIL' end
      when 'client_or_admin_both' then
        case when normalized_qual like '%id=%current_client_id()%'
               and normalized_qual like '%or%is_platform_admin()%'
               and normalized_check like '%id=%current_client_id()%'
               and normalized_check like '%or%is_platform_admin()%'
             then 'PASS' else 'FAIL' end
      when 'user_or_admin' then
        case when normalized_qual like '%user_id=%auth.uid()%'
               and normalized_qual like '%or%is_platform_admin()%'
             then 'PASS' else 'FAIL' end
      when 'admin' then
        case when normalized_qual like '%is_platform_admin()%' then 'PASS' else 'FAIL' end
      when 'admin_check' then
        case when normalized_check like '%is_platform_admin()%' then 'PASS' else 'FAIL' end
      when 'admin_both' then
        case when normalized_qual like '%is_platform_admin()%'
               and normalized_check like '%is_platform_admin()%'
             then 'PASS' else 'FAIL' end
      when 'signed_in' then
        case when normalized_qual like '%auth.uid()%isnotnull%' then 'PASS' else 'FAIL' end
      when 'owner_or_admin' then
        case when normalized_qual like '%client_id=%current_client_id()%'
               and normalized_qual like '%or%is_platform_admin()%'
             then 'PASS' else 'FAIL' end
      when 'owner_or_admin_both' then
        case when normalized_qual like '%client_id=%current_client_id()%'
               and normalized_qual like '%or%is_platform_admin()%'
               and normalized_check like '%client_id=%current_client_id()%'
               and normalized_check like '%or%is_platform_admin()%'
             then 'PASS' else 'FAIL' end
      when 'active_or_admin' then
        case when normalized_qual like '%active%or%is_platform_admin()%' then 'PASS' else 'FAIL' end
      when 'storage_private' then
        case when normalized_qual like '%invitation-assets-private%'
               and normalized_qual like '%invitation_assets%'
               and normalized_qual like '%bucket_id%'
               and normalized_qual like '%object_path%'
               and normalized_qual like '%client_id=%current_client_id()%'
             then 'PASS' else 'FAIL' end
      when 'storage_insert' then
        case when normalized_check like '%invitation-assets-private%'
               and normalized_check like '%invitation-assets-public%'
               and normalized_check like '%invitation_assets%'
               and normalized_check like '%bucket_id%'
               and normalized_check like '%object_path%'
               and normalized_check like '%client_id=%current_client_id()%'
               and normalized_check like '%status%reserved%'
               and normalized_check like '%draft_id%isnotnull%'
               and normalized_check like '%events%'
               and normalized_check like '%event_id%'
               and normalized_check like '%deleted_at%isnull%'
               and normalized_check like '%lifecycle_status%planning%active%'
             then 'PASS' else 'FAIL' end
      when 'storage_update' then
        case when normalized_qual like '%invitation-assets-private%'
               and normalized_qual like '%invitation-assets-public%'
               and normalized_qual like '%client_id=%current_client_id()%'
               and normalized_qual like '%draft_id%isnotnull%'
               and normalized_qual like '%deleted_at%isnull%'
               and normalized_qual like '%lifecycle_status%planning%active%'
               and normalized_check like '%invitation-assets-private%'
               and normalized_check like '%invitation-assets-public%'
               and normalized_check like '%client_id=%current_client_id()%'
               and normalized_check like '%draft_id%isnotnull%'
               and normalized_check like '%deleted_at%isnull%'
               and normalized_check like '%lifecycle_status%planning%active%'
             then 'PASS' else 'FAIL' end
      when 'storage_delete' then
        case when normalized_qual like '%invitation-assets-private%'
               and normalized_qual like '%invitation-assets-public%'
               and normalized_qual like '%client_id=%current_client_id()%'
               and normalized_qual like '%draft_id%isnotnull%'
               and normalized_qual like '%deleted_at%isnull%'
               and normalized_qual like '%lifecycle_status%planning%active%'
             then 'PASS' else 'FAIL' end
      else 'FAIL'
    end as status,
    'authorization, ownership, admin, and lifecycle guards preserved'::text as detail
  from policy_state
),
helper_cache_checks as (
  select
    'policy_helper_cache'::text as check_group,
    schema_name || '.' || table_name || '.' || policy_name as check_name,
    case
      when (not needs_client or (
              (normalized_qual || normalized_check) like '%select%current_client_id()%'
              and regexp_replace(normalized_qual || normalized_check, '\(select(public\.)?current_client_id\(\)(as[a-z_][a-z0-9_]*)?\)', '', 'g') not like '%current_client_id()%'
           ))
       and (not needs_admin or (
              (normalized_qual || normalized_check) like '%select%is_platform_admin()%'
              and regexp_replace(normalized_qual || normalized_check, '\(select(public\.)?is_platform_admin\(\)(as[a-z_][a-z0-9_]*)?\)', '', 'g') not like '%is_platform_admin()%'
           ))
       and (not needs_uid or (
              (normalized_qual || normalized_check) like '%select%auth.uid()%'
              and regexp_replace(normalized_qual || normalized_check, '\(selectauth.uid\(\)(as[a-z_][a-z0-9_]*)?\)', '', 'g') not like '%auth.uid()%'
           ))
      then 'PASS' else 'FAIL'
    end as status,
    'every row-independent helper call is wrapped by a scalar SELECT'::text as detail
  from policy_state
),
expected_rls(schema_name, table_name) as (
  values
    ('public', 'clients'),
    ('public', 'client_identities'),
    ('public', 'platform_admins'),
    ('public', 'products'),
    ('public', 'product_policies'),
    ('public', 'client_entitlements'),
    ('public', 'events'),
    ('public', 'platform_templates'),
    ('public', 'wedding_event_configs'),
    ('public', 'party_event_configs'),
    ('public', 'design_drafts'),
    ('public', 'invitation_assets'),
    ('public', 'event_guests'),
    ('public', 'event_guest_tags'),
    ('public', 'event_guest_tag_assignments'),
    ('public', 'personal_invitations'),
    ('public', 'general_invitations'),
    ('public', 'event_checkin_activity'),
    ('public', 'entitlement_admin_activity'),
    ('storage', 'objects')
),
rls_checks as (
  select
    'rls_enabled'::text as check_group,
    expected.schema_name || '.' || expected.table_name as check_name,
    case when table_class.relrowsecurity then 'PASS' else 'FAIL' end as status,
    format('relrowsecurity=%s', coalesce(table_class.relrowsecurity::text, '<missing>')) as detail
  from expected_rls expected
  left join pg_catalog.pg_namespace table_namespace
    on table_namespace.nspname = expected.schema_name
  left join pg_catalog.pg_class table_class
    on table_class.relnamespace = table_namespace.oid
   and table_class.relname = expected.table_name
   and table_class.relkind in ('r', 'p')
),
index_targets(table_name) as (
  values
    ('event_guest_tags'),
    ('event_guest_tag_assignments'),
    ('personal_invitations'),
    ('general_invitations'),
    ('event_checkin_activity')
),
equivalent_indexes as (
  select
    table_class.relname as table_name,
    index_class.relname as index_name,
    indexes.indexdef
  from pg_catalog.pg_index index_catalog
  join pg_catalog.pg_class table_class on table_class.oid = index_catalog.indrelid
  join pg_catalog.pg_class index_class on index_class.oid = index_catalog.indexrelid
  join pg_catalog.pg_namespace table_namespace on table_namespace.oid = table_class.relnamespace
  join pg_catalog.pg_am access_method on access_method.oid = index_class.relam
  join pg_catalog.pg_attribute first_key
    on first_key.attrelid = table_class.oid
   and first_key.attnum = index_catalog.indkey[0]
  join pg_catalog.pg_indexes indexes
    on indexes.schemaname = table_namespace.nspname
   and indexes.tablename = table_class.relname
   and indexes.indexname = index_class.relname
  where table_namespace.nspname = 'public'
    and table_class.relname in (select table_name from index_targets)
    and access_method.amname = 'btree'
    and index_catalog.indisvalid
    and index_catalog.indisready
    and index_catalog.indnkeyatts >= 1
    and index_catalog.indpred is null
    and index_catalog.indexprs is null
    and first_key.attname = 'client_id'
),
index_checks as (
  select
    'client_id_index'::text as check_group,
    'public.' || target.table_name as check_name,
    case when count(equivalent.index_name) = 1 then 'PASS' else 'FAIL' end as status,
    format(
      'equivalent_count=%s; %s',
      count(equivalent.index_name),
      coalesce(string_agg(equivalent.index_name || ': ' || equivalent.indexdef, '; ' order by equivalent.index_name), '<none>')
    ) as detail
  from index_targets target
  left join equivalent_indexes equivalent using (table_name)
  group by target.table_name
),
checks as (
  select * from policy_contract_checks
  union all select * from policy_semantic_checks
  union all select * from helper_cache_checks
  union all select * from rls_checks
  union all select * from index_checks
)
select check_group, check_name, status, detail
from checks
order by
  case status when 'FAIL' then 0 else 1 end,
  check_group,
  check_name;
