/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./*.html",
        "./js/**/*.js",
    ],
    theme: {
        extend: {
            colors: {
                bg: '#f8fafc',      // Slate 50
                card: '#ffffff',    // White
                muted: '#64748b',   // Slate 500
                text: '#1e293b',    // Slate 800
                primary: '#2563eb', // Royal Blue
                accent: '#10b981',  // Emerald 500
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
