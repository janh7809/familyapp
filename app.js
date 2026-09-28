// ============================================================
// Hageney Family App – App-Logik
// ============================================================

const cfg = window.APP_CONFIG;
const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

let currentUser = null;   // { id, email }
let currentProfile = null; // { id, display_name }
let profilesById = {};    // Cache aller Profile für "erstellt von"-Anzeige

document.getElementById('login-version').textContent = 'Version ' + cfg.APP_VERSION;
document.getElementById('app-version').textContent = 'Version ' + cfg.APP_VERSION;

// ------------------------------------------------------------
// Auth
// ------------------------------------------------------------

async function init() {
  const { data } = await sb.auth.getSession();
  if (data.session) {
    await onLoggedIn(data.session.user);
  } else {
    showLogin();
  }

  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      showLogin();
    }
  });
}

function showLogin() {
  document.getElementById('login-view').classList.remove('hidden');
  document.getElementById('app-root').classList.add('hidden');
  stopAutoRefresh();
}

async function onLoggedIn(user) {
  currentUser = user;
  await loadAllProfiles();
  currentProfile = profilesById[user.id] || { id: user.id, display_name: user.email };

  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('app-root').classList.remove('hidden');
  document.getElementById('header-user').textContent = 'Angemeldet als ' + currentProfile.display_name;

  initBoard();
  initEinkaufsliste();
  initKalender();
  initStundenplaene();
  initAnna();
  subscribeRealtime();
  startAutoRefresh();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.classList.add('hidden');
  document.getElementById('login-submit').textContent = 'Anmelden...';

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  document.getElementById('login-submit').textContent = 'Anmelden';

  if (error) {
    errorEl.textContent = 'Login fehlgeschlagen: E-Mail oder Passwort falsch.';
    errorEl.classList.remove('hidden');
    return;
  }
  await onLoggedIn(data.user);
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await sb.auth.signOut();
});

async function loadAllProfiles() {
  const { data, error } = await sb.from('profiles').select('id, display_name');
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

const viewTitles = {
  board: 'Board',
  einkaufsliste: 'Einkaufsliste',
  kalender: 'Kalender',
  stundenplaene: 'Stundenpläne',
  anna: 'Anna',
  admin: 'Admin',
};

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
  sb
    .channel('family-app-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'board_items' }, loadBoard)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, loadEinkaufsliste)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'anna_entries' }, loadAnna)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'anna_payments' }, loadAnna)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'anna_settings' }, loadAnna)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kids_schedule' }, loadStundenplaene)
    .subscribe();
}

// ------------------------------------------------------------
// Automatisches Neuladen: regelmäßig + sobald die App wieder
// sichtbar wird (z.B. aus dem Hintergrund zurückgeholt).
// Realtime deckt die meisten Änderungen sofort ab, das hier ist
// zusätzlich ein Sicherheitsnetz, falls die Verbindung kurz weg war.
// ------------------------------------------------------------

const AUTO_REFRESH_INTERVAL_MS = 60000; // 60 Sekunden
let autoRefreshTimer = null;

function refreshAllViews() {
  if (!currentUser) return;
  if (editingBoardId === null) loadBoard();
  if (editingShoppingId === null) loadEinkaufsliste();
  if (editingAnnaId === null) loadAnna();
  loadKalender();
  loadStundenplaene();
}

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshTimer = setInterval(refreshAllViews, AUTO_REFRESH_INTERVAL_MS);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentUser) {
    refreshAllViews();
  }
});

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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ------------------------------------------------------------
// Rückmeldung beim Speichern (Toast)
// ------------------------------------------------------------

let toastTimer = null;

function showToast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ============================================================
// BOARD
// ============================================================

let boardType = 'note';
let editingBoardId = null;

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

  const { error } = await sb.from('board_items').insert({
    type: boardType,
    content,
    created_by: currentUser.id,
  });

  if (error) {
    alert('Fehler beim Speichern: ' + error.message);
    return;
  }
  input.value = '';
  showToast('✓ Gespeichert');
  loadBoard();
});

async function loadBoard() {
  const { data, error } = await sb
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
    cb.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTodo(cb.dataset.id, cb.dataset.done === 'true');
    });
  });
  list.querySelectorAll('.delete-x[data-kind="board"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteBoardItem(btn.dataset.id);
    });
  });
  list.querySelectorAll('.content.editable').forEach((el) => {
    el.addEventListener('click', () => {
      editingBoardId = el.dataset.id;
      loadBoard();
    });
  });
  list.querySelectorAll('.board-save-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveBoardEdit(btn.dataset.id);
    });
  });
  list.querySelectorAll('.board-cancel-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editingBoardId = null;
      loadBoard();
    });
  });
}

function renderBoardItem(item) {
  const isTodo = item.type === 'todo';
  const marker = isTodo
    ? `<div class="checkbox" data-id="${item.id}" data-done="${item.is_done}">${item.is_done ? '✓' : ''}</div>`
    : `<div class="type-dot"></div>`;

  if (item.id === editingBoardId) {
    return `
      <div class="board-item ${item.type} editing">
        ${marker}
        <div class="content">
          <textarea class="edit-textarea" id="board-edit-${item.id}">${escapeHtml(item.content)}</textarea>
          <div class="edit-actions">
            <button class="btn btn-small board-save-btn" data-id="${item.id}">Speichern</button>
            <button class="btn btn-small btn-secondary board-cancel-btn">Abbrechen</button>
          </div>
        </div>
      </div>`;
  }

  const doneClass = item.is_done ? 'done' : '';
  const creator = displayNameFor(item.created_by);
  const meta = isTodo && item.is_done
    ? `erledigt von ${displayNameFor(item.done_by)} · ${formatDateTimeDE(item.done_at)}`
    : `von ${creator} · ${formatDateTimeDE(item.created_at)}`;

  return `
    <div class="board-item ${item.type} ${doneClass}">
      ${marker}
      <div class="content editable" data-id="${item.id}">
        <div class="text">${escapeHtml(item.content)}</div>
        <div class="meta">${meta}</div>
      </div>
      <div class="delete-x" data-id="${item.id}" data-kind="board">✕</div>
    </div>`;
}

async function toggleTodo(id, currentlyDone) {
  const willBeDone = !currentlyDone;
  const patch = willBeDone
    ? { is_done: true, done_by: currentUser.id, done_at: new Date().toISOString() }
    : { is_done: false, done_by: null, done_at: null };

  const { error } = await sb.from('board_items').update(patch).eq('id', id);
  if (error) alert('Fehler: ' + error.message);
  loadBoard();
}

async function deleteBoardItem(id) {
  if (!confirm('Diesen Eintrag wirklich löschen?')) return;
  const { error } = await sb.from('board_items').delete().eq('id', id);
  if (error) alert('Fehler: ' + error.message);
  loadBoard();
}

async function saveBoardEdit(id) {
  const textarea = document.getElementById('board-edit-' + id);
  const content = textarea.value.trim();
  if (!content) {
    alert('Der Eintrag darf nicht leer sein.');
    return;
  }
  const { error } = await sb.from('board_items').update({ content }).eq('id', id);
  if (error) {
    alert('Fehler: ' + error.message);
    return;
  }
  editingBoardId = null;
  showToast('✓ Gespeichert');
  loadBoard();
}

document.getElementById('board-export-btn').addEventListener('click', async () => {
  const { data, error } = await sb.from('board_items').select('*').order('created_at', { ascending: true });
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
// EINKAUFSLISTE
// ============================================================

let editingShoppingId = null;

function initEinkaufsliste() {
  loadEinkaufsliste();
}

document.getElementById('shopping-add-btn').addEventListener('click', async () => {
  const input = document.getElementById('shopping-input');
  const content = input.value.trim();
  if (!content) return;

  const { error } = await sb.from('shopping_items').insert({
    content,
    created_by: currentUser.id,
  });

  if (error) {
    alert('Fehler beim Speichern: ' + error.message);
    return;
  }
  input.value = '';
  showToast('✓ Gespeichert');
  loadEinkaufsliste();
});

async function loadEinkaufsliste() {
  const { data, error } = await sb
    .from('shopping_items')
    .select('*')
    .order('created_at', { ascending: false });

  const list = document.getElementById('shopping-list');
  const empty = document.getElementById('shopping-empty');

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

  list.innerHTML = data.map(renderShoppingItem).join('');

  list.querySelectorAll('.checkbox').forEach((cb) => {
    cb.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleShoppingItem(cb.dataset.id, cb.dataset.done === 'true');
    });
  });
  list.querySelectorAll('.delete-x[data-kind="shopping"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteShoppingItem(btn.dataset.id);
    });
  });
  list.querySelectorAll('.content.editable').forEach((el) => {
    el.addEventListener('click', () => {
      editingShoppingId = el.dataset.id;
      loadEinkaufsliste();
    });
  });
  list.querySelectorAll('.shopping-save-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveShoppingEdit(btn.dataset.id);
    });
  });
  list.querySelectorAll('.shopping-cancel-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editingShoppingId = null;
      loadEinkaufsliste();
    });
  });
}

function renderShoppingItem(item) {
  if (item.id === editingShoppingId) {
    return `
      <div class="board-item editing">
        <div class="type-dot"></div>
        <div class="content">
          <textarea class="edit-textarea" id="shopping-edit-${item.id}">${escapeHtml(item.content)}</textarea>
          <div class="edit-actions">
            <button class="btn btn-small shopping-save-btn" data-id="${item.id}">Speichern</button>
            <button class="btn btn-small btn-secondary shopping-cancel-btn">Abbrechen</button>
          </div>
        </div>
      </div>`;
  }

  const doneClass = item.is_done ? 'done' : '';
  const meta = item.is_done
    ? `abgehakt von ${displayNameFor(item.done_by)} · ${formatDateTimeDE(item.done_at)}`
    : `von ${displayNameFor(item.created_by)} · ${formatDateTimeDE(item.created_at)}`;

  return `
    <div class="board-item todo ${doneClass}">
      <div class="checkbox" data-id="${item.id}" data-done="${item.is_done}">${item.is_done ? '✓' : ''}</div>
      <div class="content editable" data-id="${item.id}">
        <div class="text">${escapeHtml(item.content)}</div>
        <div class="meta">${meta}</div>
      </div>
      <div class="delete-x" data-id="${item.id}" data-kind="shopping">✕</div>
    </div>`;
}

async function toggleShoppingItem(id, currentlyDone) {
  const willBeDone = !currentlyDone;
  const patch = willBeDone
    ? { is_done: true, done_by: currentUser.id, done_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    : { is_done: false, done_by: null, done_at: null, updated_at: new Date().toISOString() };

  const { error } = await sb.from('shopping_items').update(patch).eq('id', id);
  if (error) alert('Fehler: ' + error.message);
  loadEinkaufsliste();
}

async function deleteShoppingItem(id) {
  if (!confirm('Diesen Eintrag wirklich löschen?')) return;
  const { error } = await sb.from('shopping_items').delete().eq('id', id);
  if (error) alert('Fehler: ' + error.message);
  loadEinkaufsliste();
}

async function saveShoppingEdit(id) {
  const textarea = document.getElementById('shopping-edit-' + id);
  const content = textarea.value.trim();
  if (!content) {
    alert('Der Eintrag darf nicht leer sein.');
    return;
  }
  const { error } = await sb.from('shopping_items').update({ content, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    alert('Fehler: ' + error.message);
    return;
  }
  editingShoppingId = null;
  showToast('✓ Gespeichert');
  loadEinkaufsliste();
}

// ============================================================
// ANNA
// ============================================================

let annaCurrentRate = 15;
let annaEntriesCache = [];
let annaPaymentsCache = [];
let annaSelectedYear = new Date().getFullYear();
let editingAnnaId = null; // "entry:<id>" oder "payment:<id>"

function initAnna() {
  document.getElementById('anna-hours-date').value = todayISO();
  document.getElementById('anna-pay-date').value = todayISO();
  document.getElementById('anna-year-label').textContent = annaSelectedYear;
  loadAnna();
}

async function loadAnna() {
  const [settingsRes, entriesRes, paymentsRes] = await Promise.all([
    sb.from('anna_settings').select('*').eq('id', 1).single(),
    sb.from('anna_entries').select('*').order('work_date', { ascending: false }),
    sb.from('anna_payments').select('*').order('payment_date', { ascending: false }),
  ]);

  if (settingsRes.data) {
    annaCurrentRate = Number(settingsRes.data.current_rate);
    document.getElementById('anna-rate').textContent = formatEuro(annaCurrentRate) + '/h';
    document.getElementById('anna-hours-rate').value = annaCurrentRate;
  }

  annaEntriesCache = entriesRes.data || [];
  annaPaymentsCache = paymentsRes.data || [];

  const totalHoursAmount = annaEntriesCache.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalPaid = annaPaymentsCache.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = totalHoursAmount - totalPaid;

  document.getElementById('anna-balance').textContent = formatEuro(balance);
  document.getElementById('anna-balance').style.color = balance > 0 ? 'var(--color-danger)' : 'var(--color-success)';

  const lastPaid = annaPaymentsCache[0];
  document.getElementById('anna-last-paid').textContent = lastPaid ? formatDateDE(lastPaid.payment_date) : 'noch nie';

  renderAnnaHistory();
}

function renderAnnaHistory() {
  const yr = annaSelectedYear;
  document.getElementById('anna-year-label').textContent = yr;

  const entries = annaEntriesCache.filter((e) => new Date(e.work_date).getFullYear() === yr);
  const payments = annaPaymentsCache.filter((p) => new Date(p.payment_date).getFullYear() === yr);

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

  container.innerHTML = combined.map(renderAnnaHistoryRow).join('');

  container.querySelectorAll('.delete-x').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteAnnaItem(btn.dataset.kind, btn.dataset.id);
    });
  });
  container.querySelectorAll('.hr-editable').forEach((el) => {
    el.addEventListener('click', () => {
      editingAnnaId = el.dataset.kind + ':' + el.dataset.id;
      renderAnnaHistory();
    });
  });
  container.querySelectorAll('.anna-save-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveAnnaEdit(btn.dataset.kind, btn.dataset.id);
    });
  });
  container.querySelectorAll('.anna-cancel-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editingAnnaId = null;
      renderAnnaHistory();
    });
  });
}

function renderAnnaHistoryRow(item) {
  const key = item._kind + ':' + item.id;

  if (editingAnnaId === key) {
    if (item._kind === 'entry') {
      return `
        <div class="history-row entry editing-row">
          <div class="edit-grid">
            <div class="field"><label>Datum</label><input type="date" id="anna-edit-date-${item.id}" value="${item.work_date}" /></div>
            <div class="field"><label>Stunden</label><input type="number" step="0.25" min="0" id="anna-edit-hours-${item.id}" value="${item.hours}" /></div>
            <div class="field"><label>Satz (€/h)</label><input type="number" step="0.5" min="0" id="anna-edit-rate-${item.id}" value="${item.rate}" /></div>
            <div class="field"><label>Notiz</label><input type="text" id="anna-edit-note-${item.id}" value="${escapeHtml(item.note || '')}" /></div>
          </div>
          <div class="edit-actions">
            <button class="btn btn-small anna-save-btn" data-kind="entry" data-id="${item.id}">Speichern</button>
            <button class="btn btn-small btn-secondary anna-cancel-btn">Abbrechen</button>
          </div>
        </div>`;
    }
    const tip = Number(item.tip) || 0;
    return `
      <div class="history-row payment editing-row">
        <div class="edit-grid">
          <div class="field"><label>Bezahlt am</label><input type="date" id="anna-edit-date-${item.id}" value="${item.payment_date}" /></div>
          <div class="field"><label>Betrag (€)</label><input type="number" step="0.5" min="0" id="anna-edit-amount-${item.id}" value="${item.amount}" /></div>
          <div class="field"><label>davon Trinkgeld (€)</label><input type="number" step="0.5" min="0" id="anna-edit-tip-${item.id}" value="${tip}" /></div>
          <div class="field"><label>Notiz</label><input type="text" id="anna-edit-note-${item.id}" value="${escapeHtml(item.note || '')}" /></div>
        </div>
        <div class="edit-actions">
          <button class="btn btn-small anna-save-btn" data-kind="payment" data-id="${item.id}">Speichern</button>
          <button class="btn btn-small btn-secondary anna-cancel-btn">Abbrechen</button>
        </div>
      </div>`;
  }

  if (item._kind === 'entry') {
    return `
      <div class="history-row entry">
        <div class="hr-editable" data-kind="entry" data-id="${item.id}">
          <div>${item.hours} Std. × ${formatEuro(item.rate)}${item.note ? ' – ' + escapeHtml(item.note) : ''}</div>
          <div class="hr-date">${formatDateDE(item._date)} · ${displayNameFor(item.created_by)}</div>
        </div>
        <div class="hr-amount">${formatEuro(item.amount)}</div>
        <div class="delete-x" data-kind="entry" data-id="${item.id}">✕</div>
      </div>`;
  }

  const tipText = Number(item.tip) > 0 ? ` (davon ${formatEuro(item.tip)} Trinkgeld)` : '';
  return `
    <div class="history-row payment">
      <div class="hr-editable" data-kind="payment" data-id="${item.id}">
        <div>Zahlung${item.note ? ' – ' + escapeHtml(item.note) : ''}${tipText}</div>
        <div class="hr-date">${formatDateDE(item._date)} · ${displayNameFor(item.created_by)}</div>
      </div>
      <div class="hr-amount">+${formatEuro(item.amount)}</div>
      <div class="delete-x" data-kind="payment" data-id="${item.id}">✕</div>
    </div>`;
}

async function deleteAnnaItem(kind, id) {
  if (!confirm('Diesen Eintrag wirklich löschen?')) return;
  const table = kind === 'entry' ? 'anna_entries' : 'anna_payments';
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) { alert('Fehler: ' + error.message); return; }
  loadAnna();
}

async function saveAnnaEdit(kind, id) {
  if (kind === 'entry') {
    const work_date = document.getElementById('anna-edit-date-' + id).value;
    const hours = parseFloat(document.getElementById('anna-edit-hours-' + id).value);
    const rate = parseFloat(document.getElementById('anna-edit-rate-' + id).value);
    const note = document.getElementById('anna-edit-note-' + id).value.trim() || null;
    if (!work_date || !hours || !rate) {
      alert('Bitte Datum, Stunden und Satz ausfüllen.');
      return;
    }
    const { error } = await sb.from('anna_entries').update({ work_date, hours, rate, note }).eq('id', id);
    if (error) { alert('Fehler: ' + error.message); return; }
  } else {
    const payment_date = document.getElementById('anna-edit-date-' + id).value;
    const amount = parseFloat(document.getElementById('anna-edit-amount-' + id).value);
    const tip = parseFloat(document.getElementById('anna-edit-tip-' + id).value) || 0;
    const note = document.getElementById('anna-edit-note-' + id).value.trim() || null;
    if (!payment_date || !amount) {
      alert('Bitte Datum und Betrag ausfüllen.');
      return;
    }
    const { error } = await sb.from('anna_payments').update({ payment_date, amount, tip, note }).eq('id', id);
    if (error) { alert('Fehler: ' + error.message); return; }
  }
  editingAnnaId = null;
  showToast('✓ Gespeichert');
  loadAnna();
}

document.getElementById('anna-year-prev').addEventListener('click', () => {
  annaSelectedYear -= 1;
  editingAnnaId = null;
  renderAnnaHistory();
});

document.getElementById('anna-year-next').addEventListener('click', () => {
  const maxYear = new Date().getFullYear();
  if (annaSelectedYear >= maxYear) return;
  annaSelectedYear += 1;
  editingAnnaId = null;
  renderAnnaHistory();
});

document.getElementById('anna-hours-submit').addEventListener('click', async () => {
  const work_date = document.getElementById('anna-hours-date').value;
  const hours = parseFloat(document.getElementById('anna-hours-value').value);
  const rate = parseFloat(document.getElementById('anna-hours-rate').value);
  const note = document.getElementById('anna-hours-note').value.trim() || null;

  if (!work_date || !hours || !rate) {
    alert('Bitte Datum, Stunden und Satz ausfüllen.');
    return;
  }

  const { error } = await sb.from('anna_entries').insert({
    work_date, hours, rate, note, created_by: currentUser.id,
  });
  if (error) { alert('Fehler: ' + error.message); return; }

  if (rate !== annaCurrentRate) {
    await sb.from('anna_settings').update({ current_rate: rate, updated_at: new Date().toISOString() }).eq('id', 1);
  }

  document.getElementById('anna-hours-value').value = '';
  document.getElementById('anna-hours-note').value = '';
  document.getElementById('anna-hours-date').value = todayISO();
  showToast('✓ Gespeichert');
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

  const { error } = await sb.from('anna_payments').insert({
    payment_date, amount, tip, note, created_by: currentUser.id,
  });
  if (error) { alert('Fehler: ' + error.message); return; }

  document.getElementById('anna-pay-amount').value = '';
  document.getElementById('anna-pay-tip').value = '0';
  document.getElementById('anna-pay-note').value = '';
  document.getElementById('anna-pay-date').value = todayISO();
  showToast('✓ Gespeichert');
  loadAnna();
});

document.getElementById('anna-export-btn').addEventListener('click', async () => {
  const [entriesRes, paymentsRes] = await Promise.all([
    sb.from('anna_entries').select('*').order('work_date', { ascending: true }),
    sb.from('anna_payments').select('*').order('payment_date', { ascending: true }),
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
// KALENDER (Wochenansicht, nur synchronisierte Familientermine)
// ============================================================

let kalenderEventsCache = [];
let kalenderHolidaysCache = [];
let kalenderWeekOffset = 0;

function initKalender() {
  loadKalender();
}

async function loadKalender() {
  const calRes = await fetch('/api/calendar').then((r) => r.json()).catch((e) => ({ events: [], holidays: [], errors: [String(e)] }));
  kalenderEventsCache = calRes.events || [];
  kalenderHolidaysCache = (calRes.holidays || []).map((h) => ({
    ...h,
    startD: startOfDay(new Date(h.start)),
    endD: startOfDay(new Date(h.end)),
  }));
  renderKalenderWeek();
  renderFerienList();
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function mondayOfWeek(date) {
  const d = startOfDay(date);
  const isoDay = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (isoDay - 1));
  return d;
}

function holidayForDate(date) {
  return kalenderHolidaysCache.find((h) => date >= h.startD && date <= h.endD) || null;
}

function renderKalenderWeek() {
  const container = document.getElementById('kalender-week');
  const label = document.getElementById('kalender-week-label');

  const today = startOfDay(new Date());
  const monday = mondayOfWeek(today);
  monday.setDate(monday.getDate() + kalenderWeekOffset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  label.textContent = `${formatDateDE(monday)} – ${formatDateDE(sunday)}`;

  let html = '';

  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const rows = kalenderEventsCache
      .filter((e) => {
        const s = new Date(e.start);
        return s >= day && s <= dayEnd;
      })
      .map((e) => ({
        time: e.allDay ? 'ganztägig' : new Date(e.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        title: e.title,
        loc: e.location,
        sortKey: e.allDay ? '00:00' : new Date(e.start).toISOString().slice(11, 16),
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    const holiday = holidayForDate(day);
    const isToday = day.getTime() === today.getTime();
    const dayLabel = day.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });

    html += `<div class="week-day ${holiday ? 'is-ferien' : ''} ${isToday ? 'is-today' : ''}">
      <div class="week-day-head">
        <span class="week-day-name">${isToday ? 'Heute · ' : ''}${dayLabel}</span>
        ${holiday ? `<span class="ferien-badge">🏖️ ${escapeHtml(holiday.name)}</span>` : ''}
      </div>
      ${rows.length > 0
        ? rows.map((r) => `
          <div class="event-row source-family">
            <div class="event-time">${r.time}</div>
            <div class="event-dot"></div>
            <div class="event-title">${escapeHtml(r.title)}${r.loc ? `<div class="event-loc">${escapeHtml(r.loc)}</div>` : ''}</div>
          </div>`).join('')
        : '<div class="week-day-empty">Keine Termine</div>'}
    </div>`;
  }

  container.innerHTML = html;
}

function renderFerienList() {
  const container = document.getElementById('ferien-list');
  const empty = document.getElementById('ferien-empty');
  const currentYear = new Date().getFullYear();

  const list = kalenderHolidaysCache
    .filter((h) => h.startD.getFullYear() === currentYear || h.endD.getFullYear() === currentYear)
    .sort((a, b) => a.startD - b.startD);

  if (list.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  container.innerHTML = list.map((h) => `
    <div class="history-row">
      <div>${escapeHtml(h.name)}</div>
      <div class="hr-date">${formatDateDE(h.startD)} – ${formatDateDE(h.endD)}</div>
    </div>`).join('');
}

document.getElementById('kalender-week-prev').addEventListener('click', () => {
  kalenderWeekOffset -= 1;
  renderKalenderWeek();
});

document.getElementById('kalender-week-next').addEventListener('click', () => {
  kalenderWeekOffset += 1;
  renderKalenderWeek();
});

// ============================================================
// STUNDENPLÄNE
// ============================================================

const WEEKDAY_NAMES = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

let kidsScheduleCache = [];

function initStundenplaene() {
  loadStundenplaene();
}

async function loadStundenplaene() {
  const { data } = await sb.from('kids_schedule').select('*');
  kidsScheduleCache = data || [];
  renderKidsScheduleList();
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
        <div class="delete-x" data-id="${k.id}">✕</div>
      </div>`;
    });
  });
  container.innerHTML = html;

  container.querySelectorAll('.delete-x').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await sb.from('kids_schedule').delete().eq('id', btn.dataset.id);
      loadStundenplaene();
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

  const { error } = await sb.from('kids_schedule').insert({
    child_name, weekday, start_time, end_time, label,
  });
  if (error) { alert('Fehler: ' + error.message); return; }

  document.getElementById('kids-label').value = '';
  document.getElementById('kids-start-time').value = '';
  document.getElementById('kids-end-time').value = '';
  showToast('✓ Gespeichert');
  loadStundenplaene();
});

// ------------------------------------------------------------

init();
