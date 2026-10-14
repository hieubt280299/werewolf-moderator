import type { Config } from 'tailwindcss';

/**
 * "Deluxe Grimoire" tokens — sampled from the Ultimate Werewolf Deluxe card faces:
 * pitch-black canvas, charcoal vignetted panels, and faction-coloured text plates.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#050505',
        panel: { DEFAULT: '#12141C', 2: '#1A1D26', edge: '#2A2E3B' },
        bone: { DEFAULT: '#F5F5F7', dim: '#A9ABB5', faint: '#6B6E7A' },
        village: { DEFAULT: '#00A3E0', deep: '#0082C8', plate: '#1F4F8F', night: '#0B2A44' },
        wolf: { DEFAULT: '#C8102E', bright: '#D22630', plate: '#7E1420', night: '#2A0710' },
        vampire: { DEFAULT: '#8E4FD1', plate: '#4E2876', night: '#1E0F30' },
        cult: { DEFAULT: '#2FA84F', plate: '#1D6B36', night: '#0A2414' },
        ember: { DEFAULT: '#F26A21', deep: '#B8321A' },
      },
      fontFamily: {
        display: ['Oswald', 'Dosis', 'Impact', 'sans-serif'],
        body: ['"Be Vietnam Pro"', 'Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: { grimoire: '0.1em' },
      boxShadow: {
        card: '0 10px 30px -8px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.08)',
        'glow-village': '0 0 24px -4px rgba(0,163,224,0.55)',
        'glow-wolf': '0 0 24px -4px rgba(200,16,46,0.6)',
        'glow-vampire': '0 0 24px -4px rgba(142,79,209,0.55)',
        'glow-cult': '0 0 24px -4px rgba(47,168,79,0.55)',
        'glow-ember': '0 0 28px -6px rgba(242,106,33,0.6)',
        'inner-village': 'inset 0 0 20px rgba(0,163,224,0.45)',
        'inner-wolf': 'inset 0 0 20px rgba(200,16,46,0.5)',
        'inner-vampire': 'inset 0 0 20px rgba(142,79,209,0.45)',
        'inner-cult': 'inset 0 0 20px rgba(47,168,79,0.45)',
        'inner-ember': 'inset 0 0 20px rgba(242,106,33,0.45)',
      },
      /**
       * Frame-by-frame motion: every animation uses steps() timing so it reads like a
       * flip-book, and only animates transform/opacity so it stays on the GPU compositor.
       */
      keyframes: {
        'step-in': {
          from: { opacity: '0', transform: 'translate3d(0,12px,0)' },
          to: { opacity: '1', transform: 'translate3d(0,0,0)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'sheet-in': { from: { transform: 'translate3d(0,100%,0)' }, to: { transform: 'translate3d(0,0,0)' } },
        'sheet-out': { from: { transform: 'translate3d(0,0,0)' }, to: { transform: 'translate3d(0,100%,0)' } },
        deal: {
          from: { opacity: '0', transform: 'perspective(800px) rotateY(90deg) scale(0.9)' },
          to: { opacity: '1', transform: 'perspective(800px) rotateY(0deg) scale(1)' },
        },
        pop: {
          from: { opacity: '0', transform: 'scale(0.88)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'grow-x': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
      },
      // `backwards` fill: hold the first frame during any delay, but leave no transform/opacity
      // behind afterwards (a lingering transform would trap position:fixed descendants).
      animation: {
        'step-in': 'step-in 320ms steps(4, end) backwards',
        'fade-in': 'fade-in 200ms steps(3, end) backwards',
        'fade-out': 'fade-out 200ms steps(3, end) forwards',
        'sheet-in': 'sheet-in 300ms steps(6, end) backwards',
        'sheet-out': 'sheet-out 220ms steps(4, end) forwards',
        deal: 'deal 400ms steps(5, end) backwards',
        pop: 'pop 300ms steps(4, end) backwards',
        'grow-x': 'grow-x 600ms steps(6, end) backwards',
      },
      backgroundImage: {
        'panel-gradient': 'linear-gradient(160deg, #12141C 0%, #1A1D26 100%)',
        'day-border': 'linear-gradient(90deg, #B8321A, #F26A21, #C8102E)',
      },
    },
  },
  plugins: [],
} satisfies Config;
