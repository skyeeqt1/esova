// tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand primary — violet (distinctive, premium feel)
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
        },
        // Brand accent — amber/gold (winners, achievements, official)
        accent: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        // Layered midnight surfaces (base → raised)
        surface: {
          950: '#06090f',
          900: '#0a0f1a',
          850: '#101627',
          800: '#161d33',
          750: '#1d2544',
          700: '#242d50',
        },
      },
      fontFamily: {
        mono: ['monospace'],
      },
      letterSpacing: {
        eyebrow: '0.16em',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 32px -20px rgba(0,0,0,0.7)',
        'glow-primary': '0 8px 24px -8px rgba(139,92,246,0.55)',
        'glow-accent': '0 8px 24px -8px rgba(251,191,36,0.4)',
        'glow-rose': '0 8px 24px -8px rgba(244,63,94,0.45)',
      },
    },
  },
  plugins: [],
};
