// ============================================================
// Hageney Family App – Konfiguration
// ============================================================
// Hier NUR die beiden Werte aus deinem Supabase-Projekt eintragen.
// Zu finden in Supabase unter: Project Settings -> API
//   - "Project URL"       -> SUPABASE_URL
//   - "anon public" Key   -> SUPABASE_ANON_KEY
//
// Wichtig: Der "anon" Key ist bewusst öffentlich sichtbar (er steht
// im Frontend-Code) - das ist bei Supabase normal und sicher, weil
// die eigentliche Absicherung über den Login (Row Level Security)
// läuft, nicht über die Geheimhaltung dieses Keys.
// ============================================================

window.APP_CONFIG = {
  SUPABASE_URL: 'https://losqdhhkgernnexvrkoe.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_3JL6y_5UPsx7y1oKmrxdGA_QyhXYyi5',
  APP_VERSION: '0.4.0',
};
