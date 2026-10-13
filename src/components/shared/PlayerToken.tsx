import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Check, Crown, Droplet, Flame, Shield, Skull, VolumeX } from 'lucide-react';
import type { Player } from '../../@types/game';
import { ROLES } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { stepped } from '../../utils/motion';
import { ROLE_ICONS } from './roleIcons';
import { TONES } from './tones';
import { Chip } from './ui';

type Accent = 'village' | 'wolf' | 'ember' | 'vampire' | 'cult';

const ACCENT: Record<Accent, { ring: string; glow: string }> = {
  village: { ring: 'border-village', glow: 'shadow-inner-village' },
  wolf: { ring: 'border-wolf-bright', glow: 'shadow-inner-wolf' },
  ember: { ring: 'border-ember', glow: 'shadow-inner-ember' },
  vampire: { ring: 'border-vampire', glow: 'shadow-inner-vampire' },
  cult: { ring: 'border-cult', glow: 'shadow-inner-cult' },
};

interface PlayerTokenProps {
  player: Player;
  selected?: boolean;
  disabled?: boolean;
  accent?: Accent;
  showRole?: boolean;
  note?: string;
  onClick?: () => void;
}

/** Compact selectable player button used by every target / voter picker. */
export function PlayerToken({ player, selected, disabled, accent = 'village', showRole = true, note, onClick }: PlayerTokenProps) {
  const { t } = useI18n();
  const role = ROLES[player.roleId];
  const Icon = ROLE_ICONS[role.icon];
  const tone = TONES[role.cardTone];
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      whileTap={{ scale: 0.95 }}
      transition={stepped(2, 0.12)}
      className={clsx(
        'relative flex min-h-[64px] w-full items-center gap-2.5 overflow-hidden rounded-xl border bg-panel-2 px-3 py-2 text-left transition-colors',
        selected ? [ACCENT[accent].ring, ACCENT[accent].glow] : 'border-panel-edge',
        disabled && 'opacity-35',
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: tone.accent }} aria-hidden />
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/60 font-display text-sm text-bone-dim">
        {player.seat + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold leading-tight text-bone text-shadow-crisp">{player.name}</span>
        {showRole && (
          <span className={clsx('flex items-center gap-1 text-xs leading-tight', tone.text)}>
            <Icon className="h-3 w-3" />
            {t(`role.${player.roleId}.name`)}
          </span>
        )}
        {note && <span className="block text-[11px] leading-tight text-bone-faint">{note}</span>}
      </span>
      {selected && <Check className="h-5 w-5 shrink-0 text-bone" />}
    </motion.button>
  );
}

/** Illuminated status pills for a player. */
export function StatusBadges({ player }: { player: Player }) {
  const { t } = useI18n();
  const s = player.status;
  return (
    <div className="flex flex-wrap gap-1">
      {!player.alive && <Chip icon={<Skull className="h-3 w-3" />}>{t('status.dead')}</Chip>}
      {s.protected && <Chip tone="village" icon={<Shield className="h-3 w-3" />}>{t('status.protected')}</Chip>}
      {s.silenced && player.alive && <Chip tone="ember" icon={<VolumeX className="h-3 w-3" />}>{t('status.silenced')}</Chip>}
      {s.vampireMarked && player.alive && <Chip tone="vampire" icon={<Droplet className="h-3 w-3" />}>{t('status.vampireMarked')}</Chip>}
      {s.inCult && <Chip tone="cult" icon={<Flame className="h-3 w-3" />}>{t('status.inCult')}</Chip>}
      {s.princeRevealed && <Chip tone="village" icon={<Crown className="h-3 w-3" />}>{t('status.princeRevealed')}</Chip>}
      {s.transformed && <Chip tone="werewolf">{t('status.transformed')}</Chip>}
    </div>
  );
}
