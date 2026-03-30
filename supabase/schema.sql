create extension if not exists pgcrypto;

create type app_role as enum ('editor', 'client', 'ogilvy', 'admin');
create type team_type as enum ('editor', 'client', 'ogilvy');
create type schedule_type as enum ('record', 'deliver', 'review', 'go_live');

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  role app_role not null default 'client',
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  team_type team_type not null,
  created_at timestamptz not null default now()
);

create table if not exists team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(team_id, profile_id)
);

create table if not exists videos (
  id text primary key,
  title text not null,
  emoji text not null default '🎬',
  day text not null,
  time text not null,
  schedule_type schedule_type not null,
  note text,
  goes_live text,
  is_approved boolean not null default false,
  manual_status text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'videos_manual_status_check'
  ) then
    alter table videos
      add constraint videos_manual_status_check
      check (
        manual_status is null
        or manual_status in ('waiting to shoot', 'shot', 'editing', 'waiting on approval')
      );
  end if;
end $$;

create table if not exists schedule_items (
  id uuid primary key default gen_random_uuid(),
  video_id text not null references videos(id) on delete cascade,
  day text not null,
  time text not null,
  schedule_type schedule_type not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists review_links (
  id uuid primary key default gen_random_uuid(),
  video_id text not null references videos(id) on delete cascade,
  version_label text not null,
  frameio_url text not null,
  notes text,
  custom_message text,
  posted_by uuid references profiles(id) on delete set null,
  posted_by_name text not null,
  posted_at timestamptz not null default now()
);

alter table review_links add column if not exists bundle_id uuid;
alter table review_links add column if not exists bundle_order int;

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  team team_type not null,
  created_at timestamptz not null default now()
);

create table if not exists notification_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists notification_logs (
  id uuid primary key default gen_random_uuid(),
  video_id text references videos(id) on delete set null,
  review_link_id uuid references review_links(id) on delete set null,
  recipient_emails text[] not null default '{}',
  target_teams team_type[] not null default '{}',
  subject text not null,
  message text,
  triggered_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table teams enable row level security;
alter table team_memberships enable row level security;
alter table videos enable row level security;
alter table schedule_items enable row level security;
alter table review_links enable row level security;
alter table contacts enable row level security;
alter table notification_templates enable row level security;
alter table notification_logs enable row level security;

/** Single-row JSON workspace for API cutdown hub (synced via Next.js API + service role). */
create table if not exists cutdown_workspace (
  id text primary key default 'singleton',
  payload jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table cutdown_workspace enable row level security;
/** No policies: anon cannot access; service role (API route) bypasses RLS. */

create or replace function get_my_role()
returns app_role
language sql
stable
as $$
  select role from profiles where id = auth.uid()
$$;

create policy "profiles_select_self_or_admin" on profiles
for select using (id = auth.uid() or get_my_role() = 'admin');

create policy "profiles_update_self_or_admin" on profiles
for update using (id = auth.uid() or get_my_role() = 'admin');

create policy "teams_read_all" on teams
for select using (auth.role() = 'authenticated');

create policy "teams_admin_write" on teams
for all using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

create policy "team_memberships_read_all" on team_memberships
for select using (auth.role() = 'authenticated');

create policy "team_memberships_admin_write" on team_memberships
for all using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

create policy "videos_read_all" on videos
for select using (auth.role() = 'authenticated');

create policy "videos_admin_write" on videos
for all using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

create policy "schedule_items_read_all" on schedule_items
for select using (auth.role() = 'authenticated');

create policy "schedule_items_admin_write" on schedule_items
for all using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

create policy "review_links_read_all" on review_links
for select using (auth.role() = 'authenticated');

create policy "review_links_editor_insert" on review_links
for insert with check (get_my_role() in ('editor', 'admin'));

create policy "review_links_editor_update" on review_links
for update using (get_my_role() in ('editor', 'admin'))
with check (get_my_role() in ('editor', 'admin'));

create policy "contacts_read_all" on contacts
for select using (auth.role() = 'authenticated');

create policy "contacts_admin_write" on contacts
for all using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

create policy "templates_read_all" on notification_templates
for select using (auth.role() = 'authenticated');

create policy "templates_admin_write" on notification_templates
for all using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

create policy "logs_insert_editor_admin" on notification_logs
for insert with check (get_my_role() in ('editor', 'admin'));

create policy "logs_select_editor_admin" on notification_logs
for select using (get_my_role() in ('editor', 'admin'));
