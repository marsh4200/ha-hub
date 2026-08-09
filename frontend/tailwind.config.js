/** @type {import('tailwindcss').Config} */

/**
 * HA-Hub design tokens.
 *
 * The product is a control room for a fleet of Home Assistant sites, so the
 * palette is built as an elevation ladder in a single cool hue rather than a
 * set of unrelated greys. Surfaces get lighter as they come forward; borders
 * do the separating, shadows only appear on things that genuinely float.
 *
 * Legacy names (bg / bg-soft / bg-card / bg-raised / line-bright / live) are
 * kept as aliases so no surface is left unstyled during the migration.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Elevation ladder ─────────────────────────────────────────── */
        ink:     '#05080E', // app chrome — sidebar, deepest wells
        canvas:  '#0A1018', // page background
        panel:   '#101823', // resting card
        raised:  '#16202D', // inputs, hover, nested wells
        float:   '#1B2634', // dialogs, popovers, sticky bars

        /* Legacy aliases — same ladder, old names */
        bg: { DEFAULT: '#0A1018', soft: '#0D141E', card: '#101823', raised: '#16202D' },

        line: {
          DEFAULT: '#1D2836', // hairline between related things
          strong:  '#2A3747', // emphasised / hover border
          bright:  '#2A3747', // legacy alias
        },

        /* ── Brand: Home Assistant cyan, tuned for a dark UI ───────────── */
        brand: {
          DEFAULT: '#38BDF8',
          dark:    '#0EA5E9',
          dim:     '#0284C7',
          deep:    '#075985',
          ink:     '#0A1C28', // tinted fill behind cyan text
        },

        /* ── Status: one meaning each, never decorative ────────────────── */
        live: '#34D399', // healthy / online
        down: '#FB7185', // offline / error
        warn: '#FBBF24', // action required
        idle: '#64748B', // unknown / inactive
        ok:   '#34D399',

        /* ── Foreground ramp ──────────────────────────────────────────── */
        fg: {
          DEFAULT: '#E4EBF4', // primary reading text
          muted:   '#96A5B9', // supporting copy
          faint:   '#6B7C92', // metadata
          ghost:   '#4A5A6E', // decorative icons, disabled
        },
      },

      /**
       * Tailwind's `/xx` modifier resolves against this scale, and `@apply`
       * rejects any step that is not in it. The tints below are the ones the
       * surface ladder actually uses — mostly very low values, because a tinted
       * fill on a dark UI reads far stronger than the same number would on white.
       */
      opacity: {
        4: '0.04', 6: '0.06', 8: '0.08', 12: '0.12', 15: '0.15',
        35: '0.35', 45: '0.45', 55: '0.55', 65: '0.65', 85: '0.85',
      },

      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        '3xs': ['0.625rem',  { lineHeight: '0.875rem', letterSpacing: '0.02em' }],
      },

      boxShadow: {
        /* e1 — a resting card. Top highlight does the lifting, not a drop shadow. */
        e1: '0 1px 0 0 rgba(255,255,255,0.035) inset, 0 1px 2px 0 rgba(0,0,0,0.4)',
        /* e2 — something deliberately above the page: sticky bars, popovers. */
        e2: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.85)',
        /* e3 — modal. The only place a heavy shadow is earned. */
        e3: '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 32px 64px -24px rgba(0,0,0,0.9)',
        focus: '0 0 0 2px #0A1018, 0 0 0 4px rgba(56,189,248,0.55)',
      },

      keyframes: {
        riseIn:   { from: { opacity: '0', transform: 'translateY(6px)' },  to: { opacity: '1', transform: 'none' } },
        fadeIn:   { from: { opacity: '0' }, to: { opacity: '1' } },
        scaleIn:  { from: { opacity: '0', transform: 'translateY(8px) scale(.985)' }, to: { opacity: '1', transform: 'none' } },
        sheetUp:  { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        shimmer:  { '100%': { transform: 'translateX(100%)' } },
        pulseRing:{
          '0%':   { boxShadow: '0 0 0 0 rgba(52,211,153,0.5)' },
          '70%':  { boxShadow: '0 0 0 5px rgba(52,211,153,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(52,211,153,0)' },
        },
      },
      animation: {
        riseIn:  'riseIn .3s cubic-bezier(.2,.7,.3,1) both',
        fadeIn:  'fadeIn .18s ease-out both',
        scaleIn: 'scaleIn .2s cubic-bezier(.2,.7,.3,1) both',
        sheetUp: 'sheetUp .26s cubic-bezier(.2,.7,.3,1) both',
        pulseRing: 'pulseRing 2.4s ease-out infinite',
      },

      transitionTimingFunction: {
        snap: 'cubic-bezier(.2,.7,.3,1)',
      },
    },
  },
  plugins: [],
};
