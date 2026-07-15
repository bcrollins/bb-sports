import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx,mdx}',
    './content/**/*.{md,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        // BB Sports brand system
        navy: {
          DEFAULT: '#0A1F44',
          900: '#06122A',
          800: '#081938',
          700: '#0A1F44',
          600: '#102B5C',
          500: '#1B3A78'
        },
        bone: {
          DEFAULT: '#F5F2EC',
          50: '#FAF8F4',
          100: '#F5F2EC',
          200: '#EAE5D9'
        },
        charcoal: '#1A1A1A',
        ink: '#0E0E10',
        breaking: '#6B7280',
        'navy-deep': '#06122A',
        'broadcast-red': '#6B7280'
      },
      fontFamily: {
        // Internal CSS variables are defined in app/globals.css. No build-time
        // Google Fonts fetch is required for deterministic Railway deploys.
        serif: ['var(--font-playfair)', 'var(--font-source-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-anton)', 'var(--font-oswald)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        condensed: ['var(--font-oswald)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace']
      },
      maxWidth: {
        prose: '68ch',
        readable: '72ch'
      },
      boxShadow: {
        rule: '0 1px 0 0 rgba(10, 31, 68, 0.12)',
        deepRule: '0 2px 0 0 rgba(10, 31, 68, 0.85)'
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#1A1A1A',
            a: { color: '#0A1F44', textDecoration: 'underline' }
          }
        }
      }
    }
  },
  plugins: []
};

export default config;
