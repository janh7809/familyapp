-- ============================================================
-- Hageney Family App – Migration v2
-- Fügt die Einkaufsliste hinzu.
-- Anleitung: Im Supabase SQL Editor als neue Query ausführen
-- (einmalig, zusätzlich zum ursprünglichen supabase-schema.sql).
-- ============================================================

create table if not exists shopping_items (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  is_done boolean not null default false,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  done_by uuid references profiles(id),
  done_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table shopping_items enable row level security;

create policy "shopping_items_all_authenticated"
  on shopping_items for all
  to authenticated
  using (true)
  with check (true);
