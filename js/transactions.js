// Cliente compartido desde /js/supabaseClient.js
const supabase = window.sb;
const $ = (id) => document.getElementById(id);

// ---------- Utilidades ----------
async function requireSessionOrRedirect() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = "/login.html";
        return null;
    }
    return session;
}

function guessNameFromEmail(email) {
    if (!email) return "Usuario";
    const local = email.split("@")[0] || "Usuario";
    return local.charAt(0).toUpperCase() + local.slice(1);
}

async function fetchProfileFullName(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();
        if (error) return null;
        return data?.full_name || null;
    } catch (e) { return null; }
}

function setupUserMenu() {
    const btn = $("user-menu-button");
    const menu = $("user-menu");
    if (!btn || !menu) return;
    const toggle = () => menu.classList.toggle('hidden');
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    document.addEventListener('click', () => menu.classList.add('hidden'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.classList.add('hidden'); });
}

function createElement(tag, className, textContent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
}

// ---------- Estado local ----------
let ACCOUNTS = [];
let CATEGORIES = [];
let SUBCATEGORIES = []; // Todas las subcategorías del usuario
let CURRENCIES = [];

// ---------- Carga de Datos Auxiliares ----------

async function loadBankAccounts(uid) {
    const { data, error } = await supabase
        .from('bank_accounts')
        .select('id,name')
        .eq('user_id', uid)
        .order('name');
    if (error) console.error('Error loading accounts:', error);
    ACCOUNTS = data || [];
    const sel = $("tx-account");
    if (sel) {
        sel.innerHTML = '<option value="" disabled selected>Selecciona una cuenta…</option>' +
            ACCOUNTS.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    }
}

async function loadCategories() {
    const { data, error } = await supabase
        .from('categories')
        .select('id,name')
        .order('name');
    if (error) console.error('Error loading categories:', error);
    CATEGORIES = data || [];
    const sel = $("tx-category");
    if (sel) {
        sel.innerHTML = '<option value="" disabled selected>Selecciona una categoría…</option>' +
            CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
}

async function loadSubcategories(uid) {
    const { data, error } = await supabase
        .from('subcategories')
        .select('id,name,category_id')
        .eq('user_id', uid)
        .order('name');
    if (error) console.error('Error loading subcategories:', error);
    SUBCATEGORIES = data || [];
}

async function loadCurrencies() {
    const { data, error } = await supabase
        .from('currencies')
        .select('code,name')
        .order('code');
    if (error) console.error('Error loading currencies:', error);
    CURRENCIES = data || [];
    const sel = $("tx-currency");
    if (sel) {
        // Fallback si no hay monedas o error
        if (CURRENCIES.length === 0) {
            sel.innerHTML = `
                <option value="COP">COP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
            `;
        } else {
            sel.innerHTML = '<option value="" disabled selected>Selecciona moneda…</option>' +
                CURRENCIES.map(c => `<option value="${c.code}">${c.code} - ${c.name}</option>`).join('');
        }
    }
}

// ---------- Lógica de Subcategorías Dinámicas ----------
function updateSubcategorySelect(categoryId, selectedSubId = null) {
    const sel = $("tx-subcategory");
    if (!sel) return;

    if (!categoryId) {
        sel.innerHTML = '<option value="">—</option>';
        sel.disabled = true;
        return;
    }

    const filtered = SUBCATEGORIES.filter(s => s.category_id === categoryId);
    if (filtered.length === 0) {
        sel.innerHTML = '<option value="">(Sin subcategorías)</option>';
        sel.disabled = true; // Opcional: dejar habilitado pero vacío
    } else {
        sel.innerHTML = '<option value="">Selecciona (opcional)…</option>' +
            filtered.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        sel.disabled = false;
    }

    if (selectedSubId) {
        sel.value = selectedSubId;
    }
}

function bindCategoryChange() {
    const catSel = $("tx-category");
    catSel?.addEventListener('change', (e) => {
        updateSubcategorySelect(e.target.value);
    });
}

// ---------- Listado de Transacciones ----------
async function loadTransactions(uid) {
    const { data, error } = await supabase
        .from('transactions')
        .select(`
            id,
            occurred_at,
            description,
            amount,
            currency_code,
            bank_account_id,
            category_id,
            subcategory_id,
            bank_accounts (name),
            categories (name),
            subcategories (name)
        `)
        .eq('user_id', uid)
        .order('occurred_at', { ascending: false });

    const tbody = $("transactions-tbody");
    const empty = $("transactions-empty");
    const msg = $("transactions-msg");

    if (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-4 text-rose-400 text-center">${error.message}</td></tr>`;
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
        tr.className = "hover:bg-slate-800/50 transition-colors";

        // Fecha (formateada simple)
        const dateObj = new Date(r.occurred_at);
        const dateStr = dateObj.toLocaleDateString('es-CO', { timeZone: 'UTC' }); // Ajustar según necesidad

        tr.appendChild(createElement('td', 'px-6 py-4 whitespace-nowrap', dateStr));
        tr.appendChild(createElement('td', 'px-6 py-4', r.description || '—'));
        tr.appendChild(createElement('td', 'px-6 py-4', r.bank_accounts?.name || '—'));
        tr.appendChild(createElement('td', 'px-6 py-4', r.categories?.name || '—'));
        tr.appendChild(createElement('td', 'px-6 py-4', r.subcategories?.name || '—'));
        tr.appendChild(createElement('td', 'px-6 py-4', r.currency_code));

        // Valor formateado
        const amountStr = new Intl.NumberFormat('es-CO', { style: 'currency', currency: r.currency_code }).format(r.amount);
        const tdAmount = createElement('td', 'px-6 py-4 text-right font-medium', amountStr);
        // Opcional: color si es ingreso/gasto (asumiendo que amount negativo es gasto, o por categoría)
        // Por ahora simple.
        tr.appendChild(tdAmount);

        // Acciones
        const tdActions = createElement('td', 'px-6 py-4 text-right whitespace-nowrap');

        const btnEdit = createElement('button', 'text-indigo-400 hover:text-indigo-300 mr-3 transition-colors', 'Editar');
        btnEdit.setAttribute('data-tx-edit', r.id);

        const btnDel = createElement('button', 'text-rose-400 hover:text-rose-300 transition-colors', 'Borrar');
        btnDel.setAttribute('data-tx-del', r.id);

        tdActions.appendChild(btnEdit);
        tdActions.appendChild(btnDel);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
    });

    if (msg) msg.textContent = '';
}

// ---------- Modal Crear/Editar Transacción ----------
function toggleTxModal(show) {
    const m = $("transaction-modal");
    if (!m) return;
    m.classList.toggle('hidden', !show);
    if (!show) {
        // Limpiar form al cerrar si se desea, o dejarlo
    }
}

function setTxError(el, show) { el?.classList.toggle('hidden', !show); }

function fillTxForm(t = {}) {
    $("tx-id").value = t.id || '';
    $("tx-date").value = t.occurred_at ? t.occurred_at.split('T')[0] : new Date().toISOString().split('T')[0];
    $("tx-desc").value = t.description || '';
    $("tx-account").value = t.bank_account_id || '';
    $("tx-currency").value = t.currency_code || 'COP'; // Default
    $("tx-amount").value = t.amount !== undefined ? t.amount : '';

    // Categoría y Subcategoría
    $("tx-category").value = t.category_id || '';
    updateSubcategorySelect(t.category_id, t.subcategory_id);

    $("txmodal-title").textContent = t.id ? 'Editar transacción' : 'Agregar transacción';
    $("txmodal-msg").textContent = '';

    // Reset errores
    ['date', 'account', 'category', 'currency', 'amount'].forEach(f => setTxError($(`err-tx-${f}`), false));
}

function bindTxModal() {
    $("btn-new-transaction")?.addEventListener('click', () => {
        fillTxForm();
        toggleTxModal(true);
    });

    document.querySelectorAll('[data-close-txmodal]').forEach(el =>
        el.addEventListener('click', () => toggleTxModal(false))
    );

    $("transaction-form")?.addEventListener('submit', upsertTransaction);
}

// ---------- Acciones CRUD ----------
async function upsertTransaction(e) {
    e.preventDefault();
    const session = await supabase.auth.getSession();
    const uid = session.data.session?.user?.id;
    if (!uid) return;

    const id = $("tx-id").value || undefined;
    const occurred_at = $("tx-date").value;
    const description = $("tx-desc").value.trim() || null;
    const bank_account_id = $("tx-account").value;
    const category_id = $("tx-category").value;
    const subcategory_id = $("tx-subcategory").value || null;
    const currency_code = $("tx-currency").value;
    const amountRaw = $("tx-amount").value;

    // Validaciones
    let valid = true;
    ['date', 'account', 'category', 'currency', 'amount'].forEach(f => setTxError($(`err-tx-${f}`), false));

    if (!occurred_at) { setTxError($("err-tx-date"), true); valid = false; }
    if (!bank_account_id) { setTxError($("err-tx-account"), true); valid = false; }
    if (!category_id) { setTxError($("err-tx-category"), true); valid = false; }
    if (!currency_code) { setTxError($("err-tx-currency"), true); valid = false; }

    if (!amountRaw || Number(amountRaw) < 0) {
        setTxError($("err-tx-amount"), true);
        valid = false;
    }

    if (!valid) return;

    const amount = Number(amountRaw);

    const payload = {
        id,
        user_id: uid,
        occurred_at, // Supabase acepta YYYY-MM-DD para timestamptz (asume 00:00 UTC o local según config, pero ok)
        description,
        bank_account_id,
        category_id,
        subcategory_id,
        currency_code,
        amount
    };

    const { error } = await supabase.from('transactions').upsert(payload).select('id').single();

    if (error) {
        $("txmodal-msg").textContent = error.message;
        $("txmodal-msg").className = "md:col-span-2 text-sm text-center text-rose-400 mt-2";
    } else {
        $("txmodal-msg").textContent = 'Guardado exitosamente';
        $("txmodal-msg").className = "md:col-span-2 text-sm text-center text-emerald-400 mt-2";
        await loadTransactions(uid);
        setTimeout(() => toggleTxModal(false), 500);
    }
}

async function onTxTableClick(e) {
    const editBtn = e.target.closest('[data-tx-edit]');
    const delBtn = e.target.closest('[data-tx-del]');

    if (editBtn) {
        const id = editBtn.getAttribute('data-tx-edit');
        const { data, error } = await supabase.from('transactions').select('*').eq('id', id).single();
        if (error) return alert(error.message);
        fillTxForm(data);
        toggleTxModal(true);
        return;
    }

    if (delBtn) {
        const id = delBtn.getAttribute('data-tx-del');
        if (!confirm('¿Estás seguro de borrar esta transacción?')) return;

        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) return alert(error.message);

        const session = await supabase.auth.getSession();
        if (session.data.session?.user?.id) {
            loadTransactions(session.data.session.user.id);
        }
    }
}

function bindTxTable() {
    $("transactions-tbody")?.addEventListener('click', onTxTableClick);
}

// ---------- Init ----------
async function initTransactions() {
    const session = await requireSessionOrRedirect();
    if (!session) return;
    const user = session.user;

    // Header usuario
    let displayName = await fetchProfileFullName(user.id);
    if (!displayName) displayName = user.user_metadata?.full_name || guessNameFromEmail(user.email);
    const nameHeaderEl = $("user-name-header");
    if (nameHeaderEl) nameHeaderEl.textContent = displayName || "Usuario";

    setupUserMenu();
    $("btn-logout")?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = "/index.html";
    });
    supabase.auth.onAuthStateChange((event, s) => {
        if (event === 'SIGNED_OUT' || !s) window.location.href = "/index.html";
    });

    // Cargar datos
    await Promise.all([
        loadBankAccounts(user.id),
        loadCategories(),
        loadSubcategories(user.id),
        loadCurrencies()
    ]);

    bindCategoryChange();
    bindTxModal();
    bindTxTable();

    await loadTransactions(user.id);
}

initTransactions();
