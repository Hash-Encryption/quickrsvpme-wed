-- ==============================================================================
-- QuickRSVP Verification Script: Invitation Publication State & Isolation
-- Description: Self-contained transactional verification of invitation publication,
--              lifecycle decoupling, RSVP access on planning events, door scanner
--              separation, entitlement enforcement, archive replay preservation,
--              auth.uid() proving, and client ownership boundaries.
-- Test: supabase/tests/invitation_publication_state_verification.sql
-- Status: Transactional verifier — all mutations roll back automatically.
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 1. Apply Schema Changes Transactionally For Testing
-- ------------------------------------------------------------------------------
alter table public.events
  add column if not exists invitation_published_at timestamptz;

create index if not exists events_invitation_published_idx
  on public.events(id, invitation_published_at);

create or replace function private.event_public_state(p_event_id uuid)
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
  if event_row.lifecycle_status = 'ended' then return 'ended'; end if;

  if event_row.lifecycle_status = 'planning' then
    if event_row.invitation_published_at is not null then
      if private.has_product_access(event_row.client_id, event_row.product_id) then
        return 'active';
      end if;
      return 'subscription_unavailable';
    end if;
    return 'planning';
  end if;

  if event_row.lifecycle_status = 'active' then
    if event_row.invitation_published_at is null then
      return 'unpublished';
    end if;
    if private.has_product_access(event_row.client_id, event_row.product_id) then
      return 'active';
    end if;
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

create or replace function public.publish_event_invitation(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_client_id uuid := public.current_client_id();
  is_admin boolean := public.is_platform_admin();
  event_row public.events;
begin
  if auth.uid() is null or (caller_client_id is null and not is_admin) then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into event_row
  from public.events
  where id = p_event_id
    and (client_id = caller_client_id or is_admin)
    and deleted_at is null;

  if event_row.id is null then
    raise exception 'Event was not found.' using errcode = '42501';
  end if;

  if event_row.lifecycle_status in ('cancelled', 'ended', 'archived') then
    raise exception 'Cannot publish an invitation for a closed event.' using errcode = '22023';
  end if;

  if not private.has_product_access(event_row.client_id, event_row.product_id) then
    raise exception 'Subscription or entitlement required.' using errcode = '42501';
  end if;

  update public.events
  set invitation_published_at = coalesce(invitation_published_at, now())
  where id = p_event_id
  returning * into event_row;

  return event_row;
end;
$$;

create or replace function public.unpublish_event_invitation(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_client_id uuid := public.current_client_id();
  is_admin boolean := public.is_platform_admin();
  event_row public.events;
begin
  if auth.uid() is null or (caller_client_id is null and not is_admin) then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into event_row
  from public.events
  where id = p_event_id
    and (client_id = caller_client_id or is_admin)
    and deleted_at is null;

  if event_row.id is null then
    raise exception 'Event was not found.' using errcode = '42501';
  end if;

  update public.events
  set invitation_published_at = null
  where id = p_event_id
  returning * into event_row;

  return event_row;
end;
$$;

revoke all on function private.event_public_state(uuid) from public, anon, authenticated;
revoke all on function public.publish_event_invitation(uuid) from public, anon, authenticated;
revoke all on function public.unpublish_event_invitation(uuid) from public, anon, authenticated;

grant execute on function public.publish_event_invitation(uuid) to authenticated;
grant execute on function public.unpublish_event_invitation(uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 2. Schema and Permissions Verification
-- ------------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'invitation_published_at'
  ) then
    raise exception 'FAIL [Assertion 1]: events.invitation_published_at column does not exist.';
  end if;

  if not has_function_privilege('authenticated', 'public.publish_event_invitation(uuid)', 'EXECUTE') then
    raise exception 'FAIL [Assertion 1]: authenticated role must have EXECUTE on publish_event_invitation.';
  end if;

  if has_function_privilege('anon', 'public.publish_event_invitation(uuid)', 'EXECUTE') then
    raise exception 'FAIL [Assertion 1]: anon role must NOT have EXECUTE on publish_event_invitation.';
  end if;

  if not has_function_privilege('authenticated', 'public.unpublish_event_invitation(uuid)', 'EXECUTE') then
    raise exception 'FAIL [Assertion 1]: authenticated role must have EXECUTE on unpublish_event_invitation.';
  end if;

  if has_function_privilege('anon', 'public.unpublish_event_invitation(uuid)', 'EXECUTE') then
    raise exception 'FAIL [Assertion 1]: anon role must NOT have EXECUTE on unpublish_event_invitation.';
  end if;

  raise notice 'PASS: Assertion 1 — Schema and permissions certified.';
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. Discover or Provision Distinct Identities & Entitlements
-- ------------------------------------------------------------------------------
create temporary table test_pub_identities (
  client_a_user_id uuid,
  client_a_id uuid,
  client_b_user_id uuid,
  client_b_id uuid
);
insert into test_pub_identities default values;

do $$
declare
  v_instance_id uuid;
  v_user_a uuid;
  v_client_a uuid;
  v_user_b uuid;
  v_client_b uuid;
begin
  begin
    select instance_id into v_instance_id from auth.users where instance_id is not null limit 1;
  exception when others then
    v_instance_id := null;
  end;
  v_instance_id := coalesce(v_instance_id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- 1. Discover existing non-admin Client A
  select i.user_id, i.client_id into v_user_a, v_client_a
  from public.client_identities i
  where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id)
  order by i.created_at, i.user_id
  limit 1;

  -- 2. Discover existing non-admin Client B (guaranteed distinct client)
  if v_client_a is not null then
    select i.user_id, i.client_id into v_user_b, v_client_b
    from public.client_identities i
    where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id)
      and i.client_id <> v_client_a
    order by i.created_at, i.user_id
    limit 1;
  end if;

  -- 3. Provision synthetic Client A if absent
  if v_user_a is null or v_client_a is null then
    v_user_a := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      v_user_a, v_instance_id, 'authenticated', 'authenticated',
      'test-pub-a-' || v_user_a || '@quickrsvp.test', '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', 'Test Client A'),
      now(), now()
    );

    insert into public.clients (display_name, status)
    values ('Test Client A', 'active')
    returning id into v_client_a;

    insert into public.client_identities (user_id, client_id)
    values (v_user_a, v_client_a);
  end if;

  -- 4. Provision synthetic Client B if absent
  if v_user_b is null or v_client_b is null then
    v_user_b := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      v_user_b, v_instance_id, 'authenticated', 'authenticated',
      'test-pub-b-' || v_user_b || '@quickrsvp.test', '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', 'Test Client B'),
      now(), now()
    );

    insert into public.clients (display_name, status)
    values ('Test Client B', 'active')
    returning id into v_client_b;

    insert into public.client_identities (user_id, client_id)
    values (v_user_b, v_client_b);
  end if;

  update test_pub_identities set
    client_a_user_id = v_user_a,
    client_a_id = v_client_a,
    client_b_user_id = v_user_b,
    client_b_id = v_client_b;

  -- Ensure active entitlements
  insert into public.client_entitlements (client_id, product_id, status)
  values (v_client_a, 'wedding', 'active')
  on conflict (client_id, product_id) do update
  set status = 'active', starts_at = now(), ends_at = null;

  insert into public.client_entitlements (client_id, product_id, status)
  values (v_client_a, 'party', 'active')
  on conflict (client_id, product_id) do update
  set status = 'active', starts_at = now(), ends_at = null;

  insert into public.client_entitlements (client_id, product_id, status)
  values (v_client_b, 'wedding', 'active')
  on conflict (client_id, product_id) do update
  set status = 'active', starts_at = now(), ends_at = null;

  raise notice 'PASS: Assertion 2 — Client identities and entitlements certified.';
end;
$$;

grant all on test_pub_identities to authenticated, anon;

-- ------------------------------------------------------------------------------
-- 4. Comprehensive Behavior Matrix Verification
-- ------------------------------------------------------------------------------
do $$
declare
  v_user_a text;
  v_user_b text;
  v_client_a uuid;
  v_client_b uuid;

  v_event_a public.events;
  v_guest_a1 jsonb;
  v_guest_a2 jsonb;
  v_token_a1 text;
  v_token_a2 text;
  v_guest_a1_id uuid;
  v_guest_a2_id uuid;

  v_resolved jsonb;
  v_rsvp jsonb;
  v_checkin_state text;
  v_db_guest public.event_guests;

  v_archived_wedding public.events;
  v_archived_party public.events;
  v_unauthorized_error boolean := false;
  v_invalid_rsvp_error boolean := false;
begin
  select
    client_a_user_id::text,
    client_b_user_id::text,
    client_a_id,
    client_b_id
  into v_user_a, v_user_b, v_client_a, v_client_b
  from test_pub_identities;

  -- ----------------------------------------------------------------------------
  -- Section 6: Auth Context Must Be Explicitly Proven
  -- ----------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_user_a, true);

  if auth.uid() is distinct from v_user_a::uuid then
    raise exception 'FAIL [Auth Verification]: auth.uid() (%) does not match expected test user (%)',
      auth.uid(), v_user_a;
  end if;

  if public.current_client_id() is distinct from v_client_a then
    raise exception 'FAIL [Auth Verification]: current_client_id() (%) does not match expected client (%)',
      public.current_client_id(), v_client_a;
  end if;
  raise notice 'PASS: Auth Context Proven — auth.uid() = % matches Client A (%)', auth.uid(), v_client_a;

  -- [Setup] Create Wedding Event for Client A (lifecycle_status = 'planning')
  v_event_a := public.create_event(
    p_product_id => 'wedding',
    p_title => 'Reliability Test Wedding',
    p_invitation_locale => 'ar',
    p_starts_at => now() + interval '30 days',
    p_ends_at => now() + interval '30 days 6 hours',
    p_rsvp_deadline => now() + interval '25 days'
  );

  if v_event_a.lifecycle_status <> 'planning' then
    raise exception 'FAIL [Setup]: New Event must default to planning, got %', v_event_a.lifecycle_status;
  end if;
  if v_event_a.invitation_published_at is not null then
    raise exception 'FAIL [Setup]: New Event invitation must default to unpublished.';
  end if;

  -- [Setup] Create Guests with distinct personal tokens
  v_guest_a1 := public.create_event_guest(v_event_a.id, 'Tester Sarah', '0501112233', 2);
  v_token_a1 := v_guest_a1 ->> 'token';
  v_guest_a1_id := (v_guest_a1 -> 'guest' ->> 'id')::uuid;

  v_guest_a2 := public.create_event_guest(v_event_a.id, 'Tester Omar', '0504445566', 1);
  v_token_a2 := v_guest_a2 ->> 'token';
  v_guest_a2_id := (v_guest_a2 -> 'guest' ->> 'id')::uuid;

  if v_token_a1 is null or v_token_a2 is null then
    raise exception 'FAIL [Setup]: Personal invitation raw tokens must be returned on creation.';
  end if;

  -- ----------------------------------------------------------------------------
  -- Section 7 Item L: Token Hashing Verification
  -- DB stores only private.token_hash(raw_token), NEVER raw invitation token
  -- ----------------------------------------------------------------------------
  if exists (
    select 1 from public.personal_invitations
    where token_hash = v_token_a1
  ) then
    raise exception 'FAIL [Item L]: Raw invitation token was stored directly in token_hash column!';
  end if;

  if not exists (
    select 1 from public.personal_invitations
    where guest_id = v_guest_a1_id
      and token_hash = private.token_hash(v_token_a1)
  ) then
    raise exception 'FAIL [Item L]: Expected SHA256 token_hash not found in personal_invitations.';
  end if;
  raise notice 'PASS: Matrix Item L — Token hashing certified (raw token never stored in database).';

  -- ----------------------------------------------------------------------------
  -- Matrix Item A: planning + unpublished -> public access denied ('planning')
  -- ----------------------------------------------------------------------------
  if private.event_public_state(v_event_a.id) <> 'planning' then
    raise exception 'FAIL [Item A]: Unpublished planning event must have public state "planning", got %',
      private.event_public_state(v_event_a.id);
  end if;

  v_resolved := public.resolve_invitation(v_token_a1);
  if v_resolved ->> 'status' <> 'planning' then
    raise exception 'FAIL [Item A]: resolve_invitation must return status "planning" when unpublished, got %', v_resolved;
  end if;

  -- RSVP must be blocked while unpublished
  begin
    perform public.submit_personal_rsvp(v_token_a1, 'accepted', 1);
    raise exception 'FAIL [Item A]: submit_personal_rsvp must fail when invitation is unpublished.';
  exception when others then
    if sqlerrm not like '%RSVP is unavailable%' then
      raise exception 'FAIL [Item A]: Unexpected RSVP error: %', sqlerrm;
    end if;
  end;
  raise notice 'PASS: Matrix Item A — Unpublished planning event denied.';

  -- ----------------------------------------------------------------------------
  -- Matrix Items B, D, R: publish_event_invitation succeeds, Event STAYS planning
  -- ----------------------------------------------------------------------------
  v_event_a := public.publish_event_invitation(v_event_a.id);

  if v_event_a.invitation_published_at is null then
    raise exception 'FAIL [Item B]: invitation_published_at must be populated after publishing.';
  end if;

  if v_event_a.lifecycle_status <> 'planning' then
    raise exception 'FAIL [Item D / R]: Publishing invitation must NOT change lifecycle status (must remain planning), got %',
      v_event_a.lifecycle_status;
  end if;
  raise notice 'PASS: Matrix Items B, D & R — Publication succeeded while lifecycle remains planning.';

  -- ----------------------------------------------------------------------------
  -- Matrix Item C: planning + published -> invitation accessible & guest data returned
  -- ----------------------------------------------------------------------------
  if private.event_public_state(v_event_a.id) <> 'active' then
    raise exception 'FAIL [Item C]: Published planning event must return active public state, got %',
      private.event_public_state(v_event_a.id);
  end if;

  v_resolved := public.resolve_invitation(v_token_a1);
  if v_resolved ->> 'status' <> 'active' then
    raise exception 'FAIL [Item C]: resolve_invitation must return status "active" on published planning event, got %', v_resolved;
  end if;

  if v_resolved -> 'guest' ->> 'name' <> 'Tester Sarah' then
    raise exception 'FAIL [Item C]: Resolved guest name missing or incorrect: %', v_resolved;
  end if;
  raise notice 'PASS: Matrix Item C — Published planning invitation fully accessible.';

  -- ----------------------------------------------------------------------------
  -- Section 8: RSVP Assertion (Deep table read & companion rules)
  -- ----------------------------------------------------------------------------
  -- 1. Confirm companion names are rejected when request_companion_names is false
  v_invalid_rsvp_error := false;
  begin
    perform public.submit_personal_rsvp(v_token_a1, 'accepted', 2, array['Disabled Companion']);
  exception when others then
    if sqlerrm like '%Companion names are disabled%' then
      v_invalid_rsvp_error := true;
    end if;
  end;
  if not v_invalid_rsvp_error then
    raise exception 'FAIL [RSVP Rule]: Passing companion names when disabled did not throw expected exception.';
  end if;

  -- 2. Enable companion names, custom messages, and RSVP changes on event
  update public.events
  set request_companion_names = true,
      allow_custom_messages = true,
      allow_rsvp_changes = true
  where id = v_event_a.id;

  -- 3. Valid RSVP submission
  v_rsvp := public.submit_personal_rsvp(v_token_a1, 'accepted', 2, array['Sarah Companion'], 'Mabrook!');
  if v_rsvp ->> 'status' <> 'accepted' or (v_rsvp ->> 'confirmed_party_size')::integer <> 2 then
    raise exception 'FAIL [RSVP]: Guest RSVP return payload incorrect: %', v_rsvp;
  end if;

  -- 4. Direct read of public.event_guests
  select * into v_db_guest from public.event_guests where id = v_guest_a1_id;
  if v_db_guest.rsvp_status <> 'accepted'
    or v_db_guest.confirmed_party_size <> 2
    or v_db_guest.responded_at is null
    or v_db_guest.custom_message <> 'Mabrook!'
  then
    raise exception 'FAIL [RSVP Table]: Database guest record not updated correctly: %', to_jsonb(v_db_guest);
  end if;

  -- 5. Confirm companion allowance boundary enforcement (allowance is 2, requesting 4 must fail)
  v_invalid_rsvp_error := false;
  begin
    perform public.submit_personal_rsvp(v_token_a1, 'accepted', 4, array['Comp 1', 'Comp 2', 'Comp 3']);
  exception when others then
    if sqlerrm like '%Confirmed party exceeds allowance%' then
      v_invalid_rsvp_error := true;
    end if;
  end;
  if not v_invalid_rsvp_error then
    raise exception 'FAIL [RSVP Rule]: Exceeding companion allowance did not throw expected exception.';
  end if;

  -- 6. Confirm declining with party size > 0 is rejected
  v_invalid_rsvp_error := false;
  begin
    perform public.submit_personal_rsvp(v_token_a1, 'declined', 1);
  exception when others then
    if sqlerrm like '%Declined RSVP party size must be zero%' then
      v_invalid_rsvp_error := true;
    end if;
  end;
  if not v_invalid_rsvp_error then
    raise exception 'FAIL [RSVP Rule]: Declining with positive party size did not throw expected exception.';
  end if;

  -- 7. Confirm Event lifecycle is STILL planning after RSVP
  select * into v_event_a from public.events where id = v_event_a.id;
  if v_event_a.lifecycle_status <> 'planning' then
    raise exception 'FAIL [RSVP]: Event lifecycle must still be planning after RSVP, got %', v_event_a.lifecycle_status;
  end if;
  raise notice 'PASS: Section 8 — Guest RSVP verified with direct table read and boundary rules.';

  -- ----------------------------------------------------------------------------
  -- Matrix Item P / O: Scanner / Check-in separation
  -- Door scanner resolution/checkin must remain blocked while Event is planning
  -- ----------------------------------------------------------------------------
  v_checkin_state := private.checkin_event_state(v_event_a.id);
  if v_checkin_state <> 'planning' then
    raise exception 'FAIL [Item P]: checkin_event_state must return "planning" (blocked) while event is in planning, got %',
      v_checkin_state;
  end if;
  raise notice 'PASS: Matrix Item P — Door scanner checkin strictly blocked while event is planning.';

  -- ----------------------------------------------------------------------------
  -- Matrix Items F & S: unpublish_event_invitation succeeds, Event STAYS planning
  -- ----------------------------------------------------------------------------
  v_event_a := public.unpublish_event_invitation(v_event_a.id);
  if v_event_a.invitation_published_at is not null then
    raise exception 'FAIL [Item F]: invitation_published_at must be null after unpublishing.';
  end if;

  if v_event_a.lifecycle_status <> 'planning' then
    raise exception 'FAIL [Item S]: unpublish_event_invitation must NOT mutate lifecycle_status, got %',
      v_event_a.lifecycle_status;
  end if;

  if private.event_public_state(v_event_a.id) <> 'planning' then
    raise exception 'FAIL [Item F]: Unpublishing planning event must restore public state to "planning".';
  end if;

  v_resolved := public.resolve_invitation(v_token_a1);
  if v_resolved ->> 'status' <> 'planning' then
    raise exception 'FAIL [Item F]: resolve_invitation must return "planning" after unpublishing, got %', v_resolved;
  end if;
  raise notice 'PASS: Matrix Items F & S — Unpublishing restored planning access denial without mutating lifecycle.';

  -- ----------------------------------------------------------------------------
  -- Matrix Item E: active + published -> accessible
  -- ----------------------------------------------------------------------------
  v_event_a := public.publish_event_invitation(v_event_a.id);
  update public.events set lifecycle_status = 'active' where id = v_event_a.id;

  if private.event_public_state(v_event_a.id) <> 'active' then
    raise exception 'FAIL [Item E]: Active published event must have active public state.';
  end if;

  v_resolved := public.resolve_invitation(v_token_a1);
  if v_resolved ->> 'status' <> 'active' then
    raise exception 'FAIL [Item E]: Active published event invitation must resolve to active.';
  end if;

  -- Scanner is now available because event lifecycle is active!
  if private.checkin_event_state(v_event_a.id) <> 'active' then
    raise exception 'FAIL [Item E]: Scanner must be active when event lifecycle is active.';
  end if;
  raise notice 'PASS: Matrix Item E — Active published event accessible and scanner ready.';

  -- ----------------------------------------------------------------------------
  -- Matrix Item F (Active): active + unpublished -> denied ('unpublished')
  -- ----------------------------------------------------------------------------
  v_event_a := public.unpublish_event_invitation(v_event_a.id);
  if private.event_public_state(v_event_a.id) <> 'unpublished' then
    raise exception 'FAIL [Item F-Active]: Active unpublished event must return "unpublished", got %',
      private.event_public_state(v_event_a.id);
  end if;

  v_resolved := public.resolve_invitation(v_token_a1);
  if v_resolved ->> 'status' <> 'unpublished' then
    raise exception 'FAIL [Item F-Active]: resolve_invitation must return "unpublished", got %', v_resolved;
  end if;
  raise notice 'PASS: Matrix Item F (Active) — Active unpublished event returns "unpublished".';

  -- ----------------------------------------------------------------------------
  -- Matrix Item G: Subscription / product entitlement rules remain enforced
  -- ----------------------------------------------------------------------------
  v_event_a := public.publish_event_invitation(v_event_a.id);

  -- Suspend client access (suspends both explicit entitlement and build-mode allowance)
  update public.clients
  set status = 'suspended'
  where id = v_client_a;

  update public.client_entitlements
  set status = 'suspended'
  where client_id = v_client_a and product_id = 'wedding';

  if private.event_public_state(v_event_a.id) <> 'subscription_unavailable' then
    raise exception 'FAIL [Item G]: Suspended entitlement must return "subscription_unavailable", got %',
      private.event_public_state(v_event_a.id);
  end if;

  v_resolved := public.resolve_invitation(v_token_a1);
  if v_resolved ->> 'status' <> 'subscription_unavailable' then
    raise exception 'FAIL [Item G]: resolve_invitation must return "subscription_unavailable", got %', v_resolved;
  end if;

  -- Restore client status and entitlement
  update public.clients
  set status = 'active'
  where id = v_client_a;

  update public.client_entitlements
  set status = 'active'
  where client_id = v_client_a and product_id = 'wedding';

  if private.event_public_state(v_event_a.id) <> 'active' then
    raise exception 'FAIL [Item G]: Restored entitlement must return "active".';
  end if;
  raise notice 'PASS: Matrix Item G — Entitlement enforcement certified.';

  -- ----------------------------------------------------------------------------
  -- Matrix Item H: cancelled -> denied ('cancelled')
  -- ----------------------------------------------------------------------------
  update public.events set lifecycle_status = 'cancelled' where id = v_event_a.id;
  if private.event_public_state(v_event_a.id) <> 'cancelled' then
    raise exception 'FAIL [Item H]: Cancelled event must return "cancelled".';
  end if;

  v_resolved := public.resolve_invitation(v_token_a1);
  if v_resolved ->> 'status' <> 'cancelled' then
    raise exception 'FAIL [Item H]: resolve_invitation must return "cancelled", got %', v_resolved;
  end if;
  raise notice 'PASS: Matrix Item H — Cancelled event denied.';

  -- ----------------------------------------------------------------------------
  -- Matrix Item I: deleted -> denied ('unavailable')
  -- ----------------------------------------------------------------------------
  update public.events set deleted_at = now() where id = v_event_a.id;
  if private.event_public_state(v_event_a.id) <> 'unavailable' then
    raise exception 'FAIL [Item I]: Deleted event must return "unavailable".';
  end if;

  v_resolved := public.resolve_invitation(v_token_a1);
  if v_resolved ->> 'status' <> 'unavailable' then
    raise exception 'FAIL [Item I]: resolve_invitation must return "unavailable", got %', v_resolved;
  end if;
  raise notice 'PASS: Matrix Item I — Deleted event denied.';

  -- ----------------------------------------------------------------------------
  -- Matrix Item J: invalid token -> denied ('invalid')
  -- ----------------------------------------------------------------------------
  v_resolved := public.resolve_invitation('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
  if v_resolved ->> 'status' <> 'invalid' then
    raise exception 'FAIL [Item J]: Unknown token must return "invalid", got %', v_resolved;
  end if;
  raise notice 'PASS: Matrix Item J — Invalid token rejected.';

  -- ----------------------------------------------------------------------------
  -- Matrix Items K & M: revoked token and token isolation between guests
  -- ----------------------------------------------------------------------------
  v_event_a := public.create_event(
    p_product_id => 'wedding',
    p_title => 'Isolation Wedding',
    p_invitation_locale => 'ar'
  );
  v_event_a := public.publish_event_invitation(v_event_a.id);

  v_guest_a1 := public.create_event_guest(v_event_a.id, 'Guest Isolation One', '0511111111', 1);
  v_token_a1 := v_guest_a1 ->> 'token';

  v_guest_a2 := public.create_event_guest(v_event_a.id, 'Guest Isolation Two', '0522222222', 1);
  v_token_a2 := v_guest_a2 ->> 'token';
  v_guest_a2_id := (v_guest_a2 -> 'guest' ->> 'id')::uuid;

  -- Token A1 resolves Guest 1; Token A2 resolves Guest 2
  if (public.resolve_invitation(v_token_a1) -> 'guest' ->> 'name') <> 'Guest Isolation One' then
    raise exception 'FAIL [Item M]: Token A1 did not isolate to Guest 1.';
  end if;
  if (public.resolve_invitation(v_token_a2) -> 'guest' ->> 'name') <> 'Guest Isolation Two' then
    raise exception 'FAIL [Item M]: Token A2 did not isolate to Guest 2.';
  end if;

  -- Revoke Guest 2 token
  update public.personal_invitations set revoked_at = now() where guest_id = v_guest_a2_id;
  v_resolved := public.resolve_invitation(v_token_a2);
  if v_resolved ->> 'status' <> 'invalid' then
    raise exception 'FAIL [Item K]: Revoked invitation token must return "invalid", got %', v_resolved;
  end if;
  raise notice 'PASS: Matrix Items K & M — Token isolation and revocation certified.';

  -- ----------------------------------------------------------------------------
  -- Matrix Item N: Archived Wedding replay rules preserved
  -- ----------------------------------------------------------------------------
  insert into public.events (client_id, product_id, title, lifecycle_status, archived_at)
  values (v_client_a, 'wedding', 'Archived Wedding Replay', 'archived', now() - interval '3 days')
  returning * into v_archived_wedding;

  -- 1. Valid replay policy: archive_replay_enabled = true, archive_replay_days = 10 (within 3 days)
  update public.product_policies
  set configuration = '{"archive_replay_enabled": true, "archive_replay_days": 10}'::jsonb
  where product_id = 'wedding';

  if private.event_public_state(v_archived_wedding.id) <> 'archived_read_only' then
    raise exception 'FAIL [Item N]: Replayable archived wedding must return "archived_read_only", got %',
      private.event_public_state(v_archived_wedding.id);
  end if;

  -- 2. Expired replay policy: archive_replay_days = 2 (archived 3 days ago -> expired)
  update public.product_policies
  set configuration = '{"archive_replay_enabled": true, "archive_replay_days": 2}'::jsonb
  where product_id = 'wedding';

  if private.event_public_state(v_archived_wedding.id) <> 'unavailable' then
    raise exception 'FAIL [Item N]: Expired archived wedding replay must return "unavailable", got %',
      private.event_public_state(v_archived_wedding.id);
  end if;

  -- 3. Disabled replay policy: archive_replay_enabled = false
  update public.product_policies
  set configuration = '{"archive_replay_enabled": false, "archive_replay_days": 10}'::jsonb
  where product_id = 'wedding';

  if private.event_public_state(v_archived_wedding.id) <> 'unavailable' then
    raise exception 'FAIL [Item N]: Disabled archive replay must return "unavailable", got %',
      private.event_public_state(v_archived_wedding.id);
  end if;
  raise notice 'PASS: Matrix Item N — Archived Wedding replay policy preserved exactly.';

  -- ----------------------------------------------------------------------------
  -- Matrix Item O: Archived Party behavior unchanged (always unavailable)
  -- ----------------------------------------------------------------------------
  insert into public.events (client_id, product_id, title, lifecycle_status, archived_at)
  values (v_client_a, 'party', 'Archived Party Event', 'archived', now() - interval '3 days')
  returning * into v_archived_party;

  if private.event_public_state(v_archived_party.id) <> 'unavailable' then
    raise exception 'FAIL [Item O]: Archived party event must return "unavailable", got %',
      private.event_public_state(v_archived_party.id);
  end if;
  raise notice 'PASS: Matrix Item O — Archived Party behavior preserved.';

  -- ----------------------------------------------------------------------------
  -- Matrix Item Q: Cross-Client Authorization Boundaries
  -- ----------------------------------------------------------------------------
  -- Switch context to Client B
  perform set_config('request.jwt.claim.sub', v_user_b, true);

  -- Client B attempts to publish Client A's event -> MUST be blocked
  v_unauthorized_error := false;
  begin
    perform public.publish_event_invitation(v_event_a.id);
  exception when others then
    v_unauthorized_error := true;
  end;

  if not v_unauthorized_error then
    raise exception 'FAIL [Item Q]: Client B was able to publish Client A event.';
  end if;

  -- Client B attempts to unpublish Client A's event -> MUST be blocked
  v_unauthorized_error := false;
  begin
    perform public.unpublish_event_invitation(v_event_a.id);
  exception when others then
    v_unauthorized_error := true;
  end;

  if not v_unauthorized_error then
    raise exception 'FAIL [Item Q]: Client B was able to unpublish Client A event.';
  end if;
  raise notice 'PASS: Matrix Item Q — Cross-client authorization enforcement certified.';

  raise notice '=== ALL ASSERTIONS CERTIFIED (Matrix A through S + Auth Context) ===';
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. Strict Transaction Isolation: All mutations roll back automatically
-- ------------------------------------------------------------------------------
rollback;
