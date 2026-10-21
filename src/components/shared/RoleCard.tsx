import clsx from 'clsx';
import { Skull } from 'lucide-react';
import { memo, type CSSProperties, type ReactNode } from 'react';
import type { RoleId } from '../../@types/game';
import { roleDescKey, useHouseRules } from '../../context/HouseRulesContext';
import { ROLES } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { dictionaries } from '../../i18n/translations';
import { RoleAvatar } from './RoleAvatar';
import { toneBackdrop, toneGlow, tonePlate, TONES } from './tones';

type CardSize = 'xs' | 'sm' | 'md' | 'lg';

const WIDTHS: Record<CardSize, string> = {
  xs: 'w-16',
  sm: 'w-24',
  md: 'w-36',
  lg: 'w-56 sm:w-64',
};

const RESTING_SHADOW = '0 10px 30px -8px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.08)';

interface RoleCardProps {
  roleId: RoleId;
  size?: CardSize;
  /** Rules text under the localised name. Defaults on for md/lg. */
  showText?: boolean;
  showWeight?: boolean;
  dead?: boolean;
  selected?: boolean;
  /** Dim without the dead treatment (e.g. not in deck). */
  muted?: boolean;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  /** Overlay content (count badges, toggles). */
  children?: ReactNode;
  ariaLabel?: string;
}

/**
 * "Deluxe Grimoire" card face modelled on the Ultimate Werewolf Deluxe cards.
 * Dual-language: the stacked title down the right edge is always the English card name
 * (as printed), while the plate shows the role name horizontally in the active language.
 * Inner sizes use container-query units, so every size is an exact scale copy.
 */
export const RoleCard = memo(function RoleCard({
  roleId,
  size = 'md',
  showText,
  showWeight = true,
  dead = false,
  selected = false,
  muted = false,
  onClick,
  className,
  style,
  children,
  ariaLabel,
}: RoleCardProps) {
  const { t } = useI18n();
  const houseRules = useHouseRules();
  const role = ROLES[roleId];
  const tone = TONES[role.cardTone];
  const englishName = dictionaries.en[`role.${roleId}.name`];
  const localName = t(`role.${roleId}.name`);
  const words = englishName.toUpperCase().split(/\s+/);
  const longest = Math.max(...words.map((w) => w.length));
  const withText = showText ?? (size === 'md' || size === 'lg');
  const weight = role.weight > 0 ? `+${role.weight}` : role.weight < 0 ? `−${Math.abs(role.weight)}` : '0';

  const titleStyle: CSSProperties = {
    writingMode: 'vertical-rl',
    textOrientation: 'upright',
    // Fit the longest word into ~58% of the card height. Oswald's upright vertical advance
    // is ~1.45em, hence 58 / 1.45 ≈ 40. Capped so short names don't balloon.
    fontSize: `min(${(40 / Math.max(longest, 4)).toFixed(2)}cqh, 11cqw)`,
    letterSpacing: '-0.06em',
    lineHeight: 1,
  };

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={ariaLabel ?? localName}
      aria-pressed={onClick ? selected : undefined}
      className={clsx(
        'relative isolate block shrink-0 overflow-hidden rounded-[7%/5%] bg-ink text-left',
        onClick && 'press',
        WIDTHS[size],
        dead && 'grayscale',
        (dead || muted) && 'opacity-45',
        selected ? 'ring-2 ring-bone ring-offset-2 ring-offset-ink' : 'ring-1 ring-white/10',
        className,
      )}
      style={{
        aspectRatio: '5 / 7',
        // Size containment: a card's insides never re-lay out when the grid around it reflows.
        // (No content-visibility: it re-rendered every card scrolling into view, stuttering scrolls.)
        containerType: 'size',
        boxShadow: selected || size === 'lg' ? `${toneGlow(tone)}, 0 10px 30px -8px rgba(0,0,0,.9)` : RESTING_SHADOW,
        ...style,
      }}
    >
      {/* Portrait background: moonlit vignette in the faction hue. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: toneBackdrop(tone) }}
      />
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{
          left: '10%',
          top: '6%',
          width: '15cqw',
          height: '15cqw',
          background: 'radial-gradient(circle at 35% 35%, rgba(245,245,247,.5), rgba(245,245,247,.06) 60%, transparent 70%)',
        }}
      />
      <svg aria-hidden viewBox="0 0 100 30" preserveAspectRatio="none" className="absolute inset-x-0" style={{ top: '38%', height: '18%' }}>
        <path
          d="M0 30 L0 18 L4 12 L6 17 L9 8 L12 16 L15 11 L18 18 L22 6 L25 15 L28 10 L32 19 L36 9 L39 16 L43 12 L47 20 L52 7 L55 15 L59 11 L63 19 L67 8 L70 16 L74 12 L78 20 L82 9 L85 15 L89 10 L93 18 L97 11 L100 16 L100 30 Z"
          fill="#050505"
          opacity="0.7"
        />
      </svg>

      {/* Character portrait. */}
      <div aria-hidden className="absolute" style={{ left: '-7%', right: '9%', top: '5%', bottom: withText ? '24%' : '15%' }}>
        <RoleAvatar roleId={roleId} className="h-full w-full" />
      </div>
      <div aria-hidden className="absolute inset-x-0 bg-gradient-to-t from-ink/90 to-transparent" style={{ bottom: withText ? '22%' : '13%', height: '14%' }} />

      {/* Stacked English title, as printed on the physical card. */}
      <div className="absolute flex flex-row gap-[1.5cqw]" style={{ right: '4.5%', top: '4%' }}>
        {words.map((word, i) => (
          <span key={i} className="font-display font-bold text-bone text-shadow-title" style={titleStyle}>
            {word}
          </span>
        ))}
      </div>

      {/* Slanted plate: localised name (+ rules text on large cards), value in the corner. */}
      <div
        className={clsx('absolute inset-x-0 bottom-0 flex text-center', withText ? 'flex-col items-center justify-center' : 'items-end gap-[2cqw]')}
        style={{
          height: withText ? '30%' : '17%',
          clipPath: 'polygon(0 16%, 100% 0, 100% 100%, 0 100%)',
          background: tonePlate(tone),
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)',
          padding: withText ? '4.5cqh 8cqw 3cqh' : '0 4cqw 2.2cqh',
        }}
      >
        <span
          className="block min-w-0 flex-1 truncate font-display font-bold text-bone text-shadow-crisp"
          style={{ fontSize: withText ? '7.8cqw' : '10.5cqw', letterSpacing: '0.02em', lineHeight: 1.15, flex: withText ? 'none' : undefined, width: withText ? '100%' : undefined }}
        >
          {localName}
        </span>
        {withText && (
          <p className="mt-[1cqh] line-clamp-3 font-body font-medium text-bone/90 text-shadow-crisp" style={{ fontSize: '4.6cqw', lineHeight: 1.22 }}>
            {t(roleDescKey(roleId, houseRules))}
          </p>
        )}
        {showWeight && (
          <span
            className={clsx('font-display font-semibold text-bone/85 text-shadow-crisp', withText && 'absolute')}
            style={withText ? { right: '3.5cqw', bottom: '2cqh', fontSize: '5.2cqw', lineHeight: 1 } : { fontSize: '8cqw', lineHeight: 1.3 }}
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
});
