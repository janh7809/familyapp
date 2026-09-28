-- ============================================================
-- Hageney Family App – Migration v5
-- Fügt eine sort_order-Spalte für Board-Einträge hinzu, damit man
-- ToDos/Notizen innerhalb ihrer Prioritäts-Gruppe manuell per
-- Pfeil-Buttons (hoch/runter) sortieren kann.
-- Anleitung: Im Supabase SQL Editor als neue Query ausführen
-- (einmalig, zusätzlich zu den bisherigen Migrationen).
-- ============================================================

alter table board_items add column if not exists sort_order bigint;
