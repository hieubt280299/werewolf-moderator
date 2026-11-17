import clsx from 'clsx';
import { Award, HelpCircle, Lock, Megaphone, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useI18n } from '../../i18n/I18nContext';
import { scoreGame, scoreInputOf } from '../../utils/scoring';
import { MvpSpotlight, PickLine, Scoreboard } from '../scoring/Scoreboard';
import { ScoringGuide } from '../scoring/ScoringGuide';
import { Button, RoleBadge, SectionTitle, Sheet } from '../shared/ui';

/** Not chosen yet, nobody stood out (`null`), or a player's id. */
type Choice = string | null | undefined;

/**
 * The end-of-game award, in two steps. First the moderator's pick: the player on the winning
 * side who convinced the table and led their team best, or nobody if no one stood out (the
 * MVP is then decided by the scores alone). It is made blind — no score is shown before it —
 * so it judges play at the table, not the standings. It is confirmed, then final: once per
 * game, kept through Undo. Then the reveal: the MVP and the full scoreboard.
 */
export function MvpCeremony() {
  const { t } = useI18n();
  const engine = useGameEngine();
  const { state } = engine;
  const board = useMemo(() => scoreGame(scoreInputOf(state)), [state]);
  const revealed = state.mvpPick !== undefined;
  const [choice, setChoice] = useState<Choice>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [guide, setGuide] = useState(false);
  // Only the winning side can be picked; a draw has no one to pick.
  const candidates = useMemo(() => {
    const winners = new Set(state.winner?.winnerIds ?? []);
    return state.players.filter((p) => winners.has(p.id)).sort((a, b) => a.seat - b.seat);
  }, [state.players, state.winner]);
  const chosen = candidates.find((p) => p.id === choice);
  const picked = state.players.find((p) => p.id === state.mvpPick);

  const howTo = (
    <button type="button" onClick={() => setGuide(true)} className="flex items-center gap-1 text-xs text-bone-dim underline-offset-2 hover:text-bone hover:underline">
      <HelpCircle className="h-3.5 w-3.5" />
      {t('mvp.howTo')}
    </button>
  );

  const commit = () => {
    setConfirming(false);
    engine.setMvpPick(choice ?? null);
  };

  const tile = (on: boolean) =>
    clsx(
      'press flex min-h-12 items-center gap-2 rounded-xl border p-1.5 pr-2.5 text-left',
      on ? 'border-ember bg-ember/15 shadow-inner-ember' : 'border-panel-edge bg-panel-2',
    );

  return (
    <>
      {!revealed ? (
        <section className="panel animate-step-in space-y-3 border border-ember/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-lg text-bone text-shadow-crisp">
              <Megaphone className="h-5 w-5 text-ember" />
              {t('mvp.pickTitle')}
            </h3>
            {howTo}
          </div>
          {candidates.length > 0 ? (
            <>
              <p className="text-sm text-bone/85">{t('mvp.pickPrompt', { points: board.pickPoints })}</p>
              <p className="text-xs text-bone-faint">{t('mvp.pickHint')}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('mvp.pickTitle')}>
                {candidates.map((p) => {
                  const on = choice === p.id;
                  return (
                    <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => setChoice(p.id)} className={tile(on)}>
                      <RoleBadge roleId={p.roleId} size={32} dead={!p.alive} />
                      <span className={clsx('min-w-0 flex-1 truncate text-sm font-semibold', on ? 'text-bone' : 'text-bone-dim')}>{p.name}</span>
                      {on && <Megaphone className="h-4 w-4 shrink-0 text-ember" />}
                    </button>
                  );
                })}
                {/* Declining is a choice too: the MVP then comes from the scores alone. */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={choice === null}
                  onClick={() => setChoice(null)}
                  className={clsx(tile(choice === null), 'col-span-2 sm:col-span-3')}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-panel-edge">
                    <UserX className="h-4 w-4 text-bone-dim" />
                  </span>
                  <span className={clsx('min-w-0 flex-1 text-sm font-semibold', choice === null ? 'text-bone' : 'text-bone-dim')}>{t('mvp.nobody')}</span>
                </button>
              </div>
              <Button
                variant="ember"
                size="lg"
                block
                disabled={choice === undefined}
                onClick={() => setConfirming(true)}
                icon={<Award className="h-5 w-5" />}
              >
                {t('mvp.reveal')}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-bone/85">{t('mvp.pickNone')}</p>
              <Button variant="ember" size="lg" block onClick={() => engine.setMvpPick(null)} icon={<Award className="h-5 w-5" />}>
                {t('mvp.reveal')}
              </Button>
            </>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <MvpSpotlight board={board} />
          <PickLine name={picked?.name ?? null} counted={board.ranking.some((s) => s.picked)} points={board.pickPoints} />
          <div>
            <SectionTitle aside={howTo}>{t('mvp.scoreboard')}</SectionTitle>
            <Scoreboard board={board} />
          </div>
        </section>
      )}

      <Sheet open={confirming} onClose={() => setConfirming(false)} title={t('mvp.confirmTitle')} closeLabel={t('settings.close')}>
        <div className="space-y-4 pb-6">
          <div className="flex items-center gap-3 rounded-xl border border-ember/40 bg-ember/10 p-3">
            {chosen ? (
              <RoleBadge roleId={chosen.roleId} size={44} dead={!chosen.alive} />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-panel-edge">
                <UserX className="h-5 w-5 text-bone-dim" />
              </span>
            )}
            <p className="text-sm text-bone">
              {chosen ? t('mvp.confirmPick', { name: chosen.name, points: board.pickPoints }) : t('mvp.confirmNone')}
            </p>
          </div>
          <p className="flex items-start gap-2 text-sm text-bone-dim">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
            {t('mvp.confirmFinal')}
          </p>
          <div className="flex gap-3">
            <Button onClick={() => setConfirming(false)}>{t('day.cancel')}</Button>
            <Button variant="ember" block onClick={commit} icon={<Award className="h-4 w-4" />}>
              {t('mvp.confirm')}
            </Button>
          </div>
        </div>
      </Sheet>
      <ScoringGuide open={guide} onClose={() => setGuide(false)} pickPoints={board.pickPoints} />
    </>
  );
}
