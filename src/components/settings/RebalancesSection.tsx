import { Scale } from 'lucide-react';
import { useState } from 'react';
import { NO_REBALANCES, REBALANCE_IDS, type RebalanceRules } from '../../@types/game';
import { useAuth } from '../../context/AuthContext';
import { isActiveGame, useGame } from '../../context/GameContext';
import { useI18n } from '../../i18n/I18nContext';
import { RoleBadge, Toggle } from '../shared/ui';

/**
 * "Recommended Rebalances": a master toggle and one toggle per reworked role. Saved to the
 * moderator's profile; a game takes a snapshot when its cards are dealt, so changes here
 * never touch a game in progress.
 */
export function RebalancesSection() {
  const { t } = useI18n();
  const { profile, updateRebalances } = useAuth();
  const { state } = useGame();
  const rules: RebalanceRules = { ...NO_REBALANCES, ...profile?.rebalances };
  const [error, setError] = useState<string | null>(null);
  const onCount = REBALANCE_IDS.filter((id) => rules[id]).length;
  const all = onCount === REBALANCE_IDS.length;
  const activeCount = isActiveGame(state) ? REBALANCE_IDS.filter((id) => state.rules?.[id]).length : null;

  const save = (next: RebalanceRules) => {
    setError(null);
    updateRebalances(next).catch((err: unknown) => setError(t('auth.error.generic', { error: err instanceof Error ? err.message : String(err) })));
  };
  // The master switch turns everything on, or — once all are on — everything off.
  const setAll = (on: boolean) => save({ hunter: on, witch: on, bigBadWolf: on, tanner: on });

  return (
    <section className="panel animate-step-in space-y-3 p-4" aria-labelledby="rebalances-title">
      <h3 id="rebalances-title" className="flex items-center gap-2 text-sm text-bone-dim">
        <Scale className="h-4 w-4" /> {t('rebalance.title')}
      </h3>
      <p className="text-xs text-bone-faint">{t('rebalance.hint')}</p>

      <Toggle
        checked={all}
        mixed={onCount > 0 && !all}
        onChange={() => setAll(!all)}
        label={t('rebalance.all')}
        hint={t('rebalance.someOn', { count: onCount, total: REBALANCE_IDS.length })}
      />

      <ul className="space-y-3 border-l border-panel-edge pl-3">
        {REBALANCE_IDS.map((id) => (
          <li key={id} className="flex items-start gap-3">
            {/* Each house rule is named after the role it reworks. */}
            <RoleBadge roleId={id} size={32} className="mt-0.5" />
            <Toggle
              className="min-w-0 flex-1"
              checked={rules[id]}
              onChange={(on) => save({ ...rules, [id]: on })}
              label={t(`rebalance.${id}.title`)}
              hint={t(`rebalance.${id}.desc`)}
            />
          </li>
        ))}
      </ul>

      {activeCount !== null && <p className="text-xs text-ember">{t('rebalance.activeGame', { count: activeCount })}</p>}
      {error && <p className="text-xs text-wolf-bright">{error}</p>}
    </section>
  );
}
