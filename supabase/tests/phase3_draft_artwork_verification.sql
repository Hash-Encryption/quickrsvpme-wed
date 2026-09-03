with functions as (
  select
    p.proname,
    p.proargnames,
    p.prosecdef,
    p.oid,
    pg_get_function_result(p.oid) as result_type,
    pg_get_functiondef(p.oid) as definition,
    coalesce(p.proacl, acldefault('f', p.proowner)) as acl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('set_design_draft_artwork', 'set_design_draft_artwork_legacy')
    and oidvectortypes(p.proargtypes) = 'uuid, uuid'
), wrapper as (
  select * from functions where proname = 'set_design_draft_artwork'
), legacy as (
  select * from functions where proname = 'set_design_draft_artwork_legacy'
)
select
  exists (select 1 from wrapper) as wrapper_exists,
  coalesce((select proargnames = array['p_draft_id', 'p_artwork_asset_id'] from wrapper), false) as wrapper_arguments_match,
  coalesce((select result_type = 'design_drafts' from wrapper), false) as wrapper_result_matches,
  coalesce((select prosecdef from wrapper), false) as wrapper_security_definer,
  coalesce((select has_function_privilege('authenticated', oid, 'EXECUTE') from wrapper), false) as authenticated_can_execute_wrapper,
  not coalesce((select has_function_privilege('anon', oid, 'EXECUTE') from wrapper), false) as anon_cannot_execute_wrapper,
  not exists (
    select 1 from wrapper, aclexplode(wrapper.acl) acl
    where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
  ) as public_cannot_execute_wrapper,
  coalesce((select position('set_design_draft_artwork_legacy' in definition) > 0 from wrapper), false) as wrapper_delegates,
  exists (select 1 from legacy) as legacy_exists,
  coalesce((select proargnames = array['p_draft_id', 'p_asset_id'] from legacy), false) as legacy_arguments_preserved,
  coalesce((select prosecdef from legacy), false) as legacy_security_definer,
  not coalesce((select has_function_privilege('authenticated', oid, 'EXECUTE') from legacy), false) as authenticated_cannot_execute_legacy,
  not coalesce((select has_function_privilege('anon', oid, 'EXECUTE') from legacy), false) as anon_cannot_execute_legacy,
  not exists (
    select 1 from legacy, aclexplode(legacy.acl) acl
    where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
  ) as public_cannot_execute_legacy;
