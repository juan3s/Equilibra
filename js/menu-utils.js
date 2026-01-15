
const supabase = window.sb;

// --- Helpers ---

function guessNameFromEmail(email) {
    if (!email) return "Usuario";
    const local = email.split("@")[0] || "Usuario";
    return local.charAt(0).toUpperCase() + local.slice(1);
}

async function fetchProfileName(userId) {
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

// --- Menu DOM Injection ---

// Returns the HTML string for the standardized user button and menu
function getUserMenuHTML(displayName) {
    return `
        <div class="relative">
            <button id="user-menu-button"
                class="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-sm text-slate-700 bg-white transition-colors">
                <span id="user-name-header" class="font-medium">${displayName}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-70" viewBox="0 0 20 20"
                    fill="currentColor">
                    <path fill-rule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z"
                        clip-rule="evenodd" />
                </svg>
            </button>
            <div id="user-menu"
                class="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-xl p-1 hidden z-50 origin-top-right transition-all">
                <a href="/dashboard.html"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700 transition-colors">
                    <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                    Dashboard
                </a>
                <a href="/transactions.html"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700 transition-colors">
                    <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Transacciones
                </a>
                <a href="/pockets.html"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700 transition-colors">
                    <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                    Bolsillos
                </a>
                <a href="/account.html"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700 transition-colors">
                    <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    Mis Ajustes
                </a>
                <a href="/profile.html"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700 transition-colors">
                    <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    Perfil
                </a>
                <div class="h-px bg-slate-100 my-1"></div>
                <button id="btn-logout"
                    class="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-rose-50 text-sm text-rose-600 transition-colors text-left">
                    <svg class="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                    Cerrar sesión
                </button>
            </div>
        </div>
    `;
}

function attachMenuListeners() {
    const btn = document.getElementById("user-menu-button");
    const menu = document.getElementById("user-menu");
    const btnLogout = document.getElementById("btn-logout");

    if (!btn || !menu) return;

    const toggle = () => menu.classList.toggle('hidden');

    // Clean up previous listeners if any (simple way is difficult without storing references, 
    // but we usually run this once per page load. If re-running, functionality might duplicate 
    // but toggle logic is usually safe if careful. Ideally, cloneNode to strip listeners, but simpler here just to add)

    btn.onclick = (e) => {
        e.stopPropagation();
        toggle();
    };

    document.onclick = (e) => {
        // If click is outside menu and button, close it
        if (!menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) {
            menu.classList.add('hidden');
        }
    };

    document.onkeydown = (e) => {
        if (e.key === 'Escape') menu.classList.add('hidden');
    };

    if (btnLogout) {
        btnLogout.onclick = async () => {
            await supabase.auth.signOut();
            window.location.href = "/index.html";
        };
    }
}

/**
 * Main function to standardize the menu.
 * @param {Object} options
 * @param {HTMLElement} options.container - The container where to inject the menu (required for replacing index.html login button). If null, attempts to find existing elements to update.
 * @param {boolean} options.redirectIfNoSession - Whether to redirect to login if no session (for protected pages).
 */
export async function setupStandardMenu({ container = null, redirectIfNoSession = false } = {}) {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        if (redirectIfNoSession) {
            window.location.href = "/login.html";
        }
        return null;
    }

    const user = session.user;

    // 1. Determine Display Name
    // Priority: Profile First Name > Email Username
    let displayName = await fetchProfileName(user.id);
    if (!displayName) {
        displayName = guessNameFromEmail(user.email);
    }

    // 2. Render or Update Menu
    // Case A: Container provided (e.g. Index page where we replace "Iniciar Sesión")
    if (container) {
        container.innerHTML = getUserMenuHTML(displayName);
        attachMenuListeners();
    }
    // Case B: Existing header structure (Dashboard, Transactions, Account)
    else {
        // Update Name
        const nameHeaderEl = document.getElementById("user-name-header");
        if (nameHeaderEl) nameHeaderEl.textContent = displayName;

        // Also update greeting if present (Dashboard specific)
        const nameGreetingEl = document.getElementById("user-name-greeting");
        if (nameGreetingEl) nameGreetingEl.textContent = displayName;

        // Re-attach listeners just in case, or ensure they are attached
        // Existing pages might have their own listeners, but we want to standardize.
        // Ideally we should replace the inner HTML of the nav to ensure standard structure,
        // but preserving the existing structure if it matches is also fine.
        // Let's replace the content of the 'nav' or the specific container if we can identify it, 
        // to ensure the dropdown items are standard (icon + text).

        // Let's try to find the parent of #user-menu-button (usually a <nav>)
        const existingBtn = document.getElementById("user-menu-button");
        if (existingBtn) {
            const nav = existingBtn.parentElement; // The <div class="relative"> or <nav>
            if (nav) {
                // Replace the whole button+menu structure with our standard one to ensure icons/styles match
                // modifying the outerHTML or innerHTML of the parent
                nav.innerHTML = getUserMenuHTML(displayName);
                attachMenuListeners();
            }
        }
    }

    // 3. Monitor Auth State
    supabase.auth.onAuthStateChange((event, s) => {
        if (event === 'SIGNED_OUT' || !s) {
            window.location.href = "/index.html";
        }
    });

    return session;
}
