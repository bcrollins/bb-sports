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
        breaking: '#D7263D'
      },
      fontFamily: {
        serif: ['"Playfair Display"', '"Source Serif Pro"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Anton', '"Oswald"', '"Inter"', 'system-ui', 'sans-serif'],
        condensed: ['Oswald', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
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
