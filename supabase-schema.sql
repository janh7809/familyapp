-- ============================================================
-- Hageney Family App – Datenbank-Schema für Supabase
-- Version: 0.1.0
-- ============================================================
-- Anleitung: Im Supabase-Projekt unter "SQL Editor" -> "New query"
-- einfügen und mit "Run" ausführen. Einmalig beim Einrichten.
-- ============================================================

-- Erweiterung für UUIDs (in Supabase i.d.R. schon aktiv)
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Profiles: Anzeige-Namen für die zwei Familien-Konten
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_authenticated"
  on profiles for select
  to authenticated
  using (true);

-- ------------------------------------------------------------
-- Board: Notizen & ToDos (gemeinsame Liste)
-- ------------------------------------------------------------
create table if not exists board_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('note', 'todo')),
  content text not null,
  is_done boolean not null default false,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  done_by uuid references profiles(id),
  done_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table board_items enable row level security;

create policy "board_items_all_authenticated"
  on board_items for all
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- Anna: Einstellungen (aktueller Stundensatz)
-- ------------------------------------------------------------
create table if not exists anna_settings (
  id int primary key default 1,
  current_rate numeric(6,2) not null default 15.00,
  updated_at timestamptz not null default now(),
  constraint anna_settings_singleton check (id = 1)
);

insert into anna_settings (id, current_rate)
values (1, 15.00)
on conflict (id) do nothing;

alter table anna_settings enable row level security;

create policy "anna_settings_all_authenticated"
  on anna_settings for all
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- Anna: Stundeneinträge
-- ------------------------------------------------------------
create table if not exists anna_entries (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  hours numeric(5,2) not null check (hours > 0),
  rate numeric(6,2) not null check (rate > 0),
  amount numeric(8,2) generated always as (round(hours * rate, 2)) stored,
  note text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table anna_entries enable row level security;

create policy "anna_entries_all_authenticated"
  on anna_entries for all
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- Anna: Zahlungen
-- ------------------------------------------------------------
create table if not exists anna_payments (
  id uuid primary key default gen_random_uuid(),
  payment_date date not null,
  amount numeric(8,2) not null check (amount >= 0),
  tip numeric(8,2) not null default 0 check (tip >= 0),
  note text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table anna_payments enable row level security;

create policy "anna_payments_all_authenticated"
  on anna_payments for all
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- Kinder: wiederkehrende Termine (Stundenplan / Betreuung)
-- weekday: 1 = Montag ... 7 = Sonntag (ISO)
-- ------------------------------------------------------------
create table if not exists kids_schedule (
  id uuid primary key default gen_random_uuid(),
  child_name text not null,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time,
  end_time time,
  label text not null,
  location text,
  created_at timestamptz not null default now()
);

alter table kids_schedule enable row level security;

create policy "kids_schedule_all_authenticated"
  on kids_schedule for all
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- Einträge für George (Kindergarten Mo-Fr) und Oliver
-- (Tagesmutter Mo/Mi) -- Wochentage stehen fest, echte Uhrzeiten
-- fehlen noch (bewusst NULL gelassen). Sobald sie feststehen,
-- einfach in der App unter "Stundenpläne" bearbeiten.
-- ------------------------------------------------------------
insert into kids_schedule (child_name, weekday, start_time, end_time, label, location)
values
  ('George', 1, null, null, 'Kindergarten', null),
  ('George', 2, null, null, 'Kindergarten', null),
  ('George', 3, null, null, 'Kindergarten', null),
  ('George', 4, null, null, 'Kindergarten', null),
  ('George', 5, null, null, 'Kindergarten', null),
  ('Oliver', 1, null, null, 'Tagesmutter', null),
  ('Oliver', 3, null, null, 'Tagesmutter', null)
on conflict do nothing;

-- ============================================================
-- Nach dem Ausführen: siehe DEPLOY.md, Schritt "Konten anlegen"
-- für das Anlegen der zwei Supabase-Auth-Konten (Jan & Alice)
-- und der zugehörigen profiles-Zeilen.
-- ============================================================
