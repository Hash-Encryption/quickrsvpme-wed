begin;

create table public.general_invitation_requests (
  id uuid primary key,
  general_invitation_id uuid not null references public.general_invitations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 200),
  phone text not null check (
    length(phone) between 7 and 32
    and phone ~ '^[0-9+() .-]+$'
    and length(regexp_replace(phone, '[^0-9]', '', 'g')) between 7 and 15
  ),
  state text not null default 'awaiting' check (state in ('awaiting', 'approved', 'rejected')),
  guest_id uuid unique references public.event_guests(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (state = 'awaiting' and guest_id is null and reviewed_by is null and reviewed_at is null)
    or (state = 'approved' and guest_id is not null and reviewed_by is not null and reviewed_at is not null)
    or (state = 'rejected' and guest_id is null and reviewed_by is not null and reviewed_at is not null)
  )
);

create index general_invitation_requests_event_state_idx
  on public.general_invitation_requests(event_id, state, created_at desc);

create trigger general_invitation_requests_set_updated_at
before update on public.general_invitation_requests
for each row execute function private.set_updated_at();

create trigger general_invitation_requests_require_mutable_event
before insert or update or delete on public.general_invitation_requests
for each row execute function private.require_mutable_event();

alter table public.general_invitation_requests enable row level security;
revoke all on table public.general_invitation_requests from public, anon, authenticated;

create function public.submit_general_invitation_request(
  p_token text,
  p_request_id uuid,
  p_name text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.general_invitations;
  request public.general_invitation_requests;
  clean_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  clean_phone text := regexp_replace(btrim(coalesce(p_phone, '')), '\s+', ' ', 'g');
begin
  if p_request_id is null then
    raise exception 'A request ID is required.' using errcode = '22023';
  end if;
  if length(clean_name) not between 1 and 200 then
    raise exception 'Guest name is required.' using errcode = '22023';
  end if;
  if length(clean_phone) not between 7 and 32
    or clean_phone !~ '^[0-9+() .-]+$'
    or length(regexp_replace(clean_phone, '[^0-9]', '', 'g')) not between 7 and 15
  then
    raise exception 'A valid phone number is required.' using errcode = '22023';
  end if;

  select * into invitation
  from public.general_invitations
  where token_hash = private.token_hash(p_token)
    and active
    and revoked_at is null;

  if invitation.id is null
    or private.event_public_state(invitation.event_id) <> 'active'
  then
    raise exception 'Invitation is unavailable.' using errcode = '42501';
  end if;

  select * into request
  from public.general_invitation_requests
  where id = p_request_id
  for update;

  if request.id is not null then
    if request.general_invitation_id <> invitation.id
      or request.name <> clean_name
      or request.phone <> clean_phone
    then
      raise exception 'Request ID is already in use.' using errcode = '42501';
    end if;
    return jsonb_build_object(
      'request_id', request.id,
      'state', request.state,
      'submitted_at', request.created_at,
      'reviewed_at', request.reviewed_at
    );
  end if;

  begin
    insert into public.general_invitation_requests(
      id, general_invitation_id, event_id, client_id, name, phone
    ) values (
      p_request_id, invitation.id, invitation.event_id, invitation.client_id,
      clean_name, clean_phone
    )
    returning * into request;
  exception when unique_violation then
    select * into request
    from public.general_invitation_requests
    where id = p_request_id;

    if request.id is null
      or request.general_invitation_id <> invitation.id
      or request.name <> clean_name
      or request.phone <> clean_phone
    then
      raise exception 'Request ID is already in use.' using errcode = '42501';
    end if;
  end;

  return jsonb_build_object(
    'request_id', request.id,
    'state', request.state,
    'submitted_at', request.created_at,
    'reviewed_at', request.reviewed_at
  );
end;
$$;

create function public.get_general_invitation_request_status(
  p_token text,
  p_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  invitation public.general_invitations;
  request public.general_invitation_requests;
begin
  select * into invitation
  from public.general_invitations
  where token_hash = private.token_hash(p_token);

  if invitation.id is null then
    return jsonb_build_object('state', 'invalid');
  end if;

  select * into request
  from public.general_invitation_requests
  where id = p_request_id
    and general_invitation_id = invitation.id;

  if request.id is null then
    return jsonb_build_object('state', 'invalid');
  end if;

  return jsonb_build_object(
    'request_id', request.id,
    'state', request.state,
    'submitted_at', request.created_at,
    'reviewed_at', request.reviewed_at
  );
end;
$$;

create function public.list_general_invitation_requests(p_event_id uuid)
returns setof public.general_invitation_requests
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.events e
    where e.id = p_event_id
      and e.deleted_at is null
      and (e.client_id = public.current_client_id() or public.is_platform_admin())
  ) then
    raise exception 'Event was not found.' using errcode = '42501';
  end if;

  return query
  select r.*
  from public.general_invitation_requests r
  where r.event_id = p_event_id
  order by r.created_at desc;
end;
$$;

create function public.review_general_invitation_request(
  p_event_id uuid,
  p_request_id uuid,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events;
  request public.general_invitation_requests;
  guest public.event_guests;
  invitation public.personal_invitations;
  raw_token text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.' using errcode = '22023';
  end if;

  select * into event_row
  from public.events e
  where e.id = p_event_id
    and e.deleted_at is null
    and (e.client_id = public.current_client_id() or public.is_platform_admin());

  if event_row.id is null then
    raise exception 'Event was not found.' using errcode = '42501';
  end if;
  if event_row.lifecycle_status not in ('planning', 'active') then
    raise exception 'Ended, archived, cancelled, and soft-deleted Events are read-only.' using errcode = '42501';
  end if;

  select * into request
  from public.general_invitation_requests r
  where r.id = p_request_id
    and r.event_id = p_event_id
  for update;

  if request.id is null then
    raise exception 'General invitation request was not found.' using errcode = '42501';
  end if;

  if request.state = p_decision then
    return jsonb_build_object(
      'request_id', request.id,
      'state', request.state,
      'guest_id', request.guest_id,
      'token', null
    );
  end if;
  if request.state <> 'awaiting' then
    raise exception 'General invitation request has already been reviewed.' using errcode = '22023';
  end if;

  if p_decision = 'rejected' then
    update public.general_invitation_requests
    set state = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
    where id = request.id
    returning * into request;

    return jsonb_build_object(
      'request_id', request.id,
      'state', request.state,
      'guest_id', null,
      'token', null
    );
  end if;

  raw_token := private.new_invitation_token();
  insert into public.event_guests(
    event_id, client_id, source, general_request_id,
    name, phone, allowed_companions
  ) values (
    request.event_id, request.client_id, 'general_invite', request.id,
    request.name, request.phone, event_row.general_invite_allowed_companions
  )
  returning * into guest;

  insert into public.personal_invitations(
    event_id, client_id, guest_id, token_hash
  ) values (
    request.event_id, request.client_id, guest.id, private.token_hash(raw_token)
  )
  returning * into invitation;

  update public.general_invitation_requests
  set state = 'approved', guest_id = guest.id,
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = request.id
  returning * into request;

  return jsonb_build_object(
    'request_id', request.id,
    'state', request.state,
    'guest_id', guest.id,
    'invitation_id', invitation.id,
    'token', raw_token
  );
end;
$$;

revoke all on function public.submit_general_rsvp(text, uuid, text, text, integer, text[], text)
  from public, anon, authenticated;
revoke all on function public.submit_general_invitation_request(text, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.get_general_invitation_request_status(text, uuid)
  from public, anon, authenticated;
revoke all on function public.list_general_invitation_requests(uuid)
  from public, anon, authenticated;
revoke all on function public.review_general_invitation_request(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.submit_general_invitation_request(text, uuid, text, text)
  to anon, authenticated;
grant execute on function public.get_general_invitation_request_status(text, uuid)
  to anon, authenticated;
grant execute on function public.list_general_invitation_requests(uuid)
  to authenticated;
grant execute on function public.review_general_invitation_request(uuid, uuid, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
