export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#07060b',
        surface: '#100d18',
        elevated: '#16121f',
        card: '#100d18',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        'accent-soft': 'rgb(var(--accent-soft-rgb) / <alpha-value>)',
        'accent-dim': 'rgb(var(--accent-dim-rgb) / <alpha-value>)',
        text: '#f5f0ff',
        muted: '#9b92ad',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.08)',
        subtle: 'rgba(255,255,255,0.06)',
      },
      boxShadow: {
        glow: '0 8px 32px rgba(0,0,0,0.5)',
        'accent-glow': '0 0 0 1px rgb(var(--accent-rgb) / 0.5), 0 8px 40px -8px rgb(var(--accent-rgb) / 0.45)',
      },
      keyframes: {
        // Только прозрачность, никаких transform: анимируется обёртка страницы,
        // а transform сделал бы её точкой отсчёта для position:fixed внутри и
        // сломал полноэкранный плеер.
        fade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        fade: 'fade 0.35s ease both',
      },
    },
  },
}
