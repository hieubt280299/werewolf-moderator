import clsx from 'clsx';
import { Bandage, Check, Crown, DoorOpen, Droplet, Flame, Heart, Link2, Shield, Skull, VolumeX } from 'lucide-react';
import type { CardTone, Player } from '../../@types/game';
import { ROLES } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import type { DeathLink } from '../../utils/gameRules';
import { toneAccentFill, TONES } from './tones';
import { Chip, RoleBadge } from './ui';

/** A death link as one player sees it: the other end, and which way the death travels. */
export interface LinkBadge {
  kind: DeathLink['kind'];
  /** This player dies when the partner does (Virginia's chosen, the Dire Wolf). */
  diesWith: boolean;
  partner: string;
}

/** A link's colour: the role that made it (Virginia Woolf, the Dire Wolf). */
export const LINK_TONE: Record<DeathLink['kind'], CardTone> = {
  virginia: ROLES.virginiaWoolf.cardTone,
  direWolf: ROLES.direWolf.cardTone,
};

/** Every player's death links, named for display, by player id. */
export function linkBadges(players: readonly Player[], links: readonly DeathLink[]): Map<string, LinkBadge[]> {
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? '?';
  const out = new Map<string, LinkBadge[]>();
  const add = (id: string, badge: LinkBadge) => out.set(id, [...(out.get(id) ?? []), badge]);
  for (const l of links) {
    add(l.from, { kind: l.kind, diesWith: false, partner: name(l.to) });
    add(l.to, { kind: l.kind, diesWith: true, partner: name(l.from) });
  }
  return out;
}

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
  const tone = TONES[ROLES[player.roleId].cardTone];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        'press relative flex min-h-[64px] w-full items-center gap-2.5 overflow-hidden rounded-xl border bg-panel-2 px-2.5 py-2 text-left',
        selected ? [ACCENT[accent].ring, ACCENT[accent].glow] : 'border-panel-edge',
        disabled && 'opacity-35',
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: toneAccentFill(tone) }} aria-hidden />
      {showRole ? (
        <RoleBadge roleId={player.roleId} size={38} />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/60 font-display text-sm text-bone-dim">
          {player.seat + 1}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold leading-tight text-bone text-shadow-crisp">
          {showRole && <span className="mr-1 font-display text-xs text-bone-faint">{player.seat + 1}</span>}
          {player.name}
        </span>
        {showRole && <span className={clsx('block truncate text-xs leading-tight', tone.text)}>{t(`role.${player.roleId}.name`)}</span>}
        {note && <span className="block text-[11px] leading-tight text-bone-faint">{note}</span>}
      </span>
      {selected && <Check className="h-5 w-5 shrink-0 text-bone" />}
    </button>
  );
}

/**
 * Illuminated status pills for a player. `diedLabel` marks a death in the phase that just ended;
 * `links` are the player's death links (Virginia Woolf, Dire Wolf), named.
 */
export function StatusBadges({ player, diedLabel, links }: { player: Player; diedLabel?: string; links?: readonly LinkBadge[] }) {
  const { t } = useI18n();
  const s = player.status;
  return (
    <div className="flex flex-wrap gap-1">
      {!player.alive && (
        <Chip tone={diedLabel ? 'werewolf' : 'muted'} icon={<Skull className="h-3 w-3" />}>
          {diedLabel ?? t('status.dead')}
        </Chip>
      )}
      {s.protected && <Chip tone="village" icon={<Shield className="h-3 w-3" />}>{t('status.protected')}</Chip>}
      {s.silenced && player.alive && <Chip tone="ember" icon={<VolumeX className="h-3 w-3" />}>{t('status.silenced')}</Chip>}
      {s.vampireMarked && player.alive && <Chip tone="vampire" icon={<Droplet className="h-3 w-3" />}>{t('status.vampireMarked')}</Chip>}
      {s.inCult && <Chip tone="cult" icon={<Flame className="h-3 w-3" />}>{t('status.inCult')}</Chip>}
      {s.princeRevealed && <Chip tone="village" icon={<Crown className="h-3 w-3" />}>{t('status.princeRevealed')}</Chip>}
      {s.transformed && <Chip tone="werewolf">{t('status.transformed')}</Chip>}
      {s.lover && <Chip tone="vampire" icon={<Heart className="h-3 w-3" />}>{t('status.lover')}</Chip>}
      {links?.map((l, i) => (
        <Chip key={i} tone={LINK_TONE[l.kind]} icon={<Link2 className="h-3 w-3" />}>
          {t(l.diesWith ? 'status.diesWith' : 'status.takesAlong', { name: l.partner })}
        </Chip>
      ))}
      {s.banished && player.alive && <Chip tone="neutral" icon={<DoorOpen className="h-3 w-3" />}>{t('status.banished')}</Chip>}
      {s.woundedRound !== null && s.woundedRound !== undefined && player.alive && (
        <Chip tone="ember" icon={<Bandage className="h-3 w-3" />}>{t('status.wounded')}</Chip>
      )}
    </div>
  );
}
