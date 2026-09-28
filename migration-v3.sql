-- ============================================================
-- Hageney Family App – Migration v3
-- Fügt Zuweisung ("Für wen?") und Dringlichkeit (mit Fälligkeits-
-- datum) für Board-Einträge hinzu.
-- Anleitung: Im Supabase SQL Editor als neue Query ausführen
-- (einmalig, zusätzlich zu supabase-schema.sql und migration-v2.sql).
-- ============================================================

alter table board_items add column if not exists assigned_to uuid references profiles(id);
alter table board_items add column if not exists is_urgent boolean not null default false;
alter table board_items add column if not exists urgent_due_date date;
