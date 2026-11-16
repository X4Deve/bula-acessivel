
create type public.app_role as enum ('admin');
create type public.source_type as enum ('anvisa_bulario','fabricante','fornecedor_autorizado');
create type public.catalog_status as enum ('draft','published','archived');
create type public.leaflet_status as enum ('draft','in_review','published','superseded','rejected');
create type public.usage_state as enum ('none','taking','stopped');
create type public.request_status as enum ('pending','approved','rejected');
create type public.tier as enum ('free','premium');
create type public.mood as enum ('melhor','igual','pior','prefiro_nao_responder');

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at = now(); return new; end $$;

create or replace function public.is_official_anvisa_url(_url text) returns boolean language sql immutable set search_path=public as $$
  select _url ~* '^https://(consultas\.anvisa\.gov\.br|www\.gov\.br/anvisa|anvisa\.gov\.br|www\.anvisa\.gov\.br)(/|$|#|\?)'
$$;

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 120),
  preferences jsonb not null default '{}'::jsonb,
  terms_version text,
  terms_accepted_at timestamptz,
  health_tracking_consent boolean not null default false,
  health_tracking_consent_at timestamptz,
  save_search_history boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles (id, display_name, terms_version, terms_accepted_at)
  values (new.id,
    left(coalesce(new.raw_user_meta_data->>'display_name',''),120),
    nullif(new.raw_user_meta_data->>'terms_version',''),
    case when new.raw_user_meta_data->>'terms_version' is not null then now() end)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles select" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- app settings (non-clinical config)
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
grant select on public.app_settings to anon, authenticated;
grant insert, update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "settings public read" on public.app_settings for select to anon, authenticated using (true);
create policy "settings admin insert" on public.app_settings for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "settings admin update" on public.app_settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.app_settings (key, value) values
  ('premium_price_label', '"A definir"'::jsonb),
  ('curation_validity_days', '180'::jsonb),
  ('external_delivery_channel', '"nao_configurado"'::jsonb);

-- audit
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target_table text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_events to authenticated;
grant all on public.audit_events to service_role;
alter table public.audit_events enable row level security;
create policy "audit admin read" on public.audit_events for select to authenticated using (public.has_role(auth.uid(),'admin'));
create index on public.audit_events (created_at desc);

-- catalog
create table public.medicine_catalog (
  id uuid primary key default gen_random_uuid(),
  registration_code text,
  brand_name text not null check (char_length(brand_name) between 1 and 200),
  active_ingredient text,
  manufacturer text,
  strength text,
  formulation text,
  presentation text,
  therapeutic_group text,
  therapeutic_group_verified boolean not null default false,
  source_url text not null,
  source_type public.source_type not null default 'anvisa_bulario',
  verified_at timestamptz,
  status public.catalog_status not null default 'draft',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_https check (source_url ~* '^https://'),
  constraint catalog_anvisa_host check (source_type <> 'anvisa_bulario' or public.is_official_anvisa_url(source_url))
);
create index on public.medicine_catalog (status);
create index on public.medicine_catalog (lower(brand_name));
create index on public.medicine_catalog (lower(active_ingredient));
grant select on public.medicine_catalog to anon, authenticated;
grant insert, update, delete on public.medicine_catalog to authenticated;
grant all on public.medicine_catalog to service_role;
alter table public.medicine_catalog enable row level security;
create policy "catalog public published" on public.medicine_catalog for select to anon, authenticated using (status = 'published');
create policy "catalog admin read" on public.medicine_catalog for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "catalog admin insert" on public.medicine_catalog for insert to authenticated with check (public.has_role(auth.uid(),'admin') and status = 'draft');
create policy "catalog admin update" on public.medicine_catalog for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "catalog admin delete" on public.medicine_catalog for delete to authenticated using (public.has_role(auth.uid(),'admin') and status = 'draft');
create trigger catalog_touch before update on public.medicine_catalog for each row execute function public.touch_updated_at();

-- leaflet versions
create table public.leaflet_versions (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicine_catalog(id) on delete cascade,
  version_label text not null check (char_length(version_label) between 1 and 120),
  leaflet_kind text not null default 'paciente' check (leaflet_kind in ('paciente','profissional')),
  source_url text not null,
  source_type public.source_type not null default 'anvisa_bulario',
  source_checked_at timestamptz not null,
  full_text text,
  sections_json jsonb not null default '[]'::jsonb,
  verified_by uuid,
  approved_at timestamptz,
  status public.leaflet_status not null default 'draft',
  review_note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leaflet_https check (source_url ~* '^https://'),
  constraint leaflet_anvisa_host check (source_type <> 'anvisa_bulario' or public.is_official_anvisa_url(source_url)),
  constraint sections_array check (jsonb_typeof(sections_json) = 'array')
);
create index on public.leaflet_versions (medicine_id, status);
create unique index leaflet_one_published on public.leaflet_versions (medicine_id, leaflet_kind) where status = 'published';
grant select on public.leaflet_versions to anon, authenticated;
grant insert, update, delete on public.leaflet_versions to authenticated;
grant all on public.leaflet_versions to service_role;
alter table public.leaflet_versions enable row level security;
create policy "leaflet public" on public.leaflet_versions for select to anon, authenticated using (status in ('published','superseded'));
create policy "leaflet admin read" on public.leaflet_versions for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "leaflet admin insert" on public.leaflet_versions for insert to authenticated with check (public.has_role(auth.uid(),'admin') and status in ('draft','in_review'));
create policy "leaflet admin update" on public.leaflet_versions for update to authenticated using (public.has_role(auth.uid(),'admin') and status in ('draft','in_review','rejected')) with check (public.has_role(auth.uid(),'admin'));
create policy "leaflet admin delete" on public.leaflet_versions for delete to authenticated using (public.has_role(auth.uid(),'admin') and status in ('draft','rejected'));
create trigger leaflet_touch before update on public.leaflet_versions for each row execute function public.touch_updated_at();

create or replace function public.guard_publication() returns trigger language plpgsql set search_path=public as $$
begin
  if coalesce(current_setting('app.publishing', true),'') <> 'on' then
    if tg_table_name = 'leaflet_versions' and new.status in ('published','superseded') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
      raise exception 'Publicação só pode ocorrer pela função de revisão administrativa';
    end if;
    if tg_table_name = 'medicine_catalog' and new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
      raise exception 'Publicação só pode ocorrer pela função de revisão administrativa';
    end if;
  end if;
  return new;
end $$;
create trigger leaflet_guard before insert or update on public.leaflet_versions for each row execute function public.guard_publication();
create trigger catalog_guard before insert or update on public.medicine_catalog for each row execute function public.guard_publication();

create or replace function public.publish_leaflet_version(_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v public.leaflet_versions;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Sem permissão'; end if;
  select * into v from public.leaflet_versions where id = _id for update;
  if v.id is null then raise exception 'Versão não encontrada'; end if;
  if v.status not in ('draft','in_review') then raise exception 'Status não permite publicação'; end if;
  if jsonb_array_length(v.sections_json) = 0 then raise exception 'Bula sem seções revisadas'; end if;
  perform set_config('app.publishing','on', true);
  update public.leaflet_versions set status='superseded' where medicine_id=v.medicine_id and leaflet_kind=v.leaflet_kind and status='published';
  update public.leaflet_versions set status='published', verified_by=auth.uid(), approved_at=now() where id=_id;
  update public.medicine_catalog set status='published', verified_at=v.source_checked_at where id=v.medicine_id;
  insert into public.audit_events(actor_id, action, target_table, target_id) values (auth.uid(),'leaflet_published','leaflet_versions',_id);
end $$;

create or replace function public.reject_leaflet_version(_id uuid, _note text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Sem permissão'; end if;
  update public.leaflet_versions set status='rejected', review_note=left(_note,1000) where id=_id and status in ('draft','in_review');
  insert into public.audit_events(actor_id, action, target_table, target_id, details) values (auth.uid(),'leaflet_rejected','leaflet_versions',_id, jsonb_build_object('note',left(_note,1000)));
end $$;

create or replace function public.archive_medicine(_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Sem permissão'; end if;
  update public.medicine_catalog set status='archived' where id=_id;
  insert into public.audit_events(actor_id, action, target_table, target_id) values (auth.uid(),'medicine_archived','medicine_catalog',_id);
end $$;

-- user medications
create table public.user_medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  medicine_id uuid not null references public.medicine_catalog(id) on delete restrict,
  leaflet_version_id uuid references public.leaflet_versions(id) on delete set null,
  is_saved boolean not null default false,
  usage_state public.usage_state not null default 'none',
  first_accessed_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now(),
  started_at timestamptz,
  stopped_at timestamptz,
  personal_note text check (char_length(personal_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, medicine_id)
);
create index on public.user_medications (user_id, last_accessed_at desc);
grant select, insert, update, delete on public.user_medications to authenticated;
grant all on public.user_medications to service_role;
alter table public.user_medications enable row level security;
create policy "own um select" on public.user_medications for select to authenticated using (auth.uid() = user_id);
create policy "own um insert" on public.user_medications for insert to authenticated with check (auth.uid() = user_id);
create policy "own um update" on public.user_medications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own um delete" on public.user_medications for delete to authenticated using (auth.uid() = user_id);
create trigger um_touch before update on public.user_medications for each row execute function public.touch_updated_at();

create table public.user_medication_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_medication_id uuid not null references public.user_medications(id) on delete cascade,
  event text not null,
  created_at timestamptz not null default now()
);
create index on public.user_medication_history (user_medication_id, created_at desc);
grant select, insert, delete on public.user_medication_history to authenticated;
grant all on public.user_medication_history to service_role;
alter table public.user_medication_history enable row level security;
create policy "own umh select" on public.user_medication_history for select to authenticated using (auth.uid() = user_id);
create policy "own umh insert" on public.user_medication_history for insert to authenticated with check (auth.uid() = user_id and exists (select 1 from public.user_medications m where m.id = user_medication_id and m.user_id = auth.uid()));
create policy "own umh delete" on public.user_medication_history for delete to authenticated using (auth.uid() = user_id);

-- categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "own cat all" on public.categories for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.user_medication_categories (
  user_id uuid not null,
  user_medication_id uuid not null references public.user_medications(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (user_medication_id, category_id)
);
grant select, insert, delete on public.user_medication_categories to authenticated;
grant all on public.user_medication_categories to service_role;
alter table public.user_medication_categories enable row level security;
create policy "own umc select" on public.user_medication_categories for select to authenticated using (auth.uid() = user_id);
create policy "own umc insert" on public.user_medication_categories for insert to authenticated with check (
  auth.uid() = user_id
  and exists (select 1 from public.user_medications m where m.id = user_medication_id and m.user_id = auth.uid())
  and exists (select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid()));
create policy "own umc delete" on public.user_medication_categories for delete to authenticated using (auth.uid() = user_id);

-- search history (opt-in)
create table public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  query text not null check (char_length(query) between 1 and 120),
  created_at timestamptz not null default now()
);
create index on public.search_history (user_id, created_at desc);
grant select, insert, delete on public.search_history to authenticated;
grant all on public.search_history to service_role;
alter table public.search_history enable row level security;
create policy "own sh select" on public.search_history for select to authenticated using (auth.uid() = user_id);
create policy "own sh insert" on public.search_history for insert to authenticated with check (auth.uid() = user_id and exists (select 1 from public.profiles p where p.id = auth.uid() and p.save_search_history));
create policy "own sh delete" on public.search_history for delete to authenticated using (auth.uid() = user_id);

-- subscriptions
create table public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null default 'premium' check (type in ('premium')),
  status public.request_status not null default 'pending',
  user_note text check (char_length(user_note) <= 500),
  admin_reviewed_by uuid,
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_pending_request on public.subscription_requests (user_id) where status = 'pending';
create index on public.subscription_requests (status, created_at desc);
grant select, insert on public.subscription_requests to authenticated;
grant all on public.subscription_requests to service_role;
alter table public.subscription_requests enable row level security;
create policy "own req select" on public.subscription_requests for select to authenticated using (auth.uid() = user_id);
create policy "own req insert" on public.subscription_requests for insert to authenticated with check (auth.uid() = user_id and status = 'pending' and admin_reviewed_by is null and reviewed_at is null and admin_note is null);

create table public.subscription_entitlements (
  user_id uuid primary key,
  tier public.tier not null default 'free',
  status text not null default 'active' check (status in ('active','revoked')),
  valid_until timestamptz,
  approved_request_id uuid references public.subscription_requests(id) on delete set null,
  is_payment_confirmed boolean not null default false,
  updated_at timestamptz not null default now()
);
grant select on public.subscription_entitlements to authenticated;
grant all on public.subscription_entitlements to service_role;
alter table public.subscription_entitlements enable row level security;
create policy "own ent select" on public.subscription_entitlements for select to authenticated using (auth.uid() = user_id);

create or replace function public.is_premium(_user_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.subscription_entitlements e where e.user_id=_user_id and e.tier='premium' and e.status='active' and (e.valid_until is null or e.valid_until > now()))
$$;

create or replace function public.review_subscription_request(_id uuid, _approve boolean, _note text, _valid_until timestamptz default null) returns void
language plpgsql security definer set search_path=public as $$
declare r public.subscription_requests;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Sem permissão'; end if;
  if not _approve and coalesce(trim(_note),'') = '' then raise exception 'Informe o motivo da rejeição'; end if;
  select * into r from public.subscription_requests where id=_id for update;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;
  if r.status <> 'pending' then return; end if; -- idempotent
  update public.subscription_requests set status = case when _approve then 'approved'::public.request_status else 'rejected'::public.request_status end,
    admin_reviewed_by=auth.uid(), admin_note=left(_note,1000), reviewed_at=now() where id=_id;
  if _approve then
    insert into public.subscription_entitlements(user_id, tier, status, valid_until, approved_request_id, is_payment_confirmed, updated_at)
    values (r.user_id,'premium','active',_valid_until,_id,false,now())
    on conflict (user_id) do update set tier='premium', status='active', valid_until=excluded.valid_until, approved_request_id=_id, is_payment_confirmed=false, updated_at=now();
  end if;
  insert into public.audit_events(actor_id, action, target_table, target_id, details)
  values (auth.uid(), case when _approve then 'subscription_approved' else 'subscription_rejected' end, 'subscription_requests', _id, jsonb_build_object('note', left(_note,1000)));
end $$;

create or replace function public.revoke_entitlement(_user_id uuid, _note text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Sem permissão'; end if;
  update public.subscription_entitlements set status='revoked', updated_at=now() where user_id=_user_id;
  insert into public.audit_events(actor_id, action, target_table, target_id, details) values (auth.uid(),'entitlement_revoked','subscription_entitlements',_user_id, jsonb_build_object('note',left(_note,1000)));
end $$;

create or replace function public.admin_list_subscription_requests() returns table (
  id uuid, user_id uuid, status public.request_status, created_at timestamptz, reviewed_at timestamptz, admin_note text, user_note text, display_name text, email text)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Sem permissão'; end if;
  return query select r.id, r.user_id, r.status, r.created_at, r.reviewed_at, r.admin_note, r.user_note, p.display_name, u.email::text
    from public.subscription_requests r left join public.profiles p on p.id=r.user_id left join auth.users u on u.id=r.user_id
    order by (r.status='pending') desc, r.created_at desc limit 500;
end $$;

create or replace function public.admin_stats() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Sem permissão'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'premium_active', (select count(*) from public.subscription_entitlements where tier='premium' and status='active'),
    'requests_pending', (select count(*) from public.subscription_requests where status='pending'),
    'medicines_published', (select count(*) from public.medicine_catalog where status='published'),
    'leaflets_in_review', (select count(*) from public.leaflet_versions where status in ('draft','in_review'))
  );
end $$;

-- reminders (premium, enforced in DB)
create table public.reminder_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_medication_id uuid not null references public.user_medications(id) on delete cascade,
  label text check (char_length(label) <= 120),
  local_times text[] not null check (array_length(local_times,1) between 1 and 12),
  timezone text not null default 'America/Sao_Paulo',
  weekdays smallint[] not null check (array_length(weekdays,1) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  start_date date not null,
  end_date date,
  active boolean not null default true,
  delivery_channel text not null default 'in_app' check (delivery_channel in ('in_app','email')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint end_after_start check (end_date is null or end_date >= start_date)
);
create index on public.reminder_schedules (user_id);
grant select, insert, update, delete on public.reminder_schedules to authenticated;
grant all on public.reminder_schedules to service_role;
alter table public.reminder_schedules enable row level security;
create policy "own rs select" on public.reminder_schedules for select to authenticated using (auth.uid() = user_id);
create policy "own rs insert" on public.reminder_schedules for insert to authenticated with check (auth.uid() = user_id and public.is_premium(auth.uid()) and exists (select 1 from public.user_medications m where m.id=user_medication_id and m.user_id=auth.uid()));
create policy "own rs update" on public.reminder_schedules for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and public.is_premium(auth.uid()));
create policy "own rs delete" on public.reminder_schedules for delete to authenticated using (auth.uid() = user_id);
create trigger rs_touch before update on public.reminder_schedules for each row execute function public.touch_updated_at();

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  reminder_id uuid not null references public.reminder_schedules(id) on delete cascade,
  due_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','sent','failed','skipped')),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (reminder_id, due_at)
);
grant select, delete on public.notification_events to authenticated;
grant all on public.notification_events to service_role;
alter table public.notification_events enable row level security;
create policy "own ne select" on public.notification_events for select to authenticated using (auth.uid() = user_id);
create policy "own ne delete" on public.notification_events for delete to authenticated using (auth.uid() = user_id);

create table public.symptom_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_medication_id uuid not null references public.user_medications(id) on delete cascade,
  mood public.mood not null,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);
create index on public.symptom_checkins (user_id, created_at desc);
grant select, insert, delete on public.symptom_checkins to authenticated;
grant all on public.symptom_checkins to service_role;
alter table public.symptom_checkins enable row level security;
create policy "own sc select" on public.symptom_checkins for select to authenticated using (auth.uid() = user_id);
create policy "own sc insert" on public.symptom_checkins for insert to authenticated with check (
  auth.uid() = user_id and public.is_premium(auth.uid())
  and exists (select 1 from public.profiles p where p.id=auth.uid() and p.health_tracking_consent)
  and exists (select 1 from public.user_medications m where m.id=user_medication_id and m.user_id=auth.uid()));
create policy "own sc delete" on public.symptom_checkins for delete to authenticated using (auth.uid() = user_id);

-- delete own personal data (keeps auth account)
create or replace function public.delete_my_personal_data() returns void language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  delete from public.symptom_checkins where user_id=uid;
  delete from public.notification_events where user_id=uid;
  delete from public.reminder_schedules where user_id=uid;
  delete from public.user_medication_categories where user_id=uid;
  delete from public.user_medication_history where user_id=uid;
  delete from public.user_medications where user_id=uid;
  delete from public.categories where user_id=uid;
  delete from public.search_history where user_id=uid;
  update public.profiles set health_tracking_consent=false, health_tracking_consent_at=null, save_search_history=false where id=uid;
end $$;

revoke execute on function public.publish_leaflet_version(uuid), public.reject_leaflet_version(uuid,text), public.archive_medicine(uuid),
  public.review_subscription_request(uuid,boolean,text,timestamptz), public.revoke_entitlement(uuid,text),
  public.admin_list_subscription_requests(), public.admin_stats(), public.delete_my_personal_data() from anon, public;
grant execute on function public.publish_leaflet_version(uuid), public.reject_leaflet_version(uuid,text), public.archive_medicine(uuid),
  public.review_subscription_request(uuid,boolean,text,timestamptz), public.revoke_entitlement(uuid,text),
  public.admin_list_subscription_requests(), public.admin_stats(), public.delete_my_personal_data(),
  public.has_role(uuid, public.app_role), public.is_premium(uuid) to authenticated;
