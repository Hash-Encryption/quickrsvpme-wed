begin;

-- Optimistic version conflicts are application conflicts, not retryable PostgreSQL serialization failures.
create or replace function public.save_wedding_event_config(p_event_id uuid, p_configuration jsonb, p_template_version_id uuid, p_template_snapshot jsonb, p_artwork_asset_id uuid, p_expected_version bigint)
returns public.wedding_event_configs
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.wedding_event_configs;
  result public.wedding_event_configs;
begin
  if p_configuration is null or jsonb_typeof(p_configuration) <> 'object' or p_template_snapshot is null or jsonb_typeof(p_template_snapshot) <> 'object' then raise exception 'Configuration and template snapshot must be objects.' using errcode = '22023'; end if;
  if not exists (select 1 from public.events e where e.id = p_event_id and e.client_id = public.current_client_id() and e.product_id = 'wedding' and e.deleted_at is null) then raise exception 'Wedding Event was not found.' using errcode = '42501'; end if;
  if p_template_version_id is not null and not exists (
    select 1 from public.platform_templates t
    where t.id = p_template_version_id and t.product_id = 'wedding'
      and (t.active or exists (select 1 from public.wedding_event_configs c where c.event_id = p_event_id and c.template_version_id = t.id))
  ) then raise exception 'Wedding template version is unavailable.' using errcode = '22023'; end if;
  if p_template_version_id is not null then select render_snapshot into p_template_snapshot from public.platform_templates where id = p_template_version_id; end if;
  if p_artwork_asset_id is not null and not exists (select 1 from public.invitation_assets where id = p_artwork_asset_id and event_id = p_event_id and client_id = public.current_client_id() and purpose = 'published_delivery' and status = 'uploaded') then raise exception 'Published Wedding artwork is invalid.' using errcode = '42501'; end if;
  select * into existing from public.wedding_event_configs where event_id = p_event_id for update;
  if existing.event_id is null then
    if p_expected_version <> 0 then raise sqlstate 'PT409' using message = 'Configuration version conflict.'; end if;
    insert into public.wedding_event_configs(event_id, client_id, configuration, template_version_id, template_snapshot, artwork_asset_id)
    values (p_event_id, public.current_client_id(), p_configuration, p_template_version_id, p_template_snapshot, p_artwork_asset_id) returning * into result;
  else
    if existing.version <> p_expected_version then raise sqlstate 'PT409' using message = 'Configuration version conflict.'; end if;
    update public.wedding_event_configs set configuration = p_configuration, template_version_id = p_template_version_id, template_snapshot = p_template_snapshot, artwork_asset_id = p_artwork_asset_id, version = version + 1 where event_id = p_event_id returning * into result;
  end if;
  return result;
end;
$$;

create or replace function public.save_party_event_config(p_event_id uuid, p_configuration jsonb, p_template_version_id uuid, p_template_snapshot jsonb, p_expected_version bigint)
returns public.party_event_configs
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.party_event_configs;
  result public.party_event_configs;
begin
  if p_configuration is null or jsonb_typeof(p_configuration) <> 'object' or p_template_snapshot is null or jsonb_typeof(p_template_snapshot) <> 'object' then raise exception 'Configuration and template snapshot must be objects.' using errcode = '22023'; end if;
  if not exists (select 1 from public.events e where e.id = p_event_id and e.client_id = public.current_client_id() and e.product_id = 'party' and e.deleted_at is null) then raise exception 'Party Event was not found.' using errcode = '42501'; end if;
  if p_template_version_id is not null and not exists (
    select 1 from public.platform_templates t
    where t.id = p_template_version_id and t.product_id = 'party'
      and (t.active or exists (select 1 from public.party_event_configs c where c.event_id = p_event_id and c.template_version_id = t.id))
  ) then raise exception 'Party template version is unavailable.' using errcode = '22023'; end if;
  if p_template_version_id is not null then select render_snapshot into p_template_snapshot from public.platform_templates where id = p_template_version_id; end if;
  select * into existing from public.party_event_configs where event_id = p_event_id for update;
  if existing.event_id is null then
    if p_expected_version <> 0 then raise sqlstate 'PT409' using message = 'Configuration version conflict.'; end if;
    insert into public.party_event_configs(event_id, client_id, configuration, template_version_id, template_snapshot)
    values (p_event_id, public.current_client_id(), p_configuration, p_template_version_id, p_template_snapshot) returning * into result;
  else
    if existing.version <> p_expected_version then raise sqlstate 'PT409' using message = 'Configuration version conflict.'; end if;
    update public.party_event_configs set configuration = p_configuration, template_version_id = p_template_version_id, template_snapshot = p_template_snapshot, version = version + 1 where event_id = p_event_id returning * into result;
  end if;
  return result;
end;
$$;

create or replace function public.save_design_draft(p_draft_id uuid, p_title text, p_configuration jsonb, p_template_version_id uuid, p_template_snapshot jsonb, p_expected_version bigint)
returns public.design_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.design_drafts;
begin
  select * into draft from public.design_drafts where id = p_draft_id and client_id = public.current_client_id() for update;
  if draft.id is null then raise exception 'Design Draft was not found.' using errcode = '42501'; end if;
  if draft.version <> p_expected_version then raise sqlstate 'PT409' using message = 'Design Draft version conflict.'; end if;
  if nullif(btrim(p_title), '') is null or p_configuration is null or jsonb_typeof(p_configuration) <> 'object' or p_template_snapshot is null or jsonb_typeof(p_template_snapshot) <> 'object' then raise exception 'Draft title, configuration, and template snapshot are invalid.' using errcode = '22023'; end if;
  if p_template_version_id is not null and not exists (
    select 1 from public.platform_templates t
    where t.id = p_template_version_id and t.product_id = draft.product_id
      and (t.active or t.id = draft.template_version_id)
  ) then raise exception 'Draft template version is unavailable.' using errcode = '22023'; end if;
  if p_template_version_id is not null then select render_snapshot into p_template_snapshot from public.platform_templates where id = p_template_version_id; end if;
  update public.design_drafts set title = btrim(p_title), configuration = p_configuration, template_version_id = p_template_version_id, template_snapshot = p_template_snapshot, version = version + 1 where id = p_draft_id returning * into draft;
  return draft;
end;
$$;

notify pgrst, 'reload schema';

commit;
