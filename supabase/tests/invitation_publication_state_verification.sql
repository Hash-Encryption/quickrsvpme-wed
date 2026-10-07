-- Verification: invitation_publication_state_verification.sql
-- Status: SQL TRANSACTIONAL VERIFIER (DO NOT RUN AUTOMATICALLY)
-- Strict transaction isolation: Every single mutation rolls back. Zero persistent test data.

begin;

create temporary table test_pub_identities as
select
  (select i.user_id from public.client_identities i where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id) order by i.created_at limit 1) as client_user_id,
  (select i.client_id from public.client_identities i where not exists (select 1 from public.platform_admins a where a.user_id = i.user_id) order by i.created_at limit 1) as client_id;

do $$
begin
  if exists (select 1 from test_pub_identities where client_user_id is null or client_id is null) then
    raise exception 'Prerequisite: At least one non-admin client identity must exist.';
  end if;
end;
$$;

-- Ensure client entitlement exists for testing
insert into public.client_entitlements(client_id, product_id, status)
select client_id, 'wedding', 'active'
from test_pub_identities
on conflict (client_id, product_id) do update set status = 'active', starts_at = now(), ends_at = null;

create temporary table test_pub_data (
  event_id uuid,
  guest_id uuid,
  personal_token text
);
insert into test_pub_data default values;
grant all on test_pub_identities, test_pub_data to authenticated, anon;

-- Run as authenticated host
select set_config('request.jwt.claim.sub', (select client_user_id::text from test_pub_identities), true);
set local role authenticated;

do $$
declare
  v_event public.events;
  v_guest jsonb;
  v_token text;
  v_resolved jsonb;
  v_rsvp jsonb;
begin
  -- 1. Create Wedding Event (defaults to lifecycle_status = 'planning', invitation_published_at = null)
  v_event := public.create_event('wedding', 'Reliability Wedding', 'ar', now(), now() + interval '1 day', now() + interval '12 hours');
  if v_event.lifecycle_status <> 'planning' then
    raise exception 'FAIL: New Event must default to planning lifecycle, got %', v_event.lifecycle_status;
  end if;
  if v_event.invitation_published_at is not null then
    raise exception 'FAIL: New Event invitation must start unpublished.';
  end if;

  -- 2. Add Guest and create personal invitation
  v_guest := public.create_event_guest(v_event.id, 'Test Tester', '00966504932835', 1);
  v_token := v_guest ->> 'personal_invitation_token';
  if v_token is null then
    raise exception 'FAIL: Guest personal token was not generated.';
  end if;

  update test_pub_data set
    event_id = v_event.id,
    guest_id = (v_guest -> 'guest' ->> 'id')::uuid,
    personal_token = v_token;

  -- 3. Required Behavior: planning + unpublished -> invitation unavailable
  v_resolved := public.resolve_invitation(v_token);
  if v_resolved ->> 'status' <> 'unavailable' then
    raise exception 'FAIL: Unpublished planning invitation must resolve to unavailable, got %', v_resolved;
  end if;

  -- 4. Publish Invitation
  v_event := public.publish_event_invitation(v_event.id);
  if v_event.invitation_published_at is null then
    raise exception 'FAIL: Invitation was not marked published.';
  end if;

  -- 5. Canonical Product Model: Event remains in planning!
  if v_event.lifecycle_status <> 'planning' then
    raise exception 'FAIL: Publishing invitation must NOT change planning -> active.';
  end if;

  -- 6. Required Behavior: planning + published -> invitation accessible
  v_resolved := public.resolve_invitation(v_token);
  if v_resolved ->> 'status' <> 'active' then
    raise exception 'FAIL: Published planning invitation must be accessible, got %', v_resolved;
  end if;
  if v_resolved -> 'guest' ->> 'name' <> 'Test Tester' then
    raise exception 'FAIL: Guest data missing in resolved invitation.';
  end if;

  -- 7. RSVP Behavior: RSVP succeeds for published planning event
  v_rsvp := public.submit_personal_rsvp(v_token, 'accepted', 1, '{}', 'Mabrook!');
  if v_rsvp ->> 'status' <> 'accepted' then
    raise exception 'FAIL: Guest RSVP failed on published planning event, got %', v_rsvp;
  end if;

  -- 8. Door Check-in Separation: checkin_event_state requires active lifecycle
  if private.checkin_event_state(v_event.id) = 'active' then
    raise exception 'FAIL: Staff checkin must remain unavailable while event is in planning.';
  end if;

  -- 9. Unpublish Invitation -> invitation unavailable again
  v_event := public.unpublish_event_invitation(v_event.id);
  v_resolved := public.resolve_invitation(v_token);
  if v_resolved ->> 'status' <> 'unavailable' then
    raise exception 'FAIL: Unpublished invitation must resolve to unavailable, got %', v_resolved;
  end if;

  -- 10. Re-publish -> Event active + published -> accessible
  v_event := public.publish_event_invitation(v_event.id);
  update public.events set lifecycle_status = 'active' where id = v_event.id;
  v_resolved := public.resolve_invitation(v_token);
  if v_resolved ->> 'status' <> 'active' then
    raise exception 'FAIL: Active published invitation must be accessible.';
  end if;

  -- 11. Cancelled Event -> cancelled
  update public.events set lifecycle_status = 'cancelled' where id = v_event.id;
  v_resolved := public.resolve_invitation(v_token);
  if v_resolved ->> 'status' <> 'cancelled' then
    raise exception 'FAIL: Cancelled event must resolve to cancelled.';
  end if;

  -- 12. Soft deleted -> unavailable
  update public.events set deleted_at = now() where id = v_event.id;
  v_resolved := public.resolve_invitation(v_token);
  if v_resolved ->> 'status' <> 'unavailable' then
    raise exception 'FAIL: Deleted event must resolve to unavailable.';
  end if;
end;
$$;

-- Strict transactional verifier requirement: ALWAYS ROLLBACK
rollback;
