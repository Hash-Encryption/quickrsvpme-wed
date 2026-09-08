-- ==============================================================================
-- MIGRATION: 20260909000100_temporary_build_entitlements.sql
-- PURPOSE: Provide temporary bounded build entitlements (5 events per product)
--          for authenticated customer clients during development & testing.
-- STATUS: DRAFT / AWAITING USER APPROVAL (NOT AUTOMATICALLY APPLIED)
-- ==============================================================================

-- 1. Temporary Build Access Policy Function:
-- Updates private.has_product_access to grant bounded temporary build access (5 events per product)
-- to active authenticated clients if they do not yet have an explicit commercial entitlement.

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
  -- Check if client is active, product is enabled, and existing published events < 5
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

    -- Bounded to 5 usable active/test events per product during temporary build mode
    if active_events_count < 5 then
      return true;
    end if;
  end if;

  return false;
end;
$$;

revoke all on function private.has_product_access(uuid, text) from public, anon, authenticated;

-- ==============================================================================
-- REMOVAL / ROLLBACK PLAN:
-- When real commercial subscriptions / billing are deployed, restore the original
-- private.has_product_access function:
--
-- create or replace function private.has_product_access(p_client_id uuid, p_product_id text)
-- returns boolean
-- language sql
-- stable
-- security definer
-- set search_path = ''
-- as $$
--   select exists (
--     select 1
--     from public.clients as client
--     join public.client_entitlements as entitlement on entitlement.client_id = client.id
--     join public.products as product on product.id = entitlement.product_id
--     where client.id = p_client_id
--       and client.status = 'active'
--       and product.id = p_product_id
--       and product.enabled
--       and entitlement.status = 'active'
--       and entitlement.starts_at <= now()
--       and (entitlement.ends_at is null or entitlement.ends_at > now())
--   );
-- $$;
-- ==============================================================================
