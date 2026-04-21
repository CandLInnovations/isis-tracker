-- Isis Tracker — Supabase Schema
-- Run this entire file in the Supabase SQL Editor

-- Fenbendazole cycle start date
create table if not exists fenben_settings (
  id integer primary key default 1,
  cycle_start_date date not null,
  updated_at timestamptz default now()
);

-- Individual dose logs (one row per calendar date)
create table if not exists fenben_doses (
  id uuid primary key default gen_random_uuid(),
  dose_date date not null unique,
  given boolean default true,
  notes text,
  created_at timestamptz default now()
);

-- Daily supplement completion (one row per calendar date)
create table if not exists supplement_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  taken_ids text[] default '{}',
  updated_at timestamptz default now()
);

-- Per-supplement active/inactive toggles + display overrides
create table if not exists supplement_config (
  supplement_id   text primary key,
  active          boolean default true,
  name_override   text,
  dose_override   text,
  notes           text,
  updated_at      timestamptz default now()
);

-- If upgrading an existing database, run this to add the new columns:
-- alter table supplement_config add column if not exists name_override text;
-- alter table supplement_config add column if not exists dose_override text;
-- alter table supplement_config add column if not exists notes text;

-- Topical application sessions
create table if not exists topical_logs (
  id uuid primary key default gen_random_uuid(),
  applied_at timestamptz not null,
  products text[] not null default '{}',
  duration_minutes integer,
  skin_reaction text,
  notes text,
  created_at timestamptz default now()
);

-- Gabapentin PRN doses
create table if not exists gabapentin_logs (
  id uuid primary key default gen_random_uuid(),
  given_at timestamptz not null,
  pills integer not null check (pills in (1, 2)),
  pain_before integer check (pain_before between 1 and 5),
  reason text,
  notes text,
  created_at timestamptz default now()
);

-- Daily vitals & lump observations (one row per calendar date)
create table if not exists observation_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  pain_level integer check (pain_level between 1 and 5),
  energy_level integer check (energy_level between 1 and 5),
  appetite text,
  urine_color text,
  stool_quality text,
  water_intake text,
  gum_color text,
  vomiting boolean default false,
  lump_size_cm numeric,
  lump_texture text,
  lump_warmth text,
  left_side_distension boolean default false,
  lump_notes text,
  general_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Weight log
create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  weight_lbs numeric not null,
  notes text,
  created_at timestamptz default now()
);

-- Row Level Security + permissive policies (allow anon read/write — private household app)
alter table fenben_settings    enable row level security;
alter table fenben_doses       enable row level security;
alter table supplement_logs    enable row level security;
alter table supplement_config  enable row level security;
alter table topical_logs       enable row level security;
alter table gabapentin_logs    enable row level security;
alter table observation_logs   enable row level security;
alter table weight_logs        enable row level security;

create policy "allow all" on fenben_settings    for all using (true) with check (true);
create policy "allow all" on fenben_doses       for all using (true) with check (true);
create policy "allow all" on supplement_logs    for all using (true) with check (true);
create policy "allow all" on supplement_config  for all using (true) with check (true);
create policy "allow all" on topical_logs       for all using (true) with check (true);
create policy "allow all" on gabapentin_logs    for all using (true) with check (true);
create policy "allow all" on observation_logs   for all using (true) with check (true);
create policy "allow all" on weight_logs        for all using (true) with check (true);
