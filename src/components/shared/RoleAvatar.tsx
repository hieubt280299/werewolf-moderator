import clsx from 'clsx';
import { memo, useId, type ReactNode } from 'react';
import type { RoleId } from '../../@types/game';
import { ROLES } from '../../data/roles';
import { TONES, type Tone } from './tones';

/**
 * Character portraits for every role — inline vector busts in a dark-fantasy card style:
 * moonlight from the upper-left, a faction-coloured rim light, and a costume / prop that
 * identifies the role (the Seer's orb, the Witch's hat, the wolves' muzzles…).
 *
 * Pure SVG gradients only (no filters, no bitmaps) so dozens can render cheaply on phones.
 * Coordinates live in a 100×100 box: head centred at (50,46), shoulders from y≈72.
 */

interface Ctx {
  /** Instance-scoped gradient id, so many avatars can share one page. */
  id: (name: string) => string;
  /** `url(#…)` for a scoped gradient id. */
  u: (name: string) => string;
  tone: Tone;
}

type Art = (c: Ctx) => ReactNode;

// ---------------------------------------------------------------------------
// Shared anatomy
// ---------------------------------------------------------------------------

const SHOULDERS = 'M8 101 C10 83 26 74.5 50 73.5 C74 74.5 90 83 92 101 Z';
const SHOULDERS_WIDE = 'M3 101 C5 81 24 72 50 71 C76 72 95 81 97 101 Z';
const HEAD = { cx: 50, cy: 46, rx: 12.5, ry: 15.5 };

function Bust({ fill, c, wide }: { fill: string; c: Ctx; wide?: boolean }) {
  const d = wide ? SHOULDERS_WIDE : SHOULDERS;
  return (
    <>
      <path d={d} fill={fill} />
      <path d={d} fill="none" stroke={c.u('rim')} strokeWidth={1.1} />
    </>
  );
}

function Neck({ fill, thick }: { fill: string; thick?: boolean }) {
  return (
    <>
      <path d={thick ? 'M41.5 57 L58.5 57 L60.5 76 L39.5 76 Z' : 'M43.5 57 L56.5 57 L57.8 76 L42.2 76 Z'} fill={fill} />
      <path d="M42 66 Q50 71 58 66 L58 76 L42 76 Z" fill="#000" opacity={0.35} />
    </>
  );
}

function Head({ c, fill }: { c: Ctx; fill?: string }) {
  return (
    <>
      <ellipse {...HEAD} fill={fill ?? c.u('skin')} />
      <ellipse {...HEAD} fill="none" stroke={c.u('rim')} strokeWidth={0.9} />
    </>
  );
}

/** Soft shadow on the side away from the moon, for volume. */
const FaceShade = ({ c }: { c: Ctx }) => <ellipse {...HEAD} fill={c.u('shade')} />;

interface FaceProps {
  eye?: string;
  /** Glowing iris colour (adds a halo). */
  glow?: string;
  brow?: string;
  browWidth?: number;
  lips?: string;
  mouth?: 'neutral' | 'smirk' | 'flat' | 'grin' | 'frown' | 'none';
  /** Gap-toothed grin (Village Idiot). */
  gap?: boolean;
  /** Age lines on forehead and cheeks. */
  wrinkles?: boolean;
  c: Ctx;
}

function Face({ eye = '#1a1210', glow, brow = '#2a1c16', browWidth = 1.1, lips = '#5a2e26', mouth = 'neutral', gap, wrinkles, c }: FaceProps) {
  return (
    <g>
      {glow && (
        <>
          <circle cx={45.2} cy={45} r={4.2} fill={c.u('eyeHalo')} />
          <circle cx={54.8} cy={45} r={4.2} fill={c.u('eyeHalo')} />
        </>
      )}
      <path d="M42 45 Q45.2 43 48.4 45 Q45.2 46.6 42 45 Z" fill={glow ? '#120404' : '#f2e8df'} opacity={glow ? 0.9 : 0.85} />
      <path d="M51.6 45 Q54.8 43 58 45 Q54.8 46.6 51.6 45 Z" fill={glow ? '#120404' : '#f2e8df'} opacity={glow ? 0.9 : 0.85} />
      <circle cx={45.2} cy={45} r={1.25} fill={glow ?? eye} />
      <circle cx={54.8} cy={45} r={1.25} fill={glow ?? eye} />
      <path d="M41.4 41.4 Q45 39.6 48.2 41.2 M51.8 41.2 Q55 39.6 58.6 41.4" stroke={brow} strokeWidth={browWidth} fill="none" strokeLinecap="round" />
      <path d="M50 46.5 Q48.4 51 48.9 52.4 Q50 53.3 51.4 52.6" stroke="#000" strokeOpacity={0.35} strokeWidth={0.8} fill="none" />
      {mouth === 'neutral' && <path d="M46.4 56.6 Q50 58.1 53.6 56.6" stroke={lips} strokeWidth={1.1} fill="none" strokeLinecap="round" />}
      {mouth === 'smirk' && <path d="M46.2 56.9 Q50 57.8 54 55.6" stroke={lips} strokeWidth={1.2} fill="none" strokeLinecap="round" />}
      {mouth === 'flat' && <path d="M46.6 57 L53.4 57" stroke={lips} strokeWidth={1} fill="none" strokeLinecap="round" />}
      {mouth === 'frown' && <path d="M46.4 57.8 Q50 56.2 53.6 57.8" stroke={lips} strokeWidth={1.1} fill="none" strokeLinecap="round" />}
      {mouth === 'grin' && (
        <>
          <path d="M45 55.2 Q50 61.4 55 55.2 Q50 57.2 45 55.2 Z" fill="#3a0d10" />
          <path d="M45.9 55.8 Q50 57.5 54.1 55.8 L53.6 57.1 Q50 58.4 46.4 57.1 Z" fill="#f2ece0" />
          {gap && <rect x={49.3} y={56.3} width={1.4} height={1.6} fill="#2a0a0c" />}
          <path d="M45 55.2 Q50 61.4 55 55.2" stroke={lips} strokeWidth={0.8} fill="none" />
        </>
      )}
      {wrinkles && (
        <path
          d="M43.6 37.2 Q50 35.6 56.4 37.2 M44.6 39 Q50 37.8 55.4 39 M43.2 49.5 Q44.2 53.6 46 56.2 M56.8 49.5 Q55.8 53.6 54 56.2 M41.6 46.6 L40.4 47.6 M58.4 46.6 L59.6 47.6"
          stroke="#000"
          strokeOpacity={0.28}
          strokeWidth={0.7}
          fill="none"
        />
      )}
    </g>
  );
}

const Grad = ({ id, stops, x2 = 0, y2 = 1 }: { id: string; stops: [number, string, number?][]; x2?: number; y2?: number }) => (
  <linearGradient id={id} x1={0} y1={0} x2={x2} y2={y2}>
    {stops.map(([o, color, op], i) => (
      <stop key={i} offset={o} stopColor={color} stopOpacity={op ?? 1} />
    ))}
  </linearGradient>
);

const Radial = ({ id, stops, cx = 0.5, cy = 0.5, r = 0.5 }: { id: string; stops: [number, string, number?][]; cx?: number; cy?: number; r?: number }) => (
  <radialGradient id={id} cx={cx} cy={cy} r={r}>
    {stops.map(([o, color, op], i) => (
      <stop key={i} offset={o} stopColor={color} stopOpacity={op ?? 1} />
    ))}
  </radialGradient>
);

// ---------------------------------------------------------------------------
// Wolves share one parametric head
// ---------------------------------------------------------------------------

interface WolfOpts {
  fur: string;
  furDark: string;
  muzzle: string;
  eye: string;
  cub?: boolean;
  stripes?: boolean;
  scar?: boolean;
  /** Big Bad Wolf: a spiky dark mane licked by red light. */
  mane?: boolean;
  /** Fang Face's red cap. */
  cap?: string;
  /** Wolverine's pale band running from brow over the head. */
  band?: string;
  /** Fruit Brute biting an apple. */
  apple?: boolean;
  /** Closed-mouth smile instead of a snarl (Dire Wolf). */
  smile?: boolean;
  /** Lighter cheek ruff (Dire Wolf). */
  cheeks?: string;
}

function wolf(o: WolfOpts): Art {
  return (c) => {
    const head = o.cub
      ? 'M29 39 C29 26 39 21.5 50 21.5 C61 21.5 71 26 71 39 C71 49 66.5 57 60 62.5 C56 66 44 66 40 62.5 C33.5 57 29 49 29 39 Z'
      : 'M30 36 C30 25 40 20.5 50 20.5 C60 20.5 70 25 70 36 C71.5 45 68 51 64 55 L60 70 C56 77 44 77 40 70 L36 55 C32 51 28.5 45 30 36 Z';
    return (
      <>
        <defs>
          <Grad id={c.id('wfur')} stops={[[0, o.fur], [1, o.furDark]]} />
          <Grad id={c.id('wmuz')} stops={[[0, o.muzzle], [1, o.furDark]]} />
          <Radial id={c.id('weye')} stops={[[0, o.eye, 0.9], [0.4, o.eye, 0.35], [1, o.eye, 0]]} />
          <Radial id={c.id('wapple')} cx={0.38} cy={0.32} stops={[[0, '#ff8a7a'], [0.5, '#d01a22'], [1, '#5a0408']]} />
        </defs>
        {o.mane && (
          <>
            <path
              d="M27 42 L16 30 L27 30 L19 15 L33 23 L33 8 L43 19 L50 5 L57 19 L67 8 L67 23 L81 15 L73 30 L84 30 L73 42 Z"
              fill={o.furDark}
            />
            <path d="M84 30 L73 30 L81 15 L67 23 L67 8 L57 19" fill="none" stroke={c.tone.accent} strokeWidth={1.4} opacity={0.75} />
          </>
        )}
        <path
          d="M4 101 L8 85 L14 89 L18 77 L26 83 L31 71 L39 79 L50 69 L61 79 L69 71 L74 83 L82 77 L86 89 L92 85 L96 101 Z"
          fill={c.u('wfur')}
        />
        <path d="M4 101 L8 85 L14 89 L18 77 L26 83 L31 71 L39 79 L50 69" fill="none" stroke={c.u('rim')} strokeWidth={1} />
        {o.cub ? (
          <>
            <path d="M31 38 L23 10 L45 25 Z M69 38 L77 10 L55 25 Z" fill={c.u('wfur')} />
            <path d="M32 33 L27 16 L40 26 Z M68 33 L73 16 L60 26 Z" fill="#7a3a40" opacity={0.75} />
          </>
        ) : (
          <>
            <path d="M31 37 L27 11 L44 27 Z M69 37 L73 11 L56 27 Z" fill={c.u('wfur')} />
            <path d="M32 32 L30 17 L40 27 Z M68 32 L70 17 L60 27 Z" fill="#5a2a2e" opacity={0.8} />
          </>
        )}
        <path d={head} fill={c.u('wfur')} />
        <path
          d="M30.5 44 L24 50.5 L31.5 50.5 L26 57 L36 55.5 Z M69.5 44 L76 50.5 L68.5 50.5 L74 57 L64 55.5 Z"
          fill={o.cheeks ?? c.u('wfur')}
        />
        <path d={head} fill="none" stroke={c.u('rim')} strokeWidth={0.9} />
        {o.band && (
          <path
            d="M31 37 C36 30.5 44 28.5 50 28.5 C56 28.5 64 30.5 69 37 L67.5 40.5 C62 35.5 56 33.6 50 33.6 C44 33.6 38 35.5 32.5 40.5 Z"
            fill={o.band}
            opacity={0.9}
          />
        )}
        {o.cap && (
          <>
            <path d="M32 31 C31 18 43 12.5 52 12.5 C63 12.5 71 18.5 69.5 28.5 C62 26 42 26.5 32 31 Z" fill={o.cap} />
            <path d="M32 31 C42 26.5 62 26 69.5 28.5 L70 31 C62 28.8 42 29.2 31.6 33.4 Z" fill="#000" opacity={0.3} />
            <path d="M34 26 C37 18 45 14.5 52 14.5" stroke="#fff" strokeOpacity={0.25} strokeWidth={1} fill="none" />
          </>
        )}
        {o.stripes && (
          <path
            d="M44 22 L47 30.5 L45 31.5 Z M56 22 L53 30.5 L55 31.5 Z M50 21 L50.8 29.5 L49.2 29.5 Z M31.5 39 L38.5 43.5 L37.5 44.8 Z M68.5 39 L61.5 43.5 L62.5 44.8 Z"
            fill="#0d0f12"
            opacity={0.85}
          />
        )}
        <path d="M37 40 Q43 36.5 48 40.6 M52 40.6 Q57 36.5 63 40" stroke={o.furDark} strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <circle cx={42.6} cy={42.8} r={6} fill={c.u('weye')} />
        <circle cx={57.4} cy={42.8} r={6} fill={c.u('weye')} />
        <path d="M38.8 42.6 Q42.6 39.8 46.3 43.1 Q42.6 44.8 38.8 42.6 Z M61.2 42.6 Q57.4 39.8 53.7 43.1 Q57.4 44.8 61.2 42.6 Z" fill={o.eye} />
        <ellipse cx={42.8} cy={42.7} rx={0.6} ry={1.3} fill="#120404" />
        <ellipse cx={57.2} cy={42.7} rx={0.6} ry={1.3} fill="#120404" />
        {o.scar && <path d="M55.5 34 L61.5 50.5 M56.3 38.5 L58.8 37.6 M57.9 43 L60.4 42.1" stroke="#d22630" strokeWidth={1.1} opacity={0.85} />}
        {o.cub ? (
          <>
            <path d="M43 50 C43 45.6 57 45.6 57 50 L56 57 C54 61.5 46 61.5 44 57 Z" fill={c.u('wmuz')} />
            <path d="M46.6 51 C46.6 49.6 53.4 49.6 53.4 51 C53.4 52.8 51.3 54 50 54 C48.7 54 46.6 52.8 46.6 51 Z" fill="#0b0b0d" />
            <path d="M47 57.6 Q50 59.8 53 57.6" stroke="#3a1a1e" strokeWidth={0.9} fill="none" />
          </>
        ) : (
          <>
            <path d="M42 50 C42 44.5 58 44.5 58 50 L57 63 C55 69.5 45 69.5 43 63 Z" fill={c.u('wmuz')} />
            <path d="M46 53.5 C46 51.8 54 51.8 54 53.5 C54 55.5 51.5 57 50 57 C48.5 57 46 55.5 46 53.5 Z" fill="#0b0b0d" />
            {o.smile ? (
              <>
                <path d="M43.5 62 Q50 66.8 56.5 62" stroke="#2a0a0e" strokeWidth={1.2} fill="none" />
                <path d="M46 62.7 L46.8 64.8 L47.6 63 Z M54 62.7 L53.2 64.8 L52.4 63 Z" fill="#f2efe6" />
              </>
            ) : (
              <>
                <path d="M43.5 63 Q50 72 56.5 63 Q50 66.5 43.5 63 Z" fill="#4a0a12" />
                <path d="M45.6 63.8 L46.8 68.2 L48 64.6 Z M54.4 63.8 L53.2 68.2 L52 64.6 Z" fill="#f2efe6" />
              </>
            )}
          </>
        )}
        {o.apple && (
          <>
            <circle cx={55} cy={66} r={7} fill={c.u('wapple')} />
            <path d="M55 59.4 C55.4 57.4 56.6 56.4 58 56" stroke="#4a2a10" strokeWidth={0.9} fill="none" />
            <path d="M56.4 58 C58.6 56.6 61 57 62 58.4 C60 59.6 58 59.4 56.4 58 Z" fill="#3a8a2a" />
            <path d="M51.5 63.5 L50 66 L52.5 64.8 L51.8 67.6 L53.8 65.4" stroke="#f2efe6" strokeWidth={0.7} fill="none" />
            <ellipse cx={61} cy={73} rx={6} ry={4.2} fill={c.u('wfur')} />
            <path d="M57 71 L56 75 M60 71.6 L59.4 76 M63 72 L63 76" stroke={o.furDark} strokeWidth={0.7} />
          </>
        )}
      </>
    );
  };
}

// ---------------------------------------------------------------------------
// Portraits
// ---------------------------------------------------------------------------

const ART: Record<RoleId, Art> = {
  villager: (c) => (
    <>
      <defs>
        <Grad id={c.id('earth')} stops={[[0, '#6a5639'], [1, '#17110b']]} />
        <Grad id={c.id('hat')} stops={[[0, '#6b5236'], [1, '#2a1f14']]} />
      </defs>
      <Bust fill={c.u('earth')} c={c} />
      <path d="M41 73.5 L50 88 L59 73.5" fill="#d8cfbd" opacity={0.14} />
      <path d="M41 73.5 L50 88 L59 73.5" fill="none" stroke="#c9b894" strokeWidth={0.8} opacity={0.6} />
      <path d="M33.5 77 L37.5 101 M66.5 77 L62.5 101" stroke="#2a1d10" strokeWidth={3} />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <ellipse cx={50} cy={56} rx={9} ry={5.2} fill="#3a2a22" opacity={0.22} />
      <Face c={c} />
      <FaceShade c={c} />
      <ellipse cx={50} cy={32.5} rx={23} ry={4.6} fill="#3d2e1f" />
      <path d="M37.5 32.5 C37 22 42 17.5 50 17.5 C58 17.5 63 22 62.5 32.5 Z" fill={c.u('hat')} />
      <rect x={37.6} y={28.6} width={24.8} height={3.2} fill="#1e160e" />
      <path d="M37.5 32 C37.2 23 41.5 18 50 17.6" fill="none" stroke={c.u('rim')} strokeWidth={0.9} />
      <path d="M54 56.4 L74 46" stroke="#d9b45a" strokeWidth={1.1} />
      <g fill="#e3c26a">
        <ellipse cx={68} cy={49} rx={1.9} ry={0.9} transform="rotate(-28 68 49)" />
        <ellipse cx={71} cy={47.4} rx={1.9} ry={0.9} transform="rotate(-28 71 47.4)" />
        <ellipse cx={74.2} cy={45.8} rx={1.9} ry={0.9} transform="rotate(-28 74.2 45.8)" />
      </g>
    </>
  ),

  seer: (c) => (
    <>
      <defs>
        <Grad id={c.id('hair')} stops={[[0, '#5fe3ec'], [0.5, '#1d7d98'], [1, '#0a2c3c']]} />
        <Grad id={c.id('robe')} stops={[[0, '#7a2a52'], [1, '#22061a']]} />
        <Radial id={c.id('orbGlow')} stops={[[0, '#a8ffd2', 0.75], [0.45, '#3fe08e', 0.3], [1, '#3fe08e', 0]]} />
        <Radial id={c.id('orb')} cx={0.4} cy={0.35} stops={[[0, '#effff6'], [0.45, '#72f2ac'], [1, '#0f7a49']]} />
      </defs>
      <path
        d="M35.5 44 C33 27 41 21.5 50 21.5 C60 21.5 67 27 64.5 44 C66 58 68 70 74 87 L60 85 C58 74 58 64 58 58 L42 58 C42 64 42 74 40 85 L26 87 C32 70 34 58 35.5 44 Z"
        fill={c.u('hair')}
      />
      <Bust fill={c.u('robe')} c={c} />
      <path d="M34 77 Q50 85 66 77" stroke="#c9a24a" strokeWidth={1.5} fill="none" />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <path d="M37.5 40 C39 30 46 27 52 28 C58 29 62 33 62.6 40 C58 34 52 33 47 34.5 C43 35.5 40 37.5 37.5 40 Z" fill={c.u('hair')} />
      <Face c={c} eye="#2fbfb4" lips="#8a3a4a" mouth="smirk" brow="#1d5a6a" />
      <FaceShade c={c} />
      <circle cx={50} cy={35.6} r={4} fill={c.u('glow')} />
      <path d="M50 33.6 L51.4 35.6 L50 37.6 L48.6 35.6 Z" fill="#8ff4ff" />
      <circle cx={50} cy={88} r={17} fill={c.u('orbGlow')} />
      <circle cx={50} cy={88} r={8.5} fill={c.u('orb')} />
      <ellipse cx={47.4} cy={85.4} rx={2.4} ry={1.5} fill="#fff" opacity={0.7} />
      <ellipse cx={42.3} cy={93} rx={4.3} ry={3} fill={c.u('skin')} />
      <ellipse cx={57.7} cy={93} rx={4.3} ry={3} fill={c.u('skin')} />
    </>
  ),

  bodyguard: (c) => (
    <>
      <defs>
        <Grad id={c.id('leather')} stops={[[0, '#6a4630'], [1, '#170d07']]} />
        <Grad id={c.id('metal')} stops={[[0, '#b6bfcc'], [1, '#353a44']]} />
        <Grad id={c.id('mohawk')} stops={[[0, '#6fcbff'], [1, '#125a92']]} />
      </defs>
      <Bust fill={c.u('leather')} c={c} wide />
      <path d="M27 77 L62 101 L72 101 L35.5 73.5 Z" fill="#2a1a10" />
      <rect x={45} y={85} width={6} height={5} transform="rotate(34 48 87.5)" fill="none" stroke="#c9a24a" strokeWidth={1.2} />
      <path d="M10 87 C10 76.5 21 71 34 73 C36.5 79.5 32 86.5 21.5 89.5 C17 90.6 12.5 89.6 10 87 Z" fill={c.u('metal')} />
      <circle cx={19.5} cy={80.5} r={0.9} fill="#e3e7ee" />
      <circle cx={27} cy={77.3} r={0.9} fill="#e3e7ee" />
      <Neck fill={c.u('skin')} thick />
      <Head c={c} />
      <Face c={c} brow="#14223a" browWidth={1.5} mouth="flat" />
      <FaceShade c={c} />
      <path d="M45.4 33 C46 25 48.5 18 50 14.5 C51.5 18 54 25 54.6 33 C52 31.4 48 31.4 45.4 33 Z" fill={c.u('mohawk')} />
      <path d="M38 37 Q44 33.5 47 33.5 M53 33.5 Q56 33.5 62 37" stroke="#000" strokeOpacity={0.3} strokeWidth={1.4} fill="none" />
    </>
  ),

  hunter: (c) => (
    <>
      <defs>
        <Grad id={c.id('coat')} stops={[[0, '#42301f'], [1, '#100a06']]} />
        <Grad id={c.id('fur')} stops={[[0, '#9a8463'], [1, '#3a2e22']]} />
        <Grad id={c.id('horn')} stops={[[0, '#efe0b8'], [1, '#8a7448']]} x2={1} y2={0} />
      </defs>
      <Bust fill={c.u('coat')} c={c} />
      <path d="M60 76 C70 64 80 58 90 59 C91 61 90.5 63 89 64 C80 64 72 69 65 79 Z" fill={c.u('horn')} />
      <path d="M79.5 60 L80.5 64.5 M84 59 L84.6 63.6" stroke="#5a4a30" strokeWidth={0.8} />
      <path
        d="M13 88 Q19 77 25.5 83 Q29.5 72.5 36 80.5 Q40 70.5 46 78.5 Q50 68.5 54 78.5 Q60 70.5 64 80.5 Q70.5 72.5 74.5 83 Q81 77 87 88 L92 101 L8 101 Z"
        fill={c.u('fur')}
      />
      <Neck fill={c.u('skin')} />
      <path d="M36.5 42 C34 52 34 62 37 70 L41 66 C39 58 39 50 40 44 Z M63.5 42 C66 52 66 62 63 70 L59 66 C61 58 61 50 60 44 Z" fill="#2b1d14" />
      <Head c={c} />
      <Face c={c} brow="#1f140c" browWidth={1.5} mouth="none" />
      <FaceShade c={c} />
      <path d="M38.5 51 C38.5 64 44 71.5 50 71.5 C56 71.5 61.5 64 61.5 51 C59 57 54 58.6 50 58.6 C46 58.6 41 57 38.5 51 Z" fill="#3a2618" />
      <path d="M44 55.2 Q50 52.6 56 55.2 Q50 54.6 44 55.2 Z" fill="#24160c" />
      <path d="M36.5 44 C35 30 42 24 50 24 C59 24 65 30 63.5 44 C61 37 56 33 50 33 C44 33 39 37 36.5 44 Z" fill="#2b1d14" />
      <path d="M37 37.4 Q50 33 63 37.4" stroke="#7a2a1a" strokeWidth={2} fill="none" />
    </>
  ),

  witch: (c) => (
    <>
      <defs>
        <Grad id={c.id('hair')} stops={[[0, '#98ea5a'], [1, '#2a5e18']]} />
        <Grad id={c.id('dress')} stops={[[0, '#7a1828'], [1, '#200308']]} />
        <Grad id={c.id('hat')} stops={[[0, '#41744c'], [1, '#0e2216']]} />
      </defs>
      <path d="M37 38 C31 50 30 64 34 77 L42 73 C39 62 39 50 40.5 40 Z M63 38 C69 50 70 64 66 77 L58 73 C61 62 61 50 59.5 40 Z" fill={c.u('hair')} />
      <Bust fill={c.u('dress')} c={c} />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <Face c={c} lips="#a01a2c" mouth="smirk" brow="#244a18" eye="#4a8a2a" />
      <FaceShade c={c} />
      <path d="M43.5 66 Q50 69.2 56.5 66" stroke="#8a1020" strokeWidth={2} fill="none" />
      <circle cx={50} cy={80} r={3.6} fill="#e9e2d0" />
      <circle cx={48.7} cy={79.5} r={0.9} fill="#222" />
      <circle cx={51.3} cy={79.5} r={0.9} fill="#222" />
      <rect x={48.4} y={82} width={3.2} height={1.6} fill="#cfc6b2" />
      <ellipse cx={50} cy={31.5} rx={27} ry={5.4} fill="#152a1c" />
      <path d="M36.5 31 C40 22 45 12 60 4.5 C57 13 58.5 22 63.5 31 Z" fill={c.u('hat')} />
      <path d="M37 27.6 C45 26 55 26 63 27.6 L63.6 31 C55 29.4 45 29.4 36.4 31 Z" fill="#8a1424" />
      <path d="M36.5 31 C40 22 45 12 60 4.5" fill="none" stroke={c.u('rim')} strokeWidth={0.9} />
    </>
  ),

  prince: (c) => (
    <>
      <defs>
        <Grad id={c.id('cape')} stops={[[0, '#6440b0'], [1, '#170932']]} />
        <Grad id={c.id('gold')} stops={[[0, '#ffe590'], [1, '#a5761c']]} />
        <Grad id={c.id('hair')} stops={[[0, '#f3d27a'], [1, '#8a6420']]} />
      </defs>
      <Bust fill={c.u('cape')} c={c} />
      <Neck fill={c.u('skin')} />
      <path d="M33 72.5 L40 61 L50 71 L60 61 L67 72.5 L60 80.5 L50 76.5 L40 80.5 Z" fill="#3a1f6b" stroke="#c9a24a" strokeWidth={0.6} />
      <circle cx={50} cy={84} r={3.2} fill="#c8102e" stroke="#e6c260" strokeWidth={1} />
      <Head c={c} />
      <Face c={c} mouth="smirk" eye="#2a4a7a" brow="#7a5a1c" />
      <FaceShade c={c} />
      <path d="M36.8 44 C35 30 42 24.5 50 24.5 C59 24.5 65 30 63.2 44 C61 36 56 32.5 49 33.5 C44 34.2 40 37.5 36.8 44 Z M37 44 C36.5 48 37 52 38 55 L39.6 50 Z" fill={c.u('hair')} />
      <path d="M39 27.5 L41.5 20 L45.5 25 L50 17.5 L54.5 25 L58.5 20 L61 27.5 Z" fill={c.u('gold')} />
      <rect x={39} y={26.6} width={22} height={2.6} fill="#c9962a" />
      <circle cx={50} cy={22.4} r={1} fill="#c8102e" />
      <circle cx={45.5} cy={27.9} r={0.7} fill="#00a3e0" />
      <circle cx={54.5} cy={27.9} r={0.7} fill="#00a3e0" />
    </>
  ),

  diseased: (c) => (
    <>
      <defs>
        <Grad id={c.id('shirt')} stops={[[0, '#b2b0b8'], [1, '#34333a']]} />
        <Grad id={c.id('hair')} stops={[[0, '#625860'], [1, '#1c171b']]} />
      </defs>
      <path
        d="M36 46 C34 30 41 24 50 24 C59 24 66 30 64 46 C66 58 64 68 62 73 L58 60 L58 40 C54 34 46 34 42 40 L42 60 L38 73 C36 66 35 56 36 46 Z"
        fill={c.u('hair')}
      />
      <Bust fill={c.u('shirt')} c={c} />
      <path d="M42 73.5 L50 92 L58 73.5 Z" fill="#26222a" opacity={0.65} />
      <path d="M46 77 L54 82 M54 77 L46 82 M46 82 L54 87 M54 82 L46 87" stroke="#d8d4dc" strokeWidth={0.7} opacity={0.7} />
      <Neck fill={c.u('pale')} />
      <Head c={c} fill={c.u('pale')} />
      <ellipse cx={45.2} cy={45.2} rx={3.5} ry={2.6} fill="#3a2a34" opacity={0.65} />
      <ellipse cx={54.8} cy={45.2} rx={3.5} ry={2.6} fill="#3a2a34" opacity={0.65} />
      <Face c={c} eye="#9a8f86" brow="#4a3f45" lips="#6a4a52" mouth="flat" />
      <g fill="#8a3a4a" opacity={0.55}>
        <circle cx={41.8} cy={52} r={1.3} />
        <circle cx={57.2} cy={50.2} r={1} />
        <circle cx={55} cy={57.4} r={0.8} />
        <circle cx={44.4} cy={58.2} r={1.1} />
        <circle cx={53} cy={64.5} r={1.2} />
      </g>
      <FaceShade c={c} />
    </>
  ),

  spellcaster: (c) => (
    <>
      <defs>
        <Grad id={c.id('hood')} stops={[[0, '#463a8a'], [1, '#100b2a']]} />
        <Grad id={c.id('hair')} stops={[[0, '#de7438'], [1, '#6b2410']]} />
      </defs>
      <path d="M29 56 C27 32 37 20 50 20 C63 20 73 32 71 56 C71 66 68 72 64 76.5 L36 76.5 C32 72 29 66 29 56 Z" fill={c.u('hood')} />
      <path d="M29 56 C27 32 37 20 50 20" fill="none" stroke={c.u('rim')} strokeWidth={1} />
      <Bust fill={c.u('hood')} c={c} />
      <ellipse cx={50} cy={47} rx={15.5} ry={19.5} fill="#07060f" />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <path d="M37.5 42 C38 32 44 28 50 28 C56 28 62 32 62.5 42 C59 36 54 34 50 35 C46 34 41 36 37.5 42 Z" fill={c.u('hair')} />
      <Face c={c} eye="#3a6aa8" lips="#7a3a3a" mouth="none" />
      <FaceShade c={c} />
      <rect x={48.6} y={49} width={2.8} height={11} rx={1.4} fill={c.u('skin')} />
      <path d="M44 60 C44 57 56 57 56 60 L56 66 C56 69 44 69 44 66 Z" fill={c.u('skin')} />
      <path d="M46.5 62 L53.5 62 M46.5 64.4 L53.5 64.4" stroke="#000" strokeOpacity={0.25} strokeWidth={0.6} />
    </>
  ),

  lycan: (c) => (
    <>
      <defs>
        <Grad id={c.id('hair')} stops={[[0, '#3e2c34'], [1, '#080507']]} />
        <Grad id={c.id('dress')} stops={[[0, '#33224a'], [1, '#090510']]} />
        <Radial id={c.id('amber')} stops={[[0, '#ffc23a', 0.9], [1, '#ffc23a', 0]]} />
      </defs>
      <path d="M67 16 A21 21 0 1 0 75 47 A17 17 0 1 1 67 16 Z" fill="#f5f5f7" opacity={0.12} />
      <path
        d="M35.5 44 C33 27 41 21.5 50 21.5 C60 21.5 67 27 64.5 44 C66 58 68 70 74 87 L60 85 C58 74 58 64 58 58 L42 58 C42 64 42 74 40 85 L26 87 C32 70 34 58 35.5 44 Z"
        fill={c.u('hair')}
      />
      <Bust fill={c.u('skin')} c={c} />
      <path d="M16 101 C20 89 32 85.5 50 87.5 C68 85.5 80 89 84 101 Z" fill={c.u('dress')} />
      <path d="M34 88.5 L36 76 M66 88.5 L64 76" stroke="#33224a" strokeWidth={1.6} />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <path d="M37.5 42 C38 30 46 27 54 28.5 C60 30 63 35 62.6 42 C58 35.5 50 33 44 36 C41 37.5 39 39.5 37.5 42 Z" fill={c.u('hair')} />
      <Face c={c} lips="#8a1a2a" mouth="smirk" brow="#1a1014" eye="#3a2a20" />
      <circle cx={54.8} cy={45} r={4.5} fill={c.u('amber')} />
      <circle cx={54.8} cy={45} r={1.35} fill="#ffb020" />
      <FaceShade c={c} />
      <path d="M37 53 A2.4 2.4 0 1 0 39.4 56.4 A1.8 1.8 0 1 1 37 53 Z" fill="#d9dde5" />
    </>
  ),

  cursed: (c) => (
    <>
      <defs>
        <Grad id={c.id('coat')} stops={[[0, '#614530'], [1, '#140c06']]} />
        <Grad id={c.id('hat')} stops={[[0, '#5e4934'], [1, '#22180e']]} />
      </defs>
      <Bust fill={c.u('coat')} c={c} />
      <path d="M30 74.5 L43 72.5 L50 92 L57 72.5 L70 74.5 L64 101 L36 101 Z" fill="#3a2818" />
      <path d="M43 72.5 L50 92 L57 72.5 Z" fill="#181210" />
      <Neck fill={c.u('skin')} />
      <path d="M37 44 C35 54 35 64 37 72 L41 68 C40 60 40 52 40.5 46 Z M63 44 C65 54 65 64 63 72 L59 68 C60 60 60 52 59.5 46 Z" fill="#4a3a2c" />
      <Head c={c} />
      <Face c={c} eye="#8a2020" brow="#24180e" browWidth={1.6} mouth="none" />
      <FaceShade c={c} />
      <path
        d="M41.5 55.3 C44.5 52 48 53 50 54.3 C52 53 55.5 52 58.5 55.3 C56 57.6 52.5 56.4 50 55.6 C47.5 56.4 44 57.6 41.5 55.3 Z"
        fill="#3a2818"
      />
      <path d="M23 34.5 C30 30 70 30 77 34.5 C70 38.5 30 38.5 23 34.5 Z" fill="#2a1e14" />
      <path d="M36.5 33.5 C36 23 40.5 18 50 18 C59.5 18 64 23 63.5 33.5 Z" fill={c.u('hat')} />
      <path d="M44 19.6 Q50 23 56 19.6" stroke="#1c140c" strokeWidth={1} fill="none" />
      <path d="M36.6 30.5 C45 29 55 29 63.4 30.5 L63.5 33.5 C55 32 45 32 36.5 33.5 Z" fill="#140e08" />
      <path d="M23 34.5 C30 30 50 29.6 60 30" fill="none" stroke={c.u('rim')} strokeWidth={0.9} />
    </>
  ),

  werewolf: wolf({ fur: '#808898', furDark: '#1c2028', muzzle: '#a2a8b3', eye: '#ff9a3c' }),
  wolfCub: wolf({ fur: '#f4f4f7', furDark: '#8b8e98', muzzle: '#ffffff', eye: '#ff4a4a', cub: true }),
  loneWolf: (c) => (
    <>
      <circle cx={72} cy={20} r={14} fill="#f5f5f7" opacity={0.13} />
      {wolf({ fur: '#aab0ba', furDark: '#22262c', muzzle: '#d2d6dc', eye: '#ffd23c', stripes: true, scar: true })(c)}
    </>
  ),

  sorceress: (c) => (
    <>
      <defs>
        <Grad id={c.id('hair')} stops={[[0, '#2e1c2e'], [1, '#040204']]} />
        <Grad id={c.id('robe')} stops={[[0, '#1e3d2b'], [1, '#040a06']]} />
        <Grad id={c.id('collar')} stops={[[0, '#2f6040'], [1, '#08160d']]} />
        <Grad id={c.id('horn')} stops={[[0, '#ece2d2'], [1, '#655949']]} />
      </defs>
      <path
        d="M33 46 C29 26 40 18 50 18 C60 18 71 26 67 46 C70 60 72 72 76 87 L62 83 L60 58 L40 58 L38 83 L24 87 C28 72 30 60 33 46 Z"
        fill={c.u('hair')}
      />
      <Bust fill={c.u('robe')} c={c} />
      <Neck fill={c.u('pale')} />
      <path d="M27 76.5 L35 60 L42 72 L50 63 L58 72 L65 60 L73 76.5 L62 81.5 L50 78.5 L38 81.5 Z" fill={c.u('collar')} stroke="#c9a24a" strokeWidth={0.5} />
      <path d="M50 80 L52.4 83.5 L50 87 L47.6 83.5 Z" fill="#c8102e" />
      <Head c={c} fill={c.u('pale')} />
      <path d="M37 42 C38 30 44 26 50 27 C56 26 62 30 63 42 C60 35 55 32 50 34 C45 32 40 35 37 42 Z" fill={c.u('hair')} />
      <Face c={c} glow="#ff4a6a" lips="#5a0a1a" mouth="smirk" brow="#1a0c14" browWidth={1.3} />
      <FaceShade c={c} />
      <path d="M39.5 30 C32 25 29 14 35 8 C34.5 15 37 21 43.5 25.5 Z M60.5 30 C68 25 71 14 65 8 C65.5 15 63 21 56.5 25.5 Z" fill={c.u('horn')} />
      <path d="M35.5 18 L38.5 17 M36.5 22.4 L39.6 21.2 M64.5 18 L61.5 17 M63.5 22.4 L60.4 21.2" stroke="#4a4036" strokeWidth={0.6} />
    </>
  ),

  vampire: (c) => (
    <>
      <defs>
        <Grad id={c.id('cape')} stops={[[0, '#40125a'], [1, '#0c0212']]} />
        <Grad id={c.id('hair')} stops={[[0, '#30303a'], [1, '#040406']]} />
      </defs>
      <path d="M21 85 L29 45 L43 68 Z M79 85 L71 45 L57 68 Z" fill={c.u('cape')} />
      <path d="M25 81 L30 51 L40 68 Z M75 81 L70 51 L60 68 Z" fill="#6b0f1e" opacity={0.9} />
      <path d="M21 85 L29 45" fill="none" stroke={c.u('rim')} strokeWidth={1} />
      <Bust fill={c.u('cape')} c={c} />
      <Neck fill={c.u('pale')} />
      <path d="M44 72 L50 80 L56 72 L53 70 L50 72.5 L47 70 Z" fill="#e8e2ea" />
      <circle cx={50} cy={76} r={1.6} fill="#c8102e" />
      <Head c={c} fill={c.u('pale')} />
      <Face c={c} glow="#ff2a3a" lips="#5a0a14" mouth="neutral" brow="#0c0c10" browWidth={1.3} />
      <path d="M47 57.2 L47.8 60.2 L48.6 57.5 Z M53 57.2 L52.2 60.2 L51.4 57.5 Z" fill="#fff" />
      <FaceShade c={c} />
      <path
        d="M36.5 44 C35 28 42 22 50 22 C58 22 65 28 63.5 44 C62 36 58 31.5 53 32 L50 36.8 L47 32 C42 31.5 38 36 36.5 44 Z"
        fill={c.u('hair')}
      />
      <path d="M40 27 Q45 23.5 50 23.4" stroke="#8a8aa0" strokeWidth={0.6} opacity={0.6} fill="none" />
    </>
  ),

  cultLeader: (c) => (
    <>
      <defs>
        <Grad id={c.id('cape')} stops={[[0, '#a51e2c'], [1, '#2a0408']]} />
        <Grad id={c.id('shirt')} stops={[[0, '#1a4428'], [1, '#051008']]} />
        <Grad id={c.id('gold')} stops={[[0, '#efcd6c'], [1, '#8a6420']]} />
        <Grad id={c.id('hair')} stops={[[0, '#e6c870'], [1, '#7a5a1c']]} />
      </defs>
      <Bust fill={c.u('cape')} c={c} />
      <path d="M40 74 L50 101 L60 74 Z" fill={c.u('shirt')} />
      <path d="M27 82 Q32 92 30 101 M73 82 Q68 92 70 101" stroke="#000" strokeOpacity={0.3} strokeWidth={1.2} fill="none" />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <Face c={c} eye="#2a6a3a" brow="#5a4214" browWidth={1.4} mouth="flat" />
      <FaceShade c={c} />
      <path
        d="M36.8 44 C35 29 42 23.5 50 23.5 C59 23.5 65 29 63.2 44 C62 37 59 33 55 31.5 C50 30 43 31 39.5 35 C38 38 37.2 41 36.8 44 Z"
        fill={c.u('hair')}
      />
      <circle cx={50} cy={85} r={10} fill={c.u('glow')} />
      <circle cx={50} cy={85} r={4.6} fill={c.u('gold')} />
      <path d="M50 85 a1 1 0 0 1 1 1 a2 2 0 0 1 -2 2 a3 3 0 0 1 -3 -3 a3.6 3.6 0 0 1 3.6 -3.6" stroke="#3a2a0a" strokeWidth={0.8} fill="none" />
    </>
  ),
  // --- Expansion portraits (modelled on the Ultimate Werewolf Deluxe card art) ---

  apprenticeSeer: (c) => (
    <>
      <defs>
        <Grad id={c.id('hood')} stops={[[0, '#ece6f4'], [0.6, '#a69bbb'], [1, '#4a4060']]} />
        <Grad id={c.id('hair')} stops={[[0, '#f0d488'], [1, '#9a7a34']]} />
        <Radial id={c.id('orbGlow')} stops={[[0, '#b8ffd8', 0.75], [0.5, '#4fe09a', 0.25], [1, '#4fe09a', 0]]} />
        <Radial id={c.id('orb')} cx={0.4} cy={0.35} stops={[[0, '#f0fff6'], [0.5, '#8ef0bc'], [1, '#1c8a58']]} />
      </defs>
      <path d="M30 56 C27 32 37 19 50 19 C63 19 73 32 70 56 C72 68 76 80 82 101 L18 101 C24 80 28 68 30 56 Z" fill={c.u('hood')} />
      <Bust fill={c.u('hood')} c={c} />
      <ellipse cx={50} cy={46} rx={15} ry={19} fill="#2b2238" opacity={0.6} />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <path d="M37.6 42 C38 33 44 29.5 50 29.5 C56 29.5 62 33 62.4 42 C59 36.5 54 34.5 50 35 C46 34.5 41 36.5 37.6 42 Z" fill={c.u('hair')} />
      <path d="M38 37.5 Q50 33.4 62 37.5" stroke="#d9b45a" strokeWidth={0.9} fill="none" />
      <path d="M48.4 33.4 A2.1 2.1 0 1 0 51.9 34.8 A1.6 1.6 0 1 1 48.4 33.4 Z" fill="#f2d272" />
      <Face c={c} eye="#5a7a3a" lips="#9a4a4a" brow="#8a6a34" />
      <FaceShade c={c} />
      <circle cx={61.6} cy={54.4} r={1.1} fill="#e6c260" />
      <path d="M30 56 C27 32 37 19 50 19" fill="none" stroke={c.u('rim')} strokeWidth={1} />
      <circle cx={31} cy={78} r={15} fill={c.u('orbGlow')} />
      <circle cx={31} cy={78} r={8} fill={c.u('orb')} />
      <ellipse cx={28.6} cy={75.6} rx={2.2} ry={1.4} fill="#fff" opacity={0.75} />
      <ellipse cx={37} cy={86} rx={5.2} ry={3.4} fill={c.u('skin')} />
      <path d="M33.5 84 L30 80.5 M35.6 83 L32.8 78.6" stroke={c.u('skin')} strokeWidth={1.6} strokeLinecap="round" />
    </>
  ),

  auraSeer: (c) => (
    <>
      <defs>
        <Grad id={c.id('hair')} stops={[[0, '#c0485a'], [0.5, '#7a1a30'], [1, '#2a0610']]} />
        <Grad id={c.id('dress')} stops={[[0, '#4e2e86'], [1, '#140a28']]} />
        <Radial id={c.id('orbGlow')} stops={[[0, '#ff6a7a', 0.7], [1, '#ff2a3a', 0]]} />
        <Radial id={c.id('orb')} cx={0.38} cy={0.32} stops={[[0, '#ffc0c8'], [0.5, '#c8203a'], [1, '#3a0010']]} />
      </defs>
      <path
        d="M34 44 C31 26 40 20 50 20 C61 20 69 27 66 44 C69 58 71 72 77 90 L60 86 C58 74 58 64 58 58 L42 58 C42 64 42 74 40 86 L23 90 C29 72 31 58 34 44 Z"
        fill={c.u('hair')}
      />
      <Bust fill={c.u('skin')} c={c} />
      <path d="M18 101 C22 90 34 86.5 50 88 C66 86.5 78 90 82 101 Z" fill={c.u('dress')} />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <path d="M37 43 C37.5 31 45 27.5 53 28.5 C59 29.5 63 34 62.8 42 C58 35 51 33 45 35.5 C41 37 38.6 39.6 37 43 Z" fill={c.u('hair')} />
      <path
        d="M40 44.2 C40 40.4 44 39.2 47.2 42 C48.4 44.2 47.2 47.2 44 47.6 C41.8 47.8 40.4 46.4 40 44.2 Z M60 44.2 C60 40.4 56 39.2 52.8 42 C51.6 44.2 52.8 47.2 56 47.6 C58.2 47.8 59.6 46.4 60 44.2 Z"
        fill="#8a6ad8"
        opacity={0.8}
      />
      <path d="M50 37.6 L48.6 39.6 L50 41 L51.4 39.6 Z" fill="#8a6ad8" opacity={0.9} />
      <Face c={c} eye="#c03a5a" lips="#8a2a3a" mouth="flat" brow="#4a0a1a" />
      <FaceShade c={c} />
      <circle cx={65} cy={70} r={12} fill={c.u('orbGlow')} />
      <circle cx={65} cy={70} r={6.5} fill={c.u('orb')} />
      <ellipse cx={63} cy={68} rx={1.8} ry={1.1} fill="#fff" opacity={0.7} />
      <ellipse cx={65} cy={78} rx={6.4} ry={3.6} fill={c.u('skin')} />
      <g fill="#1a0a1a">
        <circle cx={60.4} cy={75.6} r={0.8} />
        <circle cx={63} cy={74.6} r={0.8} />
        <circle cx={66} cy={74.6} r={0.8} />
        <circle cx={68.8} cy={75.4} r={0.8} />
      </g>
    </>
  ),

  pi: (c) => (
    <>
      <defs>
        <Grad id={c.id('hair')} stops={[[0, '#54392a'], [1, '#160c06']]} />
        <Grad id={c.id('vest')} stops={[[0, '#6a4480'], [1, '#1e0f26']]} />
        <Grad id={c.id('shirt')} stops={[[0, '#f2eadc'], [1, '#9a9080']]} />
      </defs>
      <Bust fill={c.u('vest')} c={c} />
      <path d="M38 101 L42 74 L50 78 L58 74 L62 101 Z" fill={c.u('shirt')} />
      <Neck fill={c.u('skin')} />
      <path d="M40.5 72 C42 65.5 58 65.5 59.5 72 L57 77 L50 74.5 L43 77 Z" fill={c.u('shirt')} />
      <Head c={c} />
      <path
        d="M36.5 44 C33 34 37 25 44 23 C46 20 52 20 55 22.5 C61 22 66 28 64.5 36 C66 40 64.5 44 63.5 45 C62 38 58 33 50 33.5 C43 33 39 37 36.5 44 Z"
        fill={c.u('hair')}
      />
      <g fill={c.u('hair')}>
        <circle cx={38} cy={33} r={3} />
        <circle cx={43} cy={25.6} r={3.2} />
        <circle cx={50} cy={22.6} r={3.4} />
        <circle cx={57} cy={24.4} r={3.2} />
        <circle cx={62.4} cy={30} r={3} />
      </g>
      <Face c={c} eye="#2a1a10" brow="#24160c" browWidth={1.4} mouth="flat" />
      <FaceShade c={c} />
      <path d="M36 56.6 L40.4 70" stroke="#6a4a2a" strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={34} cy={48} r={8.6} fill="#c8deee" fillOpacity={0.32} stroke="#8a6a4a" strokeWidth={1.7} />
      <path d="M29.4 44.6 Q31.4 41.6 35 41.4" stroke="#fff" strokeOpacity={0.7} strokeWidth={0.9} fill="none" />
      <ellipse cx={40.4} cy={69} rx={4.4} ry={3.6} fill={c.u('skin')} />
    </>
  ),

  priest: (c) => (
    <>
      <defs>
        <Grad id={c.id('robe')} stops={[[0, '#80502c'], [1, '#22120a']]} />
        <Grad id={c.id('hair')} stops={[[0, '#6e4c2c'], [1, '#2a1a0c']]} />
        <Grad id={c.id('book')} x2={1} y2={1} stops={[[0, '#262c3c'], [1, '#05070c']]} />
      </defs>
      <Bust fill={c.u('robe')} c={c} />
      <Neck fill={c.u('skin')} />
      <path d="M40 70 C42 64 58 64 60 70 L60 74.5 C56 72.4 44 72.4 40 74.5 Z" fill="#5a3418" />
      <Head c={c} />
      <path d="M37 42 C36 30 42 25.5 50 25.5 C58 25.5 64 30 63 42 C61 35 57 32 50 32 C43 32 39 35 37 42 Z" fill={c.u('hair')} />
      <Face c={c} eye="#2a62b8" brow="#3a2414" mouth="smirk" />
      <FaceShade c={c} />
      <path d="M56 76 L80 72 L84 98 L60 101 Z" fill={c.u('book')} />
      <path d="M58.6 78.4 L78.4 75 L81.6 96 L61.6 98.8 Z" fill="none" stroke="#c9a24a" strokeWidth={0.6} />
      <path d="M80 72 L83 71 L87 97 L84 98 Z" fill="#e8e0c8" />
      <ellipse cx={66} cy={97} rx={5.4} ry={3.2} fill={c.u('skin')} />
    </>
  ),

  mason: (c) => (
    <>
      <defs>
        <Grad id={c.id('cloak')} stops={[[0, '#2a3e30'], [1, '#070c09']]} />
        <Grad id={c.id('cap')} stops={[[0, '#26382e'], [1, '#0a120e']]} />
      </defs>
      <Bust fill={c.u('cloak')} c={c} />
      <Neck fill={c.u('skin')} />
      <path d="M33 77 C35 65 41 60.5 44 60.5 L50 70 L56 60.5 C59 60.5 65 65 67 77 L58 81 L50 74.5 L42 81 Z" fill="#30483a" />
      <Head c={c} />
      <path d="M37 45 C36.5 40.5 37.4 37.4 39 35.4 L40.4 45 Z M63 45 C63.5 40.5 62.6 37.4 61 35.4 L59.6 45 Z" fill="#b0b0ac" />
      <Face c={c} eye="#4a8090" brow="#8a8a86" mouth="smirk" lips="#7a4a3a" wrinkles />
      <FaceShade c={c} />
      <path d="M35.5 36.4 C35 27 42 22 50 22 C59 22 65.5 27 64.5 36.4 C58 33.8 42 33.8 35.5 36.4 Z" fill={c.u('cap')} />
      <path d="M35.5 36.4 C42 33.8 58 33.8 64.5 36.4 L64.6 38 C58 35.6 42 35.6 35.4 38 Z" fill="#05080a" />
      <circle cx={50} cy={27.6} r={3.3} fill="#a01a20" stroke="#d9b45a" strokeWidth={0.7} />
      <path d="M48.3 29.2 L50 25.9 L51.7 29.2 M48.6 28.2 L51.4 28.2" stroke="#e6c260" strokeWidth={0.55} fill="none" />
    </>
  ),

  mayor: (c) => (
    <>
      <defs>
        <Grad id={c.id('coat')} stops={[[0, '#347a88'], [1, '#0a1e26']]} />
        <Grad id={c.id('hair')} stops={[[0, '#8e4e2c'], [1, '#3a1a0c']]} />
        <Grad id={c.id('badge')} x2={1} y2={1} stops={[[0, '#e2a462'], [1, '#6a3c16']]} />
      </defs>
      <Bust fill={c.u('coat')} c={c} />
      <path d="M28 76 L42 69 L50 92 L58 69 L72 76 L66 101 L34 101 Z" fill="#285a66" />
      <path d="M43 70 L50 90 L57 70 Z" fill="#1c3c48" />
      <path d="M45.4 74 L54.6 74 M46.4 78 L53.6 78 M47.4 82 L52.6 82" stroke="#3a7080" strokeWidth={1} />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <path d="M37 42 C35.5 30 42 24 51 24 C59 24 64.5 29 63.3 41 C61 33 56 30 49 30.5 C43 31 39 35 37 42 Z" fill={c.u('hair')} />
      <path d="M42 28 Q49 25.6 57 27.6" stroke="#c07a4a" strokeOpacity={0.6} strokeWidth={0.8} fill="none" />
      <Face c={c} eye="#4a6a7a" brow="#5a2a14" mouth="smirk" />
      <FaceShade c={c} />
      <rect x={26} y={84} width={9} height={11} rx={1.6} transform="rotate(-10 30.5 89.5)" fill={c.u('badge')} stroke="#4a2a10" strokeWidth={0.6} />
      <path d="M28.6 87 L32.6 86.3 M28.9 89.6 L32.9 88.9 M29.2 92.2 L33.2 91.5" stroke="#4a2a10" strokeWidth={0.5} />
    </>
  ),

  toughGuy: (c) => (
    <>
      <defs>
        <Grad id={c.id('vest')} stops={[[0, '#70401f'], [1, '#1e0e06']]} />
        <Grad id={c.id('shirt')} stops={[[0, '#ece0cf'], [1, '#8a8070']]} />
        <Grad id={c.id('hair')} stops={[[0, '#80502c'], [1, '#3a1e0e']]} />
      </defs>
      <Bust fill={c.u('shirt')} c={c} wide />
      <path d="M8 101 C10 86 21 76.5 34 73.5 L44 86 L48 101 Z M92 101 C90 86 79 76.5 66 73.5 L56 86 L52 101 Z" fill={c.u('vest')} />
      <path d="M42 72 L50 80 L58 72" stroke="#bfb3a2" strokeWidth={1} fill="none" />
      <Neck fill={c.u('skin')} thick />
      <Head c={c} />
      <path d="M37 41 C36 30 42 25 50 25 C58 25 64 30 63 41 C61 34 56 31.5 50 31.5 C44 31.5 39 34 37 41 Z" fill={c.u('hair')} />
      <ellipse cx={50} cy={55} rx={10.4} ry={7} fill="#3a2414" opacity={0.26} />
      <Face c={c} eye="#3a2414" brow="#3a1e0e" browWidth={1.6} mouth="flat" />
      <FaceShade c={c} />
    </>
  ),

  villageIdiot: (c) => (
    <>
      <defs>
        <Grad id={c.id('purple')} stops={[[0, '#6e5eb0'], [1, '#261c4c']]} />
        <Grad id={c.id('yellow')} stops={[[0, '#f0cc52'], [1, '#8a6a10']]} />
        <Grad id={c.id('cap')} stops={[[0, '#d23a2e'], [1, '#5a0a0a']]} />
      </defs>
      <Bust fill={c.u('purple')} c={c} />
      <path d="M50 73.5 C74 74.5 90 83 92 101 L50 101 Z" fill={c.u('yellow')} />
      <path d="M50 74 L50 86 M47 77 L53 83 M53 77 L47 83" stroke="#2a1a10" strokeWidth={1} />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <path d="M37 42 C37.6 38 39.4 35.4 42 34 L40.4 45 Z M63 42 C62.4 38 60.6 35.4 58 34 L59.6 45 Z" fill="#5a3a1e" />
      <Face c={c} eye="#4a3a20" brow="#3a2410" mouth="grin" gap lips="#7a3a2a" />
      <FaceShade c={c} />
      <path d="M35 39 C33 27 42 20 51 20 C61 20 68 25 66 33 C67 35 66 38 64 40 C58 35 44 34 35 39 Z" fill={c.u('cap')} />
      <path d="M35 39 C44 34 58 35 64 40 L63.5 42 C57 37.5 44 37 35.4 41.5 Z" fill="#8a1a14" />
    </>
  ),

  pacifist: (c) => (
    <>
      <defs>
        <Grad id={c.id('dress')} stops={[[0, '#5e4e24'], [1, '#1a1408']]} />
        <Grad id={c.id('scarf')} stops={[[0, '#76662c'], [1, '#2a220c']]} />
        <Grad id={c.id('hair')} stops={[[0, '#c05a30'], [1, '#5a1e0a']]} />
      </defs>
      <path d="M58 34 C66 40 69 56 65 74 L60 72 C62 58 61 46 58 40 Z" fill={c.u('hair')} />
      <Bust fill={c.u('skin')} c={c} />
      <path d="M12 101 C14 90 22 84 33 82 L64 74 C72 80 84 88 88 101 Z" fill={c.u('dress')} />
      <path d="M66 76 L69 66" stroke="#3a2c10" strokeWidth={1} />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <path d="M36.6 42.4 C36 46.4 37 50 38.6 52.4 L40 44.6 Z" fill={c.u('hair')} />
      <path d="M36 40 C35 28 42 22 50 22 C59 22 65 28 64 38 C60 32 55 29.5 50 29.5 C44 29.5 39 33 36 40 Z" fill={c.u('scarf')} />
      <Face c={c} eye="#5a3420" lips="#b04e4e" mouth="smirk" brow="#7a3014" />
      <g fill="#a8582e" opacity={0.45}>
        <circle cx={43.6} cy={50.4} r={0.5} />
        <circle cx={45.4} cy={51.2} r={0.5} />
        <circle cx={55} cy={50.6} r={0.5} />
        <circle cx={56.6} cy={51.4} r={0.5} />
      </g>
      <FaceShade c={c} />
    </>
  ),

  ghost: (c) => (
    <>
      <defs>
        <Radial id={c.id('spirit')} cx={0.4} cy={0.36} r={0.7} stops={[[0, '#c8fff0'], [0.55, '#6ab8aa'], [1, '#1e4e48']]} />
        <Grad id={c.id('robe')} stops={[[0, '#3e8478'], [1, '#08201c']]} />
        <Radial id={c.id('aura')} stops={[[0, '#9ef0dc', 0.35], [1, '#9ef0dc', 0]]} />
      </defs>
      <circle cx={50} cy={50} r={40} fill={c.u('aura')} />
      <g opacity={0.92}>
        <path
          d="M36 44 C34 28 42 22 50 22 C58 22 66 28 64 44 C66 58 67 70 70 84 L60 82 L59 58 L41 58 L40 82 L30 84 C33 70 34 58 36 44 Z"
          fill="#24564e"
        />
        <Bust fill={c.u('robe')} c={c} />
        <Neck fill={c.u('spirit')} />
        <Head c={c} fill={c.u('spirit')} />
        <path d="M42.4 52 Q44 56 46.4 57.4 M57.6 52 Q56 56 53.6 57.4" stroke="#0e2a26" strokeOpacity={0.5} strokeWidth={0.9} fill="none" />
        <Face c={c} glow="#f0fffa" brow="#1e4a44" browWidth={1.3} mouth="flat" lips="#2a5a52" />
        <path d="M38 41 C38.5 31 44 28 50 28 C56 28 61.5 31 62 41 C58 34 54 33 50 33.4 C46 33 42 34 38 41 Z" fill="#24564e" />
      </g>
      <path d="M27 93 C23 79 23 64 30 53 C34 62 34 79 30 93 Z" fill="#dcecef" opacity={0.85} />
      <path d="M30 53 L28.6 93" stroke="#8aa8ac" strokeWidth={0.6} />
      <ellipse cx={31} cy={94} rx={5.4} ry={3.2} fill={c.u('spirit')} />
    </>
  ),

  oldHag: (c) => (
    <>
      <defs>
        <Grad id={c.id('hood')} stops={[[0, '#70502e'], [1, '#1e1208']]} />
      </defs>
      <path d="M29 56 C27 32 37 20 50 20 C63 20 73 32 71 56 C71 66 68 72 64 76.5 L36 76.5 C32 72 29 66 29 56 Z" fill={c.u('hood')} />
      <path d="M29 56 C27 32 37 20 50 20" fill="none" stroke={c.u('rim')} strokeWidth={1} />
      <Bust fill={c.u('hood')} c={c} />
      <ellipse cx={50} cy={47} rx={15.5} ry={19.5} fill="#120a04" opacity={0.7} />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <path d="M38 41 C38.5 33 44 29.5 50 29.5 C56 29.5 61.5 33 62 41 C59 35.5 54 33.5 50 34 C46 33.5 41 35.5 38 41 Z" fill="#bab6b0" />
      <Face c={c} eye="#5a2a1e" brow="#8a8680" mouth="frown" lips="#7a4a44" wrinkles />
      <FaceShade c={c} />
      <path d="M45 66 L50 71 L55 66 L50 75 Z" fill="#4a2e16" />
      <path d="M60 58 C64 66 66 76 64 90 C62 84 61 76 58 66 Z" fill="#c8c4bc" />
      <path d="M59.6 64 L62.6 63 M60.8 70 L64 69 M61.6 76 L64.8 75.4 M62.4 82 L64.8 81.6" stroke="#8a8680" strokeWidth={0.6} />
    </>
  ),

  troublemaker: (c) => (
    <>
      <defs>
        <Grad id={c.id('blouse')} stops={[[0, '#f6e6e6'], [1, '#a89090']]} />
        <Grad id={c.id('bodice')} stops={[[0, '#2e2020'], [1, '#080404']]} />
        <Grad id={c.id('hair')} stops={[[0, '#d44a2c'], [1, '#5a140a']]} />
      </defs>
      <circle cx={50} cy={22} r={8} fill={c.u('hair')} />
      <Bust fill={c.u('blouse')} c={c} />
      <ellipse cx={17} cy={88} rx={12} ry={9} fill={c.u('blouse')} />
      <ellipse cx={83} cy={88} rx={12} ry={9} fill={c.u('blouse')} />
      <path d="M33 87 C40 83 60 83 67 87 L65 101 L35 101 Z" fill={c.u('bodice')} />
      <path d="M46 90 L54 96 M54 90 L46 96" stroke="#d8c8b0" strokeWidth={0.9} />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <path d="M36.5 44 C35 30 42 24 50 24 C58 24 65 30 63.5 44 C62 37 58 33 50 33 C42 33 38 37 36.5 44 Z" fill={c.u('hair')} />
      <path d="M37 44 C34 50 35 56 37 58 M63 44 C66 50 65 56 63 58" stroke="#b03a20" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Face c={c} eye="#4a6a3a" lips="#a02a3a" mouth="grin" brow="#7a2410" browWidth={1.3} />
      <FaceShade c={c} />
    </>
  ),

  leprechaun: (c) => (
    <>
      <defs>
        <Grad id={c.id('coat')} stops={[[0, '#2e6232'], [1, '#0a1e0c']]} />
        <Grad id={c.id('hat')} stops={[[0, '#428846'], [1, '#0e2a12']]} />
        <Grad id={c.id('beard')} stops={[[0, '#e06e2e'], [1, '#7a2a0a']]} />
      </defs>
      <Bust fill={c.u('coat')} c={c} />
      <path d="M42 72 L50 85 L58 72 Z" fill="#ece4d4" />
      <path d="M43 76 L50 79 L57 76 L57 82.4 L50 79.6 L43 82.4 Z" fill="#2a7a3a" />
      <Neck fill={c.u('skin')} />
      <path d="M37.6 44 L30.6 35 L36.4 51 Z M62.4 44 L69.4 35 L63.6 51 Z" fill={c.u('skin')} />
      <Head c={c} />
      <path d="M37 48 C36 62 42 72.5 50 73.5 C58 72.5 64 62 63 48 C60 56.4 55 58.4 50 58.4 C45 58.4 40 56.4 37 48 Z" fill={c.u('beard')} />
      <Face c={c} eye="#3a8a3a" brow="#a8401a" mouth="grin" lips="#7a2a14" />
      <FaceShade c={c} />
      <ellipse cx={50} cy={33} rx={19} ry={4.2} fill="#1e4a22" />
      <path d="M38 33 C37 22 42 16 50 16 C58 16 63 22 62 33 Z" fill={c.u('hat')} />
      <rect x={38.2} y={29} width={23.6} height={3.6} fill="#12100a" />
      <rect x={46} y={28.4} width={8} height={4.8} rx={0.6} fill="none" stroke="#d9b45a" strokeWidth={1.2} />
    </>
  ),

  drunk: (c) => (
    <>
      <defs>
        <Grad id={c.id('hat')} stops={[[0, '#704428'], [1, '#2a160a']]} />
        <Grad id={c.id('vest')} stops={[[0, '#5e3620'], [1, '#1e0e06']]} />
        <Grad id={c.id('shirt')} stops={[[0, '#f2ebdf'], [1, '#9a9284']]} />
        <Grad id={c.id('beer')} stops={[[0, '#f6b03a'], [1, '#8a4a08']]} />
      </defs>
      <Bust fill={c.u('shirt')} c={c} />
      <path d="M10 101 C12 87 22 77.5 34 74.5 L42 88 L44 101 Z M90 101 C88 87 78 77.5 66 74.5 L58 88 L56 101 Z" fill={c.u('vest')} />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <path d="M37 44 C36 39 38 35.6 40.4 34 L41.2 46 Z M63 44 C64 39 62 35.6 59.6 34 L58.8 46 Z" fill="#6a3e20" />
      <Face c={c} eye="#4a3420" brow="#5a3418" mouth="smirk" />
      <path d="M41.8 44.4 Q45.2 42.6 48.6 44.4 L48.6 43 L41.8 43 Z M51.4 44.4 Q54.8 42.6 58.2 44.4 L58.2 43 L51.4 43 Z" fill={c.u('skin')} />
      <FaceShade c={c} />
      <path d="M27 35 C33 31 67 31 73 35 C67 38.5 33 38.5 27 35 Z" fill="#4a2c16" />
      <path d="M37 34 C36 24 41 19 50 19 C59 19 64 24 63 34 Z" fill={c.u('hat')} />
      <path d="M37.2 30.6 C45 29 55 29 62.8 30.6 L63 34 C55 32.4 45 32.4 37 34 Z" fill="#e8e2d6" />
      <rect x={19} y={72} width={17} height={22} rx={2} fill={c.u('beer')} />
      <rect x={21} y={74} width={3} height={17} rx={1.4} fill="#fff" opacity={0.3} />
      <ellipse cx={27.5} cy={72} rx={9} ry={3.2} fill="#fffaf0" />
      <path d="M36 76 C42 76 42 88 36 88" stroke="#d8d0c0" strokeWidth={2} fill="none" />
      <ellipse cx={38.4} cy={82} rx={4.6} ry={6.2} fill={c.u('skin')} />
    </>
  ),

  cupid: (c) => (
    <>
      <defs>
        <Grad id={c.id('toga')} stops={[[0, '#f4eee4'], [1, '#b0a698']]} />
        <Grad id={c.id('hair')} stops={[[0, '#704828'], [1, '#2a1608']]} />
      </defs>
      <path d="M17 79 L29 52 L37.5 56 L25.5 83 Z" fill="#c9b08a" />
      <path d="M31 54 L26 34 M33.4 55 L31 32.6 M35.6 56 L36 34" stroke="#6a4a2a" strokeWidth={1} />
      <g fill="#f4f4f8">
        <path d="M26 34 L23.6 28 L27.4 30.4 L28 26.6 L29.4 33 Z" />
        <path d="M31 32.6 L29.6 26.4 L32.6 29.4 L33.8 25.8 L33.6 32.4 Z" />
        <path d="M36 34 L35.6 27.6 L38 31 L39.8 27.8 L38.4 34.4 Z" />
      </g>
      <path
        d="M35 46 C32 32 38 22 48 21 C58 20 67 27 65 40 C67 48 66 56 63 60 L60 50 L40 50 L37 60 C35 56 34 51 35 46 Z"
        fill={c.u('hair')}
      />
      <path d="M62.4 44 C68.4 52 66.4 62 60 64.4" stroke="#9a5ab0" strokeWidth={2} fill="none" strokeLinecap="round" />
      <Bust fill={c.u('skin')} c={c} />
      <path d="M20 101 C24 90 34 85 46 86 L70 76 C78 84 84 92 84 101 Z" fill={c.u('toga')} />
      <path d="M29 77 L60 101 L66.4 101 L35.4 75 Z" fill="#6a3a1c" />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <circle cx={50} cy={22.6} r={6.6} fill={c.u('hair')} />
      <path d="M37.5 42 C38 32 44 28.5 50 28.5 C56 28.5 62 32 62.5 42 C59 36 54 34 50 34.5 C46 34 41 36 37.5 42 Z" fill={c.u('hair')} />
      <path d="M38 36.6 Q50 32.6 62 36.6" stroke="#d9b45a" strokeWidth={1.4} fill="none" />
      <Face c={c} eye="#5a3a1a" lips="#8a3a3a" mouth="smirk" brow="#4a2a10" />
      <FaceShade c={c} />
    </>
  ),

  doppelganger: (c) => (
    <>
      <defs>
        <Grad id={c.id('dark')} stops={[[0, '#3e281a'], [1, '#100604']]} />
        <Grad id={c.id('blond')} stops={[[0, '#f4dc94'], [1, '#a8843a']]} />
        <Radial id={c.id('violet')} cx={0.6} cy={0.38} r={0.75} stops={[[0, '#a898ec'], [0.6, '#6a58b8'], [1, '#2e2464']]} />
      </defs>
      <path d="M50 21.5 C40 21.5 33 27 35.5 44 C34 58 32 70 26 87 L40 85 C42 74 42 64 42 58 L50 58 Z" fill={c.u('dark')} />
      <path d="M50 21.5 C60 21.5 67 27 64.5 44 C66 58 68 70 74 87 L60 85 C58 74 58 64 58 58 L50 58 Z" fill={c.u('blond')} />
      <Bust fill={c.u('violet')} c={c} />
      <path d="M50 73.5 C74 74.5 90 83 92 101 L50 101 Z" fill={c.u('skin')} />
      <path d="M38 90 L50 92 L50 101 L34 101 Z" fill="#2a1a1a" />
      <path d="M50 92 L64 88 L68 101 L50 101 Z" fill="#e8b4be" />
      <path d="M22 84 L28 88 M18 90 L25 93 M27 79 L32 83" stroke="#221a4e" strokeWidth={1.4} strokeLinecap="round" />
      <Neck fill={c.u('skin')} />
      <path d="M43.5 57 L50 57 L50 76 L42.2 76 Z" fill={c.u('violet')} />
      <Head c={c} />
      <path d="M50 30.5 A12.5 15.5 0 0 0 50 61.5 Z" fill={c.u('violet')} />
      <path d="M39.6 40 L44.6 41.6 M38.8 47 L43.8 47.6 M40.4 53 L45 52.2" stroke="#221a4e" strokeWidth={1.2} strokeLinecap="round" />
      <Face c={c} eye="#c06020" lips="#a02a3a" mouth="smirk" brow="#2a1a10" />
      <path d="M37.5 42 C38 32 44 28.5 50 28.5 L50 34 C45 34 40 37 37.5 42 Z" fill={c.u('dark')} />
      <path d="M62.5 42 C62 32 56 28.5 50 28.5 L50 34 C55 34 60 37 62.5 42 Z" fill={c.u('blond')} />
      <path d="M50 28 L50 101" stroke="#000" strokeOpacity={0.15} strokeWidth={0.6} />
    </>
  ),

  virginiaWoolf: (c) => (
    <>
      <defs>
        <Grad id={c.id('blouse')} stops={[[0, '#efede8'], [1, '#8a8680']]} />
        <Grad id={c.id('hair')} stops={[[0, '#6e4428'], [1, '#2a160a']]} />
      </defs>
      <circle cx={61} cy={53} r={6.4} fill={c.u('hair')} />
      <Bust fill={c.u('blouse')} c={c} />
      <path d="M36 80 Q42 92 40 101 M64 80 Q58 92 60 101 M46 84 Q50 92 49 101" stroke="#000" strokeOpacity={0.18} strokeWidth={1} fill="none" />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <path d="M37 46 C35 30 42 24.5 50 24.5 C58 24.5 65 30 63 46 C61.4 37 57 32.4 50 33 C43 32.4 38.6 37 37 46 Z" fill={c.u('hair')} />
      <Face c={c} eye="#4a3420" brow="#3a2010" mouth="flat" lips="#8a4a40" />
      <path d="M41.8 44.6 Q45.2 43.2 48.6 44.6 L48.6 43.4 L41.8 43.4 Z M51.4 44.6 Q54.8 43.2 58.2 44.6 L58.2 43.4 L51.4 43.4 Z" fill={c.u('skin')} />
      <FaceShade c={c} />
    </>
  ),

  tanner: (c) => (
    <>
      <defs>
        <Grad id={c.id('vest')} stops={[[0, '#70703c'], [1, '#22220e']]} />
        <Grad id={c.id('shirt')} stops={[[0, '#ece0cf'], [1, '#8a8070']]} />
        <Grad id={c.id('scarf')} stops={[[0, '#3e9450'], [1, '#0e3a1a']]} />
        <Grad id={c.id('hair')} stops={[[0, '#4e3222'], [1, '#160c06']]} />
      </defs>
      <path
        d="M35.5 44 C33 30 41 24 50 24 C59 24 67 30 64.5 44 C66 56 66 64 64 70 L60 66 L60 46 L40 46 L40 66 L36 70 C34 64 34 56 35.5 44 Z"
        fill={c.u('hair')}
      />
      <Bust fill={c.u('shirt')} c={c} />
      <path d="M12 101 C14 88 24 78 36 75 L42 90 L42 101 Z M88 101 C86 88 76 78 64 75 L58 90 L58 101 Z" fill={c.u('vest')} />
      <Neck fill={c.u('skin')} />
      <path d="M38 64 C40 70 60 70 62 64 C64 70 62 76.5 58 80 C52 82.4 46 82.4 42 80 C38 76.5 36 70 38 64 Z" fill={c.u('scarf')} />
      <path d="M42 72 Q50 75 58 72 M43.6 77 Q50 79.4 56.4 77" stroke="#0a2a12" strokeOpacity={0.5} strokeWidth={0.9} fill="none" />
      <path d="M37.6 44 L33 37.4 L37 50.6 Z M62.4 44 L67 37.4 L63 50.6 Z" fill={c.u('skin')} />
      <Head c={c} />
      <path d="M38 42 C38.5 33 44 30 50 30 C56 30 61.5 33 62 42 C59 36 54 34.5 50 35 C46 34.5 41 36 38 42 Z" fill={c.u('hair')} />
      <Face c={c} eye="#4a6a7a" brow="#2a1a10" mouth="frown" lips="#9a5a4a" />
      <path d="M43 53 Q44 57.6 46.4 59 M57 53 Q56 57.6 53.6 59" stroke="#000" strokeOpacity={0.25} strokeWidth={0.8} fill="none" />
      <FaceShade c={c} />
    </>
  ),

  minion: (c) => (
    <>
      <defs>
        <Grad id={c.id('vest')} stops={[[0, '#50602e'], [1, '#141a08']]} />
        <Grad id={c.id('shirt')} stops={[[0, '#ecdfcb'], [1, '#8a8070']]} />
        <Grad id={c.id('hair')} stops={[[0, '#544030'], [1, '#120c06']]} />
      </defs>
      <Bust fill={c.u('shirt')} c={c} />
      <path d="M10 101 C12 86 22 77 33 74 L44 88 L42 101 Z M90 101 C88 86 78 77 67 74 L56 88 L58 101 Z" fill={c.u('vest')} />
      <path d="M33 74 L41 66 L46 74 M67 74 L59 66 L54 74" fill="#3e4c22" />
      <path d="M46.6 80 L53.4 86 M53.4 80 L46.6 86 M46.6 86 L53.4 92 M53.4 86 L46.6 92" stroke="#8a6a50" strokeWidth={0.8} />
      <Neck fill={c.u('skin')} />
      <Head c={c} />
      <path
        d="M37 42 C35 33 37 26 42 22 L44 15.5 L47 21 L50 12.5 L53 20 L57 14.5 L58 22 C63 25 65 32 63 42 C61 35 57 31 50 31 C43 31 39 35 37 42 Z"
        fill={c.u('hair')}
      />
      <Face c={c} eye="#4a3a20" brow="#2a1a0a" browWidth={1.5} mouth="grin" lips="#7a2a2a" />
      <path d="M48.4 59.6 L50 64.4 L51.6 59.6 Z" fill="#3a2a1a" />
      <FaceShade c={c} />
    </>
  ),

  wolfMan: (c) => (
    <>
      <defs>
        <Grad id={c.id('fur')} stops={[[0, '#b48c4c'], [1, '#4a3416']]} />
        <Radial id={c.id('furFace')} cx={0.42} cy={0.4} r={0.7} stops={[[0, '#d2aa6a'], [0.6, '#9a7438'], [1, '#4a3416']]} />
        <Grad id={c.id('shirt')} stops={[[0, '#f4eee2'], [1, '#a8a090']]} />
      </defs>
      <Bust fill={c.u('shirt')} c={c} />
      <path d="M42 72 L50 93 L58 72 Z" fill={c.u('fur')} />
      <path d="M40 74 Q46 86 50 93 M60 74 Q54 86 50 93" stroke="#d8d0c0" strokeWidth={1.2} fill="none" />
      <Neck fill={c.u('fur')} thick />
      <path d="M35 38 L31 25 L41 32 Z M65 38 L69 25 L59 32 Z" fill={c.u('fur')} />
      <path d="M33 46 C31 30 39 21 50 21 C61 21 69 30 67 46 C68 56 64 66 58 71 L42 71 C36 66 32 56 33 46 Z" fill={c.u('fur')} />
      <ellipse cx={50} cy={47} rx={12.5} ry={14.5} fill={c.u('furFace')} />
      <path d="M33 46 C31 30 39 21 50 21 C61 21 69 30 67 46" fill="none" stroke={c.u('rim')} strokeWidth={0.9} />
      <path d="M39.6 41 Q45 37.2 49 41 M51 41 Q55 37.2 60.4 41" stroke="#3a2410" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <circle cx={45} cy={44.4} r={4} fill={c.u('eyeHalo')} />
      <circle cx={55} cy={44.4} r={4} fill={c.u('eyeHalo')} />
      <path d="M42 44.4 Q45 42.6 48 44.6 Q45 46 42 44.4 Z M58 44.4 Q55 42.6 52 44.6 Q55 46 58 44.4 Z" fill="#ff5a2a" />
      <path d="M47 49.4 C47 47.8 53 47.8 53 49.4 C53 51.4 51 52.4 50 52.4 C49 52.4 47 51.4 47 49.4 Z" fill="#2a1a10" />
      <path d="M43.4 55 Q50 63.6 56.6 55 Q50 57.6 43.4 55 Z" fill="#5a0a12" />
      <path d="M44.6 55.6 Q50 57.8 55.4 55.6 L55 56.8 Q50 58.6 45 56.8 Z" fill="#f4efe2" />
      <path d="M45.4 56 L46.4 60 L47.4 56.6 Z M54.6 56 L53.6 60 L52.6 56.6 Z" fill="#f4efe2" />
      <path d="M36 52 L40 54 M35.6 56 L40 57 M64 52 L60 54 M64.4 56 L60 57" stroke="#4a3416" strokeWidth={0.8} />
    </>
  ),

  bigBadWolf: wolf({ fur: '#4c4e5c', furDark: '#0e0f14', muzzle: '#6c6e7a', eye: '#ff8a20', mane: true }),
  direWolf: wolf({ fur: '#8c7c6a', furDark: '#2a2018', muzzle: '#efe6da', eye: '#f2c23a', smile: true, cheeks: '#e6ddd0' }),
  fangFace: wolf({ fur: '#aa8c5a', furDark: '#3a2a14', muzzle: '#efe2c8', eye: '#f2c23a', cap: '#c8302a' }),

  fruitBrute: (c) => (
    <>
      {wolf({ fur: '#7c4c2a', furDark: '#2a140a', muzzle: '#ead6c2', eye: '#ff9a3c', apple: true })(c)}
      <path d="M22 72 L58 101 L64 101 L27 70 Z" fill="#d8c8a8" opacity={0.9} />
      <path d="M8 90 C10 82 22 78 32 82 C36 88 34 98 30 101 L8 101 Z" fill="#6a4a24" />
      <g>
        <circle cx={14} cy={86} r={2.4} fill="#6a3a8a" />
        <circle cx={18} cy={85} r={2.4} fill="#7a4a9a" />
        <circle cx={16} cy={89} r={2.4} fill="#5a2a7a" />
        <path d="M20 84 C24 78 30 78 33 81 C29 81 25 82 22 86 Z" fill="#f0c83a" />
        <circle cx={26} cy={86} r={3.2} fill="#5ab03a" />
        <path d="M28 92 L36 82 L34 94 Z" fill="#f08a2a" />
      </g>
    </>
  ),

  wolverine: (c) => (
    <>
      {wolf({ fur: '#4c3c34', furDark: '#140e0a', muzzle: '#5c4c44', eye: '#d0d8ff', band: '#c8bba8' })(c)}
      <ellipse cx={74} cy={80} rx={10} ry={8} fill="#1e1612" />
      <g fill="#ece8e0">
        <path d="M68 74 C70 60 72 50 70 40 C75 50 75 62 71 75 Z" />
        <path d="M74 73 C78 60 82 52 82 42 C85 53 83 64 77 75 Z" />
        <path d="M79 76 C85 66 90 60 92 52 C93 63 89 72 82 79 Z" />
      </g>
    </>
  ),
};

// ---------------------------------------------------------------------------

interface RoleAvatarProps {
  roleId: RoleId;
  /** `bust` fills a card portrait; `badge` crops head-and-shoulders into a round token. */
  variant?: 'bust' | 'badge';
  className?: string;
}

export const RoleAvatar = memo(function RoleAvatar({ roleId, variant = 'bust', className }: RoleAvatarProps) {
  const raw = useId().replace(/:/g, '');
  const tone = TONES[ROLES[roleId].cardTone];
  const id = (name: string) => `${raw}-${name}`;
  const c: Ctx = { id, u: (name) => `url(#${id(name)})`, tone };

  return (
    <svg
      viewBox={variant === 'badge' ? '18 12 64 64' : '0 0 100 100'}
      preserveAspectRatio={variant === 'badge' ? 'xMidYMid slice' : 'xMidYMax meet'}
      className={clsx('block', className)}
      aria-hidden
    >
      <defs>
        <Radial id={id('skin')} cx={0.4} cy={0.38} r={0.7} stops={[[0, '#e4b899'], [0.55, '#b07c62'], [1, '#553529']]} />
        <Radial id={id('pale')} cx={0.4} cy={0.38} r={0.7} stops={[[0, '#ebe6ec'], [0.55, '#aaa1ad'], [1, '#4a4250']]} />
        <Grad id={id('rim')} x2={1} y2={0.3} stops={[[0, tone.accent, 0.95], [0.5, tone.accent, 0]]} />
        <Grad id={id('shade')} x2={1} y2={0.2} stops={[[0.4, '#000', 0], [1, '#000', 0.5]]} />
        <Radial id={id('glow')} stops={[[0, tone.accent, 0.85], [1, tone.accent, 0]]} />
        <Radial id={id('eyeHalo')} stops={[[0, '#ff6a6a', 0.7], [1, '#ff2a3a', 0]]} />
      </defs>
      {ART[roleId](c)}
    </svg>
  );
});
