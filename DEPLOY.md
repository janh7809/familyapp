# Hageney Family App – Einrichtung Schritt für Schritt

Diese Anleitung bringt die App das erste Mal online. Rechne mit ca. 20–30 Minuten.
Für spätere Updates (App ist schon online) siehe den Abschnitt **"Update auf Version 0.2.0"** ganz unten – der Ersteinrichtungs-Teil (1–7) ist dann nicht mehr nötig.

## 1. Supabase-Projekt anlegen

1. Auf https://supabase.com einloggen (bzw. kostenloses Konto anlegen).
2. "New Project" klicken, Namen vergeben (z.B. `hageney-family-app`), Passwort für die Datenbank setzen (separat notieren) und Region z.B. Frankfurt (eu-central-1) wählen.
3. Warten, bis das Projekt fertig eingerichtet ist (ca. 1–2 Minuten).

## 2. Datenbank-Struktur einspielen

1. Im Supabase-Projekt links auf "SQL Editor" klicken.
2. "New query" klicken.
3. Den kompletten Inhalt der Datei `supabase-schema.sql` hineinkopieren.
4. Auf "Run" klicken. Es sollte "Success" erscheinen.

## 3. Die zwei Familien-Konten anlegen

1. Links auf "Authentication" → "Users" klicken.
2. Auf "Add user" → "Create new user" klicken.
3. E-Mail und ein Passwort für **dich** eintragen. Häkchen bei "Auto Confirm User" setzen. Speichern.
4. Dasselbe nochmal für **Alice** (eigene E-Mail-Adresse, eigenes Passwort).
5. Wieder in den "SQL Editor" wechseln, neue Query, folgendes ausführen um die beiden User-IDs zu sehen:
   ```sql
   select id, email from auth.users;
   ```
6. Für jede Zeile die `id` kopieren und damit folgendes ausführen (Werte anpassen):
   ```sql
   insert into profiles (id, display_name) values
     ('HIER-JAN-UUID-EINFÜGEN', 'Jan'),
     ('HIER-ALICE-UUID-EINFÜGEN', 'Alice');
   ```

## 4. App mit Supabase verbinden

1. Im Supabase-Projekt links auf "Project Settings" → "API" klicken.
2. "Project URL" kopieren → in `config.js` bei `SUPABASE_URL` einfügen.
3. Den Key unter "anon public" kopieren → in `config.js` bei `SUPABASE_ANON_KEY` einfügen.
4. Datei speichern.

## 5. Auf GitHub hochladen

Wie bei der Stammtisch-App: neues Repository anlegen (z.B. `hageney-family-app`) und **alle** Dateien/Ordner aus diesem Paket per Drag-and-Drop hochladen – wichtig ist, dass die Ordnerstruktur erhalten bleibt (der `api`-Ordner mit `calendar.js` muss als Ordner mit hochgeladen werden, nicht einzeln).

## 6. Mit Vercel verbinden

1. Auf https://vercel.com einloggen (mit GitHub verbunden, wie gehabt).
2. "Add New" → "Project" → das eben erstellte GitHub-Repository auswählen.
3. Vercel erkennt das Projekt automatisch, keine Einstellungen nötig – auf "Deploy" klicken.
4. Nach ca. 1 Minute ist die App unter einer `*.vercel.app`-Adresse erreichbar.

## 7. Testen

1. Die Vercel-URL öffnen, mit deinem Konto einloggen.
2. Board: eine Notiz und ein ToDo anlegen, abhaken testen.
3. Anna: eine Test-Stunde eintragen, im Verlauf antippen zum Bearbeiten, über das rote X wieder löschen.
4. Kalender: prüfen, ob Termine aus dem Familienkalender erscheinen. Falls nicht, siehe "Fehlerbehebung" unten.
5. Auf dem Handy: Seite im Browser öffnen → "Zum Home-Bildschirm hinzufügen", damit es wie eine App aussieht.

## Fehlerbehebung Kalender

Falls unter "Kalender" keine Termine erscheinen:
- Direkt `https://DEINE-VERCEL-URL/api/calendar` im Browser öffnen – dort sollte JSON mit `events` und `holidays` erscheinen.
- Steht dort ein Eintrag unter `errors`? Das zeigt, ob der iCloud-Link oder die Ferien-Schnittstelle das Problem ist.
- Falls der iCloud-Link nicht funktioniert: in der Kalender-App auf dem iPhone prüfen, ob "Öffentlicher Kalender" noch aktiv ist, und den Link ggf. neu kopieren (dann in `api/calendar.js` bei `DEFAULT_CALENDAR_URL` ersetzen und neu hochladen).

## Versionierung

Jede neue Version dieser App bekommt eine hochgezählte Nummer in `config.js` (`APP_VERSION`), sichtbar im Footer der App – genau wie bei der Stammtisch-App. Aktuell: **0.4.0**.

## Update auf Version 0.4.0

Board-Einträge haben jetzt statt nur "Dringend ja/nein" eine **3-stufige Priorität**: 🔴 Dringend / 🟡 Mittel / ⚪ Nicht wichtig. Die Übersicht sortiert jede Spalte automatisch danach – Dringend oben, Nicht wichtig unten (nicht mehr nur nach Erstelldatum). Ein Fälligkeitsdatum ist weiterhin nur bei "Dringend" Pflicht. "Mittel" ist die Standardauswahl für neue Einträge.

1. **Neue Spalte für die Priorität anlegen:** Im Supabase-Projekt → "SQL Editor" → "New query" → kompletten Inhalt von `migration-v4.sql` einfügen → "Run". Einmalig, zusätzlich zu den bisherigen Migrationen. Bestehende dringende Einträge werden dabei automatisch auf "Dringend" gesetzt, alle anderen auf "Mittel".
2. **Alle Dateien wie gewohnt komplett neu auf GitHub hochladen.**

## Update auf Version 0.3.3

Keine Datenbank-Änderung nötig:

- Bei Anna sind "Stunden eintragen" (violetter Rahmen) und "Zahlung eintragen" (oranger Rahmen) jetzt farblich unterschiedlich umrahmt, damit die beiden Blöcke auf einen Blick auseinanderzuhalten sind.
- Im Board erscheint jetzt zuerst die eigene Liste der gerade eingeloggten Person (mit "(Du)"-Kennzeichnung), danach "Gemeinsam", danach die Liste der anderen Person.
- Bei Ferien und Feiertagen ist jetzt eine "HEUTE"-Trennlinie in der Jahresliste eingeblendet, die zeigt, wo man sich gerade im Jahr befindet; eine gerade laufende Ferienzeit ist zusätzlich mit 📍 hervorgehoben.

**Nur Schritt: Alle Dateien wie gewohnt komplett neu auf GitHub hochladen.**

## Update auf Version 0.3.2

Reine Mobil-Optimierung, keine Datenbank-Änderung nötig:

- Die Symbole unten in der Navigation sind jetzt größer und sitzen etwas höher.
- Alle runden/kleinen Buttons (Löschen-X, Häkchen, Jahres-/Wochenpfeile, Trinkgeld-Stepper) sind größer und leichter zu treffen.
- In der Board-Übersicht hat jetzt jede Person (Gemeinsam / Alice / Jan) einen eigenen farbigen Rahmen-Kasten, damit auf einen Blick klar ist, wem ein Eintrag zugeordnet ist – nicht mehr nur über die Schrift.
- Allgemeiner Feinschliff bei Abständen und Kanten für die Handy-Ansicht.

**Nur Schritt: Alle Dateien wie gewohnt komplett neu auf GitHub hochladen.** Kein SQL nötig.

## Update auf Version 0.3.0

Diese Version bringt: Board-Einträge lassen sich Jan, Alice oder "Beide" zuweisen und werden in der Übersicht entsprechend in Spalten aufgeteilt (Gemeinsam / Jan / Alice, nebeneinander wenn genug Platz ist); ein Dringlichkeits-Feld mit Pflicht-Fälligkeitsdatum, wobei die rote Hervorhebung umso kräftiger wird, je näher der Termin rückt; bei Anna kann nur noch der komplette offene Betrag als bezahlt markiert werden (kein freier Betrag mehr), dazu ein Trinkgeld-Rechner in 5€-Schritten mit Live-Vorschau des theoretischen Stundensatzes inkl. Trinkgeld, und ein separater Trinkgeld-Block fürs ganze Jahr oben im Verlauf; im Kalender gibt es jetzt einen "Aktuelle Woche"-Button und Feiertage werden rot hervorgehoben plus als Jahresliste unter den Ferien aufgeführt.

1. **Neue Spalten für Board-Einträge anlegen:** Im Supabase-Projekt → "SQL Editor" → "New query" → kompletten Inhalt von `migration-v3.sql` einfügen → "Run". Einmalig, zusätzlich zu `supabase-schema.sql` und `migration-v2.sql`.
2. **Alle Dateien wie gewohnt komplett neu auf GitHub hochladen.**

## Update auf Version 0.2.0

Diese Version bringt: 6 Reiter (Board, Einkaufsliste, Kalender, Stundenpläne, Anna, Admin) mit deutlicherem aktivem Tab, Klick-zum-Bearbeiten bei Board/Einkaufsliste/Anna, deutlichere Löschen-Buttons, Anna-Verlauf mit Jahresumschalter, Kalender als Wochenansicht mit Ferien-Hervorhebung und Ferien-Liste, Speicher-Bestätigung nach jedem Eintrag, automatisches Neuladen alle 60 Sekunden, sowie einen neuen Admin-Reiter mit den CSV-Exports.

Da die App schon läuft, reichen zwei Schritte:

1. **Neue Tabelle für die Einkaufsliste anlegen:** Im Supabase-Projekt → "SQL Editor" → "New query" → kompletten Inhalt von `migration-v2.sql` einfügen → "Run". Einmalig, zusätzlich zum ursprünglichen `supabase-schema.sql`.
2. **Alle Dateien wie gewohnt komplett neu auf GitHub hochladen** (überschreibt die alten Dateien 1:1) – Vercel deployt danach automatisch neu.

## Offen / nächste Schritte

- Anna-Historie 2017–2026 aus der Excel: fertig aufbereitet als `anna-history-import.sql`, noch nicht eingespielt – erst zur Kontrolle durchsehen (einige Einträge sind markiert, wo das Originaldatum unklar war), dann im SQL Editor ausführen.
- Henry's Schul-Stundenplan sowie die genauen Uhrzeiten für George (Kindergarten) und Oliver (Tagesmutter) – kannst du direkt in der App unter "Stundenpläne" → "Zeit eintragen" nachtragen, sobald du sie hast.
