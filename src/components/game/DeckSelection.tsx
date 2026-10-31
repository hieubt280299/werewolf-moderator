import clsx from 'clsx';
import { Eraser, Shuffle } from 'lucide-react';
import type { ExperienceLevel, RoleId, SetupDraft } from '../../@types/game';
import { useHouseRules } from '../../context/HouseRulesContext';
import { useSettings } from '../../context/SettingsContext';
import { ALWAYS_IN_POOL } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { calculateBalance, EXPERIENCE_TARGET, extraTeams, generateBalancedDeck } from '../../utils/gameCalculations';
import { BalanceMeter } from '../shared/BalanceMeter';
import { RoleGrid } from '../shared/RoleGrid';
import { Button, Toggle } from '../shared/ui';

interface DeckSelectionProps {
  deck: RoleId[];
  pool: RoleId[];
  /** The last game's cards: auto-balance changes at least 10% of them. */
  previousDeck?: RoleId[];
  playerCount: number;
  experience: ExperienceLevel;
  onChange: (patch: Partial<SetupDraft>) => void;
}

/**
 * Deck step: how many of each pooled role to deal, set by hand or auto-balanced from the
 * Role Pool. Changing the pool empties the deck (see UPDATE_SETUP), so only pooled roles
 * are ever shown here. Also where full pool calls are switched on (a device setting).
 */
export function DeckSelection({ deck, pool, previousDeck, playerCount, experience, onChange }: DeckSelectionProps) {
  const { t } = useI18n();
  const houseRules = useHouseRules();
  const { fullPoolCalls, update } = useSettings();
  const available = [...new Set<RoleId>([...ALWAYS_IN_POOL, ...pool])];
  const extra = extraTeams(deck, houseRules)[0];

  return (
    <div className="space-y-5">
      <div className="sticky top-14 z-20 -mx-4 bg-ink/95 px-4 pb-3 pt-1">
        <BalanceMeter sum={calculateBalance(deck)} target={EXPERIENCE_TARGET[experience]} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={clsx('font-display text-sm tracking-wide', deck.length === playerCount ? 'text-bone' : 'text-ember')}>
            {t('setup.cards', { cards: deck.length, players: playerCount })}
          </span>
          <div className="flex-1" />
          <Button size="sm" variant="plain" disabled={deck.length === 0} onClick={() => onChange({ deck: [] })} icon={<Eraser className="h-4 w-4" />}>
            {t('setup.clearDeck')}
          </Button>
          <Button
            size="sm"
            variant="village"
            onClick={() => onChange({ deck: generateBalancedDeck({ playerCount, pool, experience, rules: houseRules, previousDeck }) })}
            icon={<Shuffle className="h-4 w-4" />}
          >
            {t('setup.autoBalance')}
          </Button>
        </div>
      </div>
      <p className="text-xs text-bone-faint">{t('setup.deckHint')}</p>
      {/* At most three teams: once a third team is in, roles of other extra teams are locked. */}
      <p className="text-xs text-bone-faint">{extra ? t('setup.thirdTeam', { team: t(`team.${extra}`) }) : t('setup.teamLimit')}</p>
      <Toggle
        className="rounded-xl border border-panel-edge bg-panel-2 p-3"
        checked={fullPoolCalls}
        onChange={(on) => update({ fullPoolCalls: on })}
        label={t('setup.fullPoolCalls')}
        hint={t('setup.fullPoolCallsHint')}
      />
      <RoleGrid mode="count" deck={deck} onDeck={(next) => onChange({ deck: next })} roles={available} />
    </div>
  );
}
