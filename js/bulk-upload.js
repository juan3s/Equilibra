export function initBulkUpload(supabase, { accounts, currencies, categories }) {
    const $ = (id) => document.getElementById(id);
    const modal = $("bulk-upload-modal");
    const form = $("bulk-upload-form");
    const msg = $("bulk-msg");
    const btnOpen = $("btn-bulk-upload");
    const spinner = $("bulk-loading-spinner");

    // Dropdown logic for the main button
    const btnOptions = $("btn-new-options");
    const dropdown = $("dropdown-new-options");

    if (btnOptions && dropdown) {
        btnOptions.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.classList.contains('hidden') && !btnOptions.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }

    // Modal Logic
    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            dropdown.classList.add('hidden'); // Close dropdown
            openBulkModal();
        });
    }

    document.querySelectorAll('[data-close-bulkmodal]').forEach(el =>
        el.addEventListener('click', closeBulkModal)
    );

    function openBulkModal() {
        // Populate Selects
        const accSel = $("bulk-account");
        const currSel = $("bulk-currency");

        if (accSel) {
            accSel.innerHTML = '<option value="" disabled selected>Selecciona una cuenta…</option>' +
                accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
        }

        if (currSel) {
            currSel.innerHTML = '<option value="" disabled selected>Selecciona moneda…</option>' +
                currencies.map(c => `<option value="${c.code}">${c.code} - ${c.name}</option>`).join('');
            // Default to COP if exists, generic default otherwise
            if (currencies.find(c => c.code === 'COP')) currSel.value = 'COP';
        }

        msg.textContent = '';
        msg.className = "text-sm text-center text-slate-500 hidden pt-2";
        form.reset();
        modal.classList.remove('hidden');
    }

    function closeBulkModal() {
        modal.classList.add('hidden');
    }

    // Form Submit
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = $("bulk-file");
            const accountId = $("bulk-account").value;
            const currency = $("bulk-currency").value;
            
            if (!accountId || !currency || !fileInput.files.length) {
                showMsg("Todos los campos son obligatorios.", "text-rose-500");
                return;
            }

            const file = fileInput.files[0];
            if (file.size > 5 * 1024 * 1024) { // 5MB
                showMsg("El archivo es demasiado grande (max 5MB).", "text-rose-500");
                return;
            }

            // Get "Transferencias internas" category ID or fallback to first one
            const defaultCategory = categories.find(c => c.name === 'Transferencias internas') || categories[0];
            if (!defaultCategory) {
                showMsg("No se encontró una categoría por defecto.", "text-rose-500");
                return;
            }

            setLoading(true);

            // Prepare FormData
            const formData = new FormData();
            formData.append('file', file);
            formData.append('bank_account_id', accountId);
            formData.append('currency_code', currency);
            formData.append('category_id', defaultCategory.id);

            try {
                const { data, error } = await supabase.functions.invoke('process-batch-upload', {
                    body: formData,
                });

                if (error) throw error; // Edge Function invocation error
                
                // Check for logic error returned by function
                if (!data.success) {
                    throw new Error(data.message || 'Error desconocido procesando el archivo.');
                }

                showMsg(`Proceso exitoso. ${data.inserted} transacciones creadas.`, "text-emerald-600");
                setTimeout(() => {
                    closeBulkModal();
                    // Reload transactions list - Custom Event or direct call?
                    // Simpler: Dispatch event on window that transactions.js listens to
                    window.dispatchEvent(new CustomEvent('transactions-updated'));
                }, 2000);

            } catch (err) {
                console.error(err);
                showMsg(err.message || "Error al procesar el archivo.", "text-rose-500");
            } finally {
                setLoading(false);
            }
        });
    }

    function showMsg(text, colorClass) {
        msg.textContent = text;
        msg.className = `text-sm text-center pt-2 ${colorClass}`;
        msg.classList.remove('hidden');
    }

    function setLoading(isLoading) {
        const btn = form.querySelector('button[type="submit"]');
        if (isLoading) {
            btn.disabled = true;
            btn.classList.add('opacity-75', 'cursor-not-allowed');
            spinner.classList.remove('hidden');
        } else {
            btn.disabled = false;
            btn.classList.remove('opacity-75', 'cursor-not-allowed');
            spinner.classList.add('hidden');
        }
    }
}
