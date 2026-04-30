import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'tg-bg':            'var(--tg-theme-bg-color, #ffffff)',
        'tg-secondary-bg':  'var(--tg-theme-secondary-bg-color, #f1f1f1)',
        'tg-text':          'var(--tg-theme-text-color, #000000)',
        'tg-hint':          'var(--tg-theme-hint-color, #999999)',
        'tg-link':          'var(--tg-theme-link-color, #2481cc)',
        'tg-button':        'var(--tg-theme-button-color, #2481cc)',
        'tg-button-text':   'var(--tg-theme-button-text-color, #ffffff)',
        'tg-destructive':   'var(--tg-theme-destructive-text-color, #cc0000)',
      },
    },
  },
  plugins: [],
} satisfies Config;
