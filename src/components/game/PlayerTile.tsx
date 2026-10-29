import clsx from 'clsx';
import { Shield } from 'lucide-react';
import { memo } from 'react';
import type { Player } from '../../@types/game';
import { ROLES } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { StatusBadges, type LinkBadge } from '../shared/PlayerToken';
import { toneAccentFill, TONES } from '../shared/tones';
import { RoleBadge } from '../shared/ui';

interface PlayerTileProps {
  player: Player;
  /** Bodyguard target while the night is in progress. */
  shielded?: boolean;
  /** Died in the phase that just ended: the label to show ("Died last night"). */
  diedLabel?: string;
  /** Death links (Virginia Woolf, Dire Wolf); keep the array stable so the memo holds. */
  links?: readonly LinkBadge[];
  /** Stable callback (receives the player id), so the memo holds across board updates. */
  onInspect: (playerId: string) => void;
}

const RESTING = '0 10px 30px -8px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.08)';

/** Player block for the dashboard grid: faction edge, character badge and illuminated statuses. */
export const PlayerTile = memo(function PlayerTile({ player, shielded, diedLabel, links, onInspect }: PlayerTileProps) {
  const { t } = useI18n();
  const tone = TONES[ROLES[player.roleId].cardTone];
  const s = player.status;

  // A fresh death keeps its colours and glows red; earlier deaths fade to grey.
  const fresh = !player.alive && !!diedLabel;
  const glow = fresh
    ? TONES.werewolf.inner
    : !player.alive
      ? RESTING
      : shielded
        ? TONES.village.inner
        : s.vampireMarked
          ? TONES.vampire.inner
          : s.silenced
            ? 'inset 0 0 20px rgba(242,106,33,0.45)'
            : RESTING;

  return (
    <button
      type="button"
      onClick={() => onInspect(player.id)}
      className={clsx(
        'press relative flex min-h-[96px] w-full flex-col gap-1.5 overflow-hidden rounded-2xl border bg-panel-gradient py-3 pl-4 pr-3 text-left',
        player.alive ? 'border-panel-edge' : fresh ? 'border-wolf/60' : 'border-panel-edge/50 opacity-50 grayscale',
      )}
      style={{ boxShadow: glow }}
    >
      {/* Faction edge, like the coloured plate on the physical card. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: tone.split ? toneAccentFill(tone) : `linear-gradient(180deg, ${tone.accent}, ${tone.plateDark})` }} />
      <div className="flex items-center gap-2.5">
        <RoleBadge roleId={player.roleId} size={40} />
        <div className="min-w-0 flex-1">
          <span className={clsx('flex items-center gap-1.5 truncate text-base font-semibold text-bone text-shadow-crisp', !player.alive && 'line-through')}>
            <span className="font-display text-xs text-bone-faint">{player.seat + 1}</span>
            <span className="truncate">{player.name}</span>
          </span>
          <span className={clsx('block truncate font-display text-xs uppercase tracking-grimoire', tone.text)}>{t(`role.${player.roleId}.name`)}</span>
        </div>
        {shielded && player.alive && <Shield className="h-4 w-4 shrink-0 text-village" />}
      </div>
      <StatusBadges player={player} diedLabel={diedLabel} links={links} />
    </button>
  );
});
