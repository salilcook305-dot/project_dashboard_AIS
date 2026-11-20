/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0B1F5C',
          royal: '#1565C0',
          bright: '#1E7BE0',
          sky: '#2AA0F0',
          gold: '#D4921A',
          light: '#F2F6FC',
          surface: '#F8FAFC',
        },
        avail: {
          available: '#2E7D32',
          busy: '#1E7BE0',
          heavy: '#D4921A',
          overloaded: '#C62828',
          leave: '#6B7A99',
        }
      },
    },
  },
  plugins: [],
}
