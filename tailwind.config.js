/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        safety: {
          green: '#10B981',
          emerald: '#059669',
          amber: '#F59E0B',
          yellow: '#EAB308',
          red: '#EF4444',
          rose: '#E11D48',
          stale: '#64748B',
          cyan: '#06B6D4',
          electric: '#38BDF8'
        },
        dark: {
          950: '#030712',
          900: '#090D16',
          850: '#0F172A',
          800: '#1E293B',
          700: '#334155'
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'glow-radar': 'radar 4s linear infinite',
        'shimmer': 'shimmer 2.5s infinite linear'
      },
      keyframes: {
        radar: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      }
    },
  },
  plugins: [],
}
