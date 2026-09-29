-- ============================================================
-- Hageney Family App – Migration v6
-- Fügt die Kinder-Checkliste hinzu: EINE gemeinsame Tages-Checkliste
-- für alle Kinder zusammen, mit Morgen-/Nachmittags-/Abendblock an
-- Wochentagen (Mo-Fr). Samstag ist frei, Sonntag gibt es stattdessen
-- die Taschengeld-Aufgabe (Block "sonntag").
-- Der "Reset um Mitternacht" passiert automatisch, weil jeder Haken
-- an ein Datum gebunden ist (completion_date) - es muss dafür nichts
-- gelöscht werden.
--
-- Anleitung: Im Supabase SQL Editor als neue Query ausführen
-- (einmalig, zusätzlich zu den bisherigen Migrationen).
-- ============================================================

create table if not exists checklist_tasks (
  id uuid primary key default gen_random_uuid(),
  block text not null check (block in ('morgen', 'nachmittag', 'abend', 'sonntag')),
  label text not null,
  icon text not null default '⭐',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table checklist_tasks enable row level security;

create policy "checklist_tasks_all_authenticated"
  on checklist_tasks for all
  to authenticated
  using (true)
  with check (true);

create table if not exists checklist_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references checklist_tasks(id) on delete cascade,
  completion_date date not null,
  completed_by uuid references profiles(id),
  completed_at timestamptz not null default now(),
  unique (task_id, completion_date)
);

alter table checklist_completions enable row level security;

create policy "checklist_completions_all_authenticated"
  on checklist_completions for all
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- Vorbelegte Aufgaben. Können in der App jederzeit umbenannt, mit
-- einem anderen Icon versehen, gelöscht oder ergänzt werden.
-- ------------------------------------------------------------
insert into checklist_tasks (block, label, icon, sort_order) values
  ('morgen', 'Anziehen', '👕', 1),
  ('morgen', 'Frühstück', '🥣', 2),
  ('morgen', 'Zähneputzen', '🪥', 3),
  ('morgen', 'Lunchbox in Ranzen / Tasche', '🎒', 4),
  ('nachmittag', 'Ranzen / Taschen aufräumen', '🧹', 1),
  ('nachmittag', 'Lunchbox in die Küche', '🍱', 2),
  ('nachmittag', 'Hausaufgaben / Aufgaben', '📝', 3),
  ('abend', 'Kleider für den nächsten Morgen rauslegen', '👔', 1),
  ('abend', 'Waschen (Duschen oder Baden)', '🛁', 2),
  ('abend', 'Zähneputzen', '🪥', 3),
  ('abend', 'Schlafanzug anziehen', '🌙', 4),
  ('abend', 'Wäsche in den Wäschekorb', '🧺', 5),
  ('abend', 'Ranzen / Tasche für den nächsten Tag vorbereiten', '🎒', 6),
  ('abend', 'Bett', '🛏️', 7),
  ('sonntag', 'Taschengeld: 1€ in die Spardose, 1€ zum Ausgeben', '🐷', 1);
