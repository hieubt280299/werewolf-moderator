import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import type { RoleId } from '../../@types/game';
import { ROLES, ROLE_ORDER } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { countRoles, sortDeck } from '../../utils/gameCalculations';
import { RoleCard } from './RoleCard';
import { RoleDetailSheet } from './RoleDetailSheet';
import { TONES } from './tones';

interface RoleCountGridProps {
  deck: RoleId[];
  onDeck: (deck: RoleId[]) => void;
  /** When given, each special role gets an "In pool" toggle for the auto-balancer. */
  pool?: RoleId[];
  onPool?: (pool: RoleId[]) => void;
}

/**
 * Card grid with ± steppers — the shared deck editor for setup and the deck studio.
 * Tapping a card opens its full-size preview with the complete rules text.
 */
export function RoleCountGrid({ deck, onDeck, pool, onPool }: RoleCountGridProps) {
  const { t } = useI18n();
  const counts = countRoles(deck);
  const [preview, setPreview] = useState<RoleId | null>(null);

  const adjust = (id: RoleId, delta: 1 | -1) => {
    if (delta > 0) {
      if ((counts[id] ?? 0) < ROLES[id].maxCopies) onDeck(sortDeck([...deck, id]));
    } else {
      const idx = deck.lastIndexOf(id);
      if (idx >= 0) onDeck(deck.filter((_, i) => i !== idx));
    }
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5">
        {ROLE_ORDER.map((id) => {
          const n = counts[id] ?? 0;
          const tone = TONES[ROLES[id].cardTone];
          const canPool = pool && onPool && id !== 'villager' && id !== 'werewolf';
          return (
            <div key={id} className="flex flex-col items-center gap-2">
              <RoleCard roleId={id} size="sm" muted={n === 0} className="!w-full" onClick={() => setPreview(id)}>
                {n > 0 && (
                  <span
                    className="absolute left-1.5 top-1.5 flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 font-display text-sm font-bold text-bone shadow-card"
                    style={{ background: tone.accent }}
                  >
                    ×{n}
                  </span>
                )}
              </RoleCard>
              <div className="flex w-full items-center justify-between rounded-lg border border-panel-edge bg-panel-2">
                <button type="button" aria-label="−" onClick={() => adjust(id, -1)} disabled={n === 0} className="press p-2 disabled:opacity-30">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-display text-sm">{n}</span>
                <button type="button" aria-label="+" onClick={() => adjust(id, 1)} disabled={n >= ROLES[id].maxCopies} className="press p-2 disabled:opacity-30">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {canPool && (
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] uppercase tracking-wide text-bone-dim">
                  <input
                    type="checkbox"
                    checked={pool.includes(id)}
                    onChange={() => onPool(pool.includes(id) ? pool.filter((r) => r !== id) : [...pool, id])}
                    className="h-4 w-4 accent-[#00A3E0]"
                  />
                  {t('setup.inPool')}
                </label>
              )}
            </div>
          );
        })}
      </div>
      <RoleDetailSheet
        roleId={preview}
        onClose={() => setPreview(null)}
        count={preview ? (counts[preview] ?? 0) : 0}
        onAdjust={(delta) => preview && adjust(preview, delta)}
      />
    </>
  );
}
