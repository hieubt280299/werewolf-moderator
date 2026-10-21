import clsx from 'clsx';
import { Eraser, Shuffle } from 'lucide-react';
import type { ExperienceLevel, RoleId, SetupDraft } from '../../@types/game';
import { ALWAYS_IN_POOL } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { calculateBalance, EXPERIENCE_TARGET, generateBalancedDeck } from '../../utils/gameCalculations';
import { BalanceMeter } from '../shared/BalanceMeter';
import { RoleGrid } from '../shared/RoleGrid';
import { Button } from '../shared/ui';

interface DeckSelectionProps {
  deck: RoleId[];
  pool: RoleId[];
  playerCount: number;
  experience: ExperienceLevel;
  onChange: (patch: Partial<SetupDraft>) => void;
}

/**
 * Deck step: how many of each pooled role to deal, set by hand or auto-balanced from the
 * Role Pool. Changing the pool empties the deck (see UPDATE_SETUP), so only pooled roles
 * are ever shown here.
 */
export function DeckSelection({ deck, pool, playerCount, experience, onChange }: DeckSelectionProps) {
  const { t } = useI18n();
  const available = [...new Set<RoleId>([...ALWAYS_IN_POOL, ...pool])];

  return (
    <div className="space-y-5">
      <div className="sticky top-14 z-20 -mx-4 bg-ink/95 px-4 pb-3 pt-1">
        <BalanceMeter sum={calculateBalance(deck)} target={EXPERIENCE_TARGET[experience]} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={clsx('font-display text-sm uppercase tracking-grimoire', deck.length === playerCount ? 'text-bone' : 'text-ember')}>
            {t('setup.cards', { cards: deck.length, players: playerCount })}
          </span>
          <div className="flex-1" />
          <Button size="sm" variant="plain" disabled={deck.length === 0} onClick={() => onChange({ deck: [] })} icon={<Eraser className="h-4 w-4" />}>
            {t('setup.clearDeck')}
          </Button>
          <Button
            size="sm"
            variant="village"
            onClick={() => onChange({ deck: generateBalancedDeck({ playerCount, pool, experience }) })}
            icon={<Shuffle className="h-4 w-4" />}
          >
            {t('setup.autoBalance')}
          </Button>
        </div>
      </div>
      <p className="text-xs text-bone-faint">{t('setup.deckHint')}</p>
      <RoleGrid mode="count" deck={deck} onDeck={(next) => onChange({ deck: next })} roles={available} />
    </div>
  );
}
