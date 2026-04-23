-- ============================================================
-- Isis Tracker Migration — Run each block separately in order
-- ============================================================

-- BLOCK 1: Create supplement_groups table
create table if not exists supplement_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_order integer not null default 0,
  icon text,
  created_at timestamptz default now()
);

-- BLOCK 2: RLS for supplement_groups
alter table supplement_groups enable row level security;
create policy "allow all" on supplement_groups for all using (true) with check (true);

-- BLOCK 3: Add columns to supplement_config (each on its own line)
alter table supplement_config add column if not exists name text;
alter table supplement_config add column if not exists dose text;
alter table supplement_config add column if not exists status text default 'active';
alter table supplement_config add column if not exists group_id uuid;
alter table supplement_config add column if not exists display_order integer default 0;
alter table supplement_config add column if not exists estimated_days_remaining integer;
alter table supplement_config add column if not exists last_restocked_date date;
alter table supplement_config add column if not exists preferred_source text;
alter table supplement_config add column if not exists reorder_notes text;

-- BLOCK 4: Add foreign key constraint (run after BLOCK 1 + 3)
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'supplement_config_group_id_fkey'
  ) then
    alter table supplement_config
      add constraint supplement_config_group_id_fkey
      foreign key (group_id) references supplement_groups(id);
  end if;
end $$;

-- BLOCK 5: Fenben continuous mode
alter table fenben_settings add column if not exists dosing_mode text default 'cycling';

-- BLOCK 6: Observations — allow multiple entries per day + time_of_day + belly measurement
alter table observation_logs drop constraint if exists observation_logs_log_date_key;
alter table observation_logs add column if not exists time_of_day text;
alter table observation_logs add column if not exists belly_measurement_cm numeric;

-- BLOCK 7: Migrate boolean active → status
update supplement_config set status = case when active = true then 'active' else 'on_order' end;

-- BLOCK 8: Belly exhale/inhale split + measurement_unit tracking
alter table observation_logs add column if not exists belly_exhale numeric;
alter table observation_logs add column if not exists belly_inhale numeric;
alter table observation_logs add column if not exists measurement_unit text default 'in';

-- All existing data was entered in cm (columns were named _cm) — mark them accordingly
update observation_logs
  set measurement_unit = 'cm'
  where lump_size_cm is not null or belly_measurement_cm is not null;

-- Migrate old single belly field → belly_exhale
update observation_logs
  set belly_exhale = belly_measurement_cm
  where belly_measurement_cm is not null;

-- BLOCK 8b: Separate belly unit column
alter table observation_logs add column if not exists belly_unit text default 'in';
-- Note: no data migration needed — the app falls back to measurement_unit when belly_unit is null

-- BLOCK 9: Benadryl logs table
create table if not exists benadryl_logs (
  id uuid primary key default gen_random_uuid(),
  given_at timestamptz not null,
  dose_mg integer not null check (dose_mg in (25, 50)),
  reason text,
  notes text,
  created_at timestamptz default now()
);

alter table benadryl_logs enable row level security;
create policy "allow all" on benadryl_logs for all using (true) with check (true);

-- ============================================================
-- SEED DATA — Run after all blocks above complete
-- ============================================================

-- Groups (deterministic UUIDs — safe to re-run)
insert into supplement_groups (id, name, display_order) values
  ('11111111-1111-1111-1111-111111111111', '☀️ Morning Treat — Batch 1', 1),
  ('22222222-2222-2222-2222-222222222222', '☀️ Morning Treat — Batch 2', 2),
  ('33333333-3333-3333-3333-333333333333', '🌙 Evening Treat', 3),
  ('44444444-4444-4444-4444-444444444444', '🌿 Hulda Clark Trio', 4),
  ('55555555-5555-5555-5555-555555555555', '🍖 With Raw Meal', 5),
  ('66666666-6666-6666-6666-666666666666', '💊 Chad''s Evening Additions', 6)
on conflict (id) do nothing;

-- GROUP 1: Morning Treat Batch 1
insert into supplement_config (supplement_id, name, dose, status, group_id, display_order, notes) values
  ('am_turmeric',     'Turmeric',                    '1.5-2 tsp',         'active',        '11111111-1111-1111-1111-111111111111', 1,  null),
  ('am_black_pepper', 'Black Pepper',                '1/4 tsp',           'active',        '11111111-1111-1111-1111-111111111111', 2,  'Required with turmeric for absorption'),
  ('am_ginger',       'Ginger',                      '1/4 tsp',           'active',        '11111111-1111-1111-1111-111111111111', 3,  null),
  ('am_nso',          'NSO (Black Seed Oil)',         '1 tsp',             'active',        '11111111-1111-1111-1111-111111111111', 4,  'Thymoquinone - anti-tumor'),
  ('am_nigella',      'Ground Nigella Sativa Seeds', '1/4 tsp',           'active',        '11111111-1111-1111-1111-111111111111', 5,  'Pairs with NSO'),
  ('am_reishi',       'Reishi Mushroom',             '1 tsp',             'active',        '11111111-1111-1111-1111-111111111111', 6,  'Anti-tumor, immune'),
  ('am_chaga',        'Chaga Mushroom',              '1 tsp',             'active',        '11111111-1111-1111-1111-111111111111', 7,  'Betulinic acid, anti-tumor'),
  ('am_cordyceps',    'Cordyceps',                   '1 tsp',             'active',        '11111111-1111-1111-1111-111111111111', 8,  'Mitochondrial support'),
  ('am_astragalus',   'Astragalus',                  '1 tsp',             'active',        '11111111-1111-1111-1111-111111111111', 9,  'NK cell activation'),
  ('am_jiaogulan',    'Jiaogulan',                   '1/2 tsp',           'active',        '11111111-1111-1111-1111-111111111111', 10, 'Saponin immune activation'),
  ('am_elecampane',   'Elecampane Root',             '1/2 tsp',           'active',        '11111111-1111-1111-1111-111111111111', 11, 'Alantolactone anti-tumor'),
  ('am_olive_leaf',   'Olive Leaf',                  '1 tsp',             'active',        '11111111-1111-1111-1111-111111111111', 12, 'Oleuropein antimicrobial/anti-tumor'),
  ('am_gotu_kola',    'Gotu Kola',                   '1/2 tsp',           'active',        '11111111-1111-1111-1111-111111111111', 13, 'Connective tissue, anti-tumor'),
  ('am_frankincense', 'Frankincense Resin Powder',   '1/8 tsp (300-500mg)', 'active',      '11111111-1111-1111-1111-111111111111', 14, 'Full boswellic acid spectrum'),
  ('am_graviola',     'Graviola Leaf',               '1/2 tsp',           'need_to_order', '11111111-1111-1111-1111-111111111111', 15, 'Acetogenins - highest priority order'),
  ('am_turkey_tail',  'Turkey Tail Mushroom',        '1 tsp',             'need_to_order', '11111111-1111-1111-1111-111111111111', 16, 'PSK/PSP immune - on order'),
  ('am_maitake',      'Maitake Mushroom',            '1 tsp',             'need_to_order', '11111111-1111-1111-1111-111111111111', 17, 'D-fraction canine cancer research')
on conflict (supplement_id) do update set
  name = excluded.name,
  dose = excluded.dose,
  group_id = excluded.group_id,
  display_order = excluded.display_order,
  notes = case when supplement_config.name is null then excluded.notes else supplement_config.notes end,
  status = case when supplement_config.name is null then excluded.status else supplement_config.status end;

-- GROUP 2: Morning Treat Batch 2
insert into supplement_config (supplement_id, name, dose, status, group_id, display_order, notes) values
  ('am_ashwagandha',    'Ashwagandha',                  '1/4 tsp',           'active',        '22222222-2222-2222-2222-222222222222', 1,  'Adaptogen, anti-inflammatory'),
  ('am_barberry',       'Barberry Root Bark',           '1 tsp',             'active',        '22222222-2222-2222-2222-222222222222', 2,  'Berberine alkaloid spectrum'),
  ('am_milk_thistle',   'Milk Thistle Seed',            '1.5 tsp',           'active',        '22222222-2222-2222-2222-222222222222', 3,  'Increased for continuous fenben'),
  ('am_vitex',          'Vitex Berry',                  '1/4 tsp',           'active',        '22222222-2222-2222-2222-222222222222', 4,  'Hormonal - ovarian remnant support'),
  ('am_saw_palmetto',   'Saw Palmetto',                 '1/4 tsp',           'active',        '22222222-2222-2222-2222-222222222222', 5,  'Anti-hormonal, anti-proliferative'),
  ('am_dandelion',      'Dandelion Root',               '1 tsp',             'active',        '22222222-2222-2222-2222-222222222222', 6,  'Liver, lymphatic, diuretic'),
  ('am_bay_leaf',       'Bay Leaf',                     '1/4 tsp',           'active',        '22222222-2222-2222-2222-222222222222', 7,  'Ursolic acid anti-tumor'),
  ('am_msm',            'MSM',                          '1/4 tsp',           'active',        '22222222-2222-2222-2222-222222222222', 8,  'Joint, connective tissue'),
  ('am_chondroitin',    'Chondroitin',                  'open 1 capsule',    'active',        '22222222-2222-2222-2222-222222222222', 9,  'Joint support'),
  ('am_glucosamine',    'Glucosamine Sulfate',          '1/4 tsp',           'active',        '22222222-2222-2222-2222-222222222222', 10, 'Joint support'),
  ('am_creatine',       'Creatine (micronized)',        '1 tsp',             'active',        '22222222-2222-2222-2222-222222222222', 11, 'Muscle preservation, anti-tumor metabolism'),
  ('am_citicoline',     'Citicoline Sodium',            '1/4 tsp',           'active',        '22222222-2222-2222-2222-222222222222', 12, 'Neuroprotective, liver support'),
  ('am_nac',            'NAC',                          'open 1 capsule',    'active',        '22222222-2222-2222-2222-222222222222', 13, 'Glutathione precursor, liver protection'),
  ('am_cbd',            'CBD Oil (full spectrum)',      '1 full dropper',    'active',        '22222222-2222-2222-2222-222222222222', 14, 'Anti-tumor, pain, appetite'),
  ('am_nad',            'NAD+ (liposomal)',             '1 serving',         'active',        '22222222-2222-2222-2222-222222222222', 15, 'Mitochondrial support'),
  ('am_vit_c',          'Liposomal Vitamin C',          '1-2 servings',      'active',        '22222222-2222-2222-2222-222222222222', 16, 'High-dose anti-tumor'),
  ('am_vit_e',          'Vitamin E Succinate (d-alpha)','400IU open capsule','need_to_order', '22222222-2222-2222-2222-222222222222', 17, 'Tippens protocol - on order'),
  ('am_blessed_thistle','Blessed Thistle',              '1/4 tsp',           'active',        '22222222-2222-2222-2222-222222222222', 18, 'Liver bile support')
on conflict (supplement_id) do update set
  name = excluded.name,
  dose = excluded.dose,
  group_id = excluded.group_id,
  display_order = excluded.display_order,
  notes = case when supplement_config.name is null then excluded.notes else supplement_config.notes end,
  status = case when supplement_config.name is null then excluded.status else supplement_config.status end;

-- GROUP 3: Evening Treat
insert into supplement_config (supplement_id, name, dose, status, group_id, display_order, notes) values
  ('pm_turmeric',     'Turmeric',             '1.5-2 tsp',          'active', '33333333-3333-3333-3333-333333333333', 1,  null),
  ('pm_black_pepper', 'Black Pepper',         '1/4 tsp',            'active', '33333333-3333-3333-3333-333333333333', 2,  null),
  ('pm_boswellia',    'Boswellia',            'open 1 capsule (500mg)', 'active', '33333333-3333-3333-3333-333333333333', 3, '5-LOX inhibitor, key anti-tumor'),
  ('pm_cats_claw',    'Cat''s Claw',          '1/4 tsp',            'active', '33333333-3333-3333-3333-333333333333', 4,  'TNF-alpha inhibitor'),
  ('pm_milk_thistle', 'Milk Thistle Seed',    '1 tsp',              'active', '33333333-3333-3333-3333-333333333333', 5,  'Evening liver dose'),
  ('pm_nettle',       'Nettle',               '1 tsp',              'active', '33333333-3333-3333-3333-333333333333', 6,  'Systemic anti-inflammatory'),
  ('pm_pau_darco',    'Pau d''Arco',          '1/2 tsp',            'active', '33333333-3333-3333-3333-333333333333', 7,  'Lapachol anti-tumor'),
  ('pm_chaparral',    'Chaparral',            '1/8 tsp',            'active', '33333333-3333-3333-3333-333333333333', 8,  'NDGA - potent, keep dose low'),
  ('pm_burdock',      'Burdock Root',         '1 tsp',              'active', '33333333-3333-3333-3333-333333333333', 9,  'Essiac herb, blood purifier'),
  ('pm_mullein',      'Mullein Leaf',         '1/2 tsp',            'active', '33333333-3333-3333-3333-333333333333', 10, 'Respiratory support'),
  ('pm_slippery_elm', 'Slippery Elm Bark',    '1 tsp',              'active', '33333333-3333-3333-3333-333333333333', 11, 'GI soothing, constipation support'),
  ('pm_marshmallow',  'Marshmallow Root',     '1 tsp',              'active', '33333333-3333-3333-3333-333333333333', 12, 'GI mucilage, pairs with slippery elm'),
  ('pm_gotu_kola',    'Gotu Kola',            '1/2 tsp',            'active', '33333333-3333-3333-3333-333333333333', 13, 'Evening second dose'),
  ('pm_moringa',      'Moringa Leaf',         '1/4 tsp',            'active', '33333333-3333-3333-3333-333333333333', 14, 'Dense nutrition, anti-inflammatory'),
  ('pm_melatonin',    'Melatonin',            '6-9mg crushed',      'active', '33333333-3333-3333-3333-333333333333', 15, 'Pain modulation, anti-tumor, sleep')
on conflict (supplement_id) do update set
  name = excluded.name,
  dose = excluded.dose,
  group_id = excluded.group_id,
  display_order = excluded.display_order,
  notes = case when supplement_config.name is null then excluded.notes else supplement_config.notes end,
  status = case when supplement_config.name is null then excluded.status else supplement_config.status end;

-- GROUP 4: Hulda Clark Trio
insert into supplement_config (supplement_id, name, dose, status, group_id, display_order, notes) values
  ('clark_black_walnut', 'Black Walnut Hull Powder', '1/4 tsp', 'active', '44444444-4444-4444-4444-444444444444', 1, 'Juglone cytotoxic to cancer cells'),
  ('clark_wormwood',     'Wormwood',                 '1/4 tsp', 'active', '44444444-4444-4444-4444-444444444444', 2, 'Artemisinin anti-tumor - once daily only'),
  ('clark_clove',        'Clove Powder',             '1/8 tsp', 'active', '44444444-4444-4444-4444-444444444444', 3, 'Eugenol, completes Clark protocol')
on conflict (supplement_id) do update set
  name = excluded.name,
  dose = excluded.dose,
  group_id = excluded.group_id,
  display_order = excluded.display_order,
  notes = case when supplement_config.name is null then excluded.notes else supplement_config.notes end,
  status = case when supplement_config.name is null then excluded.status else supplement_config.status end;

-- GROUP 5: With Raw Meal
insert into supplement_config (supplement_id, name, dose, status, group_id, display_order, notes) values
  ('meal_fenben',      'Fenbendazole',             '444mg',       'active', '55555555-5555-5555-5555-555555555555', 1,  'CONTINUOUS daily - no off cycle. Give with fat.'),
  ('meal_ivermectin',  'Ivermectin 1% injectable', '1ml orally',  'active', '55555555-5555-5555-5555-555555555555', 2,  'Daily, anti-cancer via P-glycoprotein inhibition'),
  ('meal_gelatin',     'Grass Fed Gelatin',         '1 tbsp',      'active', '55555555-5555-5555-5555-555555555555', 3,  'Glycine, gut lining'),
  ('meal_beef_fat',    'Beef Fat (raw trimmings)',  '2oz',         'active', '55555555-5555-5555-5555-555555555555', 4,  'Fat carrier for fenben'),
  ('am_apricot',       'Apricot Seeds (bitter)',    'few seeds',   'active', '55555555-5555-5555-5555-555555555555', 5,  'Amygdalin - give AM and PM'),
  ('meal_beef_heart',  'Beef Heart',                '1 serving',   'active', '55555555-5555-5555-5555-555555555555', 6,  null),
  ('meal_beef_liver',  'Beef Liver',                '1 serving',   'active', '55555555-5555-5555-5555-555555555555', 7,  null),
  ('meal_broccoli',    'Broccoli',                  '1 serving',   'active', '55555555-5555-5555-5555-555555555555', 8,  null),
  ('meal_blueberries', 'Blueberries',               '1 serving',   'active', '55555555-5555-5555-5555-555555555555', 9,  null),
  ('meal_green_tripe', 'Green Tripe',               '1 serving',   'active', '55555555-5555-5555-5555-555555555555', 10, null),
  ('meal_egg_yolks',   'Egg Yolks',                 '2 yolks',     'active', '55555555-5555-5555-5555-555555555555', 11, null),
  ('meal_sardines',    'Sardines',                  '1 serving',   'active', '55555555-5555-5555-5555-555555555555', 12, null),
  ('meal_mackerel',    'Mackerel',                  '1 serving',   'active', '55555555-5555-5555-5555-555555555555', 13, null)
on conflict (supplement_id) do update set
  name = excluded.name,
  dose = excluded.dose,
  group_id = excluded.group_id,
  display_order = excluded.display_order,
  notes = case when supplement_config.name is null then excluded.notes else supplement_config.notes end,
  status = case when supplement_config.name is null then excluded.status else supplement_config.status end;

-- GROUP 6: Chad's Evening Additions
insert into supplement_config (supplement_id, name, dose, status, group_id, display_order, notes) values
  ('chad_benadryl', 'Benadryl (diphenhydramine)', 'PRN as needed', 'sidelined', '66666666-6666-6666-6666-666666666666', 1, 'PRN pain/comfort - use only when needed'),
  ('pm_apricot',    'Apricot Seeds (bitter)',      'few seeds',     'sidelined', '66666666-6666-6666-6666-666666666666', 2, 'Moved to With Raw Meal')
on conflict (supplement_id) do update set
  name = excluded.name,
  dose = excluded.dose,
  group_id = excluded.group_id,
  display_order = excluded.display_order,
  notes = case when supplement_config.name is null then excluded.notes else supplement_config.notes end,
  status = case when supplement_config.name is null then excluded.status else supplement_config.status end;

-- Sidelined: old supplements not in new protocol
insert into supplement_config (supplement_id, name, dose, status) values
  ('am_quercetin', 'Quercetin', '500mg', 'sidelined')
on conflict (supplement_id) do update set
  name = excluded.name,
  status = case when supplement_config.name is null then 'sidelined' else supplement_config.status end;
