// Cliente compartido desde /js/supabaseClient.js
import { setupStandardMenu } from '/js/menu-utils.js';
const supabase = window.sb;
const $ = (id) => document.getElementById(id);

// ---------- Estado local ----------
let ACCOUNTS = [];
// POCKETS will be loaded per account
let POCKETS_BY_ACCOUNT = {}; // cache: { accountId: [pockets] }

// ---------- Estado de Filtros ----------
const now = new Date();
let FILTER_STATE = {
    month: now.getMonth(), // 0-11
    year: now.getFullYear()
};

// ---------- Utilidades ----------
function createElement(tag, className, textContent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
}

// ---------- Carga de Datos Auxiliares ----------

async function loadBankAccounts(uid) {
    const { data, error } = await supabase
        .from('bank_accounts')
        .select('id,name,currency_code')
        .eq('user_id', uid)
        .order('name');
    if (error) console.error('Error loading accounts:', error);
    ACCOUNTS = data || [];

    const sel = $("mv-account");
    if (sel) {
        sel.innerHTML = '<option value="" disabled selected>Selecciona una cuenta…</option>' +
            ACCOUNTS.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    }
}

async function loadPocketsForAccount(accountId) {
    if (!accountId) return [];

    // Check cache
    if (POCKETS_BY_ACCOUNT[accountId]) return POCKETS_BY_ACCOUNT[accountId];

    const { data, error } = await supabase
        .from('pockets')
        .select('id,name')
        .eq('bank_account_id', accountId)
        .order('name');

    if (error) {
        console.error('Error loading pockets:', error);
        return [];
    }

    POCKETS_BY_ACCOUNT[accountId] = data || [];
    return data || [];
}

// ---------- Lógica de Filtros UI ----------

function changeMonth(delta) {
    let m = FILTER_STATE.month + delta;
    let y = FILTER_STATE.year;

    if (m < 0) {
        m = 11;
        y--;
    } else if (m > 11) {
        m = 0;
        y++;
    }

    FILTER_STATE.month = m;
    FILTER_STATE.year = y;

    // Sync Dropdowns
    const monthSel = $("filter-period-month");
    const yearSel = $("filter-period-year");

    if (monthSel) monthSel.value = m;

    if (yearSel) {
        // Verify year option exists
        let opt = yearSel.querySelector(`option[value="${y}"]`);
        if (!opt) {
            opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            // Check where to insert
            const first = parseInt(yearSel.firstElementChild.value);
            const last = parseInt(yearSel.lastElementChild.value);

            if (y < first) yearSel.insertBefore(opt, yearSel.firstElementChild);
            else if (y > last) yearSel.appendChild(opt);
            else yearSel.appendChild(opt);
        }
        yearSel.value = y;
    }

    updateActiveFilterText();
    reloadMovements();
}

function initFilters() {
    // 1. Periodo: Año
    const yearSel = $("filter-period-year");
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 2; y <= currentYear + 1; y++) {
        const opt = createElement('option', '', y);
        opt.value = y;
        if (y === FILTER_STATE.year) opt.selected = true;
        yearSel.appendChild(opt);
    }

    // Periodo: Mes
    const monthSel = $("filter-period-month");
    monthSel.value = FILTER_STATE.month;

    // Listeners Periodo
    yearSel.addEventListener('change', (e) => {
        FILTER_STATE.year = parseInt(e.target.value);
        updateActiveFilterText();
        reloadMovements();
    });
    monthSel.addEventListener('change', (e) => {
        FILTER_STATE.month = parseInt(e.target.value);
        updateActiveFilterText();
        reloadMovements();
    });

    updateActiveFilterText();

    // Nav Arrows
    $("btn-prev-month")?.addEventListener('click', () => changeMonth(-1));
    $("btn-next-month")?.addEventListener('click', () => changeMonth(1));
}

function updateActiveFilterText() {
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const m = months[FILTER_STATE.month];
    $("active-filter-period").textContent = `${m} ${FILTER_STATE.year}`;
}

async function reloadMovements() {
    const session = await supabase.auth.getSession();
    const uid = session.data.session?.user?.id;
    if (uid) loadMovements(uid);
}

// ---------- Listado de Movimientos ----------
async function loadMovements(uid) {
    // Rangos de fecha
    const start = new Date(Date.UTC(FILTER_STATE.year, FILTER_STATE.month, 1)).toISOString();
    const end = new Date(Date.UTC(FILTER_STATE.year, FILTER_STATE.month + 1, 0, 23, 59, 59, 999)).toISOString();

    let query = supabase
        .from('pocket_allocations')
        .select(`
            id,
            occurred_at,
            description,
            amount,
            bank_account_id,
            from_pocket_id,
            to_pocket_id,
            bank_accounts (name, currency_code),
            from_pocket: pockets!from_pocket_id(name),
            to_pocket: pockets!to_pocket_id(name)
        `)
        .eq('user_id', uid)
        .gte('occurred_at', start)
        .lte('occurred_at', end)
        .order('occurred_at', { ascending: false });

    const { data, error } = await query;

    const tbody = $("pockets-tbody");
    const empty = $("pockets-empty");
    const msg = $("pockets-msg");

    if (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-4 text-rose-500 text-center">${error.message}</td></tr>`;
        return;
    }

    const rows = data || [];
    if (!tbody || !empty) return;

    if (rows.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    tbody.innerHTML = '';

    rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors";

        // Fecha (formateada simple)
        const dateObj = new Date(r.occurred_at);
        const dateStr = dateObj.toLocaleDateString('es-CO', { timeZone: 'UTC' });

        tr.appendChild(createElement('td', 'px-6 py-4 whitespace-nowrap', dateStr));
        tr.appendChild(createElement('td', 'px-6 py-4', r.description || '—'));
        tr.appendChild(createElement('td', 'px-6 py-4', r.bank_accounts?.name || '—'));
        tr.appendChild(createElement('td', 'px-6 py-4', r.from_pocket?.name || '—'));
        tr.appendChild(createElement('td', 'px-6 py-4', r.to_pocket?.name || '—'));
        tr.appendChild(createElement('td', 'px-6 py-4', r.bank_accounts?.currency_code || '-'));

        // Valor
        const currency = r.bank_accounts?.currency_code || 'COP';
        const amountStr = new Intl.NumberFormat('es-CO', { style: 'currency', currency: currency }).format(r.amount);

        // Color and Value based on movement type
        let colorClass = 'text-slate-900';
        // Logic: 
        // Load: from_pocket is null (or undefined) -> Green
        // Unload: to_pocket is null (or undefined) -> Red
        // Internal: both exist -> Blue

        if (!r.from_pocket_id && r.to_pocket_id) {
            colorClass = 'text-emerald-600'; // Carga
        } else if (r.from_pocket_id && !r.to_pocket_id) {
            colorClass = 'text-rose-600'; // Descarga
        } else if (r.from_pocket_id && r.to_pocket_id) {
            colorClass = 'text-blue-600'; // Interno
        }

        tr.appendChild(createElement('td', `px-6 py-4 text-right font-medium ${colorClass}`, amountStr));

        // Acciones
        const tdActions = createElement('td', 'px-6 py-4 text-right whitespace-nowrap');

        const btnEdit = createElement('button', 'text-indigo-600 hover:text-indigo-800 mr-3 transition-colors', 'Editar');
        btnEdit.setAttribute('data-mv-edit', r.id);

        const btnDel = createElement('button', 'text-rose-600 hover:text-rose-800 transition-colors', 'Borrar');
        btnDel.setAttribute('data-mv-del', r.id);

        tdActions.appendChild(btnEdit);
        tdActions.appendChild(btnDel);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
    });

    if (msg) msg.textContent = '';
}

// ---------- Logic for Movement Types ----------
function updateFormVisibility() {
    const type = $("mv-type").value; // load, unload, internal
    const fromContainer = $("mv-from-pocket").closest('div');
    const toContainer = $("mv-to-pocket").closest('div');

    // Default visibility
    fromContainer.classList.remove('hidden');
    toContainer.classList.remove('hidden');

    if (type === 'load') {
        fromContainer.classList.add('hidden');
    } else if (type === 'unload') {
        toContainer.classList.add('hidden');
    }
    // internal: show both (default)
}

// ---------- Modal Crear/Editar Movimiento ----------

function toggleModal(show) {
    const m = $("movement-modal");
    if (!m) return;
    m.classList.toggle('hidden', !show);
}

function setModalError(el, show) { el?.classList.toggle('hidden', !show); }

function updateCurrencyDisplay(accountId) {
    const account = ACCOUNTS.find(a => a.id == accountId);
    $("mv-currency").value = account ? account.currency_code : '';
}

async function updatePocketsDropdowns(accountId, selectedFrom = null, selectedTo = null) {
    const fromSel = $("mv-from-pocket");
    const toSel = $("mv-to-pocket");

    if (!accountId) {
        fromSel.innerHTML = '<option value="">— Ninguno —</option>';
        fromSel.disabled = true;
        toSel.innerHTML = '<option value="">— Ninguno —</option>';
        toSel.disabled = true;
        return;
    }

    // Enable and show loading state if fetching needed
    fromSel.disabled = false;
    toSel.disabled = false;

    const pockets = await loadPocketsForAccount(accountId);

    const optionsHtml = '<option value="">— Ninguno —</option>' +
        pockets.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    fromSel.innerHTML = optionsHtml;
    toSel.innerHTML = optionsHtml;

    if (selectedFrom) fromSel.value = selectedFrom;
    if (selectedTo) toSel.value = selectedTo;
}

function fillForm(m = {}) {
    $("mv-id").value = m.id || '';
    $("mv-date").value = m.occurred_at ? m.occurred_at.split('T')[0] : new Date().toISOString().split('T')[0];
    $("mv-desc").value = m.description || '';
    $("mv-account").value = m.bank_account_id || '';
    $("mv-amount").value = m.amount !== undefined ? m.amount : '';

    // Trigger updates
    if (m.bank_account_id) {
        updateCurrencyDisplay(m.bank_account_id);
        updatePocketsDropdowns(m.bank_account_id, m.from_pocket_id, m.to_pocket_id);
    } else {
        $("mv-currency").value = '';
        updatePocketsDropdowns(null);
    }

    // Determine Type
    let type = 'load'; // Default
    if (m.id) {
        if (m.from_pocket_id && m.to_pocket_id) type = 'internal';
        else if (m.from_pocket_id && !m.to_pocket_id) type = 'unload';
        else type = 'load';
    }
    $("mv-type").value = type;
    updateFormVisibility();

    $("modal-title").textContent = m.id ? 'Editar Movimiento' : 'Agregar Movimiento';
    $("modal-msg").textContent = '';

    // Reset errores
    ['date', 'account', 'amount'].forEach(f => setModalError($(`err-mv-${f}`), false));
}

function bindModal() {
    $("btn-new-movement")?.addEventListener('click', () => {
        fillForm();
        toggleModal(true);
    });

    document.querySelectorAll('[data-close-modal]').forEach(el =>
        el.addEventListener('click', () => toggleModal(false))
    );

    $("movement-form")?.addEventListener('submit', upsertMovement);

    // When account changes
    $("mv-account")?.addEventListener('change', (e) => {
        const accId = e.target.value;
        updateCurrencyDisplay(accId);
        updatePocketsDropdowns(accId);
    });

    $("mv-type")?.addEventListener('change', updateFormVisibility);
}

// ---------- Acciones CRUD ----------
async function upsertMovement(e) {
    e.preventDefault();
    const session = await supabase.auth.getSession();
    const uid = session.data.session?.user?.id;
    if (!uid) return;

    const id = $("mv-id").value || undefined;
    const occurred_at = $("mv-date").value;
    const description = $("mv-desc").value.trim() || null;
    const bank_account_id = $("mv-account").value;
    const from_pocket_id = $("mv-from-pocket").value || null;
    const to_pocket_id = $("mv-to-pocket").value || null;
    const amountRaw = $("mv-amount").value;

    // Validaciones
    let valid = true;
    ['date', 'account', 'amount'].forEach(f => setModalError($(`err-mv-${f}`), false));

    if (!occurred_at) { setModalError($("err-mv-date"), true); valid = false; }
    if (!bank_account_id) { setModalError($("err-mv-account"), true); valid = false; }
    if (!amountRaw || Number(amountRaw) < 0) {
        setModalError($("err-mv-amount"), true);
        valid = false;
    }

    // Custom validation: At least one pocket
    const type = $("mv-type").value;

    // Adjust pockets based on type
    let finalFrom = from_pocket_id;
    let finalTo = to_pocket_id;

    if (type === 'load') {
        finalFrom = null; // Ensure null
        if (!to_pocket_id) {
            $("modal-msg").textContent = "El Bolsillo Destino es obligatorio para Cargas.";
            $("modal-msg").className = "md:col-span-2 text-sm text-center text-rose-500 mt-2";
            valid = false;
        }
    } else if (type === 'unload') {
        finalTo = null; // Ensure null
        if (!from_pocket_id) {
            $("modal-msg").textContent = "El Bolsillo Origen es obligatorio para Descargas.";
            $("modal-msg").className = "md:col-span-2 text-sm text-center text-rose-500 mt-2";
            valid = false;
        }
    } else if (type === 'internal') {
        if (!from_pocket_id || !to_pocket_id) {
            $("modal-msg").textContent = "Origen y Destino son obligatorios para movimientos Internos.";
            $("modal-msg").className = "md:col-span-2 text-sm text-center text-rose-500 mt-2";
            valid = false;
        }
    }

    if (!valid) return;

    const amount = Number(amountRaw);

    const payload = {
        id,
        user_id: uid,
        occurred_at,
        description,
        bank_account_id,
        from_pocket_id: finalFrom,
        to_pocket_id: finalTo,
        amount
    };

    const { error } = await supabase.from('pocket_allocations').upsert(payload).select('id').single();

    if (error) {
        $("modal-msg").textContent = error.message;
        $("modal-msg").className = "md:col-span-2 text-sm text-center text-rose-500 mt-2";
    } else {
        $("modal-msg").textContent = 'Guardado exitosamente';
        $("modal-msg").className = "md:col-span-2 text-sm text-center text-emerald-600 mt-2";
        await loadMovements(uid);
        setTimeout(() => toggleModal(false), 500);
    }
}

async function onTableClick(e) {
    const editBtn = e.target.closest('[data-mv-edit]');
    const delBtn = e.target.closest('[data-mv-del]');

    if (editBtn) {
        const id = editBtn.getAttribute('data-mv-edit');
        const { data, error } = await supabase.from('pocket_allocations').select('*').eq('id', id).single();
        if (error) return alert(error.message);
        fillForm(data);
        toggleModal(true);
        return;
    }

    if (delBtn) {
        const id = delBtn.getAttribute('data-mv-del');
        if (!confirm('¿Estás seguro de borrar este movimiento?')) return;

        const { error } = await supabase.from('pocket_allocations').delete().eq('id', id);
        if (error) return alert(error.message);

        const session = await supabase.auth.getSession();
        if (session.data.session?.user?.id) {
            loadMovements(session.data.session.user.id);
        }
    }
}

function bindTable() {
    $("pockets-tbody")?.addEventListener('click', onTableClick);
}

// ---------- Init ----------
async function initPockets() {
    // 1. Setup Menu & Session
    const session = await setupStandardMenu({ redirectIfNoSession: true });
    if (!session) return;
    const user = session.user;

    // Cargar cuentas
    await loadBankAccounts(user.id);

    // Init UI Filters
    initFilters();

    bindModal();
    bindTable();

    await loadMovements(user.id);
}

initPockets();
