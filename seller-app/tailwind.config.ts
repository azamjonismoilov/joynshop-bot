import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─── Brand ───
        brand: {
          DEFAULT: 'var(--color-brand)',
          hover:   'var(--color-brand-hover)',
          active:  'var(--color-brand-active)',
          subtle:  'var(--color-brand-subtle)',
          fg:      'var(--color-brand-fg)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          hover:   'var(--color-secondary-hover)',
          active:  'var(--color-secondary-active)',
          subtle:  'var(--color-secondary-subtle)',
          fg:      'var(--color-secondary-fg)',
        },
        // ─── Semantic ───
        success: {
          DEFAULT: 'var(--color-success)',
          hover:   'var(--color-success-hover)',
          subtle:  'var(--color-success-subtle)',
          fg:      'var(--color-success-fg)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          hover:   'var(--color-danger-hover)',
          subtle:  'var(--color-danger-subtle)',
          fg:      'var(--color-danger-fg)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          hover:   'var(--color-warning-hover)',
          subtle:  'var(--color-warning-subtle)',
          fg:      'var(--color-warning-fg)',
        },
        purple: {
          DEFAULT: 'var(--color-purple)',
          subtle:  'var(--color-purple-subtle)',
          fg:      'var(--color-purple-fg)',
        },
        // ─── Neutral scale ───
        neutral: {
          0:   'var(--color-neutral-0)',
          50:  'var(--color-neutral-50)',
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          300: 'var(--color-neutral-300)',
          400: 'var(--color-neutral-400)',
          500: 'var(--color-neutral-500)',
          600: 'var(--color-neutral-600)',
          700: 'var(--color-neutral-700)',
          800: 'var(--color-neutral-800)',
          900: 'var(--color-neutral-900)',
        },
        // ─── Foreground (text) semantic ───
        fg: {
          1:          'var(--color-fg-1)',
          2:          'var(--color-fg-2)',
          3:          'var(--color-fg-3)',
          4:          'var(--color-fg-4)',
          disabled:   'var(--color-fg-disabled)',
          'on-brand': 'var(--color-fg-on-brand)',
        },
        // ─── Background semantic ───
        bg: {
          1:     'var(--color-bg-1)',
          2:     'var(--color-bg-2)',
          3:     'var(--color-bg-3)',
          muted: 'var(--color-bg-muted)',
        },
        // ─── Border ───
        border: {
          DEFAULT: 'var(--color-border)',
          strong:  'var(--color-border-strong)',
          focus:   'var(--color-border-focus)',
        },
      },
      fontFamily: {
        display: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        body:    ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono:    ['DM Mono', 'ui-monospace', 'SF Mono', 'monospace'],
      },
      fontSize: {
        xs:    ['12px', { lineHeight: '16px' }],
        sm:    ['14px', { lineHeight: '20px' }],
        base:  ['16px', { lineHeight: '24px' }],
        lg:    ['18px', { lineHeight: '28px' }],
        xl:    ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '40px' }],
      },
      borderRadius: {
        xs:    'var(--radius-xs)',
        sm:    'var(--radius-sm)',
        md:    'var(--radius-md)',
        lg:    'var(--radius-lg)',
        xl:    'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        '4xl': 'var(--radius-4xl)',
        full:  'var(--radius-full)',
        // Component aliases
        button: 'var(--radius-button)',
        input:  'var(--radius-input)',
        card:   'var(--radius-card)',
        badge:  'var(--radius-badge)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      transitionDuration: {
        fast: '100ms',
        base: '150ms',
        slow: '250ms',
      },
    },
  },
  plugins: [],
} satisfies Config;
