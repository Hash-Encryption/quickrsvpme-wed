-- Read-only verification for 20260904000100_phase3_general_invitation_requests.sql.
-- Expected: one row and every column is true.

with functions as (
  select
    p.oid,
    p.proname,
    p.prosecdef,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.oid in (
      to_regprocedure('public.submit_general_invitation_request(text,uuid,text,text)'),
      to_regprocedure('public.get_general_invitation_request_status(text,uuid)'),
      to_regprocedure('public.list_general_invitation_requests(uuid)'),
      to_regprocedure('public.review_general_invitation_request(uuid,uuid,text)')
    )
), submit_request as (
  select * from functions where proname = 'submit_general_invitation_request'
), request_status as (
  select * from functions where proname = 'get_general_invitation_request_status'
), list_requests as (
  select * from functions where proname = 'list_general_invitation_requests'
), review_request as (
  select * from functions where proname = 'review_general_invitation_request'
)
select
  to_regclass('public.general_invitation_requests') is not null
    as request_table_exists,
  (
    select count(*) = 12
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'general_invitation_requests'
      and column_name in (
        'id', 'general_invitation_id', 'event_id', 'client_id',
        'name', 'phone', 'state', 'guest_id', 'reviewed_by',
        'reviewed_at', 'created_at', 'updated_at'
      )
  ) as request_columns_exist,
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'general_invitation_requests'
  ) as request_rls_enabled,
  not has_table_privilege('anon', 'public.general_invitation_requests', 'SELECT')
    and not has_table_privilege('anon', 'public.general_invitation_requests', 'INSERT')
    and not has_table_privilege('anon', 'public.general_invitation_requests', 'UPDATE')
    and not has_table_privilege('anon', 'public.general_invitation_requests', 'DELETE')
    as anon_has_no_table_access,
  not has_table_privilege('authenticated', 'public.general_invitation_requests', 'SELECT')
    and not has_table_privilege('authenticated', 'public.general_invitation_requests', 'INSERT')
    and not has_table_privilege('authenticated', 'public.general_invitation_requests', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.general_invitation_requests', 'DELETE')
    as authenticated_has_no_table_access,
  (
    select count(*) = 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'general_invitation_requests'
  ) as request_table_has_no_direct_policies,
  (
    select count(*) = 2
    from pg_trigger
    where tgrelid = 'public.general_invitation_requests'::regclass
      and not tgisinternal
      and tgname in (
        'general_invitation_requests_set_updated_at',
        'general_invitation_requests_require_mutable_event'
      )
  ) as request_triggers_exist,
  (select count(*) = 1 and bool_and(prosecdef) from submit_request)
    as submit_request_security_definer,
  (select count(*) = 1 and bool_and(prosecdef) from request_status)
    as request_status_security_definer,
  (select count(*) = 1 and bool_and(prosecdef) from list_requests)
    as list_requests_security_definer,
  (select count(*) = 1 and bool_and(prosecdef) from review_request)
    as review_request_security_definer,
  coalesce((
    select position('event_public_state' in definition) > 0
      and position('active' in definition) > 0
    from submit_request
  ), false) as public_submission_requires_active_event,
  coalesce((
    select position('for update' in lower(definition)) > 0
      and position('request.general_invitation_id <> invitation.id' in definition) > 0
    from submit_request
  ), false) as submission_is_idempotent_and_token_scoped,
  coalesce((
    select position('r.event_id = p_event_id' in definition) > 0
      and position('public.current_client_id()' in definition) > 0
    from list_requests
  ), false) as host_list_is_event_and_owner_scoped,
  coalesce((
    select position('for update' in lower(definition)) > 0
      and position('request.state <> ''awaiting''' in definition) > 0
      and position('general_request_id' in definition) > 0
      and position('public.personal_invitations' in definition) > 0
    from review_request
  ), false) as review_is_locked_idempotent_and_guest_integrated,
  has_function_privilege('anon', 'public.submit_general_invitation_request(text,uuid,text,text)', 'EXECUTE')
    as anon_can_submit_request,
  has_function_privilege('anon', 'public.get_general_invitation_request_status(text,uuid)', 'EXECUTE')
    as anon_can_read_own_token_scoped_status,
  not has_function_privilege('anon', 'public.list_general_invitation_requests(uuid)', 'EXECUTE')
    as anon_cannot_list_requests,
  not has_function_privilege('anon', 'public.review_general_invitation_request(uuid,uuid,text)', 'EXECUTE')
    as anon_cannot_review_requests,
  has_function_privilege('authenticated', 'public.list_general_invitation_requests(uuid)', 'EXECUTE')
    as authenticated_can_list_requests,
  has_function_privilege('authenticated', 'public.review_general_invitation_request(uuid,uuid,text)', 'EXECUTE')
    as authenticated_can_review_requests,
  not has_function_privilege(
    'anon',
    'public.submit_general_rsvp(text,uuid,text,text,integer,text[],text)',
    'EXECUTE'
  ) as legacy_general_rsvp_revoked_from_anon,
  not has_function_privilege(
    'authenticated',
    'public.submit_general_rsvp(text,uuid,text,text,integer,text[],text)',
    'EXECUTE'
  ) as legacy_general_rsvp_revoked_from_authenticated;
