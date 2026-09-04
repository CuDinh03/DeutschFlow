import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand Colors
        'brand-black': {
          DEFAULT: 'var(--brand-black)',
          dark: 'var(--brand-black-dark)',
          light: 'var(--brand-black-light)',
        },
        'brand-yellow': {
          DEFAULT: 'var(--brand-yellow)',
          dark: 'var(--brand-yellow-dark)',
          light: 'var(--brand-yellow-light)',
        },
        'brand-red': {
          DEFAULT: 'var(--brand-red)',
          dark: 'var(--brand-red-dark)',
          light: 'var(--brand-red-light)',
        },
        // Gender Colors
        gender: {
          der: 'var(--gender-der)',
          die: 'var(--gender-die)',
          das: 'var(--gender-das)',
          plural: 'var(--gender-plural)',
        },
        // Semantic Colors
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          hover: 'var(--primary-hover)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
          hover: 'var(--accent-hover)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        success: {
          DEFAULT: 'var(--success)',
          foreground: 'var(--success-foreground)',
        },
        info: {
          DEFAULT: 'var(--info)',
          foreground: 'var(--info-foreground)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          foreground: 'var(--warning-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input-background)',
        ring: 'var(--ring)',
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
        // ── Galerie 2.0 (UI 2.0) — scoped to `.ga-scope`; vars from src/styles/galerie.css.
        // Additive only. These utilities are inert outside `.ga-scope`.
        ga: {
          bg: 'var(--ga-bg)',
          card: 'var(--ga-card)',
          surface: 'var(--ga-surface)',
          line: 'var(--ga-line)',
          'side-active': 'var(--ga-side-active)',
          'slate-bg': 'var(--ga-slate-bg)',
          ink: 'var(--ga-ink)',
          muted: 'var(--ga-muted)',
          subtle: 'var(--ga-subtle)',
          faint: 'var(--ga-faint)',
          border: 'var(--ga-border)',
          'slate-border': 'var(--ga-slate-border)',
          yellow: 'var(--ga-yellow)',
          'yellow-soft': 'var(--ga-yellow-soft)',
          gold: 'var(--ga-gold)',
          red: 'var(--ga-red)',
          'red-soft': 'var(--ga-red-soft)',
          green: 'var(--ga-green)',
          'green-soft': 'var(--ga-green-soft)',
          blue: 'var(--ga-blue)',
          'blue-soft': 'var(--ga-blue-soft)',
          violet: 'var(--ga-violet)',
          'violet-soft': 'var(--ga-violet-soft)',
          teal: 'var(--ga-teal)',
          'teal-soft': 'var(--ga-teal-soft)',
          orange: 'var(--ga-orange)',
          'orange-soft': 'var(--ga-orange-soft)',
          navy: 'var(--ga-navy)',
          'navy-soft': 'var(--ga-navy-soft)',
          accent: 'var(--ga-accent)',
          'accent-soft': 'var(--ga-accent-soft)',
          'accent-ink': 'var(--ga-accent-ink)',
          // Focus indicator semantic — role-independent (Gate 0: accent student fail 3:1).
          focus: 'var(--ga-focus)',
          // Semantic bổ sung (DS §5.4/§5.7 — approved D1–D8)
          warning: 'var(--ga-warning)',
          'warning-soft': 'var(--ga-warning-soft)',
          overlay: 'var(--ga-overlay)',
          'locked-bg': 'var(--ga-locked-bg)',
          'locked-fg': 'var(--ga-locked-fg)',
          streak: 'var(--ga-streak)',
          xp: 'var(--ga-xp)',
          progress: 'var(--ga-progress)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
        // Galerie 2.0 — 2px editorial + ngoại lệ touch 6px có tên (DS §6.2) + pill.
        ga: 'var(--ga-radius)',
        'ga-touch': 'var(--ga-radius-touch)',
        'ga-pill': '999px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        // Galerie 2.0 — chỉ true elevation (DS §6.4).
        'ga-card-hover': 'var(--ga-shadow-card-hover)',
        'ga-panel': 'var(--ga-shadow-panel)',
        'ga-drawer': 'var(--ga-shadow-drawer)',
        'ga-selected-bar': 'var(--ga-shadow-selected-bar)',
      },
      spacing: {
        xs: 'var(--spacing-xs)',
        sm: 'var(--spacing-sm)',
        md: 'var(--spacing-md)',
        lg: 'var(--spacing-lg)',
        xl: 'var(--spacing-xl)',
        '2xl': 'var(--spacing-2xl)',
        // Galerie 2.0 spacing scale (DS §4) — p-ga-4, gap-ga-5, …
        'ga-1': 'var(--ga-space-1)',
        'ga-2': 'var(--ga-space-2)',
        'ga-3': 'var(--ga-space-3)',
        'ga-4': 'var(--ga-space-4)',
        'ga-5': 'var(--ga-space-5)',
        'ga-6': 'var(--ga-space-6)',
        'ga-7': 'var(--ga-space-7)',
        'ga-8': 'var(--ga-space-8)',
        'ga-9': 'var(--ga-space-9)',
        'ga-10': 'var(--ga-space-10)',
      },
      // Galerie 2.0 semantic type ramp (DS §3.1, approved D7). Dùng `text-ga-*` thay cho
      // `text-[Npx]` mới — lint chặn arbitrary size mới, thang này là đường thay thế.
      fontSize: {
        'ga-display': ['36px', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '500' }],
        'ga-display-m': ['28px', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '500' }],
        'ga-h1': ['28px', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '500' }],
        'ga-h1-m': ['24px', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '500' }],
        'ga-h2': ['20px', { lineHeight: '1.25', fontWeight: '500' }],
        'ga-h3': ['16px', { lineHeight: '1.35', fontWeight: '600' }],
        'ga-body-lg': ['15px', { lineHeight: '1.55' }],
        'ga-body': ['14px', { lineHeight: '1.5' }],
        'ga-small': ['13px', { lineHeight: '1.45' }],
        'ga-caption': ['12px', { lineHeight: '1.4' }],
        'ga-eyebrow': ['11px', { lineHeight: '1.2', letterSpacing: '0.08em', fontWeight: '600' }],
        'ga-stat-label': ['11px', { lineHeight: '1.2', letterSpacing: '0.16em', fontWeight: '600' }],
        'ga-vocab': ['26px', { lineHeight: '1.3', fontWeight: '500' }],
        'ga-stat': ['32px', { lineHeight: '1.1', fontWeight: '500' }],
        'ga-stat-m': ['24px', { lineHeight: '1.1', fontWeight: '500' }],
        'ga-numeral': ['20px', { lineHeight: '1.1', fontWeight: '600' }],
      },
      transitionDuration: {
        'ga-fast': '150ms',
        'ga-base': '240ms',
        'ga-slow': '400ms',
        'ga-ritual': '1500ms',
      },
      transitionTimingFunction: {
        'ga-out': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        'ga-ritual': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Galerie 2.0 type pairing (display serif + UI sans). Vars from src/styles/galerie.css.
        'ga-display': ['var(--ga-display)'],
        'ga-ui': ['var(--ga-ui)'],
      },
    },
  },
  plugins: [],
}

export default config
