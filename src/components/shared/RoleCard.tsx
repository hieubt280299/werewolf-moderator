import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Skull } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import type { RoleId } from '../../@types/game';
import { ROLES } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { stepped } from '../../utils/motion';
import { ROLE_ICONS } from './roleIcons';
import { TONES } from './tones';

type CardSize = 'xs' | 'sm' | 'md' | 'lg';

const WIDTHS: Record<CardSize, string> = {
  xs: 'w-16',
  sm: 'w-24',
  md: 'w-36',
  lg: 'w-56 sm:w-64',
};

interface RoleCardProps {
  roleId: RoleId;
  size?: CardSize;
  /** Rules text on the plate. Defaults on for md/lg. */
  showText?: boolean;
  showWeight?: boolean;
  dead?: boolean;
  selected?: boolean;
  /** Dim without the dead treatment (e.g. not in deck). */
  muted?: boolean;
  onClick?: () => void;
  className?: string;
  /** Overlay content (count badges, toggles). */
  children?: ReactNode;
  ariaLabel?: string;
}

/**
 * "Deluxe Grimoire" card face modelled on the Ultimate Werewolf Deluxe cards:
 * vignetted night portrait, stacked vertical title down the right edge, a slanted
 * faction-coloured rules plate and the balance value in the corner.
 * All inner sizes use container-query units so every size is a true scale copy.
 */
export function RoleCard({
  roleId,
  size = 'md',
  showText,
  showWeight = true,
  dead = false,
  selected = false,
  muted = false,
  onClick,
  className,
  children,
  ariaLabel,
}: RoleCardProps) {
  const { t } = useI18n();
  const role = ROLES[roleId];
  const tone = TONES[role.cardTone];
  const Icon = ROLE_ICONS[role.icon];
  const name = t(`role.${roleId}.name`);
  const words = name.toLocaleUpperCase().split(/\s+/);
  const longest = Math.max(...words.map((w) => [...w].length));
  const withText = showText ?? (size === 'md' || size === 'lg');
  const weight = role.weight > 0 ? `+${role.weight}` : role.weight < 0 ? `−${Math.abs(role.weight)}` : '0';

  const titleStyle: CSSProperties = {
    writingMode: 'vertical-rl',
    textOrientation: 'upright',
    // Fit the longest word into ~62% of the card height. Oswald's upright vertical advance is
    // ~1.45em, hence 62 / 1.45 ≈ 43. Capped so short names don't balloon.
    fontSize: `min(${(43 / Math.max(longest, 4)).toFixed(2)}cqh, 11.5cqw)`,
    letterSpacing: '-0.06em',
    lineHeight: 1,
  };

  const Tag = onClick ? motion.button : motion.div;

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={ariaLabel ?? name}
      aria-pressed={onClick ? selected : undefined}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      animate={{ scale: selected ? 1.03 : 1 }}
      transition={stepped(3, 0.18)}
      className={clsx(
        'relative isolate block shrink-0 overflow-hidden rounded-[7%/5%] bg-ink text-left shadow-card',
        WIDTHS[size],
        dead && 'grayscale',
        (dead || muted) && 'opacity-45',
        selected ? 'ring-2 ring-bone ring-offset-2 ring-offset-ink' : 'ring-1 ring-white/10',
        className,
      )}
      style={{
        aspectRatio: '5 / 7',
        containerType: 'size',
        boxShadow:
          selected || size === 'lg'
            ? `0 0 28px -6px ${tone.glow}, 0 10px 30px -8px rgba(0,0,0,.9)`
            : '0 10px 30px -8px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.08)',
      }}
    >
      {/* Portrait background: moonlit vignette in the faction hue. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(110% 75% at 38% 32%, ${tone.mist} 0%, ${tone.night} 48%, #050505 100%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{
          left: '12%',
          top: '8%',
          width: '16cqw',
          height: '16cqw',
          background: 'radial-gradient(circle at 35% 35%, rgba(245,245,247,.55), rgba(245,245,247,.08) 60%, transparent 70%)',
          filter: 'blur(0.4cqw)',
        }}
      />
      {/* Treeline silhouette like the forest edge behind each portrait. */}
      <svg aria-hidden viewBox="0 0 100 30" preserveAspectRatio="none" className="absolute inset-x-0" style={{ top: '46%', height: '22%' }}>
        <path
          d="M0 30 L0 18 L4 12 L6 17 L9 8 L12 16 L15 11 L18 18 L22 6 L25 15 L28 10 L32 19 L36 9 L39 16 L43 12 L47 20 L52 7 L55 15 L59 11 L63 19 L67 8 L70 16 L74 12 L78 20 L82 9 L85 15 L89 10 L93 18 L97 11 L100 16 L100 30 Z"
          fill="#050505"
          opacity="0.85"
        />
      </svg>
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink via-ink/70 to-transparent" />

      {/* Emblem. */}
      <div aria-hidden className="absolute flex items-center justify-center" style={{ left: '6%', right: '22%', top: '14%', height: '46%' }}>
        <Icon
          strokeWidth={1.4}
          className="text-bone"
          style={{ width: '46cqw', height: '46cqw', filter: `drop-shadow(0 0 3cqw ${tone.glow}) drop-shadow(0 1cqw 1cqw rgba(0,0,0,.9))` }}
        />
      </div>

      {/* Stacked vertical title. */}
      <div className="absolute flex flex-row gap-[1.5cqw]" style={{ right: '4.5%', top: '4%' }}>
        {words.map((word, i) => (
          <span key={i} className="font-display font-bold text-bone text-shadow-title" style={titleStyle}>
            {word}
          </span>
        ))}
      </div>

      {/* Slanted rules plate. */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col justify-center"
        style={{
          height: withText ? '27%' : '13%',
          clipPath: 'polygon(0 22%, 100% 0, 100% 100%, 0 100%)',
          background: `linear-gradient(180deg, ${tone.plate} 0%, ${tone.plateDark} 100%)`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)',
          padding: withText ? '6cqh 9cqw 3.5cqh 5cqw' : '0 4cqw',
        }}
      >
        {withText && (
          <p className="line-clamp-4 text-center font-body font-medium text-bone text-shadow-crisp" style={{ fontSize: '4.9cqw', lineHeight: 1.25 }}>
            {t(`role.${roleId}.desc`)}
          </p>
        )}
        {showWeight && (
          <span
            className="absolute font-display font-semibold text-bone/90 text-shadow-crisp"
            style={{ right: '4cqw', bottom: withText ? '2cqh' : '1.5cqh', fontSize: withText ? '5.5cqw' : '9cqw', lineHeight: 1 }}
          >
            {weight}
          </span>
        )}
      </div>

      {dead && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
          <Skull className="text-bone/80" style={{ width: '34cqw', height: '34cqw' }} />
        </div>
      )}
      {children}
    </Tag>
  );
}
