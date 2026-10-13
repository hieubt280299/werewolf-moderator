import type { CardTone } from '../../@types/game';

/**
 * Per-faction palette sampled from the physical card faces:
 * `plate` is the rules-text box, `night`/`mist` the vignetted portrait background.
 */
export interface Tone {
  accent: string;
  plate: string;
  plateDark: string;
  night: string;
  mist: string;
  glow: string;
  inner: string;
  /** Tailwind classes for accent bars / chips. */
  bar: string;
  text: string;
}

export const TONES: Record<CardTone, Tone> = {
  village: {
    accent: '#00A3E0',
    plate: '#2160A8',
    plateDark: '#123A6E',
    night: '#0B2338',
    mist: '#2D5E86',
    glow: 'rgba(0,163,224,0.55)',
    inner: 'inset 0 0 20px rgba(0,163,224,0.45)',
    bar: 'bg-village',
    text: 'text-village',
  },
  werewolf: {
    accent: '#C8102E',
    plate: '#8A1622',
    plateDark: '#4E0A13',
    night: '#24070C',
    mist: '#6E1A24',
    glow: 'rgba(200,16,46,0.6)',
    inner: 'inset 0 0 20px rgba(200,16,46,0.5)',
    bar: 'bg-wolf',
    text: 'text-wolf-bright',
  },
  vampire: {
    accent: '#8E4FD1',
    plate: '#5A2D8A',
    plateDark: '#331752',
    night: '#170B26',
    mist: '#4B2C6E',
    glow: 'rgba(142,79,209,0.55)',
    inner: 'inset 0 0 20px rgba(142,79,209,0.45)',
    bar: 'bg-vampire',
    text: 'text-vampire',
  },
  cult: {
    accent: '#2FA84F',
    plate: '#1F7A3C',
    plateDark: '#0F4521',
    night: '#081C10',
    mist: '#24573A',
    glow: 'rgba(47,168,79,0.55)',
    inner: 'inset 0 0 20px rgba(47,168,79,0.45)',
    bar: 'bg-cult',
    text: 'text-cult',
  },
  // Solo roles (Tanner): the earthy brown plate of the printed card.
  neutral: {
    accent: '#C48A3F',
    plate: '#7A5428',
    plateDark: '#45300F',
    night: '#1F160B',
    mist: '#5A4224',
    glow: 'rgba(196,138,63,0.55)',
    inner: 'inset 0 0 20px rgba(196,138,63,0.45)',
    bar: 'bg-[#C48A3F]',
    text: 'text-[#D9A35A]',
  },
};
