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
  /** Two-sided cards (Cursed): left and right halves. */
  split?: [Tone, Tone];
}

const BASE_TONES: Record<Exclude<CardTone, 'dual'>, Tone> = {
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

export const TONES: Record<CardTone, Tone> = {
  ...BASE_TONES,
  dual: {
    ...BASE_TONES.village,
    glow: 'rgba(150,60,120,0.5)',
    bar: 'bg-gradient-to-b from-village to-wolf',
    // w-fit: the gradient spans the word itself, not the whole row.
    text: 'w-fit bg-gradient-to-r from-village to-wolf-bright bg-clip-text text-transparent',
    split: [BASE_TONES.village, BASE_TONES.werewolf],
  },
};

// CSS helpers — each handles split tones with a hard 50/50 edge.

/** Portrait backdrop of a card. */
export function toneBackdrop(t: Tone): string {
  if (t.split) {
    const [a, b] = t.split;
    return `radial-gradient(110% 75% at 38% 30%, transparent 0%, rgba(5,5,5,.35) 55%, #050505 100%), linear-gradient(100deg, ${a.mist} 0%, ${a.night} 50%, ${b.night} 50%, ${b.mist} 100%)`;
  }
  return `radial-gradient(110% 75% at 38% 30%, ${t.mist} 0%, ${t.night} 48%, #050505 100%)`;
}

/** Rules plate of a card. */
export function tonePlate(t: Tone): string {
  if (t.split) {
    const [a, b] = t.split;
    return `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.4) 100%), linear-gradient(100deg, ${a.plate} 50%, ${b.plate} 50%)`;
  }
  return `linear-gradient(180deg, ${t.plate} 0%, ${t.plateDark} 100%)`;
}

/** Outer glow for highlighted / large cards. */
export function toneGlow(t: Tone): string {
  if (t.split) return `-10px 0 28px -8px ${t.split[0].glow}, 10px 0 28px -8px ${t.split[1].glow}`;
  return `0 0 28px -6px ${t.glow}`;
}

/** Solid accent, or a two-colour accent for split tones (for bars, rings, badges). */
export function toneAccentFill(t: Tone, direction = '180deg'): string {
  if (t.split) return `linear-gradient(${direction}, ${t.split[0].accent} 50%, ${t.split[1].accent} 50%)`;
  return t.accent;
}

/** Round badge background. */
export function toneBadge(t: Tone): string {
  if (t.split) {
    const [a, b] = t.split;
    return `linear-gradient(90deg, ${a.night} 50%, ${b.night} 50%)`;
  }
  return `radial-gradient(circle at 40% 30%, ${t.mist}, ${t.night} 70%)`;
}
