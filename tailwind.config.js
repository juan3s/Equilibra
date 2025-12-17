/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./*.html",
        "./js/**/*.js",
    ],
    theme: {
        extend: {
            colors: {
                bg: '#0f172a',
                card: '#0b1220',
                muted: '#94a3b8',
                text: '#e5e7eb',
                primary: '#4f46e5',
                accent: '#10b981',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
