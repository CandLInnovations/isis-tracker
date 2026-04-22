-- Isis Tracker — Supabase Schema
-- Full schema for fresh installations.
-- For existing databases, see the MIGRATION section at the bottom.

-- Fenbendazole cycle settings
create table if not exists fenben_settings (
  id integer primary key default 1,
  cycle_start_date date not null,
  dosing_mode text not null default 'cycling',
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

-- Named, ordered supplement groups
create table if not exists supplement_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_order integer not null default 0,
  icon text,
  created_at timestamptz default now()
);

-- Supplement definitions + per-supplement config
-- supplement_id is the stable identifier referenced in supplement_logs.taken_ids
create table if not exists supplement_config (
  supplement_id   text primary key,
  name            text,
  dose            text,
  status          text not null default 'active',
  group_id        uuid references supplement_groups(id),
  display_order   integer default 0,
  notes           text,
  name_override   text,
  dose_override   text,
  estimated_days_remaining integer,
  last_restocked_date date,
  preferred_source text,
  reorder_notes   text,
  active          boolean default true,
  updated_at      timestamptz default now(),
  constraint supplement_config_status_check check (status in ('active','on_order','need_to_order','sidelined'))
);

-- Daily supplement completion (one row per calendar date)
create table if not exists supplement_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  taken_ids text[] default '{}',
  updated_at timestamptz default now()
);

-- Topical application sessions
create table if not exists topical_logs (
  id uuid primary key default gen_random_uuid(),
  applied_at timestamptz not null,
  products text[] not null default '{}',
  duration_hours numeric,
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

-- Daily vitals & lump observations (multiple entries per date allowed)
create table if not exists observation_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  time_of_day text,
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

-- Row Level Security + permissive policies (private household app)
alter table fenben_settings    enable row level security;
alter table fenben_doses       enable row level security;
alter table supplement_groups  enable row level security;
alter table supplement_config  enable row level security;
alter table supplement_logs    enable row level security;
alter table topical_logs       enable row level security;
alter table gabapentin_logs    enable row level security;
alter table observation_logs   enable row level security;
alter table weight_logs        enable row level security;

create policy "allow all" on fenben_settings    for all using (true) with check (true);
create policy "allow all" on fenben_doses       for all using (true) with check (true);
create policy "allow all" on supplement_groups  for all using (true) with check (true);
create policy "allow all" on supplement_config  for all using (true) with check (true);
create policy "allow all" on supplement_logs    for all using (true) with check (true);
create policy "allow all" on topical_logs       for all using (true) with check (true);
create policy "allow all" on gabapentin_logs    for all using (true) with check (true);
create policy "allow all" on observation_logs   for all using (true) with check (true);
create policy "allow all" on weight_logs        for all using (true) with check (true);


-- =============================================================================
-- MIGRATION: Run these on an EXISTING database (skip for fresh installs)
-- =============================================================================

-- Step 1: New tables
-- create table supplement_groups (as above) + RLS policy

-- Step 2: Extend supplement_config
-- alter table supplement_config
--   add column if not exists name text,
--   add column if not exists dose text,
--   add column if not exists status text not null default 'active',
--   add column if not exists group_id uuid references supplement_groups(id),
--   add column if not exists display_order integer default 0,
--   add column if not exists notes text,
--   add column if not exists estimated_days_remaining integer,
--   add column if not exists last_restocked_date date,
--   add column if not exists preferred_source text,
--   add column if not exists reorder_notes text;
-- alter table supplement_config add constraint supplement_config_status_check
--   check (status in ('active','on_order','need_to_order','sidelined'));

-- Step 3: Migrate boolean active → status
-- update supplement_config set status = case when active = true then 'active' else 'on_order' end;

-- Step 4: fenben continuous mode
-- alter table fenben_settings add column if not exists dosing_mode text not null default 'cycling';

-- Step 5: observation_logs multi-entry + time_of_day
-- alter table observation_logs drop constraint if exists observation_logs_log_date_key;
-- alter table observation_logs add column if not exists time_of_day text;

-- Step 6: topical_logs duration in hours
-- alter table topical_logs rename column duration_minutes to duration_hours;
-- alter table topical_logs alter column duration_hours type numeric;

-- =============================================================================
-- SEED DATA: Run after migration steps above
-- =============================================================================

-- Supplement groups (deterministic UUIDs — safe to re-run)
insert into supplement_groups (id, name, display_order) values
  ('11111111-1111-1111-1111-111111111111', '☀️ Morning Treat — Batch 1', 1),
  ('22222222-2222-2222-2222-222222222222', '☀️ Morning Treat — Batch 2', 2),
  ('33333333-3333-3333-3333-333333333333', '🌙 Evening Treat', 3),
  ('44444444-4444-4444-4444-444444444444', '🌿 Hulda Clark Trio', 4),
  ('55555555-5555-5555-5555-555555555555', '🍖 With Raw Meal', 5),
  ('66666666-6666-6666-6666-666666666666', '💊 Chad''s Evening Additions', 6)
on conflict (id) do nothing;

-- GROUP 1: ☀️ Morning Treat — Batch 1
insert into supplement_config (supplement_id, name, dose, status, group_id, display_order, notes) values
  ('am_turmeric',       'Turmeric',                    '1.5–2 tsp',          'active',        '11111111-1111-1111-1111-111111111111', 1,  null),
  ('am_black_pepper',   'Black Pepper',                '¼ tsp',              'active',        '11111111-1111-1111-1111-111111111111', 2,  'Required with turmeric for absorption'),
  ('am_ginger',         'Ginger',                      '¼ tsp',              'active',        '11111111-1111-1111-1111-111111111111', 3,  null),
  ('am_nso',            'NSO (Black Seed Oil)',         '1 tsp',              'active',        '11111111-1111-1111-1111-111111111111', 4,  'Thymoquinone — anti-tumor'),
  ('am_nigella',        'Ground Nigella Sativa Seeds', '¼ tsp',              'active',        '11111111-1111-1111-1111-111111111111', 5,  'Pairs with NSO'),
  ('am_reishi',         'Reishi Mushroom',             '1 tsp',              'active',        '11111111-1111-1111-1111-111111111111', 6,  'Anti-tumor, immune'),
  ('am_chaga',          'Chaga Mushroom',              '1 tsp',              'active',        '11111111-1111-1111-1111-111111111111', 7,  'Betulinic acid, anti-tumor'),
  ('am_cordyceps',      'Cordyceps',                   '1 tsp',              'active',        '11111111-1111-1111-1111-111111111111', 8,  'Mitochondrial support'),
  ('am_astragalus',     'Astragalus',                  '1 tsp',              'active',        '11111111-1111-1111-1111-111111111111', 9,  'NK cell activation'),
  ('am_jiaogulan',      'Jiaogulan',                   '½ tsp',              'active',        '11111111-1111-1111-1111-111111111111', 10, 'Saponin immune activation'),
  ('am_elecampane',     'Elecampane Root',             '½ tsp',              'active',        '11111111-1111-1111-1111-111111111111', 11, 'Alantolactone anti-tumor'),
  ('am_olive_leaf',     'Olive Leaf',                  '1 tsp',              'active',        '11111111-1111-1111-1111-111111111111', 12, 'Oleuropein antimicrobial/anti-tumor'),
  ('am_gotu_kola',      'Gotu Kola',                   '½ tsp',              'active',        '11111111-1111-1111-1111-111111111111', 13, 'Connective tissue, anti-tumor'),
  ('am_frankincense',   'Frankincense Resin Powder',   '⅛ tsp (300–500mg)', 'active',        '11111111-1111-1111-1111-111111111111', 14, 'Full boswellic acid spectrum'),
  ('am_graviola',       'Graviola Leaf',               '½ tsp',              'need_to_order', '11111111-1111-1111-1111-111111111111', 15, 'Acetogenins — highest priority order'),
  ('am_turkey_tail',    'Turkey Tail Mushroom',        '1 tsp',              'need_to_order', '11111111-1111-1111-1111-111111111111', 16, 'PSK/PSP immune — on order'),
  ('am_maitake',        'Maitake Mushroom',            '1 tsp',              'need_to_order', '11111111-1111-1111-1111-111111111111', 17, 'D-fraction canine cancer research')
on conflict (supplement_id) do update set
  name = excluded.name,
  dose = excluded.dose,
  group_id = excluded.group_id,
  display_order = excluded.display_order,
  notes = case when supplement_config.name is null then excluded.notes else supplement_config.notes end,
  status = case when supplement_config.name is null then excluded.status else supplement_config.status end;

-- GROUP 2: ☀️ Morning Treat — Batch 2
insert into supplement_config (supplement_id, name, dose, status, group_id, display_order, notes) values
  ('am_ashwagandha',    'Ashwagandha',                 '¼ tsp',              'active',        '22222222-2222-2222-2222-222222222222', 1,  'Adaptogen, anti-inflammatory'),
  ('am_barberry',       'Barberry Root Bark',          '1 tsp',              'active',        '22222222-2222-2222-2222-222222222222', 2,  'Berberine alkaloid spectrum'),
  ('am_milk_thistle',   'Milk Thistle Seed',           '1.5 tsp',            'active',        '22222222-2222-2222-2222-222222222222', 3,  'Increased for continuous fenben'),
  ('am_vitex',          'Vitex Berry',                 '¼ tsp',              'active',        '22222222-2222-2222-2222-222222222222', 4,  'Hormonal — ovarian remnant support'),
  ('am_saw_palmetto',   'Saw Palmetto',                '¼ tsp',              'active',        '22222222-2222-2222-2222-222222222222', 5,  'Anti-hormonal, anti-proliferative'),
  ('am_dandelion',      'Dandelion Root',              '1 tsp',              'active',        '22222222-2222-2222-2222-222222222222', 6,  'Liver, lymphatic, diuretic'),
  ('am_bay_leaf',       'Bay Leaf',                    '¼ tsp',              'active',        '22222222-2222-2222-2222-222222222222', 7,  'Ursolic acid anti-tumor'),
  ('am_msm',            'MSM',                         '¼ tsp',              'active',        '22222222-2222-2222-2222-222222222222', 8,  'Joint, connective tissue'),
  ('am_chondroitin',    'Chondroitin',                 'open 1 capsule',     'active',        '22222222-2222-2222-2222-222222222222', 9,  'Joint support'),
  ('am_glucosamine',    'Glucosamine Sulfate',         '¼ tsp',              'active',        '22222222-2222-2222-2222-222222222222', 10, 'Joint support'),
  ('am_creatine',       'Creatine (micronized)',       '1 tsp',              'active',        '22222222-2222-2222-2222-222222222222', 11, 'Muscle preservation, anti-tumor metabolism'),
  ('am_citicoline',     'Citicoline Sodium',           '¼ tsp',              'active',        '22222222-2222-2222-2222-222222222222', 12, 'Neuroprotective, liver support'),
  ('am_nac',            'NAC',                         'open 1 capsule',     'active',        '22222222-2222-2222-2222-222222222222', 13, 'Glutathione precursor, liver protection'),
  ('am_cbd',            'CBD Oil (full spectrum)',     '1 full dropper',     'active',        '22222222-2222-2222-2222-222222222222', 14, 'Anti-tumor, pain, appetite'),
  ('am_nad',            'NAD+ (liposomal)',            '1 serving',          'active',        '22222222-2222-2222-2222-222222222222', 15, 'Mitochondrial support'),
  ('am_vit_c',          'Liposomal Vitamin C',         '1–2 servings',       'active',        '22222222-2222-2222-2222-222222222222', 16, 'High-dose anti-tumor'),
  ('am_vit_e',          'Vitamin E Succinate (d-alpha)', '400IU open capsule', 'need_to_order', '22222222-2222-2222-2222-222222222222', 17, 'Tippens protocol — on order'),
  ('am_blessed_thistle', 'Blessed Thistle',            '¼ tsp',              'active',        '22222222-2222-2222-2222-222222222222', 18, 'Liver bile support')
on conflict (supplement_id) do update set
  name = excluded.name,
  dose = excluded.dose,
  group_id = excluded.group_id,
  display_order = excluded.display_order,
  notes = case when supplement_config.name is null then excluded.notes else supplement_config.notes end,
  status = case when supplement_config.name is null then excluded.status else supplement_config.status end;

-- GROUP 3: 🌙 Evening Treat
insert into supplement_config (supplement_id, name, dose, status, group_id, display_order, notes) values
  ('pm_turmeric',      'Turmeric',                    '1.5–2 tsp',          'active', '33333333-3333-3333-3333-333333333333', 1,  null),
  ('pm_black_pepper',  'Black Pepper',                '¼ tsp',              'active', '33333333-3333-3333-3333-333333333333', 2,  null),
  ('pm_boswellia',     'Boswellia',                   'open 1 capsule (500mg)', 'active', '33333333-3333-3333-3333-333333333333', 3,  '5-LOX inhibitor, key anti-tumor'),
  ('pm_cats_claw',     'Cat''s Claw',                 '¼ tsp',              'active', '33333333-3333-3333-3333-333333333333', 4,  'TNF-alpha inhibitor'),
  ('pm_milk_thistle',  'Milk Thistle Seed',           '1 tsp',              'active', '33333333-3333-3333-3333-333333333333', 5,  'Evening liver dose'),
  ('pm_nettle',        'Nettle',                      '1 tsp',              'active', '33333333-3333-3333-3333-333333333333', 6,  'Systemic anti-inflammatory'),
  ('pm_pau_darco',     'Pau d''Arco',                 '½ tsp',              'active', '33333333-3333-3333-3333-333333333333', 7,  'Lapachol anti-tumor'),
  ('pm_chaparral',     'Chaparral',                   '⅛ tsp',              'active', '33333333-3333-3333-3333-333333333333', 8,  'NDGA — potent, keep dose low'),
  ('pm_burdock',       'Burdock Root',                '1 tsp',              'active', '33333333-3333-3333-3333-333333333333', 9,  'Essiac herb, blood purifier'),
  ('pm_mullein',       'Mullein Leaf',                '½ tsp',              'active', '33333333-3333-3333-3333-333333333333', 10, 'Respiratory support'),
  ('pm_slippery_elm',  'Slippery Elm Bark',           '1 tsp',              'active', '33333333-3333-3333-3333-333333333333', 11, 'GI soothing, constipation support'),
  ('pm_marshmallow',   'Marshmallow Root',            '1 tsp',              'active', '33333333-3333-3333-3333-333333333333', 12, 'GI mucilage, pairs with slippery elm'),
  ('pm_gotu_kola',     'Gotu Kola',                   '½ tsp',              'active', '33333333-3333-3333-3333-333333333333', 13, 'Evening second dose'),
  ('pm_moringa',       'Moringa Leaf',                '¼ tsp',              'active', '33333333-3333-3333-3333-333333333333', 14, 'Dense nutrition, anti-inflammatory'),
  ('pm_melatonin',     'Melatonin',                   '6–9mg crushed',      'active', '33333333-3333-3333-3333-333333333333', 15, 'Pain modulation, anti-tumor, sleep')
on conflict (supplement_id) do update set
  name = excluded.name,
  dose = excluded.dose,
  group_id = excluded.group_id,
  display_order = excluded.display_order,
  notes = case when supplement_config.name is null then excluded.notes else supplement_config.notes end,
  status = case when supplement_config.name is null then excluded.status else supplement_config.status end;

-- GROUP 4: 🌿 Hulda Clark Trio
insert into supplement_config (supplement_id, name, dose, status, group_id, display_order, notes) values
  ('clark_black_walnut', 'Black Walnut Hull Powder', '¼ tsp',  'active', '44444444-4444-4444-4444-444444444444', 1, 'Juglone cytotoxic to cancer cells'),
  ('clark_wormwood',     'Wormwood',                 '¼ tsp',  'active', '44444444-4444-4444-4444-444444444444', 2, 'Artemisinin anti-tumor — once daily only'),
  ('clark_clove',        'Clove Powder',             '⅛ tsp',  'active', '44444444-4444-4444-4444-444444444444', 3, 'Eugenol, completes Clark protocol')
on conflict (supplement_id) do update set
  name = excluded.name,
  dose = excluded.dose,
  group_id = excluded.group_id,
  display_order = excluded.display_order,
  notes = case when supplement_config.name is null then excluded.notes else supplement_config.notes end,
  status = case when supplement_config.name is null then excluded.status else supplement_config.status end;

-- GROUP 5: 🍖 With Raw Meal
insert into supplement_config (supplement_id, name, dose, status, group_id, display_order, notes) values
  ('meal_fenben',       'Fenbendazole',              '444mg',              'active', '55555555-5555-5555-5555-555555555555', 1,  'CONTINUOUS daily — no off cycle. Give with fat.'),
  ('meal_ivermectin',   'Ivermectin 1% injectable',  '1ml orally',         'active', '55555555-5555-5555-5555-555555555555', 2,  'Daily, anti-cancer via P-glycoprotein inhibition'),
  ('meal_gelatin',      'Grass Fed Gelatin',         '1 tbsp',             'active', '55555555-5555-5555-5555-555555555555', 3,  'Glycine, gut lining'),
  ('meal_beef_fat',     'Beef Fat (raw trimmings)',  '2oz',                'active', '55555555-5555-5555-5555-555555555555', 4,  'Fat carrier for fenben'),
  ('am_apricot',        'Apricot Seeds (bitter)',    'few seeds',          'active', '55555555-5555-5555-5555-555555555555', 5,  'Amygdalin — give AM and PM'),
  ('meal_beef_heart',   'Beef Heart',                '1 serving',          'active', '55555555-5555-5555-5555-555555555555', 6,  null),
  ('meal_beef_liver',   'Beef Liver',                '1 serving',          'active', '55555555-5555-5555-5555-555555555555', 7,  null),
  ('meal_broccoli',     'Broccoli',                  '1 serving',          'active', '55555555-5555-5555-5555-555555555555', 8,  null),
  ('meal_blueberries',  'Blueberries',               '1 serving',          'active', '55555555-5555-5555-5555-555555555555', 9,  null),
  ('meal_green_tripe',  'Green Tripe',               '1 serving',          'active', '55555555-5555-5555-5555-555555555555', 10, null),
  ('meal_egg_yolks',    'Egg Yolks',                 '2 yolks',            'active', '55555555-5555-5555-5555-555555555555', 11, null),
  ('meal_sardines',     'Sardines',                  '1 serving',          'active', '55555555-5555-5555-5555-555555555555', 12, null),
  ('meal_mackerel',     'Mackerel',                  '1 serving',          'active', '55555555-5555-5555-5555-555555555555', 13, null)
on conflict (supplement_id) do update set
  name = excluded.name,
  dose = excluded.dose,
  group_id = excluded.group_id,
  display_order = excluded.display_order,
  notes = case when supplement_config.name is null then excluded.notes else supplement_config.notes end,
  status = case when supplement_config.name is null then excluded.status else supplement_config.status end;

-- GROUP 6: 💊 Chad's Evening Additions
-- Benadryl (PRN/sidelined), pm_apricot (sidelined - moved to meal group as am_apricot)
insert into supplement_config (supplement_id, name, dose, status, group_id, display_order, notes) values
  ('chad_benadryl',    'Benadryl (diphenhydramine)', 'PRN as needed',      'sidelined', '66666666-6666-6666-6666-666666666666', 1, 'PRN pain/comfort — use only when needed'),
  ('pm_apricot',       'Apricot Seeds (bitter)',     'few seeds',          'sidelined', '66666666-6666-6666-6666-666666666666', 2, 'Moved to With Raw Meal as am_apricot')
on conflict (supplement_id) do update set
  name = excluded.name,
  dose = excluded.dose,
  group_id = excluded.group_id,
  display_order = excluded.display_order,
  notes = case when supplement_config.name is null then excluded.notes else supplement_config.notes end,
  status = case when supplement_config.name is null then excluded.status else supplement_config.status end;

-- Sidelined: old supplements not in new protocol
insert into supplement_config (supplement_id, name, dose, status, group_id, display_order) values
  ('am_quercetin', 'Quercetin', '500mg', 'sidelined', null, 0)
on conflict (supplement_id) do update set
  name = excluded.name,
  status = case when supplement_config.name is null then 'sidelined' else supplement_config.status end;
