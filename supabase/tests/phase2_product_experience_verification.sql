-- Read-only verification for 20260903000100_phase2_product_experience_foundation.sql.
-- Expected: one row; every boolean is true, party_v2_templates = 4,
-- and mutable_event_triggers = 8.

select
  to_regprocedure(
    'public.admin_set_entitlement(uuid,text,text,timestamp with time zone,timestamp with time zone,jsonb)'
  ) is not null as extended_entitlement_rpc,
  (
    select count(*) = 4
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entitlement_admin_activity'
      and column_name in (
        'previous_starts_at', 'new_starts_at',
        'previous_policy_overrides', 'new_policy_overrides'
      )
  ) as entitlement_history_columns,
  (
    select count(*)
    from public.platform_templates
    where product_id = 'party'
      and version = 1
      and renderer_key in ('corporate', 'birthday', 'baby-shower', 'custom')
      and active
  ) as party_v2_templates,
  (
    select count(*)
    from pg_trigger
    where not tgisinternal
      and tgname like '%_require_mutable_event'
  ) as mutable_event_triggers,
  position(
    'Archived and cancelled Events are read-only.'
    in pg_get_functiondef('private.protect_event_fields()'::regprocedure)
  ) > 0 as terminal_event_guard,
  position(
    'Ended, archived, cancelled, and soft-deleted Events are read-only.'
    in pg_get_functiondef('private.require_mutable_event()'::regprocedure)
  ) > 0 as operational_mutation_guard,
  (
    select count(*) = 3
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'invitation_objects_insert',
        'invitation_objects_update',
        'invitation_objects_delete'
      )
      and coalesce(qual, with_check, '') like '%lifecycle_status%'
  ) as terminal_storage_guard;
