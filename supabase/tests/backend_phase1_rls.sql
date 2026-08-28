-- Run manually only after the Phase 1 migration, two Client identities, and one
-- platform_admins assignment exist. Every temporary mutation rolls back.
begin;

create temporary table phase1_test_identities as
select
  (select identity.user_id from public.client_identities as identity where not exists (select 1 from public.platform_admins as admin where admin.user_id = identity.user_id) order by identity.created_at limit 1) as client_a_user_id,
  (select identity.client_id from public.client_identities as identity where not exists (select 1 from public.platform_admins as admin where admin.user_id = identity.user_id) order by identity.created_at limit 1) as client_a_id,
  (select identity.user_id from public.client_identities as identity where not exists (select 1 from public.platform_admins as admin where admin.user_id = identity.user_id) order by identity.created_at offset 1 limit 1) as client_b_user_id,
  (select identity.client_id from public.client_identities as identity where not exists (select 1 from public.platform_admins as admin where admin.user_id = identity.user_id) order by identity.created_at offset 1 limit 1) as client_b_id,
  (select user_id from public.platform_admins order by created_at limit 1) as admin_user_id;

do $$
begin
  if exists (
    select 1 from phase1_test_identities
    where client_a_user_id is null or client_a_id is null
       or client_b_user_id is null or client_b_id is null
       or admin_user_id is null
  ) then
    raise exception 'Prerequisite: create two Client identities and assign one platform_admin before running this test.';
  end if;
end;
$$;

insert into public.client_entitlements (client_id, product_id, status)
select client_a_id, 'wedding', 'active' from phase1_test_identities
on conflict (client_id, product_id) do update
set status = 'active', starts_at = now(), ends_at = null;

insert into public.client_entitlements (client_id, product_id, status)
select client_b_id, 'wedding', 'active' from phase1_test_identities
on conflict (client_id, product_id) do update
set status = 'active', starts_at = now(), ends_at = null;

grant select on phase1_test_identities to authenticated, anon;

select set_config('request.jwt.claim.sub', (select client_a_user_id::text from phase1_test_identities), true);
set local role authenticated;

do $$
declare
  own_client_id uuid := public.current_client_id();
  other_client_id uuid := (select client_b_id from phase1_test_identities);
  event_row public.events;
begin
  if (select count(*) from public.clients) <> 1 then
    raise exception 'FAIL: Client A must see exactly one Client.';
  end if;
  if exists (select 1 from public.clients where id = other_client_id) then
    raise exception 'FAIL: Client A can read Client B.';
  end if;
  if (select count(*) from public.client_entitlements where client_id <> own_client_id) <> 0 then
    raise exception 'FAIL: Client A can read another Client entitlement.';
  end if;
  if exists (select 1 from public.platform_admins) then
    raise exception 'FAIL: Client A can read platform_admins.';
  end if;

  update public.clients set display_name = display_name where id = other_client_id;
  if found then
    raise exception 'FAIL: Client A mutated Client B.';
  end if;

  begin
    update public.clients set status = 'suspended' where id = own_client_id;
    raise exception 'FAIL: Client A changed protected Client status.';
  exception when insufficient_privilege then null;
  end;

  update public.client_entitlements set status = 'cancelled' where client_id = own_client_id;
  if found then
    raise exception 'FAIL: Client A modified an entitlement.';
  end if;

  begin
    insert into public.platform_admins (user_id) values (auth.uid());
    raise exception 'FAIL: Client A self-promoted.';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.create_event('wedding', 'Spoofed owner', 'ar', null, null, null, null, null, other_client_id);
    raise exception 'FAIL: Client A spoofed Client B ownership.';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.create_event('party', 'Missing entitlement');
    raise exception 'FAIL: Event creation without entitlement succeeded.';
  exception when insufficient_privilege then null;
  end;

  event_row := public.create_event('wedding', 'Phase 1 RLS test');
  if event_row.client_id <> own_client_id then
    raise exception 'FAIL: create_event did not derive Client A ownership.';
  end if;

  begin
    update public.events set client_id = other_client_id where id = event_row.id;
    raise exception 'FAIL: Client A transferred Event ownership.';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.events set product_id = 'party' where id = event_row.id;
    raise exception 'FAIL: Client A changed Event product.';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.events where id = event_row.id;
    raise exception 'FAIL: Client A hard-deleted an Event.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select client_b_user_id::text from phase1_test_identities), true);
set local role authenticated;

do $$
begin
  if exists (
    select 1 from public.clients
    where id = (select client_a_id from phase1_test_identities)
  ) then
    raise exception 'FAIL: Client B can read Client A.';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select admin_user_id::text from phase1_test_identities), true);
set local role authenticated;

do $$
declare
  admin_event public.events;
begin
  if not public.is_platform_admin() then
    raise exception 'FAIL: platform administrator was not recognized.';
  end if;
  if (select count(*) from public.clients) < 2 then
    raise exception 'FAIL: platform administrator cannot read platform Clients.';
  end if;
  admin_event := public.create_event(
    'wedding', 'Phase 1 Admin RLS test', 'ar', null, null, null, null, null,
    (select client_a_id from phase1_test_identities)
  );
  if admin_event.client_id <> (select client_a_id from phase1_test_identities) then
    raise exception 'FAIL: platform administrator Event has the wrong target Client.';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $$
begin
  begin
    perform 1 from public.clients;
    raise exception 'FAIL: anonymous role read Clients.';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.events;
    raise exception 'FAIL: anonymous role read Events.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
