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

    // 5. Cargar Gráfico de Balance
    await loadBalanceChart(user.id);

    // 6. Cargar Gráfico Variación
    await loadVariationChartSmallMultiples(user.id);
}

let chartInstance = null; // Variable global para la instancia del gráfico Balance
let variationChartInstance = null; // Variable global para gráfico Variación

// ... (Functions loadBalanceChart and renderChart remain unchanged above) ...

async function loadBalanceChart(userId) {
    const ctx = $("balance-chart")?.getContext('2d');
    const currencySelect = $("chart-currency-select");
    if (!ctx || !currencySelect) return;

    // Calcular rango de 12 meses (incluyendo actual)
    const now = new Date();
    // 11 meses atrás desde el día 1
    const startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 11, 1));
    const endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));

    const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
            amount,
            occurred_at,
            currency_code,
            categories (
                category_types (operation_factor)
            )
        `)
        .eq('user_id', userId)
        .gte('occurred_at', startDate.toISOString())
        .lte('occurred_at', endDate.toISOString())
        .order('occurred_at', { ascending: true });

    if (error) {
        console.error("Error loading chart data", error);
        return;
    }

    // 1. Procesar datos: Agrupar por Moneda -> Mes (YYYY-MM)
    const dataByCurrency = {};

    // Generar labels de los últimos 12 meses para asegurar eje X completo
    const monthsMap = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 11 + i, 1));
        const key = d.toISOString().slice(0, 7); // YYYY-MM
        const label = d.toLocaleString('es-CO', { month: 'short', year: 'numeric', timeZone: 'UTC' });
        monthsMap.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }

    transactions.forEach(tx => {
        const currency = tx.currency_code || 'COP';
        const key = tx.occurred_at.slice(0, 7);
        const amount = Number(tx.amount) || 0;
        const factor = tx.categories?.category_types?.operation_factor || 0;

        if (!dataByCurrency[currency]) dataByCurrency[currency] = {};
        if (!dataByCurrency[currency][key]) dataByCurrency[currency][key] = { income: 0, expense: 0 };

        if (factor > 0) dataByCurrency[currency][key].income += amount;
        else if (factor < 0) dataByCurrency[currency][key].expense += amount;
    });

    // 2. Poblar Selector de Moneda
    const currencies = Object.keys(dataByCurrency).sort();

    if (currencies.length === 0) {
        currencySelect.innerHTML = '<option disabled selected>Sin datos</option>';
        return;
    }

    currencySelect.innerHTML = currencies.map(c => `<option value="${c}">${c}</option>`).join('');

    // Listener cambio de moneda
    currencySelect.addEventListener('change', (e) => {
        renderChart(ctx, e.target.value, dataByCurrency, monthsMap);
    });

    // Renderizar inicial (primera moneda)
    renderChart(ctx, currencies[0], dataByCurrency, monthsMap);
}

function renderChart(ctx, currency, dataByCurrency, monthsMap) {
    // Preparar datasets
    const incomeData = [];
    const expenseData = [];
    const labels = monthsMap.map(m => m.label);

    monthsMap.forEach(m => {
        const record = dataByCurrency[currency]?.[m.key] || { income: 0, expense: 0 };
        incomeData.push(record.income);
        expenseData.push(record.expense);
    });

    // Destruir anterior si existe
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ingresos',
                    data: incomeData,
                    backgroundColor: '#10b981', // emerald-500
                    borderRadius: 4,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                },
                {
                    label: 'Gastos',
                    data: expenseData,
                    backgroundColor: '#f43f5e', // rose-500
                    borderRadius: 4,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, boxWidth: 8 }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('es-CO', {
                                    style: 'currency',
                                    currency: currency,
                                    maximumFractionDigits: 0
                                }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { borderDash: [2, 4], color: '#f1f5f9' },
                    ticks: {
                        callback: function (value) {
                            return new Intl.NumberFormat('es-CO', {
                                style: 'currency',
                                currency: currency,
                                notation: "compact",
                                compactDisplay: "short"
                            }).format(value);
                        }
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

let variationCharts = [];

async function loadVariationChart(userId) {
    const ctx = $("variation-chart")?.getContext('2d');
    const currencySelect = $("variation-currency-select");
    if (!ctx || !currencySelect) return;

    // Calcular fechas
    const now = new Date();

    // Mes actual
    const currentMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const currentMonthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59));

    // Mes anterior
    const prevMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
    const prevMonthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0, 23, 59, 59));

    // Traer datos de AMBOS meses
    const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
            amount,
            occurred_at,
            currency_code,
            categories (name)
        `)
        .eq('user_id', userId)
        .gte('occurred_at', prevMonthStart.toISOString())
        .lte('occurred_at', currentMonthEnd.toISOString());

    if (error) {
        console.error("Error loading variation data", error);
        return;
    }

    // Procesar datos
    // Estructura: { 'COP': { 'Comida': { current: 100, prev: 80 }, ... } }
    const dataByCurrency = {};

    transactions.forEach(tx => {
        const currency = tx.currency_code || 'COP';
        const amount = Number(tx.amount) || 0;
        const catName = tx.categories?.name || 'Otros';
        const date = new Date(tx.occurred_at);

        // Determinar si es mes actual o anterior
        // Comparación simple por string YYYY-MM
        const txMonthStr = tx.occurred_at.slice(0, 7);
        const currentMonthStr = currentMonthStart.toISOString().slice(0, 7);
        const prevMonthStr = prevMonthStart.toISOString().slice(0, 7);

        if (!dataByCurrency[currency]) dataByCurrency[currency] = {};
        if (!dataByCurrency[currency][catName]) dataByCurrency[currency][catName] = { current: 0, prev: 0 };

        if (txMonthStr === currentMonthStr) {
            dataByCurrency[currency][catName].current += amount;
        } else if (txMonthStr === prevMonthStr) {
            dataByCurrency[currency][catName].prev += amount;
        }
    });

    // Poblar Selector
    const currencies = Object.keys(dataByCurrency).sort();
    if (currencies.length === 0) {
        currencySelect.innerHTML = '<option disabled selected>Sin datos</option>';
        return;
    }

    currencySelect.innerHTML = currencies.map(c => `<option value="${c}">${c}</option>`).join('');

    // Listener
    currencySelect.addEventListener('change', (e) => {
        renderVariationChart(ctx, e.target.value, dataByCurrency);
    });

    // Render inicial
    renderVariationChart(ctx, currencies[0], dataByCurrency);
}

function renderSmallMultiples(currency, selectedCats, dataByCurrency, visualMonths) {
    const gridContainer = $("variation-grid");
    gridContainer.innerHTML = '';

    // Destruir charts previos
    variationCharts.forEach(c => c.destroy());
    variationCharts = [];

    const currencyData = dataByCurrency[currency] || {};

    selectedCats.forEach(cat => {
        if (!currencyData[cat]) return;

        const catData = currencyData[cat];
        const percentages = [];
        const colors = [];

        // Calcular variaciones para los 12 meses visuales
        visualMonths.forEach((m, index) => {
            const currentKey = m.key;
            // Key mes anterior: Necesitamos calcularla dinámicamente porque visualMonths[0] necesita su previo.
            const dPrev = new Date(m.obj);
            dPrev.setMonth(dPrev.getMonth() - 1);
            const prevKey = dPrev.toISOString().slice(0, 7);

            const currentVal = Math.abs(catData[currentKey] || 0);
            const prevVal = Math.abs(catData[prevKey] || 0);

            let pct = 0;
            if (prevVal === 0) {
                if (currentVal > 0) pct = 100; // Crecimiento desde 0
                else pct = 0;
            } else {
                pct = ((currentVal - prevVal) / prevVal) * 100;
            }

            percentages.push(pct);

            if (pct > 0) colors.push('#10b981'); // Green
            else if (pct < 0) colors.push('#f43f5e'); // Red
            else colors.push('#cbd5e1'); // Slate 300
        });

        // Crear Elementos DOM
        const card = document.createElement('div');
        card.className = "flex flex-col bg-slate-50 rounded-xl p-4 border border-slate-100";
        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <h3 class="font-semibold text-slate-700 text-sm truncate" title="${cat}">${cat}</h3>
            </div>
            <div class="relative h-24 w-full">
                <canvas></canvas>
            </div>
        `;
        gridContainer.appendChild(card);

        const ctx = card.querySelector('canvas').getContext('2d');

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: visualMonths.map(m => m.label),
                datasets: [{
                    data: percentages,
                    backgroundColor: colors,
                    borderRadius: 2,
                    barPercentage: 0.5,
                    categoryPercentage: 0.8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return `${ctx.parsed.y.toFixed(1)}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        min: -100,
                        max: 100,
                        border: { display: false },
                        grid: { display: true, color: '#e2e8f0', drawTicks: false },
                        ticks: { display: false }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 9 },
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 4
                        }
                    }
                }
            }
        });
        variationCharts.push(chart);
    });
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

async function loadVariationChartSmallMultiples(userId) {
    const gridContainer = $("variation-grid");
    const currencySelect = $("variation-currency-select");
    const filterBtn = $("category-filter-btn");
    const filterMenu = $("category-filter-menu");

    if (!gridContainer || !currencySelect) return;

    // Calcular rango de 13 meses (12 de visualización + 1 previo para cálculo)
    const now = new Date();

    // Mes final (fin del mes actual)
    const endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59));
    // Mes inicial (13 meses atrás del mes actual) -> 12 meses visuales + 1 base
    const startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 12, 1));

    // Fetch data
    const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
            amount,
            occurred_at,
            currency_code,
            categories (name),
            category_types:categories (operation_factor)
        `)
        .eq('user_id', userId)
        .gte('occurred_at', startDate.toISOString())
        .lte('occurred_at', endDate.toISOString())
        .order('occurred_at', { ascending: true });

    if (error) {
        console.error("Error loading variation data", error);
        gridContainer.innerHTML = '<p class="text-rose-500 col-span-full text-center">Error cargando datos</p>';
        return;
    }

    if (!transactions || transactions.length === 0) {
        gridContainer.innerHTML = '<p class="text-slate-400 col-span-full text-center">No hay datos suficientes para mostrar variaciones.</p>';
        currencySelect.innerHTML = '<option disabled selected>Sin datos</option>';
        return;
    }

    // --- Procesamiento de Datos ---
    const visualMonths = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth() + 1 + i, 1));
        const key = d.toISOString().slice(0, 7); // YYYY-MM
        const label = d.toLocaleString('es-CO', { month: 'short', year: 'numeric', timeZone: 'UTC' });
        const formattedLabel = label.charAt(0).toUpperCase() + label.slice(1);
        visualMonths.push({ key, label: formattedLabel, obj: d });
    }

    const dataByCurrency = {};
    const allCategories = new Set();

    transactions.forEach(tx => {
        const currency = tx.currency_code || 'COP';
        const catName = tx.categories?.name || 'Otros';
        const monthKey = tx.occurred_at.slice(0, 7);
        const amount = Number(tx.amount) || 0;

        allCategories.add(catName);

        if (!dataByCurrency[currency]) dataByCurrency[currency] = {};
        if (!dataByCurrency[currency][catName]) dataByCurrency[currency][catName] = {};

        if (!dataByCurrency[currency][catName][monthKey]) dataByCurrency[currency][catName][monthKey] = 0;
        dataByCurrency[currency][catName][monthKey] += amount;
    });

    const currencies = Object.keys(dataByCurrency).sort();
    currencySelect.innerHTML = currencies.map(c => `<option value="${c}">${c}</option>`).join('');

    const sortedCategories = Array.from(allCategories).sort();
    filterMenu.innerHTML = sortedCategories.map(cat => `
        <label class="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
            <input type="checkbox" value="${cat}" checked class="form-checkbox h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 category-checkbox">
            <span class="text-sm text-slate-700">${cat}</span>
        </label>
    `).join('');

    filterBtn.onclick = (e) => {
        e.stopPropagation();
        filterMenu.classList.toggle('hidden');
    };
    document.addEventListener('click', () => filterMenu.classList.add('hidden'));
    filterMenu.addEventListener('click', (e) => e.stopPropagation());

    currencySelect.addEventListener('change', () => updateGrid());

    const checkboxes = filterMenu.querySelectorAll('.category-checkbox');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => updateGrid());
    });

    function updateGrid() {
        const selectedCurrency = currencySelect.value;
        const selectedCats = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);

        renderSmallMultiples(selectedCurrency, selectedCats, dataByCurrency, visualMonths);
    }

    updateGrid();
}

initDashboard();