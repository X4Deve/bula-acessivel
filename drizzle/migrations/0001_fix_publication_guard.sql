create or replace function public.guard_publication() returns trigger language plpgsql set search_path=public as $$
declare new_s text := new.status::text; old_s text := case when tg_op = 'UPDATE' then old.status::text end;
begin
  if coalesce(current_setting('app.publishing', true),'') <> 'on' then
    if tg_table_name = 'leaflet_versions' and new_s in ('published','superseded') and new_s is distinct from old_s then
      raise exception 'Publicação só pode ocorrer pela função de revisão administrativa';
    end if;
    if tg_table_name = 'medicine_catalog' and new_s = 'published' and new_s is distinct from old_s then
      raise exception 'Publicação só pode ocorrer pela função de revisão administrativa';
    end if;
  end if;
  return new;
end $$;