/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        goldkit: {
          bg: '#1a1a1a',
          surface: '#242424',
          border: '#333333',
          gold: '#c9a227',
          'gold-light': '#e0bc4a',
          muted: '#9ca3af',
        },
      },
      backgroundImage: {
        prism: 'linear-gradient(135deg, #c9a227 0%, #e85d4c 25%, #9b59b6 50%, #3498db 75%, #2ecc71 100%)',
      },
    },
  },
  plugins: [],
}
