/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Deep cool ink — these are Home Assistant sites, so the palette is
        // built around HA's own cyan rather than a generic dashboard blue.
        bg:   { DEFAULT: '#070A10', soft: '#0D131E', card: '#111A28', raised: '#16212F' },
        line: { DEFAULT: '#1C2635', bright: '#2B3A4F' },
        brand:{ DEFAULT: '#03A9F4', dark: '#0288D1', dim: '#0B6E9A' },
        live: '#22C55E',
        down: '#FB7185',
        warn: '#FBBF24',
        idle: '#64748B',
      },
      fontFamily: {
        sans:    ['"Space Grotesk"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.8)',
        lift:  '0 12px 32px -12px rgba(3,169,244,0.25)',
      },
      keyframes: {
        pulseRing: {
          '0%':   { boxShadow: '0 0 0 0 rgba(34,197,94,0.45)' },
          '70%':  { boxShadow: '0 0 0 6px rgba(34,197,94,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(34,197,94,0)' },
        },
        riseIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 2.4s ease-out infinite',
        riseIn: 'riseIn .35s cubic-bezier(.2,.7,.3,1) both',
      },
    },
  },
  plugins: [],
};
