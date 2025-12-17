import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                login: resolve(__dirname, 'login.html'),
                dashboard: resolve(__dirname, 'dashboard.html'),
                account: resolve(__dirname, 'account.html'),
                reset: resolve(__dirname, 'reset.html'),
                transactions: resolve(__dirname, 'transactions.html'),
            },
        },
    },
});
