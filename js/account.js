// ============================ /js/account.js ============================
// Protección de ruta + Menú usuario + Gestión UI de cuentas bancarias
const supabase = window.sb;
const $ = (id) => document.getElementById(id);

// ---------- Utilidades ----------
async function requireSessionOrRedirect() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = "/login.html"; return null; }
  return session;
}
function guessNameFromEmail(email) {
  if (!email) return "Usuario";
  const local = email.split("@")[0] || "Usuario";
  return local.charAt(0).toUpperCase() + local.slice(1);
}
function setupUserMenu() {
  const btn = $("user-menu-button"), menu = $("user-menu"); if (!btn || !menu) return;
  const toggle = () => menu.classList.toggle('hidden');
  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  document.addEventListener('click', () => menu.classList.add('hidden'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.classList.add('hidden'); });
}

// ---------- Estado local ----------
let BANKS = []; // {id, name}

// ---------- Cargar bancos para el select ----------
async function loadBanks() {
  const sel = $("ba-bank"); if (!sel) return;
  const { data, error } = await supabase.from('banks').select('id,name').order('name');
  if (error) { sel.innerHTML = `<option value="">—</option>`; return; }
  BANKS = data || [];
  sel.innerHTML = (BANKS.length ? BANKS : [{ id: '', name: '—' }]).map(b => `<option value="${b.id}">${b.name}</option>`).join('');
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
  if (error) { tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-4 text-red-400">${error.message}</td></tr>`; empty.classList.add('hidden'); return; }
  const rows = data || [];
  if (rows.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = rows.map(r => {
    const bankName = r.banks?.name || findBankName(r.bank_id);
    return `<tr>
      <td class="px-4 py-3">${r.name || '—'}</td>
      <td class="px-4 py-3 capitalize">${r.account_type || '—'}</td>
      <td class="px-4 py-3">${r.currency_code || 'COP'}</td>
      <td class="px-4 py-3">${bankName || '—'}</td>
      <td class="px-4 py-3 text-right">
        <button class="px-3 py-1 rounded-md border border-slate-700 hover:bg-slate-800 text-xs" data-ba-edit="${r.id}">Editar</button>
        <button class="px-3 py-1 rounded-md border border-rose-700 text-rose-300 hover:bg-rose-900/20 text-xs" data-ba-del="${r.id}">Borrar</button>
      </td>
    </tr>`;
  }).join('');
  msg.textContent = '';
}

// ---------- Modal crear/editar ----------
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

// ---------- Acciones CRUD ----------
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

// ---------- Init ----------
async function initAccountPage() {
  const session = await requireSessionOrRedirect(); if (!session) return;
  const user = session.user;
  const displayName = user.user_metadata?.full_name || guessNameFromEmail(user.email);
  const nameHeaderEl = $("user-name-header"); if (nameHeaderEl) nameHeaderEl.textContent = displayName || "Usuario";

  setupUserMenu();
  $("btn-logout")?.addEventListener('click', async () => { await supabase.auth.signOut(); window.location.href = "/index.html"; });
  supabase.auth.onAuthStateChange((event, s) => { if (event === 'SIGNED_OUT' || !s) window.location.href = '/index.html'; });

  await loadBanks();
  await loadBankAccounts();
  bindBAModal();
  bindBATable();
}

initAccountPage();

