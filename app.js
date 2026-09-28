// ============================================================
// Hageney Family App – App-Logik
// ============================================================

const cfg = window.APP_CONFIG;
const supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

let currentUser = null;   // { id, email }
let currentProfile = null; // { id, display_name }
let profilesById = {};    // Cache aller Profile für "erstellt von"-Anzeige

document.getElementById('login-version').textContent = 'Version ' + cfg.APP_VERSION;
document.getElementById('app-version').textContent = 'Version ' + cfg.APP_VERSION;

// ------------------------------------------------------------
// Auth
// ------------------------------------------------------------

async function init() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    await onLoggedIn(data.session.user);
  } else {
    showLogin();
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      showLogin();
    }
  });
}

function showLogin() {
  document.getElementById('login-view').classList.remove('hidden');
  document.getElementById('app-root').classList.add('hidden');
}

async function onLoggedIn(user) {
  currentUser = user;
  await loadAllProfiles();
  currentProfile = profilesById[user.id] || { id: user.id, display_name: user.email };

  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('app-root').classList.remove('hidden');
  document.getElementById('header-user').textContent = 'Angemeldet als ' + currentProfile.display_name;

  initBoard();
  initAnna();
  initKalender();
  subscribeRealtime();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.classList.add('hidden');
  document.getElementById('login-submit').textContent = 'Anmelden...';

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  document.getElementById('login-submit').textContent = 'Anmelden';

  if (error) {
    errorEl.textContent = 'Login fehlgeschlagen: E-Mail oder Passwort falsch.';
    errorEl.classList.remove('hidden');
    return;
  }
  await onLoggedIn(data.user);
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
});

async function loadAllProfiles() {
  const { data, error } = await supabase.from('profiles').select('id, display_name');
  if (!error && data) {
    profilesById = {};
    data.forEach((p) => (profilesById[p.id] = p));
  }
}

function displayNameFor(userId) {
  if (profilesById[userId]) return profilesById[userId].display_name;
  return 'Unbekannt';
}

// ------------------------------------------------------------
// Navigation
// ------------------------------------------------------------

const viewTitles = { board: 'Board', anna: 'Anna', kalender: 'Kalender' };

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
    document.getElementById('view-' + view).classList.remove('hidden');
    document.getElementById('header-title').textContent = viewTitles[view];
  });
});

// ------------------------------------------------------------
// Realtime: bei Änderungen durch den Partner automatisch neu laden
// ------------------------------------------------------------

function subscribeRealtime() {
  supabase
    .channel('family-app-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'board_items' }, loadBoard)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'anna_entries' }, loadAnna)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'anna_payments' }, loadAnna)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'anna_settings' }, loadAnna)
    .subscribe();
}

// ------------------------------------------------------------
// Formatierungs-Hilfsfunktionen
// ------------------------------------------------------------

function formatDateDE(dateStrOrDate) {
  const d = typeof dateStrOrDate === 'string' ? new Date(dateStrOrDate) : dateStrOrDate;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTimeDE(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ', ' +
         d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatEuro(value) {
  return Number(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map(csvEscape).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ============================================================
// BOARD
// ============================================================

let boardType = 'note';

document.querySelectorAll('.type-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-toggle').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    boardType = btn.dataset.type;
  });
});

function initBoard() {
  loadBoard();
}

document.getElementById('board-add-btn').addEventListener('click', async () => {
  const input = document.getElementById('board-input');
  const content = input.value.trim();
  if (!content) return;

  const { error } = await supabase.from('board_items').insert({
    type: boardType,
    content,
    created_by: currentUser.id,
  });

  if (error) {
    alert('Fehler beim Speichern: ' + error.message);
    return;
  }
  input.value = '';
  loadBoard();
});

async function loadBoard() {
  const { data, error } = await supabase
    .from('board_items')
    .select('*')
    .order('created_at', { ascending: false });

  const list = document.getElementById('board-list');
  const empty = document.getElementById('board-empty');

  if (error) {
    list.innerHTML = '';
    empty.textContent = 'Fehler beim Laden: ' + error.message;
    empty.classList.remove('hidden');
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = data.map(renderBoardItem).join('');

  list.querySelectorAll('.checkbox').forEach((cb) => {
    cb.addEventListener('click', () => toggleTodo(cb.dataset.id, cb.dataset.done === 'true'));
  });
  list.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteBoardItem(btn.dataset.id));
  });
}

function renderBoardItem(item) {
  const isTodo = item.type === 'todo';
  const doneClass = item.is_done ? 'done' : '';
  const creator = displayNameFor(item.created_by);
  const meta = isTodo && item.is_done
    ? `erledigt von ${displayNameFor(item.done_by)} · ${formatDateTimeDE(item.done_at)}`
    : `von ${creator} · ${formatDateTimeDE(item.created_at)}`;

  const marker = isTodo
    ? `<div class="checkbox" data-id="${item.id}" data-done="${item.is_done}">${item.is_done ? '✓' : ''}</div>`
    : `<div class="type-dot"></div>`;

  return `
    <div class="board-item ${item.type} ${doneClass}">
      ${marker}
      <div class="content">
        <div class="text">${escapeHtml(item.content)}</div>
        <div class="meta">${meta} <span class="delete-btn" data-id="${item.id}" style="cursor:pointer;color:var(--color-danger)">✕</span></div>
      </div>
    </div>`;
}

async function toggleTodo(id, currentlyDone) {
  const willBeDone = !currentlyDone;
  const patch = willBeDone
    ? { is_done: true, done_by: currentUser.id, done_at: new Date().toISOString() }
    : { is_done: false, done_by: null, done_at: null };

  const { error } = await supabase.from('board_items').update(patch).eq('id', id);
  if (error) alert('Fehler: ' + error.message);
  loadBoard();
}

async function deleteBoardItem(id) {
  if (!confirm('Diesen Eintrag wirklich löschen?')) return;
  const { error } = await supabase.from('board_items').delete().eq('id', id);
  if (error) alert('Fehler: ' + error.message);
  loadBoard();
}

document.getElementById('board-export-btn').addEventListener('click', async () => {
  const { data, error } = await supabase.from('board_items').select('*').order('created_at', { ascending: true });
  if (error) { alert('Fehler: ' + error.message); return; }
  const rows = [['Typ', 'Inhalt', 'Erstellt von', 'Erstellt am', 'Erledigt', 'Erledigt von', 'Erledigt am']];
  data.forEach((i) => rows.push([
    i.type === 'todo' ? 'ToDo' : 'Notiz',
    i.content,
    displayNameFor(i.created_by),
    formatDateTimeDE(i.created_at),
    i.is_done ? 'Ja' : 'Nein',
    i.done_by ? displayNameFor(i.done_by) : '',
    i.done_at ? formatDateTimeDE(i.done_at) : '',
  ]));
  downloadCSV('board-export.csv', rows);
});

// ============================================================
// ANNA
// ============================================================

let annaCurrentRate = 15;

function initAnna() {
  document.getElementById('anna-hours-date').value = todayISO();
  document.getElementById('anna-pay-date').value = todayISO();
  loadAnna();
}

async function loadAnna() {
  const [settingsRes, entriesRes, paymentsRes] = await Promise.all([
    supabase.from('anna_settings').select('*').eq('id', 1).single(),
    supabase.from('anna_entries').select('*').order('work_date', { ascending: false }),
    supabase.from('anna_payments').select('*').order('payment_date', { ascending: false }),
  ]);

  if (settingsRes.data) {
    annaCurrentRate = Number(settingsRes.data.current_rate);
    document.getElementById('anna-rate').textContent = formatEuro(annaCurrentRate) + '/h';
    document.getElementById('anna-hours-rate').value = annaCurrentRate;
  }

  const entries = entriesRes.data || [];
  const payments = paymentsRes.data || [];

  const totalHoursAmount = entries.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = totalHoursAmount - totalPaid;

  document.getElementById('anna-balance').textContent = formatEuro(balance);
  document.getElementById('anna-balance').style.color = balance > 0 ? 'var(--color-danger)' : 'var(--color-success)';

  const lastPaid = payments[0];
  document.getElementById('anna-last-paid').textContent = lastPaid ? formatDateDE(lastPaid.payment_date) : 'noch nie';

  renderAnnaHistory(entries, payments);
}

function renderAnnaHistory(entries, payments) {
  const combined = [
    ...entries.map((e) => ({ ...e, _kind: 'entry', _date: e.work_date })),
    ...payments.map((p) => ({ ...p, _kind: 'payment', _date: p.payment_date })),
  ].sort((a, b) => new Date(b._date) - new Date(a._date));

  const container = document.getElementById('anna-history');
  const empty = document.getElementById('anna-empty');

  if (combined.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  container.innerHTML = combined.map((item) => {
    if (item._kind === 'entry') {
      return `
        <div class="history-row entry">
          <div>
            <div>${item.hours} Std. × ${formatEuro(item.rate)}${item.note ? ' – ' + escapeHtml(item.note) : ''}</div>
            <div class="hr-date">${formatDateDE(item._date)} · ${displayNameFor(item.created_by)}</div>
          </div>
          <div class="hr-amount">${formatEuro(item.amount)}</div>
        </div>`;
    }
    const tipText = Number(item.tip) > 0 ? ` (davon ${formatEuro(item.tip)} Trinkgeld)` : '';
    return `
      <div class="history-row payment">
        <div>
          <div>Zahlung${item.note ? ' – ' + escapeHtml(item.note) : ''}${tipText}</div>
          <div class="hr-date">${formatDateDE(item._date)} · ${displayNameFor(item.created_by)}</div>
        </div>
        <div class="hr-amount">+${formatEuro(item.amount)}</div>
      </div>`;
  }).join('');
}

document.getElementById('anna-hours-submit').addEventListener('click', async () => {
  const work_date = document.getElementById('anna-hours-date').value;
  const hours = parseFloat(document.getElementById('anna-hours-value').value);
  const rate = parseFloat(document.getElementById('anna-hours-rate').value);
  const note = document.getElementById('anna-hours-note').value.trim() || null;

  if (!work_date || !hours || !rate) {
    alert('Bitte Datum, Stunden und Satz ausfüllen.');
    return;
  }

  const { error } = await supabase.from('anna_entries').insert({
    work_date, hours, rate, note, created_by: currentUser.id,
  });
  if (error) { alert('Fehler: ' + error.message); return; }

  if (rate !== annaCurrentRate) {
    await supabase.from('anna_settings').update({ current_rate: rate, updated_at: new Date().toISOString() }).eq('id', 1);
  }

  document.getElementById('anna-hours-value').value = '';
  document.getElementById('anna-hours-note').value = '';
  document.getElementById('anna-hours-date').value = todayISO();
  loadAnna();
});

document.getElementById('anna-pay-submit').addEventListener('click', async () => {
  const payment_date = document.getElementById('anna-pay-date').value;
  const amount = parseFloat(document.getElementById('anna-pay-amount').value);
  const tip = parseFloat(document.getElementById('anna-pay-tip').value) || 0;
  const note = document.getElementById('anna-pay-note').value.trim() || null;

  if (!payment_date || !amount) {
    alert('Bitte Datum und Betrag ausfüllen.');
    return;
  }

  const { error } = await supabase.from('anna_payments').insert({
    payment_date, amount, tip, note, created_by: currentUser.id,
  });
  if (error) { alert('Fehler: ' + error.message); return; }

  document.getElementById('anna-pay-amount').value = '';
  document.getElementById('anna-pay-tip').value = '0';
  document.getElementById('anna-pay-note').value = '';
  document.getElementById('anna-pay-date').value = todayISO();
  loadAnna();
});

document.getElementById('anna-export-btn').addEventListener('click', async () => {
  const [entriesRes, paymentsRes] = await Promise.all([
    supabase.from('anna_entries').select('*').order('work_date', { ascending: true }),
    supabase.from('anna_payments').select('*').order('payment_date', { ascending: true }),
  ]);
  const rows = [['Art', 'Datum', 'Stunden', 'Satz', 'Betrag', 'Trinkgeld', 'Notiz', 'Erfasst von']];
  (entriesRes.data || []).forEach((e) => rows.push([
    'Stunden', formatDateDE(e.work_date), e.hours, e.rate, e.amount, '', e.note || '', displayNameFor(e.created_by),
  ]));
  (paymentsRes.data || []).forEach((p) => rows.push([
    'Zahlung', formatDateDE(p.payment_date), '', '', p.amount, p.tip, p.note || '', displayNameFor(p.created_by),
  ]));
  downloadCSV('anna-export.csv', rows);
});

// ============================================================
// KALENDER
// ============================================================

const WEEKDAY_NAMES = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const CHILD_SOURCE = { Henry: 'school', George: 'kindergarten', Oliver: 'tagesmutter' };
const CHILD_LABEL_PREFIX = { Henry: 'Henry', George: 'George', Oliver: 'Oliver' };

let kidsScheduleCache = [];

function initKalender() {
  loadKalender();
}

async function loadKalender() {
  const [calRes, kidsRes] = await Promise.all([
    fetch('/api/calendar').then((r) => r.json()).catch((e) => ({ events: [], holidays: [], errors: [String(e)] })),
    supabase.from('kids_schedule').select('*'),
  ]);

  kidsScheduleCache = kidsRes.data || [];
  renderKidsScheduleList();
  renderHolidayBanner(calRes.holidays || []);
  renderKalenderList(calRes.events || []);
}

function renderHolidayBanner(holidays) {
  const now = new Date();
  const upcoming = holidays
    .map((h) => ({ ...h, startD: new Date(h.start), endD: new Date(h.end) }))
    .filter((h) => h.endD >= now)
    .sort((a, b) => a.startD - b.startD)[0];

  const card = document.getElementById('holiday-card');
  const banner = document.getElementById('holiday-banner');

  if (!upcoming) { card.style.display = 'none'; return; }

  const isNow = upcoming.startD <= now && upcoming.endD >= now;
  banner.textContent = isNow
    ? `🏖️ Aktuell Ferien: ${upcoming.name} (bis ${formatDateDE(upcoming.endD)})`
    : `🏖️ Nächste Ferien: ${upcoming.name} (ab ${formatDateDE(upcoming.startD)})`;
  card.style.display = 'block';
}

function renderKalenderList(familyEvents) {
  const container = document.getElementById('kalender-list');
  const empty = document.getElementById('kalender-empty');
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }

  let html = '';
  let anyEvent = false;

  days.forEach((day) => {
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const isoWeekday = day.getDay() === 0 ? 7 : day.getDay();

    const famRows = familyEvents
      .filter((e) => {
        const s = new Date(e.start);
        return s >= day && s <= dayEnd;
      })
      .map((e) => ({
        time: e.allDay ? 'ganztägig' : new Date(e.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        title: e.title,
        loc: e.location,
        source: 'family',
        sortKey: e.allDay ? '00:00' : new Date(e.start).toISOString().slice(11, 16),
      }));

    const kidRows = kidsScheduleCache
      .filter((k) => k.weekday === isoWeekday)
      .map((k) => ({
        time: k.start_time ? k.start_time.slice(0, 5) : 'Zeit offen',
        title: `${CHILD_LABEL_PREFIX[k.child_name] || k.child_name}: ${k.label}`,
        loc: k.location,
        source: CHILD_SOURCE[k.child_name] || 'family',
        sortKey: k.start_time ? k.start_time.slice(0, 5) : '00:00',
      }));

    const rows = [...famRows, ...kidRows].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    if (rows.length === 0) return; // Tage ohne Termine überspringen, hält die Liste kurz

    anyEvent = true;
    const isToday = day.getTime() === today.getTime();
    const dayLabel = day.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' });

    html += `<div class="day-group">
      <div class="day-title ${isToday ? 'today' : ''}">${isToday ? 'Heute · ' : ''}${dayLabel}</div>
      ${rows.map((r) => `
        <div class="event-row source-${r.source}">
          <div class="event-time">${r.time}</div>
          <div class="event-dot"></div>
          <div class="event-title">${escapeHtml(r.title)}${r.loc ? `<div class="event-loc">${escapeHtml(r.loc)}</div>` : ''}</div>
        </div>`).join('')}
    </div>`;
  });

  container.innerHTML = html;
  empty.classList.toggle('hidden', anyEvent);
}

function renderKidsScheduleList() {
  const container = document.getElementById('kids-schedule-list');
  if (kidsScheduleCache.length === 0) {
    container.innerHTML = '<div class="empty-hint">Noch keine Zeiten eingetragen.</div>';
    return;
  }
  const byChild = {};
  kidsScheduleCache.forEach((k) => {
    byChild[k.child_name] = byChild[k.child_name] || [];
    byChild[k.child_name].push(k);
  });

  let html = '';
  Object.keys(byChild).forEach((child) => {
    const items = byChild[child].sort((a, b) => a.weekday - b.weekday);
    html += `<p style="margin-top:10px"><strong>${escapeHtml(child)}</strong></p>`;
    items.forEach((k) => {
      const timeText = k.start_time ? `${k.start_time.slice(0, 5)}–${(k.end_time || '').slice(0, 5)}` : 'Zeit offen';
      html += `<div class="history-row">
        <div>${WEEKDAY_NAMES[k.weekday]} · ${escapeHtml(k.label)} <span class="hr-date">(${timeText})</span></div>
        <div><span class="delete-btn" data-id="${k.id}" style="cursor:pointer;color:var(--color-danger)">✕</span></div>
      </div>`;
    });
  });
  container.innerHTML = html;

  container.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await supabase.from('kids_schedule').delete().eq('id', btn.dataset.id);
      loadKalender();
    });
  });
}

document.getElementById('kids-schedule-submit').addEventListener('click', async () => {
  const child_name = document.getElementById('kids-child-select').value;
  const weekday = parseInt(document.getElementById('kids-weekday-select').value, 10);
  const start_time = document.getElementById('kids-start-time').value || null;
  const end_time = document.getElementById('kids-end-time').value || null;
  const label = document.getElementById('kids-label').value.trim();

  if (!label) { alert('Bitte eine Bezeichnung eintragen.'); return; }

  const { error } = await supabase.from('kids_schedule').insert({
    child_name, weekday, start_time, end_time, label,
  });
  if (error) { alert('Fehler: ' + error.message); return; }

  document.getElementById('kids-label').value = '';
  document.getElementById('kids-start-time').value = '';
  document.getElementById('kids-end-time').value = '';
  loadKalender();
});

// ------------------------------------------------------------

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

init();
