
// Cliente compartido desde /js/supabaseClient.js
const supabase = window.sb;

// Authentication check
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/login.html';
        return null;
    }
    return session;
}

// Load profile data
async function loadProfile(session) {
    if (!session || !session.user) return;

    const user = session.user;

    // Set email (from auth user)
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.value = user.email;
    }

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('first_name, last_name, gender, birth_date')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "The result contains 0 rows" which might happen if profile doesn't exist yet
            console.error('Error fetching profile:', error);
            // alert('Error al cargar el perfil');
        }

        if (data) {
            document.getElementById('first_name').value = data.first_name || '';
            document.getElementById('last_name').value = data.last_name || '';
            document.getElementById('gender').value = data.gender || '';
            document.getElementById('birthdate').value = data.birth_date || ''; // ID of input remains 'birthdate'
        }

        // Update header user name
        const userNameHeader = document.getElementById('user-name-header');
        if (userNameHeader) {
            userNameHeader.textContent = data?.first_name || user.email;
        }

    } catch (err) {
        console.error('Unexpected error loading profile:', err);
    }
}

// Update profile data
async function updateProfile(event, session) {
    event.preventDefault();

    if (!session || !session.user) return;

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Guardando...';
    submitBtn.disabled = true;

    const updates = {
        id: session.user.id,
        first_name: document.getElementById('first_name').value,
        last_name: document.getElementById('last_name').value,
        gender: document.getElementById('gender').value,
        birth_date: document.getElementById('birthdate').value || null, // Handle empty date
        updated_at: new Date(),
    };

    try {
        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', session.user.id);

        if (error) {
            throw error;
        }

        alert('Perfil actualizado correctamente');

        // Update header name immediately if changed
        const userNameHeader = document.getElementById('user-name-header');
        if (userNameHeader && updates.first_name) {
            userNameHeader.textContent = updates.first_name;
        }

    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error al actualizar el perfil: ' + error.message);
    } finally {
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
    }
}

// Menu handling (reused from other pages mostly, but keeping it self-contained or we could import a shared ui.js if it existed)
function setupMenu() {
    const btn = document.getElementById('user-menu-button');
    const menu = document.getElementById('user-menu');
    const btnLogout = document.getElementById('btn-logout');

    if (btn && menu) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!btn.contains(e.target) && !menu.contains(e.target)) {
                menu.classList.add('hidden');
            }
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/login.html';
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const session = await checkAuth();
    if (session) {
        setupMenu();
        await loadProfile(session);

        const form = document.getElementById('profile-form');
        if (form) {
            form.addEventListener('submit', (e) => updateProfile(e, session));
        }
    }
});
