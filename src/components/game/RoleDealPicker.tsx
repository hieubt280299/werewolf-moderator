import clsx from 'clsx';
import { ArrowLeftRight, Shuffle } from 'lucide-react';
import { useState } from 'react';
import type { Player, RoleId } from '../../@types/game';
import { ROLES } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { sortDeck, swapRole } from '../../utils/gameCalculations';
import { RoleCard } from '../shared/RoleCard';
import { TONES } from '../shared/tones';
import { Button, Sheet } from '../shared/ui';

interface RoleDealPickerProps {
  players: Player[];
  onChange: (players: Player[]) => void;
  onReshuffle: () => void;
}

/**
 * Deal review. The role picker only offers roles that are in this game's deck, and
 * choosing a role someone else holds swaps the two — the hand always matches the deck.
 */
export function RoleDealPicker({ players, onChange, onReshuffle }: RoleDealPickerProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<string | null>(null);
  const player = players.find((p) => p.id === editing) ?? null;
  const deckRoles = [...new Set(sortDeck(players.map((p) => p.roleId)))];

  const pick = (roleId: RoleId) => {
    if (!player) return;
    onChange(swapRole(players, player.id, roleId));
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 text-sm text-bone-dim">
          <p>{t('setup.assignHint')}</p>
          <p className="text-xs text-bone-faint">{t('deal.tapToChange')}</p>
        </div>
        <Button size="sm" onClick={onReshuffle} icon={<Shuffle className="h-4 w-4" />}>
          {t('setup.reshuffle')}
        </Button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {players.map((p, i) => {
          const tone = TONES[ROLES[p.roleId].cardTone];
          return (
            <li key={p.id} className="animate-deal" style={{ animationDelay: `${i * 35}ms` }}>
              <button
                type="button"
                onClick={() => setEditing(p.id)}
                className="press flex min-h-[112px] w-full items-center gap-3 rounded-2xl border border-panel-edge bg-panel-gradient p-2 pr-3 text-left shadow-card"
              >
                <RoleCard roleId={p.roleId} size="xs" showWeight={false} />
                <div className="min-w-0 flex-1">
                  <span className="font-display text-xs text-bone-faint">#{p.seat + 1}</span>
                  <p className="truncate text-lg font-semibold text-bone text-shadow-crisp">{p.name}</p>
                  <p className={clsx('font-display text-sm uppercase tracking-grimoire', tone.text)}>{t(`role.${p.roleId}.name`)}</p>
                </div>
                <ArrowLeftRight className="h-4 w-4 shrink-0 text-bone-faint" />
              </button>
            </li>
          );
        })}
      </ul>

      <Sheet open={!!player} onClose={() => setEditing(null)} title={player ? t('deal.pick', { name: player.name }) : ''} closeLabel={t('settings.close')}>
        {player && (
          <div className="space-y-4 pb-5">
            <p className="text-xs text-bone-faint">{t('deal.onlyDeck')}</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {deckRoles.map((roleId) => {
                const holders = players.filter((p) => p.roleId === roleId && p.id !== player.id).map((p) => p.name);
                return (
                  <div key={roleId} className="flex flex-col items-center gap-1.5">
                    <RoleCard roleId={roleId} size="sm" className="!w-full" selected={player.roleId === roleId} onClick={() => pick(roleId)} />
                    <span className="line-clamp-2 text-center text-[11px] leading-tight text-bone-faint">
                      {holders.length > 0 ? t('deal.heldBy', { names: holders.join(', ') }) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
