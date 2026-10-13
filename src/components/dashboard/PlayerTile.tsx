import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import type { Player } from '../../@types/game';
import { ROLES } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { stepped } from '../../utils/motion';
import { StatusBadges } from '../shared/PlayerToken';
import { ROLE_ICONS } from '../shared/roleIcons';
import { TONES } from '../shared/tones';

interface PlayerTileProps {
  player: Player;
  /** Bodyguard target while the night is in progress. */
  shielded?: boolean;
  onClick: () => void;
}

/** Player block for the dashboard grid: faction edge, role, and illuminated statuses. */
export function PlayerTile({ player, shielded, onClick }: PlayerTileProps) {
  const { t } = useI18n();
  const role = ROLES[player.roleId];
  const tone = TONES[role.cardTone];
  const Icon = ROLE_ICONS[role.icon];
  const s = player.status;

  // Always a concrete value: framer-motion keeps stale inline styles when a value becomes undefined.
  const resting = '0 10px 30px -8px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.08)';
  const inner = !player.alive
    ? resting
    : shielded
      ? TONES.village.inner
      : s.vampireMarked
        ? TONES.vampire.inner
        : s.silenced
          ? 'inset 0 0 20px rgba(242,106,33,0.45)'
          : resting;

  return (
    <motion.button
      type="button"
      layout
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={stepped(3, 0.2)}
      className={clsx(
        'relative flex min-h-[96px] w-full flex-col gap-1.5 overflow-hidden rounded-2xl border bg-panel-gradient py-3 pl-4 pr-3 text-left shadow-card',
        player.alive ? 'border-panel-edge' : 'border-panel-edge/50 opacity-50 grayscale',
      )}
      style={{ boxShadow: inner }}
    >
      {/* Faction edge, like the coloured plate on the physical card. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: `linear-gradient(180deg, ${tone.accent}, ${tone.plateDark})` }} />
      <div className="flex items-center gap-2">
        <span className="font-display text-xs text-bone-faint">{player.seat + 1}</span>
        <span className={clsx('min-w-0 flex-1 truncate text-base font-semibold text-bone text-shadow-crisp', !player.alive && 'line-through')}>
          {player.name}
        </span>
        {shielded && player.alive && <Shield className="h-4 w-4 text-village" />}
      </div>
      <span className={clsx('flex items-center gap-1.5 font-display text-xs uppercase tracking-grimoire', tone.text)}>
        <Icon className="h-3.5 w-3.5" />
        {t(`role.${player.roleId}.name`)}
      </span>
      <StatusBadges player={player} />
    </motion.button>
  );
}
