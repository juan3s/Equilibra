// ============================ /js/auth.js ============================
// Lógica separada para el manejo de autenticación

// Usa el singleton creado en supabaseClient.js
const supabase = window.sb;

// Helpers UI
const $ = (id) => document.getElementById(id);
const toggle = (el, show) => el.classList.toggle('hidden', !show);
const toast = (msg, type = 'info') => {
    const t = $("toast");
    const styles = { info: "text-slate-600", ok: "text-emerald-600", warn: "text-amber-600", err: "text-rose-600" };
    if (!t) return;
    t.className = `mt-4 text-sm ${styles[type] || styles.info}`;
    t.textContent = msg;
};

//const authPanels = $("auth-panels");
//const appPanel = $("app");
const userEmail = $("user-email");

// Navegación simple entre paneles (solo si existen en la página)
$("go-signup")?.addEventListener('click', (e) => { e.preventDefault(); toggle($("form-signin"), false); toggle($("form-reset"), false); toggle($("form-signup"), true); });
$("go-signin")?.addEventListener('click', (e) => { e.preventDefault(); toggle($("form-signin"), true); toggle($("form-reset"), false); toggle($("form-signup"), false); });
$("btn-forgot")?.addEventListener('click', () => { toggle($("form-signin"), false); toggle($("form-reset"), true); toggle($("form-signup"), false); });
$("go-back-login")?.addEventListener('click', (e) => { e.preventDefault(); toggle($("form-signin"), true); toggle($("form-reset"), false); toggle($("form-signup"), false); });

// Sign In
$("form-signin")?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $("si-email").value.trim();
    const password = $("si-password").value;
    toast("Entrando…");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return toast(error.message, 'err');
    toast('¡Bienvenido!', 'ok');
    window.location.href = "/dashboard.html";
});

// Sign Up
$("form-signup")?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $("su-email").value.trim();
    const password = $("su-password").value;
    toast("Creando cuenta…");
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/reset.html` }
    });
    if (error) return toast(error.message, 'err');
    toast('Revisa tu correo para confirmar/restablecer.', 'ok');
    toggle($("form-signin"), true); toggle($("form-signup"), false);
});

// Reset password (envía email con enlace a reset.html)
$("form-reset")?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $("re-email").value.trim();
    toast("Enviando enlace de restablecimiento…");
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset.html` });
    if (error) return toast(error.message, 'err');
    toast('Si el email existe, se ha enviado un enlace para restablecer.', 'ok');
});

// Sign Out
$("btn-signout")?.addEventListener('click', async () => {
    await supabase.auth.signOut();
});

// Cambios de sesión
supabase.auth.onAuthStateChange(async (event, session) => {
    const logged = !!session;
    //if (authPanels) toggle(authPanels, !logged);
    //if (appPanel) toggle(appPanel, logged);
    if (userEmail) userEmail.textContent = logged ? (session.user?.email || 'Usuario') : '—';

    if (event === 'PASSWORD_RECOVERY') {
        toast('Abre el enlace desde tu email para restablecer la contraseña.', 'warn');
    }

    if (event === "SIGNED_IN" && session) {
        window.location.href = "/dashboard.html"; // ← cualquier inicio de sesión
    }
});

// Chequear sesión al cargar (solo en index)
(async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.href = "/dashboard.html"; // ← evita quedarse en login
        return;
    }
    const logged = !!session;
    //if (authPanels) toggle(authPanels, !logged);
    //if (appPanel) toggle(appPanel, logged);
    if (userEmail && logged) userEmail.textContent = session.user?.email || 'Usuario';
})();