// ============================ /js/account.js ============================
// Lógica de la página de cuenta (sin persistencia). Requiere sesión activa.

const supabase = window.sb;

// Helpers
const $ = (id) => document.getElementById(id);

async function requireSessionOrRedirect() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "/login.html";
    return null;
  }
  return session;
}

function nameFromEmail(email) {
  if (!email) return "Usuario";
  const local = email.split("@")[0] || "";
  if (!local) return "Usuario";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function initialsFromEmail(email) {
  if (!email) return "U";
  const base = nameFromEmail(email);
  return base.split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase() || "U";
}

function setupUserMenu(session) {
  const user = session.user;
  const name = nameFromEmail(user.email);
  $("user-name").textContent = name;
  $("user-email").textContent = user.email;
  $("user-initials").textContent = initialsFromEmail(user.email);

  const btn = $("btn-user");
  const dd = $("dropdown");
  function closeOnOutside(e) { if (!dd.contains(e.target) && !btn.contains(e.target)) dd.classList.add("hidden"); }

  btn?.addEventListener("click", () => dd.classList.toggle("hidden"));
  document.addEventListener("click", closeOnOutside);
}

async function init() {
  const session = await requireSessionOrRedirect();
  if (!session) return;

  setupUserMenu(session);

  $("btn-logout")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  });

  supabase.auth.onAuthStateChange((event, s) => {
    if (event === "SIGNED_OUT" || !s) window.location.href = "/index.html";
  });
}

init();
