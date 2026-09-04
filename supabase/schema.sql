-- Run this SQL in your Supabase SQL editor.
-- It creates normalized tables for users/roles, profiles, registrations, and power checks.

create table if not exists public.epc_users (
  id text primary key,
  email text not null unique,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  is_active boolean not null default true,
  password_salt text,
  password_hash text,
  password_iterations integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.epc_profiles (
  id text primary key,
  model_name text not null,
  engine text not null,
  engine_count integer,
  engines jsonb,
  check_types jsonb not null,
  limits jsonb not null,
  input_schema jsonb not null,
  calculation_id text not null,
  execution_mode text not null default 'calculated' check (execution_mode in ('calculated', 'input_only')),
  input_only_config jsonb,
  power_check_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.epc_registrations (
  id text primary key,
  tail_number text not null,
  profile_id text not null references public.epc_profiles(id) on delete restrict,
  engines jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.epc_power_checks (
  id text primary key,
  check_date date not null,
  registration_id text not null references public.epc_registrations(id) on delete cascade,
  check_type text not null,
  total_time_hrs double precision,
  calculation_version text,
  profile_execution_mode text check (profile_execution_mode in ('calculated', 'input_only')),
  schema_version integer,
  profile_snapshot jsonb,
  check_values jsonb,
  check_result jsonb,
  overall_result jsonb,
  created_by_user_id text,
  created_by_user_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.epc_power_check_engines (
  check_id text not null references public.epc_power_checks(id) on delete cascade,
  engine_id text not null,
  engine_label text not null,
  engine_values jsonb not null,
  engine_result jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (check_id, engine_id)
);

create index if not exists idx_epc_checks_registration on public.epc_power_checks(registration_id);
create index if not exists idx_epc_checks_check_date on public.epc_power_checks(check_date);
create index if not exists idx_epc_registrations_profile on public.epc_registrations(profile_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_epc_users_updated on public.epc_users;
create trigger trg_epc_users_updated before update on public.epc_users
for each row execute function public.set_updated_at();

drop trigger if exists trg_epc_profiles_updated on public.epc_profiles;
create trigger trg_epc_profiles_updated before update on public.epc_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_epc_registrations_updated on public.epc_registrations;
create trigger trg_epc_registrations_updated before update on public.epc_registrations
for each row execute function public.set_updated_at();

drop trigger if exists trg_epc_checks_updated on public.epc_power_checks;
create trigger trg_epc_checks_updated before update on public.epc_power_checks
for each row execute function public.set_updated_at();

drop trigger if exists trg_epc_check_engines_updated on public.epc_power_check_engines;
create trigger trg_epc_check_engines_updated before update on public.epc_power_check_engines
for each row execute function public.set_updated_at();

-- Role-aware RLS setup.
alter table public.epc_users enable row level security;
alter table public.epc_profiles enable row level security;
alter table public.epc_registrations enable row level security;
alter table public.epc_power_checks enable row level security;
alter table public.epc_power_check_engines enable row level security;

create or replace function public.epc_current_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.epc_is_known_active_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.epc_users u
    where lower(u.email) = public.epc_current_email()
      and u.is_active = true
  );
$$;

create or replace function public.epc_current_role()
returns text
language sql
stable
as $$
  select u.role
  from public.epc_users u
  where lower(u.email) = public.epc_current_email()
    and u.is_active = true
  limit 1;
$$;

create or replace function public.epc_can_write()
returns boolean
language sql
stable
as $$
  select public.epc_current_role() in ('admin', 'editor');
$$;

create or replace function public.epc_is_admin()
returns boolean
language sql
stable
as $$
  select public.epc_current_role() = 'admin';
$$;

drop policy if exists epc_users_read on public.epc_users;
create policy epc_users_read on public.epc_users
for select using (public.epc_is_known_active_user());

drop policy if exists epc_users_admin_insert on public.epc_users;
create policy epc_users_admin_insert on public.epc_users
for insert with check (public.epc_is_admin());

drop policy if exists epc_users_bootstrap_insert on public.epc_users;
create policy epc_users_bootstrap_insert on public.epc_users
for insert with check (
  (select count(*) from public.epc_users) = 0
  and lower(email) = public.epc_current_email()
  and role = 'admin'
  and is_active = true
);

drop policy if exists epc_users_admin_update on public.epc_users;
create policy epc_users_admin_update on public.epc_users
for update using (public.epc_is_admin())
with check (public.epc_is_admin());

drop policy if exists epc_users_admin_delete on public.epc_users;
create policy epc_users_admin_delete on public.epc_users
for delete using (public.epc_is_admin());

drop policy if exists epc_profiles_read on public.epc_profiles;
create policy epc_profiles_read on public.epc_profiles
for select using (public.epc_is_known_active_user());

drop policy if exists epc_profiles_write on public.epc_profiles;
create policy epc_profiles_write on public.epc_profiles
for all using (public.epc_can_write())
with check (public.epc_can_write());

drop policy if exists epc_registrations_read on public.epc_registrations;
create policy epc_registrations_read on public.epc_registrations
for select using (public.epc_is_known_active_user());

drop policy if exists epc_registrations_write on public.epc_registrations;
create policy epc_registrations_write on public.epc_registrations
for all using (public.epc_can_write())
with check (public.epc_can_write());

drop policy if exists epc_power_checks_read on public.epc_power_checks;
create policy epc_power_checks_read on public.epc_power_checks
for select using (public.epc_is_known_active_user());

drop policy if exists epc_power_checks_write on public.epc_power_checks;
create policy epc_power_checks_write on public.epc_power_checks
for all using (public.epc_can_write())
with check (public.epc_can_write());

drop policy if exists epc_power_check_engines_read on public.epc_power_check_engines;
create policy epc_power_check_engines_read on public.epc_power_check_engines
for select using (public.epc_is_known_active_user());

drop policy if exists epc_power_check_engines_write on public.epc_power_check_engines;
create policy epc_power_check_engines_write on public.epc_power_check_engines
for all using (public.epc_can_write())
with check (public.epc_can_write());





