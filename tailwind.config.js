/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        calm: {
          bg: '#F3F0FF',           // Soft Lavender / Periwinkle background from user screenshot
          ivory: '#F8F7FF',        // Slightly lighter tint
          card: '#FFFFFF',         // Crisp White card surfaces
          navy: '#2F3159',         // Deep Slate Navy header & primary text from user screenshot
          purple: '#7F00FF',       // Vivid Electric Purple accent from user screenshot
          'purple-hover': '#6E00DE',
          'purple-light': '#EDE9FE',
          border: '#E2D9F3',       // Soft lilac border
          'border-light': '#EDE9FE',
          sage: '#7F00FF',         // Main accent updated to vibrant purple
          'sage-dark': '#2F3159',  // Dark headings updated to deep slate navy
          'sage-hover': '#6E00DE',
          mint: '#EDE9FE',         // Light badge background
          'mint-light': '#F5F3FF',
          'pale-blue': '#E0E7FF',
          lavender: '#EDE9FE',
          beige: '#F5F3FF',
          charcoal: '#2F3159',
          muted: '#696C92',        // Muted indigo grey
          'muted-light': '#8E92B5',
          correct: '#16A34A',      // Accessible green
          'correct-light': '#DCFCE7',
          warning: '#D97706',      // Warm amber
          'warning-light': '#FEF3C7',
          danger: '#DC2626',       // Vibrant red
          'danger-light': '#FEE2E2'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(38, 61, 50, 0.05), 0 2px 6px -1px rgba(38, 61, 50, 0.03)',
        'soft-lg': '0 10px 30px -4px rgba(38, 61, 50, 0.08), 0 4px 10px -2px rgba(38, 61, 50, 0.04)',
        'soft-hover': '0 14px 34px -4px rgba(38, 61, 50, 0.12), 0 6px 14px -2px rgba(38, 61, 50, 0.06)'
      },
      animation: {
        'wave-slow': 'wave 12s ease-in-out infinite',
        'float-gentle': 'floatGentle 7s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out'
      },
      keyframes: {
        wave: {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-12px) scale(1.02)' }
        },
        floatGentle: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    },
  },
  plugins: [],
}
