// ============================ /js/account.js ============================
// Protección de ruta y menú de usuario para account.html
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


function setupUserMenu() {
  const btn = $("user-menu-button");
  const menu = $("user-menu");
  if (!btn || !menu) return;
  const toggle = () => menu.classList.toggle('hidden');
  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  document.addEventListener('click', () => menu.classList.add('hidden'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.classList.add('hidden'); });
}


async function initAccountPage() {
  const session = await requireSessionOrRedirect();
  if (!session) return;
  const user = session.user;
  const displayName = user.user_metadata?.full_name || guessNameFromEmail(user.email);
  const nameHeaderEl = $("user-name-header");
  if (nameHeaderEl) nameHeaderEl.textContent = displayName || "Usuario";


  setupUserMenu();


  $("btn-logout")?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html"; // Home tras cerrar sesión
  });


  supabase.auth.onAuthStateChange((event, s) => {
    if (event === 'SIGNED_OUT' || !s) {
      window.location.href = "/index.html";
    }
  });
}


initAccountPage();
