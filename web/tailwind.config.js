/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0B1437',
          800: '#111C44',
          700: '#1A234A',
          600: '#2B3674',
        },
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          500: '#6366F1',
          600: '#4F46E5', // Primary indigo
          700: '#4338CA', // Hover indigo
        },
        page: '#F5F7FB',
        borderSubtle: '#E5E9F2',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(11, 20, 55, 0.04), 0 1px 2px rgba(11, 20, 55, 0.02)',
        elevated: '0 10px 30px rgba(11, 20, 55, 0.08), 0 2px 6px rgba(11, 20, 55, 0.04)',
      }
    },
  },
  plugins: [],
}
