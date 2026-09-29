-- ============================================================
-- Hageney Family App – Stundenpläne der Kinder (Version 0.4.4)
-- ============================================================
-- ACHTUNG: Dieses Skript LÖSCHT zuerst alle bisherigen Einträge in
-- der Tabelle "kids_schedule" und trägt dann die aktuellen
-- Betreuungszeiten und wiederkehrenden Aktivitäten von Henry,
-- George und Oliver neu ein.
--
-- Einmalig ausführen in Supabase -> SQL Editor -> "New query"
-- ============================================================

delete from kids_schedule;

insert into kids_schedule (child_name, weekday, start_time, end_time, label) values
  -- Henry: Schule
  ('Henry', 1, '07:45', '13:10', 'Schule'),   -- Montag
  ('Henry', 2, '07:45', '13:10', 'Schule'),   -- Dienstag
  ('Henry', 3, '08:35', '13:10', 'Schule'),   -- Mittwoch
  ('Henry', 4, '07:45', '15:00', 'Schule'),   -- Donnerstag
  ('Henry', 5, '08:35', '13:10', 'Schule'),   -- Freitag

  -- Henry: Aktivitäten
  ('Henry', 1, '17:30', '18:15', 'Wingtsun'),   -- Montag
  ('Henry', 2, '17:30', '19:00', 'Fußball'),    -- Dienstag
  ('Henry', 5, '17:30', '19:00', 'Fußball'),    -- Freitag
  ('Henry', 6, '09:30', '11:30', 'THW'),        -- Samstag

  -- George: Kindergarten
  ('George', 1, '07:30', '13:30', 'Kindergarten'),
  ('George', 2, '07:30', '13:30', 'Kindergarten'),
  ('George', 3, '07:30', '13:30', 'Kindergarten'),
  ('George', 4, '07:30', '13:30', 'Kindergarten'),
  ('George', 5, '07:30', '13:30', 'Kindergarten'),

  -- George: Aktivitäten
  ('George', 4, '16:00', '17:00', 'Mountainbike'),  -- Donnerstag

  -- Oliver: Tagesmutter (nur Dienstag und Mittwoch)
  ('Oliver', 2, '08:00', '14:00', 'Tagesmutter'),
  ('Oliver', 3, '08:00', '14:00', 'Tagesmutter');
