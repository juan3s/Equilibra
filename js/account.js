// ============================ /js/account.js ============================
// Protección de ruta + Menú usuario + Gestión UI de cuentas bancarias y bolsillos
import { setupStandardMenu } from '/js/menu-utils.js';
const supabase = window.sb;
const $ = (id) => document.getElementById(id);

// ---------- Utilidades ----------
// Session & Menu handled by menu-utils.js

function createElement(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent) el.textContent = textContent;
  return el;
}


// ---------- Estado local ----------
let BANKS = [];     // {id, name}
let ACCOUNTS = [];  // {id, name, bank_id}

// ---------- Cargar bancos para el select ----------
async function loadBanks() {
  const sel = $("ba-bank"); // puede no existir en todas las vistas
  const { data, error } = await supabase.from('banks').select('id,name').order('name');
  if (error) {
    if (sel) sel.innerHTML = `<option value="">—</option>`;
    return;
  }
  BANKS = data || [];
  if (sel) {
    sel.innerHTML = (BANKS.length ? BANKS : [{ id: '', name: '—' }])
      .map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  }
}

// ---------- Listado de cuentas bancarias ----------
async function getUserId() { const { data: { user } } = await supabase.auth.getUser(); return user?.id || null; }
function findBankName(bank_id) { const b = BANKS.find(x => x.id === bank_id); return b?.name || '—'; }

async function loadBankAccounts() {
  const uid = await getUserId(); if (!uid) return;
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('id,name,description,account_type,account_number,currency_code,initial_balance,bank_id,banks(name)')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  const tbody = $("bank-accounts-tbody");
  const empty = $("bank-accounts-empty");
  const msg = $("bank-accounts-msg");
  if (error) { if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-4 text-rose-500">${error.message}</td></tr>`; if (empty) empty.classList.add('hidden'); return; }
  const rows = data || [];
  if (!tbody || !empty) return;
  if (rows.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = '';
  rows.forEach(r => {
    const bankName = r.banks?.name || findBankName(r.bank_id);
    const tr = document.createElement('tr');

    tr.appendChild(createElement('td', 'px-4 py-3', r.name || '—'));
    tr.appendChild(createElement('td', 'px-4 py-3 capitalize', r.account_type || '—'));
    tr.appendChild(createElement('td', 'px-4 py-3', r.currency_code || 'COP'));
    tr.appendChild(createElement('td', 'px-4 py-3', bankName || '—'));

    const tdActions = createElement('td', 'px-4 py-3 text-right');

    const btnEdit = createElement('button', 'px-3 py-1 rounded-md border border-slate-300 hover:bg-slate-50 text-xs text-slate-700', 'Editar');
    btnEdit.setAttribute('data-ba-edit', r.id);
    tdActions.appendChild(btnEdit);

    tdActions.appendChild(document.createTextNode(' '));

    const btnDel = createElement('button', 'px-3 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs', 'Borrar');
    btnDel.setAttribute('data-ba-del', r.id);
    tdActions.appendChild(btnDel);

    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
  msg && (msg.textContent = '');
}

// ---------- Modal crear/editar cuenta ----------
function toggleBAModal(show) { const m = $("bank-account-modal"); if (!m) return; m.classList.toggle('hidden', !show); }
function setError(el, show) { el?.classList.toggle('hidden', !show); }
function fillBAForm(a = {}) {
  $("ba-id").value = a.id || '';
  $("ba-name").value = a.name || '';
  $("ba-desc").value = a.description || '';
  $("ba-type").value = a.account_type || 'ahorros';
  $("ba-number").value = a.account_number || '';
  $("ba-currency").value = a.currency_code || 'COP';
  $("ba-initial").value = (a.initial_balance ?? '') === null ? '' : (a.initial_balance ?? '');
  $("ba-bank").value = a.bank_id || (BANKS[0]?.id || '');
  $("bamodal-title").textContent = a.id ? 'Editar cuenta' : 'Agregar cuenta';
  $("bamodal-msg").textContent = '';
  setError($("err-name"), false); setError($("err-initial"), false);
}
function bindBAModal() {
  $("btn-new-bank-account")?.addEventListener('click', () => { fillBAForm(); toggleBAModal(true); });
  document.querySelectorAll('[data-close-bamodal]').forEach(el => el.addEventListener('click', () => toggleBAModal(false)));
  $("bank-account-form")?.addEventListener('submit', upsertBankAccount);
}

// ---------- Acciones CRUD cuenta ----------
async function upsertBankAccount(e) {
  e.preventDefault();
  const uid = await getUserId(); if (!uid) return;

  const id = $("ba-id").value || undefined;
  const name = $("ba-name").value.trim();
  const description = $("ba-desc").value.trim() || null;
  const account_type = $("ba-type").value || 'ahorros';
  const account_number = $("ba-number").value.trim() || null;
  const currency_code = $("ba-currency").value || 'COP';
  const initial_raw = $("ba-initial").value.trim();

  // Validaciones
  let valid = true;
  setError($("err-name"), false); setError($("err-initial"), false);
  if (!name) { setError($("err-name"), true); valid = false; }
  if (initial_raw !== '' && isNaN(Number(initial_raw))) { setError($("err-initial"), true); valid = false; }
  if (!valid) return;

  const initial_balance = initial_raw === '' ? null : Number(initial_raw);
  const bank_id = $("ba-bank").value || null;

  const payload = { id, user_id: uid, name, description, account_type, account_number, currency_code, initial_balance, bank_id };
  const { error } = await supabase.from('bank_accounts').upsert(payload).select('id').single();
  $("bamodal-msg").textContent = error ? error.message : 'Guardado ✅';
  if (!error) { await loadBankAccounts(); setTimeout(() => toggleBAModal(false), 400); }
}

async function onTableClick(e) {
  const editBtn = e.target.closest('[data-ba-edit]');
  const delBtn = e.target.closest('[data-ba-del]');
  if (editBtn) {
    const id = editBtn.getAttribute('data-ba-edit');
    const { data, error } = await supabase.from('bank_accounts').select('*').eq('id', id).single();
    if (error) return alert(error.message);
    fillBAForm(data); toggleBAModal(true); return;
  }
  if (delBtn) {
    const id = delBtn.getAttribute('data-ba-del');
    if (!confirm('¿Eliminar esta cuenta? Esta acción no se puede deshacer.')) return;
    const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
    if (error) return alert(error.message);
    await loadBankAccounts();
  }
}
function bindBATable() { $("bank-accounts-tbody")?.addEventListener('click', onTableClick); }

// =====================================================================
//                         BOLSILLOS (POCKETS)
// =====================================================================

// Cargar cuentas para el dropdown de bolsillos
async function loadAccountsForSelect() {
  const uid = await getUserId(); if (!uid) return;
  const sel = $("po-account");
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('id,name,bank_id')
    .eq('user_id', uid)
    .order('name');
  if (error) {
    if (sel) sel.innerHTML = '<option value="">—</option>';
    return;
  }
  ACCOUNTS = data || [];
  if (sel) {
    sel.innerHTML = '<option value="" disabled selected>Selecciona una cuenta…</option>' +
      ACCOUNTS.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  }
}

function findAccountName(account_id) {
  const a = ACCOUNTS.find(x => x.id === account_id);
  return a?.name || '—';
}
function findAccountBankName(account_id) {
  const a = ACCOUNTS.find(x => x.id === account_id);
  return findBankName(a?.bank_id);
}

// Listado de bolsillos
async function loadPockets() {
  const uid = await getUserId(); if (!uid) return;
  const { data, error } = await supabase
    .from('pockets')
    .select('id,name,bank_account_id')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  const tbody = $("pockets-tbody");
  const empty = $("pockets-empty");
  const msg = $("pockets-msg");
  if (error) { if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-rose-500">${error.message}</td></tr>`; if (empty) empty.classList.add('hidden'); return; }
  const rows = data || [];
  if (!tbody || !empty) return;
  if (rows.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = '';
  rows.forEach(r => {
    const accountName = findAccountName(r.bank_account_id);
    const bankName = findAccountBankName(r.bank_account_id);
    const tr = document.createElement('tr');

    tr.appendChild(createElement('td', 'px-4 py-3', r.name || '—'));
    tr.appendChild(createElement('td', 'px-4 py-3', bankName || '—'));
    tr.appendChild(createElement('td', 'px-4 py-3', accountName || '—'));

    const tdActions = createElement('td', 'px-4 py-3 text-right');

    const btnEdit = createElement('button', 'px-3 py-1 rounded-md border border-slate-300 hover:bg-slate-50 text-xs text-slate-700', 'Editar');
    btnEdit.setAttribute('data-po-edit', r.id);
    tdActions.appendChild(btnEdit);

    tdActions.appendChild(document.createTextNode(' '));

    const btnDel = createElement('button', 'px-3 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs', 'Borrar');
    btnDel.setAttribute('data-po-del', r.id);
    tdActions.appendChild(btnDel);

    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
  msg && (msg.textContent = '');
}

// Modal de bolsillos
function togglePOModal(show) { const m = $("pocket-modal"); if (!m) return; m.classList.toggle('hidden', !show); }
function setPOError(el, show) { el?.classList.toggle('hidden', !show); }
function fillPOForm(p = {}) {
  $("po-id").value = p.id || '';
  $("po-name").value = p.name || '';
  $("po-account").value = p.bank_account_id || '';
  $("pomodal-title").textContent = p.id ? 'Editar bolsillo' : 'Agregar bolsillo';
  $("pomodal-msg").textContent = '';
  setPOError($("err-po-name"), false); setPOError($("err-po-account"), false);
}
function bindPOModal() {
  $("btn-new-pocket")?.addEventListener('click', () => { fillPOForm(); togglePOModal(true); });
  document.querySelectorAll('[data-close-pomodal]').forEach(el => el.addEventListener('click', () => togglePOModal(false)));
  $("pocket-form")?.addEventListener('submit', upsertPocket);
}

// Acciones CRUD bolsillos
async function upsertPocket(e) {
  e.preventDefault();
  const uid = await getUserId(); if (!uid) return;
  const id = $("po-id").value || undefined;
  const name = $("po-name").value.trim();
  const bank_account_id = $("po-account").value;

  let valid = true;
  setPOError($("err-po-name"), false); setPOError($("err-po-account"), false);
  if (!name) { setPOError($("err-po-name"), true); valid = false; }
  if (!bank_account_id) { setPOError($("err-po-account"), true); valid = false; }
  if (!valid) return;

  const payload = { id, user_id: uid, name, bank_account_id, initial_amount: id ? undefined : 0 };
  const { error } = await supabase.from('pockets').upsert(payload).select('id').single();
  $("pomodal-msg").textContent = error ? error.message : 'Guardado ✅';
  if (!error) { await loadPockets(); setTimeout(() => togglePOModal(false), 400); }
}

async function onPocketsTableClick(e) {
  const editBtn = e.target.closest('[data-po-edit]');
  const delBtn = e.target.closest('[data-po-del]');
  if (editBtn) {
    const id = editBtn.getAttribute('data-po-edit');
    const { data, error } = await supabase.from('pockets').select('*').eq('id', id).single();
    if (error) return alert(error.message);
    fillPOForm(data); togglePOModal(true); return;
  }
  if (delBtn) {
    const id = delBtn.getAttribute('data-po-del');
    if (!confirm('¿Eliminar este bolsillo? Esta acción no se puede deshacer.')) return;
    const { error } = await supabase.from('pockets').delete().eq('id', id);
    if (error) return alert(error.message);
    await loadPockets();
  }
}
function bindPocketsTable() { $("pockets-tbody")?.addEventListener('click', onPocketsTableClick); }

// =====================================================================
//                         SUBCATEGORÍAS
// =====================================================================

let CATEGORIES = []; // {id, name, color, icon}

// Cargar categorías para el dropdown
async function loadCategories() {
  const sel = $("sc-category");
  const { data, error } = await supabase.from('categories').select('id,name').order('name');
  if (error) {
    if (sel) sel.innerHTML = `<option value="">—</option>`;
    return;
  }
  CATEGORIES = data || [];
  if (sel) {
    sel.innerHTML = '<option value="" disabled selected>Selecciona una categoría…</option>' +
      CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
}

function findCategoryName(cat_id) {
  const c = CATEGORIES.find(x => x.id === cat_id);
  return c?.name || '—';
}

// Listado de subcategorías
async function loadSubcategories() {
  const uid = await getUserId(); if (!uid) return;
  const { data, error } = await supabase
    .from('subcategories')
    .select('id,name,color,icon,category_id')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  const tbody = $("subcategories-tbody");
  const empty = $("subcategories-empty");
  const msg = $("subcategories-msg");

  if (error) { if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-rose-500">${error.message}</td></tr>`; if (empty) empty.classList.add('hidden'); return; }
  const rows = data || [];
  if (!tbody || !empty) return;
  if (rows.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = '';

  rows.forEach(r => {
    const categoryName = findCategoryName(r.category_id);
    const tr = document.createElement('tr');

    // Nombre
    tr.appendChild(createElement('td', 'px-4 py-3', r.name || '—'));

    // Color (círculo)
    const tdColor = createElement('td', 'px-4 py-3');
    const colorCircle = createElement('div', 'w-4 h-4 rounded-full');
    colorCircle.style.backgroundColor = r.color || '#ccc';
    tdColor.appendChild(colorCircle);
    tr.appendChild(tdColor);

    // Categoría
    tr.appendChild(createElement('td', 'px-4 py-3', categoryName));

    // Acciones
    const tdActions = createElement('td', 'px-4 py-3 text-right');

    const btnEdit = createElement('button', 'px-3 py-1 rounded-md border border-slate-300 hover:bg-slate-50 text-xs text-slate-700', 'Editar');
    btnEdit.setAttribute('data-sc-edit', r.id);
    tdActions.appendChild(btnEdit);

    tdActions.appendChild(document.createTextNode(' '));

    const btnDel = createElement('button', 'px-3 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs', 'Borrar');
    btnDel.setAttribute('data-sc-del', r.id);
    tdActions.appendChild(btnDel);

    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
  msg && (msg.textContent = '');
}

// Modal subcategorías
function toggleSCModal(show) { const m = $("subcategory-modal"); if (!m) return; m.classList.toggle('hidden', !show); }
function setSCError(el, show) { el?.classList.toggle('hidden', !show); }
function fillSCForm(s = {}) {
  $("sc-id").value = s.id || '';
  $("sc-name").value = s.name || '';
  $("sc-category").value = s.category_id || '';
  $("sc-icon").value = s.icon || '';
  $("sc-color").value = s.color || '#4f46e5';
  $("scmodal-title").textContent = s.id ? 'Editar subcategoría' : 'Agregar subcategoría';
  $("scmodal-msg").textContent = '';
  setSCError($("err-sc-name"), false); setSCError($("err-sc-category"), false);
}
function bindSCModal() {
  $("btn-new-subcategory")?.addEventListener('click', () => { fillSCForm(); toggleSCModal(true); });
  document.querySelectorAll('[data-close-scmodal]').forEach(el => el.addEventListener('click', () => toggleSCModal(false)));
  $("subcategory-form")?.addEventListener('submit', upsertSubcategory);
}

// Acciones CRUD subcategorías
async function upsertSubcategory(e) {
  e.preventDefault();
  const uid = await getUserId(); if (!uid) return;
  const id = $("sc-id").value || undefined;
  const name = $("sc-name").value.trim();
  const category_id = $("sc-category").value;
  const icon = $("sc-icon").value.trim() || null;
  const color = $("sc-color").value;

  let valid = true;
  setSCError($("err-sc-name"), false); setSCError($("err-sc-category"), false);
  if (!name) { setSCError($("err-sc-name"), true); valid = false; }
  if (!category_id) { setSCError($("err-sc-category"), true); valid = false; }
  if (!valid) return;

  const payload = { id, user_id: uid, name, category_id, icon, color };
  const { error } = await supabase.from('subcategories').upsert(payload).select('id').single();
  $("scmodal-msg").textContent = error ? error.message : 'Guardado ✅';
  if (!error) { await loadSubcategories(); setTimeout(() => toggleSCModal(false), 400); }
}

async function onSubcategoriesTableClick(e) {
  const editBtn = e.target.closest('[data-sc-edit]');
  const delBtn = e.target.closest('[data-sc-del]');
  if (editBtn) {
    const id = editBtn.getAttribute('data-sc-edit');
    const { data, error } = await supabase.from('subcategories').select('*').eq('id', id).single();
    if (error) return alert(error.message);
    fillSCForm(data); toggleSCModal(true); return;
  }
  if (delBtn) {
    const id = delBtn.getAttribute('data-sc-del');
    if (!confirm('¿Eliminar esta subcategoría? Esta acción no se puede deshacer.')) return;
    const { error } = await supabase.from('subcategories').delete().eq('id', id);
    if (error) return alert(error.message);
    await loadSubcategories();
  }
}
function bindSubcategoriesTable() { $("subcategories-tbody")?.addEventListener('click', onSubcategoriesTableClick); }


// ---------- Init ----------
async function initAccountPage() {
  const session = await setupStandardMenu({ redirectIfNoSession: true });
  if (!session) return;
  const user = session.user;

  await loadBanks();
  await loadBankAccounts();
  bindBAModal();
  bindBATable();

  // Bolsillos
  await loadAccountsForSelect();
  await loadPockets();
  bindPOModal();
  bindPocketsTable();

  // Subcategorías
  await loadCategories();
  await loadSubcategories();
  bindSCModal();
  bindSubcategoriesTable();
}

initAccountPage();