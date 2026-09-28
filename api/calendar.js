// ============================================================
// Vercel Serverless Function: /api/calendar
// Holt den geteilten iCloud-Familienkalender (ICS) und die
// Schulferien Baden-Württemberg server-seitig ab (kein CORS-
// Problem, keine Apple-ID-Zugangsdaten nötig - reiner Lesezugriff
// auf den öffentlich freigegebenen Kalenderlink).
// ============================================================

const ical = require('node-ical');

// Der von Jan freigegebene "Öffentlicher Kalender"-Link.
// webcal:// wird hier durch https:// ersetzt, das ist derselbe Server.
// Kann bei Bedarf per Vercel-Umgebungsvariable FAMILY_CALENDAR_URL
// überschrieben werden, ohne den Code zu ändern.
const DEFAULT_CALENDAR_URL =
  'https://p153-caldav.icloud.com/published/2/MTk1NTYyNzE5MTk1NTYyN0UJa4Zw6AmGqDGEHeUakuunE38t2uMzLijtPzpM7b-gV-uy_78X5k6aucxQ-lL9QqGg0MPFTRwNRQjRWFspLPQ';

const FERIEN_STATE = 'BW';
const FEIERTAGE_COUNTY = 'DE-BW';
const RANGE_DAYS_AHEAD = 45;

module.exports = async (req, res) => {
  const calendarUrl = process.env.FAMILY_CALENDAR_URL || DEFAULT_CALENDAR_URL;

  const [eventsResult, holidaysResult, feiertageResult] = await Promise.allSettled([
    fetchCalendarEvents(calendarUrl),
    fetchFerienBW(),
    fetchFeiertageBW(),
  ]);

  const response = {
    events: eventsResult.status === 'fulfilled' ? eventsResult.value : [],
    holidays: holidaysResult.status === 'fulfilled' ? holidaysResult.value : [],
    feiertage: feiertageResult.status === 'fulfilled' ? feiertageResult.value : [],
    errors: [],
  };

  if (eventsResult.status === 'rejected') {
    response.errors.push('Familienkalender konnte nicht geladen werden: ' + eventsResult.reason.message);
  }
  if (holidaysResult.status === 'rejected') {
    response.errors.push('Ferien BW konnten nicht geladen werden: ' + holidaysResult.reason.message);
  }
  if (feiertageResult.status === 'rejected') {
    response.errors.push('Feiertage BW konnten nicht geladen werden: ' + feiertageResult.reason.message);
  }

  // 15 Minuten cachen, damit nicht bei jedem App-Aufruf neu geladen wird
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
  res.status(200).json(response);
};

async function fetchCalendarEvents(url) {
  const data = await ical.async.fromURL(url);

  const now = new Date();
  const rangeEnd = new Date();
  rangeEnd.setDate(now.getDate() + RANGE_DAYS_AHEAD);

  const events = [];

  for (const key of Object.keys(data)) {
    const item = data[key];
    if (item.type !== 'VEVENT') continue;

    if (item.rrule) {
      // Wiederkehrender Termin: alle Vorkommen im Zeitraum berechnen
      let occurrences = [];
      try {
        occurrences = item.rrule.between(now, rangeEnd, true);
      } catch (e) {
        continue;
      }
      for (const occDate of occurrences) {
        // Ausnahmen (verschobene/gelöschte Einzeltermine), falls vorhanden
        const key2 = occDate.toISOString().slice(0, 10);
        if (item.exdate && Object.values(item.exdate).some((d) => d.toISOString().slice(0, 10) === key2)) {
          continue;
        }
        events.push(toEvent(item, occDate));
      }
    } else if (item.start && item.start >= now && item.start <= rangeEnd) {
      events.push(toEvent(item, item.start));
    }
  }

  // Einzeltermine, die eine wiederkehrende Serie überschreiben (recurrences)
  for (const key of Object.keys(data)) {
    const item = data[key];
    if (item.type === 'VEVENT' && item.recurrences) {
      for (const rKey of Object.keys(item.recurrences)) {
        const rItem = item.recurrences[rKey];
        if (rItem.start >= now && rItem.start <= rangeEnd) {
          events.push(toEvent(rItem, rItem.start));
        }
      }
    }
  }

  events.sort((a, b) => new Date(a.start) - new Date(b.start));
  return events;
}

function toEvent(item, start) {
  const isAllDay = item.datetype === 'date';
  let eventStart = start;
  let eventEnd;

  if (isAllDay) {
    // Datum ohne Uhrzeit auf UTC-Mitternacht normalisieren, damit es
    // unabhängig von der Server-Zeitzone am richtigen Kalendertag erscheint
    eventStart = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
    const endSrc = item.end || start;
    eventEnd = new Date(Date.UTC(endSrc.getFullYear(), endSrc.getMonth(), endSrc.getDate()));
  } else {
    const durationMs = item.end && item.start ? item.end.getTime() - item.start.getTime() : 0;
    eventEnd = new Date(eventStart.getTime() + durationMs);
  }

  return {
    title: item.summary || '(ohne Titel)',
    start: eventStart.toISOString(),
    end: eventEnd.toISOString(),
    allDay: isAllDay,
    location: item.location || null,
  };
}

async function fetchFerienBW() {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];
  const all = [];

  for (const year of years) {
    const resp = await fetch(`https://schulferien-api.de/api/v1/${year}/${FERIEN_STATE}/`);
    if (!resp.ok) continue;
    const json = await resp.json();
    for (const h of json) {
      all.push({
        name: h.name_cp || h.name,
        start: h.start,
        end: h.end,
      });
    }
  }

  return all;
}

async function fetchFeiertageBW() {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];
  const all = [];

  for (const year of years) {
    const resp = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/DE`);
    if (!resp.ok) continue;
    const json = await resp.json();
    for (const h of json) {
      const appliesToBW = h.global || (Array.isArray(h.counties) && h.counties.includes(FEIERTAGE_COUNTY));
      if (!appliesToBW) continue;
      all.push({ name: h.localName || h.name, date: h.date });
    }
  }

  return all;
}
