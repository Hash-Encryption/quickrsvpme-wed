-- ==============================================================================
-- MIGRATION: 20260909000200_draft_allowance_and_safe_delete.sql
-- PURPOSE: 
--   1. Increase design draft allowance to 20 for Wedding & Party in product_policies.
--   2. Increase temporary build event allowance to 20 per product in private.has_product_access.
--   3. Authoritative preflight RPC (get_design_draft_delete_plan) confirming eligibility
--      and returning draft-owned Storage assets before any files are removed.
--   4. Authoritative safe unpublished-draft deletion RPC (delete_design_draft)
--      rechecking all authorization + event-linkage boundaries before deleting metadata & draft.
-- STATUS: DRAFT / AWAITING USER APPROVAL (NOT AUTOMATICALLY APPLIED)
-- ==============================================================================

-- 1. Increase draft limits in product policies from 2 to 20
update public.product_policies
set configuration = jsonb_set(configuration, '{design_draft_limit}', '20'::jsonb)
where product_id in ('wedding', 'party');

-- 2. Update temporary build event allowance to 20 in private.has_product_access
create or replace function private.has_product_access(p_client_id uuid, p_product_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  has_explicit_entitlement boolean := false;
  active_events_count integer := 0;
begin
  -- First check explicit commercial entitlements from the database
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
  ) into has_explicit_entitlement;

  if has_explicit_entitlement then
    return true;
  end if;

  -- Temporary build-mode allowance for authenticated clients:
  -- Bounded to 20 usable active/test events per product
  if exists (
    select 1
    from public.clients as client
    join public.products as product on product.id = p_product_id
    where client.id = p_client_id
      and client.status = 'active'
      and product.enabled
  ) then
    select count(*)
    from public.events as e
    where e.client_id = p_client_id
      and e.product_id = p_product_id
      and e.deleted_at is null
      and e.archived_at is null
      and e.lifecycle_status in ('planning', 'active')
    into active_events_count;

    if active_events_count < 20 then
      return true;
    end if;
  end if;

  return false;
end;
$$;

revoke all on function private.has_product_access(uuid, text) from public, anon, authenticated;

-- 3. Authoritative preflight RPC: verifies eligibility & returns draft-owned assets
create or replace function public.get_design_draft_delete_plan(p_draft_id uuid)
returns table (
  asset_id uuid,
  bucket_id text,
  object_path text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_client_id uuid;
  v_draft public.design_drafts;
begin
  -- 1. Authentication check
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  -- 2. Authorization check: Admin or matching Client
  if public.is_platform_admin() then
    select * into v_draft
    from public.design_drafts
    where id = p_draft_id;
  else
    caller_client_id := public.current_client_id();
    if caller_client_id is null then
      raise exception 'Client identity was not found.' using errcode = '42501';
    end if;

    select * into v_draft
    from public.design_drafts
    where id = p_draft_id
      and client_id = caller_client_id;
  end if;

  if v_draft.id is null then
    raise exception 'Design Draft was not found.' using errcode = 'P0002';
  end if;

  -- 3. Published / event-linked check
  if exists (
    select 1
    from public.events
    where source_draft_id = p_draft_id
  ) then
    raise exception 'Draft is linked to an existing event and cannot be deleted.' using errcode = '42501';
  end if;

  -- 4. Return authorized draft-owned assets for Storage API cleanup
  return query
  select a.id as asset_id, a.bucket_id, a.object_path
  from public.invitation_assets a
  where a.draft_id = p_draft_id;
end;
$$;

revoke all on function public.get_design_draft_delete_plan(uuid) from public, anon;
grant execute on function public.get_design_draft_delete_plan(uuid) to authenticated;

-- 4. Authoritative safe unpublished-draft deletion RPC
create or replace function public.delete_design_draft(p_draft_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_client_id uuid;
  v_draft public.design_drafts;
begin
  -- 1. Recheck authentication
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  -- 2. Recheck authorization: Admin or matching Client
  if public.is_platform_admin() then
    select * into v_draft
    from public.design_drafts
    where id = p_draft_id;
  else
    caller_client_id := public.current_client_id();
    if caller_client_id is null then
      raise exception 'Client identity was not found.' using errcode = '42501';
    end if;

    select * into v_draft
    from public.design_drafts
    where id = p_draft_id
      and client_id = caller_client_id;
  end if;

  if v_draft.id is null then
    raise exception 'Design Draft was not found.' using errcode = 'P0002';
  end if;

  -- 3. Recheck event linkage
  if exists (
    select 1
    from public.events
    where source_draft_id = p_draft_id
  ) then
    raise exception 'Draft is linked to an existing event and cannot be deleted.' using errcode = '42501';
  end if;

  -- 4. Disassociate artwork asset from draft row to avoid circular FK restraint
  update public.design_drafts
  set artwork_asset_id = null
  where id = p_draft_id;

  -- 5. Remove draft-owned invitation asset metadata rows
  delete from public.invitation_assets
  where draft_id = p_draft_id;

  -- 6. Permanently delete the draft row
  delete from public.design_drafts
  where id = p_draft_id;

  return true;
end;
$$;

revoke all on function public.delete_design_draft(uuid) from public, anon;
grant execute on function public.delete_design_draft(uuid) to authenticated;
