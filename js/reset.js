// ============================ /js/reset.js ============================
// Lógica separada para la página reset.html

// Usa el singleton creado en supabaseClient.js
const supabase = window.sb;

const $r = (id) => document.getElementById(id);
const msg = (t, cls = 'text-slate-600') => { const el = $r('msg'); if (!el) return; el.className = `text-sm mt-2 ${cls}`; el.textContent = t; };

function parseHashParams() {
    const h = new URLSearchParams(window.location.hash.replace('#', ''));
    return {
        access_token: h.get('access_token'),
        refresh_token: h.get('refresh_token'),
        type: h.get('type')
    };
}

async function ensureSessionFromHash() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session;
    const { access_token, refresh_token, type } = parseHashParams();
    if (type === 'recovery' && access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) console.error('setSession error:', error);
        return data?.session || null;
    }
    return null;
}

(async function initReset() {
    const session = await ensureSessionFromHash();
    if (!session) {
        msg('Enlace inválido o caducado. Vuelve a solicitar el restablecimiento.', 'text-rose-600');
    }
})();

$r('form-new-pass')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = $r('new-pass').value;
    const p2 = $r('confirm-pass').value;
    if (p1 !== p2) return msg('Las contraseñas no coinciden.', 'text-amber-600');
    msg('Actualizando contraseña…');
    const { data, error } = await supabase.auth.updateUser({ password: p1 });
    if (error) return msg(error.message, 'text-rose-600');
    msg('¡Contraseña actualizada! Ya puedes volver a iniciar sesión.', 'text-emerald-600');
    setTimeout(() => (window.location.href = "/login.html"), 800);
});