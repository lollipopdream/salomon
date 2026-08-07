/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        salomon: {
          red:     '#E8002D',
          black:   '#0A0E1A',
          dark:    '#0D1529',
          navy:    '#111D3A',
          card:    'rgba(10,20,50,0.72)',
          glass:   'rgba(255,255,255,0.06)',
          border:  'rgba(255,255,255,0.12)',
          cyan:    '#00C8FF',
          teal:    '#0AFFE0',
          gold:    '#FFD966',
          text:    '#E8EDF8',
          muted:   '#7B8DB0',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', '"Inter"', 'sans-serif'],
      },
      backgroundImage: {
        'mountain': "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=90')",
        'card-gradient': 'linear-gradient(135deg, rgba(10,20,50,0.85) 0%, rgba(5,15,40,0.70) 100%)',
        'hero-gradient': 'linear-gradient(180deg, rgba(5,10,25,0.30) 0%, rgba(5,10,25,0.80) 100%)',
        'glow-cyan': 'radial-gradient(ellipse at center, rgba(0,200,255,0.15) 0%, transparent 70%)',
      },
      boxShadow: {
        'glass': '0 4px 24px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glow-red':  '0 0 20px rgba(232,0,45,0.5), 0 0 40px rgba(232,0,45,0.2)',
        'glow-cyan': '0 0 20px rgba(0,200,255,0.5), 0 0 40px rgba(0,200,255,0.2)',
        'glow-teal': '0 0 16px rgba(10,255,224,0.4)',
        'card-hover':'0 8px 40px 0 rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)',
      },
      animation: {
        'fadeIn':       'fadeIn 0.6s ease forwards',
        'fadeInUp':     'fadeInUp 0.7s ease forwards',
        'fadeInLeft':   'fadeInLeft 0.7s ease forwards',
        'fadeInRight':  'fadeInRight 0.7s ease forwards',
        'slideDown':    'slideDown 0.5s ease forwards',
        'pulse-slow':   'pulse 3s ease-in-out infinite',
        'ping-slow':    'ping 2.5s cubic-bezier(0,0,0.2,1) infinite',
        'glow-pulse':   'glowPulse 2s ease-in-out infinite',
        'trail':        'trailDraw 2.5s ease forwards',
        'float':        'float 4s ease-in-out infinite',
        'spin-slow':    'spin 8s linear infinite',
        'shimmer':      'shimmer 2s linear infinite',
        'particle':     'particle 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeInRight: {
          '0%':   { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.6', filter: 'blur(0px)' },
          '50%':      { opacity: '1',   filter: 'blur(2px)' },
        },
        trailDraw: {
          '0%':   { strokeDashoffset: '1000' },
          '100%': { strokeDashoffset: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        particle: {
          '0%':   { opacity: '0',   transform: 'translateY(0) scale(0.5)' },
          '20%':  { opacity: '1',   transform: 'translateY(-20px) scale(1)' },
          '80%':  { opacity: '0.6', transform: 'translateY(-80px) scale(0.8)' },
          '100%': { opacity: '0',   transform: 'translateY(-120px) scale(0.3)' },
        },
      },
    },
  },
  plugins: [],
  safelist: [
    'bg-white/5', 'bg-white/8', 'bg-white/10', 'bg-white/12', 'bg-white/15',
    'z-5',
  ],
}
