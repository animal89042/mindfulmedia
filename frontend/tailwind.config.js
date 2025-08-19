/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class",
    content: ["./public/index.html", "./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            colors: {
                brand: {
                    DEFAULT: '#1E40AF',
                },
            },
        },
    },
    plugins: [],
};