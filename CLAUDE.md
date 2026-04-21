# Isis Tracker — Project Documentation

Health protocol tracker for Isis, a 5-year-old female Great Dane (~107 lbs) undergoing a natural treatment protocol for a suspected soft tissue mass.

---

## Project Structure

```
isis-tracker/
├── src/
│   ├── app/
│   │   ├── layout.tsx          — Root layout with Nav + global styles
│   │   ├── globals.css         — Tailwind base + custom component classes
│   │   ├── page.tsx            — Dashboard (/)
│   │   ├── fenben/page.tsx     — Fenbendazole tracker (/fenben)
│   │   ├── supplements/page.tsx— Supplement checklist (/supplements)
│   │   ├── topical/page.tsx    — Topical application log (/topical)
│   │   ├── medications/page.tsx— Gabapentin PRN log (/medications)
│   │   ├── observations/page.tsx— Daily vitals log (/observations)
│   │   └── weight/page.tsx     — Weight log (/weight)
│   ├── components/
│   │   └── Nav.tsx             — Sticky top navigation bar
│   └── lib/
│       ├── supabase.ts         — Supabase client singleton + TypeScript types
│       └── supplements.ts      — Static supplement data, cycle utilities, constants
├── tailwind.config.ts          — Custom bark/moss/cream color palette
├── next.config.ts
├── .env.local.example          — Environment variable template
└── CLAUDE.md                   — This file
```

---

## Tech Stack

- **Next.js 15** (App Router, Turbopack dev server)
- **React 19**
- **TypeScript**
- **Tailwind CSS** with custom earthy color palette
- **Supabase** (PostgreSQL, shared database for multi-device access)
- **@supabase/supabase-js** v2

---

## Setup Instructions

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, and run the SQL schema below in the SQL Editor.

### 3. Add environment variables

Copy `.env.local.example` to `.env.local` and fill in your project URL and anon key:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run the dev server

```bash
npm run dev
```

---

## Supabase Database Schema

Run this entire block in the Supabase SQL Editor:

```sql
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

-- Per-supplement active/inactive toggles
create table if not exists supplement_config (
  supplement_id text primary key,
  active boolean default true,
  updated_at timestamptz default now()
);

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
```

### Row Level Security (optional but recommended)

If you want public access from any device without authentication, disable RLS or add a permissive policy:

```sql
-- Example: allow all reads and writes (suitable for a private household app)
alter table fenben_settings    enable row level security;
alter table fenben_doses       enable row level security;
alter table supplement_logs    enable row level security;
alter table supplement_config  enable row level security;
alter table topical_logs       enable row level security;
alter table gabapentin_logs    enable row level security;
alter table observation_logs   enable row level security;
alter table weight_logs        enable row level security;

-- Permissive policies (all operations, anon role)
create policy "allow all" on fenben_settings    for all using (true) with check (true);
create policy "allow all" on fenben_doses       for all using (true) with check (true);
create policy "allow all" on supplement_logs    for all using (true) with check (true);
create policy "allow all" on supplement_config  for all using (true) with check (true);
create policy "allow all" on topical_logs       for all using (true) with check (true);
create policy "allow all" on gabapentin_logs    for all using (true) with check (true);
create policy "allow all" on observation_logs   for all using (true) with check (true);
create policy "allow all" on weight_logs        for all using (true) with check (true);
```

---

## What's Built

| Page            | Route           | Features |
|-----------------|-----------------|----------|
| Dashboard       | `/`             | Summary cards: fenben status, supplement progress, last topical, latest pain level, 7-day gabapentin count, on-order alert |
| Fenbendazole    | `/fenben`       | Cycle calculator (3 ON / 4 OFF), month calendar with color-coded days, dose logging with notes, dose history |
| Supplements     | `/supplements`  | Grouped checklist (Morning / Evening / Meal), progress bar, per-supplement active toggle, mark-all-done per group, on-order badge |
| Topical         | `/topical`      | Log form with product multi-select, duration, skin reaction, notes; history grouped by date |
| Gabapentin      | `/medications`  | PRN dose log with pain scale picker, reason dropdown, stats summary (total doses/pills, last 7 days) |
| Observations    | `/observations` | Daily vitals form with lump section; expandable history cards sorted newest-first |
| Weight          | `/weight`       | Weight log with trend arrows vs prior entry, baseline reference, min/max summary |

---

## Design System

- **Background:** `#fdf8f0` (warm cream)
- **Primary Brown (bark):** 9-step scale, nav uses `bark-800`
- **Accent Green (moss):** ON days, progress bars, action buttons
- **Font:** Georgia/serif throughout — no Inter, no sans-serif defaults
- **Cards:** white with `bark-100` border, subtle shadow
- **No purple gradients, no generic AI-app aesthetics**

Custom Tailwind tokens: `bark-50` → `bark-900`, `moss-50` → `moss-900`, `cream`

---

## Suggested Enhancements

### High Priority
- **Pain trend chart** — Add `recharts` and render a line chart on the Observations page plotting pain_level and energy_level over time. Also useful on the Dashboard as a mini sparkline.
- **PWA support** — Add a `manifest.json` and service worker via `next-pwa` so the tracker can be installed on the home screen of a phone for bedside logging.

### Medium Priority
- **Photo upload for lump** — Supabase Storage + a photo field on observation_logs so you can visually track lump changes over time. Add a simple image grid sorted by date.
- **Export / backup** — A `/export` page that generates a JSON or CSV download of all data tables. Useful for sharing with a vet or as an offline backup.
- **Supplement history view** — Show past days' supplement completion rates as a simple calendar heatmap (similar to GitHub contributions).

### Lower Priority
- **Reminder notifications** — PWA push notifications or a simple in-browser reminder for morning/evening supplement times.
- **Veterinary notes section** — A freeform notes/appointments page for logging vet visits, test results, and protocol changes.
- **Multi-dog support** — Abstract the app to support multiple pets with a dog selector in the nav.
- **Print-friendly protocol summary** — A `/print` page that renders the full supplement protocol in a printer-friendly layout to share with the vet.

---

## Fenbendazole Cycle Logic

Cycle is 7 days total: **Days 1–3 ON**, **Days 4–7 OFF**, then repeat indefinitely.

Given a `cycleStartDate` and a `targetDate`, the cycle day (1–7) is:
```
daysSinceStart = floor((targetDate - cycleStartDate) / 86400000)
cycleDay = (daysSinceStart % 7) + 1   // 1–7
isOnDay = cycleDay <= 3
```

Implemented in `src/lib/supplements.ts` as `getCycleDayNumber()`, `isFenbenOnDay()`, and `daysUntilPhaseChange()`.

---

## Supplement IDs Reference

All supplement IDs used in `supplement_logs.taken_ids` and `supplement_config.supplement_id`:

**Morning:** `am_turmeric`, `am_black_pepper`, `am_ginger`, `am_ashwagandha`, `am_barberry`, `am_milk_thistle`, `am_vitex`, `am_msm`, `am_chondroitin`, `am_cbd`, `am_dandelion`, `am_creatine`, `am_citicoline`, `am_apricot`, `am_vit_e`, `am_turkey_tail`, `am_quercetin`

**Evening:** `pm_turmeric`, `pm_boswellia`, `pm_cats_claw`, `pm_milk_thistle`, `pm_nettle`, `pm_apricot`

**Meal:** `meal_gelatin`

On-order (initially inactive): `am_vit_e`, `am_turkey_tail`, `am_quercetin`
