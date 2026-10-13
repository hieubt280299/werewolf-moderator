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
      backgroundImage: {
        'panel-gradient': 'linear-gradient(160deg, #12141C 0%, #1A1D26 100%)',
        'day-border': 'linear-gradient(90deg, #B8321A, #F26A21, #C8102E)',
      },
    },
  },
  plugins: [],
} satisfies Config;
