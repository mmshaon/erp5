/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base:    '#020d14',
        surface: '#041520',
        card:    '#061d2a',
        border:  '#0a2d42',
        cyan:    { DEFAULT: '#00d4ff', dark: '#0099bb' },
        success: '#00e5a0',
        warning: '#f0b429',
        error:   '#ff4757',
        muted:   '#4a7a94',
        text:    { DEFAULT: '#e8f4f8', muted: '#7ab3c8' },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        mono:    ['IBM Plex Mono', 'monospace'],
        body:    ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
