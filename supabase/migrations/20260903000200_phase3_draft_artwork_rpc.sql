begin;

alter function public.set_design_draft_artwork(uuid, uuid)
  rename to set_design_draft_artwork_legacy;

revoke all on function public.set_design_draft_artwork_legacy(uuid, uuid)
  from public, anon, authenticated;

create function public.set_design_draft_artwork(
  p_draft_id uuid,
  p_artwork_asset_id uuid
)
returns public.design_drafts
language sql
security definer
set search_path = ''
as $$
  select public.set_design_draft_artwork_legacy(p_draft_id, p_artwork_asset_id);
$$;

revoke all on function public.set_design_draft_artwork(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.set_design_draft_artwork(uuid, uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
