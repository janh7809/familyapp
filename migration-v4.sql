-- ============================================================
-- Hageney Family App – Migration v4
-- Fügt eine 3-stufige Priorität (Dringend / Mittel / Nicht wichtig)
-- für Board-Einträge hinzu, damit die Übersicht automatisch danach
-- sortiert werden kann.
-- Anleitung: Im Supabase SQL Editor als neue Query ausführen
-- (einmalig, zusätzlich zu supabase-schema.sql, migration-v2.sql
-- und migration-v3.sql).
-- ============================================================

alter table board_items add column if not exists priority text not null default 'mittel'
  check (priority in ('dringend', 'mittel', 'niedrig'));

-- Bestehende Einträge übernehmen ihre bisherige Dringend-Markierung,
-- alle anderen werden auf "Mittel" gesetzt.
update board_items set priority = 'dringend' where is_urgent = true and priority = 'mittel';
