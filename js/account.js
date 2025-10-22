// ============================ /js/account.js ============================
// Lógica de la página Mis Ajustes (sin persistencia); requiere sesión.

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
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function setupUserMenu() {
  const btn = $("user-menu-button");
  const menu = $("user-menu");
  btn?.addEventListener("click", (e) => {
    e.stopPropagation();
    menu?.classList.toggle("hidden");
  });
  document.addEventListener("click", () => menu?.classList.add("hidden"));
}

async function initAccount() {
  const session = await requireSessionOrRedirect();
  if (!session) return;

  const email = session.user?.email;
  $("user-name-header").textContent = guessNameFromEmail(email || "");

  setupUserMenu();

  $("btn-logout")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  });

  supabase.auth.onAuthStateChange((event, s) => {
    if (event === "SIGNED_OUT" || !s) {
      window.location.href = "/index.html";
    }
  });
}

initAccount();
