// Cliente compartido desde /js/supabaseClient.js
const supabase = window.sb;
const $ = (id) => document.getElementById(id);

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

async function fetchProfileFirstName(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('first_name')
            .eq('id', userId)
            .single();
        if (error) return null;
        return data?.first_name || null;
    } catch (e) { return null; }
}

function setupUserMenu() {
    const btn = $("user-menu-button");
    const menu = $("user-menu");
    if (!btn || !menu) return;
    const toggle = () => menu.classList.toggle('hidden');
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    // Cerrar al hacer click fuera
    document.addEventListener('click', () => menu.classList.add('hidden'));
    // Cerrar con Escape
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.classList.add('hidden'); });
}

async function initDashboard() {
    const session = await requireSessionOrRedirect();
    if (!session) return;
    const user = session.user;

    // 1. Prioridad: Nombre del perfil
    let displayName = await fetchProfileFirstName(user.id);

    // 2. Fallback: Nombre derivado del email
    if (!displayName) {
        displayName = guessNameFromEmail(user.email);
    }

    const nameHeaderEl = $("user-name-header");
    const nameGreetingEl = $("user-name-greeting");

    // Actualizar DOM
    if (nameHeaderEl) nameHeaderEl.textContent = displayName;
    if (nameGreetingEl) nameGreetingEl.textContent = displayName;

    // 3. Setup UI (User Menu & Logout)
    setupUserMenu();

    $("btn-logout")?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = "/index.html"; // al home de Equilibra
    });

    supabase.auth.onAuthStateChange((event, s) => {
        if (event === 'SIGNED_OUT' || !s) {
            window.location.href = "/index.html"; // home tras cerrar sesión
        }
    });

    // 4. Cargar Resumen Financiero
    await loadFinancialSummary(user.id);
}

async function loadFinancialSummary(userId) {
    const widgetsContainer = $("dashboard-financial-widgets");
    const monthLabel = $("dashboard-month");

    // Fecha actual
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Actualizar label: "Resumen Diciembre 2025"
    const monthName = now.toLocaleString('es-CO', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    if (monthLabel) monthLabel.textContent = `Resumen ${capitalizedMonth} ${currentYear}`;

    // Rango de fechas (Mes actual completo UTC)
    const start = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString();
    const end = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)).toISOString();

    // Fetch transactions
    const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
            amount,
            currency_code,
            categories (
                category_types (operation_factor)
            )
        `)
        .eq('user_id', userId)
        .gte('occurred_at', start)
        .lte('occurred_at', end);

    if (error) {
        if (widgetsContainer) widgetsContainer.innerHTML = `<p class="text-rose-500 text-sm">Error cargando datos</p>`;
        return;
    }

    if (!transactions || transactions.length === 0) {
        if (widgetsContainer) widgetsContainer.innerHTML = `<p class="text-slate-400 text-sm text-center py-4">No hay movimientos este mes.</p>`;
        return;
    }

    // Agrupar por moneda
    const totalsByCurrency = {};

    transactions.forEach(tx => {
        const currency = tx.currency_code || 'COP';
        const amount = Number(tx.amount) || 0;
        const factor = tx.categories?.category_types?.operation_factor || 0;

        if (!totalsByCurrency[currency]) {
            totalsByCurrency[currency] = { income: 0, expense: 0 };
        }

        if (factor > 0) {
            totalsByCurrency[currency].income += amount;
        } else if (factor < 0) {
            totalsByCurrency[currency].expense += amount;
        }
    });

    // Renderizar Widgets por Moneda
    if (widgetsContainer) {
        widgetsContainer.innerHTML = ''; // Limpiar loader

        Object.keys(totalsByCurrency).sort().forEach(currency => {
            const { income, expense } = totalsByCurrency[currency];

            // Formateadores
            const fmt = new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: currency,
                maximumFractionDigits: 0
            });

            const incomeStr = fmt.format(income);
            const expenseStr = fmt.format(expense);

            // Crear Bloque HTML
            const widgetHtml = `
                <div class="border-t first:border-t-0 border-slate-100 pt-3 mt-3 first:pt-0 first:mt-0">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">${currency}</p>
                    <div class="grid grid-cols-2 gap-3 text-sm">
                        <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <p class="text-slate-500 text-xs mb-1">Ingresos</p>
                            <p class="text-emerald-600 text-lg font-semibold truncate" title="${incomeStr}">${incomeStr}</p>
                        </div>
                        <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <p class="text-slate-500 text-xs mb-1">Gastos</p>
                            <p class="text-rose-600 text-lg font-semibold truncate" title="${expenseStr}">${expenseStr}</p>
                        </div>
                    </div>
                </div>
            `;

            // Insertar con seguridad (usando insertAdjacentHTML o innerHTML acumulado)
            // Para simplicidad en string template largo:
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = widgetHtml;
            widgetsContainer.appendChild(tempDiv.firstElementChild);
        });
    }
}

initDashboard();