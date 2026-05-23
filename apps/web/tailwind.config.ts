import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  // Phase 7.5 — opt-in dark mode controlled by a `dark` class on <html>.
  // The class is set synchronously by the head script in app/layout.tsx so
  // there's no flash of the wrong theme on initial paint.
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Vazirmatn for Persian/Arabic, falls back to system Persian-friendly fonts,
        // then to generic sans. See globals.css for the @font-face declarations.
        sans: [
          'Vazirmatn',
          'IRANSans',
          'Tahoma',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe7ff',
          200: '#bdd2ff',
          300: '#90b3ff',
          400: '#5e89ff',
          500: '#3b66ff',
          600: '#2547f5',
          700: '#1d36dc',
          800: '#1e30b1',
          900: '#1f2f8b',
        },
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
    },
  },
  plugins: [],
};

export default config;
