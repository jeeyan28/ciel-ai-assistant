import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sky: 'var(--slime-500)',
        ink: 'var(--ink)',
        surface: 'var(--surface)',
        line: 'var(--line)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Sora', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: { gel: '20px' },
    },
  },
  plugins: [],
} satisfies Config
