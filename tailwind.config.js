/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#f0f4fa',
          100: '#dde6f2',
          200: '#baced8',
          300: '#91abca',
          400: '#6285b8',
          500: '#3d64a0',
          600: '#2e4e84',
          700: '#1e3a5f',
          800: '#162c48',
          900: '#0f1e32',
        },
      },
    },
  },
  plugins: [],
}
