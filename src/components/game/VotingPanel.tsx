import clsx from 'clsx';
import { DoorOpen, Droplet, Gavel, Ghost, Pause, Play, RotateCcw, Swords, Timer, Undo2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Nomination } from '../../@types/game';
import { useListMotion } from '../../hooks/useListMotion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useI18n } from '../../i18n/I18nContext';
import { dayCascadeDeaths } from '../../utils/gameRules';
import { PlayerToken } from '../shared/PlayerToken';
import { Tooltip } from '../shared/Tooltip';
import { Button, Chip, SectionTitle, Sheet } from '../shared/ui';

/** Nomination, defense and public execution tracker for the day phase. */
export function VotingPanel() {
  const { t } = useI18n();
  const engine = useGameEngine();
  const { state, alive, byId } = engine;
  const [nominating, setNominating] = useState(false);
  const listRef = useListMotion<HTMLDivElement>(220);

  const silenced = alive.filter((p) => p.status.silenced);
  const banished = alive.filter((p) => p.status.banished);
  const ghostSpeaks = state.players.some((p) => !p.alive && p.roleId === 'ghost');
  const twoExecutions = (state.executionsLeft ?? 1) > 1 || (state.executedToday !== null && state.dayStep !== 'closed');
  const vampirePending = !state.modifiers.vampireTriggeredToday && alive.some((p) => p.status.vampireMarked);
  const executed = byId.get(state.executedToday ?? '');
  // Taken down with the vote's victim; the reason stays with the moderator.
  const alsoEliminated = executed && !executed.alive ? dayCascadeDeaths(state) : [];
  const isOpen = state.dayStep !== 'closed';
  const nominations = state.nominations.filter((n) => byId.get(n.accusedId)?.alive || n.accusedId === state.executedToday);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {silenced.length > 0 && (
          <Chip tone="ember" icon={<VolumeX className="h-3 w-3" />}>
            {t('day.silenced')}: {silenced.map((p) => p.name).join(', ')}
          </Chip>
        )}
        {banished.length > 0 && (
          <Chip tone="neutral" icon={<DoorOpen className="h-3 w-3" />}>
            {t('day.banished')}: {banished.map((p) => p.name).join(', ')}
          </Chip>
        )}
        {ghostSpeaks && (
          <Chip tone="village" icon={<Ghost className="h-3 w-3" />}>
            {t('day.ghost')}
          </Chip>
        )}
        {twoExecutions && isOpen && (
          <Chip tone="ember" icon={<Swords className="h-3 w-3" />}>
            {t('day.twoExecutions', { left: state.executionsLeft })}
          </Chip>
        )}
        {vampirePending && isOpen && (
          <Chip tone="vampire" icon={<Droplet className="h-3 w-3" />}>
            {t('day.vampirePending')}
          </Chip>
        )}
      </div>

      <DebateTimer />

      {isOpen ? (
        <>
          <p className="text-sm text-bone-dim">{t('day.discussion')}</p>
          <div ref={listRef} className="relative space-y-4">
            {nominations.map((nom) => (
              <NominationCard key={nom.id} nomination={nom} />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="ember" size="lg" disabled={!engine.canNominate} onClick={() => setNominating(true)} icon={<Gavel className="h-5 w-5" />}>
              {t('day.nominate')}
            </Button>
            <Button size="lg" onClick={engine.closeDay}>
              {t('day.noExecution')}
            </Button>
          </div>
        </>
      ) : (
        <div className="panel border border-ember/30 p-4 text-center">
          <p className="font-display text-lg uppercase tracking-grimoire text-bone">{t('day.closed')}</p>
          {executed && (
            <p className="mt-1 text-bone-dim">
              {executed.alive ? t('day.princeSaved', { name: executed.name }) : t('day.executed', { name: executed.name })}
            </p>
          )}
          {alsoEliminated.length > 0 && (
            <p className="mt-1 text-bone-dim">{t('day.alsoEliminated', { names: alsoEliminated.map((p) => p.name).join(', ') })}</p>
          )}
        </div>
      )}

      <NominateSheet open={nominating} onClose={() => setNominating(false)} />
    </div>
  );
}

function NominationCard({ nomination }: { nomination: Nomination }) {
  const { t } = useI18n();
  const engine = useGameEngine();
  const { alive, byId, votesNeeded } = engine;
  const accused = byId.get(nomination.accusedId);
  if (!accused) return null;
  // Mayor counts double; forced voters (Idiot / Pacifist) are applied by the rules engine.
  const count = engine.voteCount(nomination.id);
  const majority = count >= votesNeeded;

  const toggleVoter = (id: string) =>
    engine.setVoters(
      nomination.id,
      nomination.voters.includes(id) ? nomination.voters.filter((v) => v !== id) : [...nomination.voters, id],
    );

  return (
    <div className={clsx('panel overflow-hidden border', majority ? 'border-wolf/60 shadow-glow-wolf' : 'border-ember/30')}>
      <div className="h-1 bg-day-border" />
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-bone-dim">{t('day.accused')}</p>
            <p className="font-display text-2xl font-bold uppercase tracking-grimoire text-bone text-shadow-crisp">{accused.name}</p>
          </div>
          <div className="text-right">
            <p className={clsx('font-display text-2xl font-bold', majority ? 'text-wolf-bright' : 'text-bone')}>
              {t('day.votes', { count, needed: votesNeeded })}
            </p>
            <p className="text-xs text-bone-dim">{majority ? t('day.majority') : t('day.noMajority', { needed: votesNeeded })}</p>
          </div>
        </div>

        <p className="text-xs text-bone-faint">{t('day.tapVoters')}</p>
        <div className="flex flex-wrap gap-2">
          {alive.map((p) => {
            // The accused can't vote on their own nomination: always counted as NO / abstain.
            if (p.id === accused.id) {
              return (
                <Tooltip
                  key={p.id}
                  content={t('day.abstainHint')}
                  className="flex min-h-10 cursor-help items-center rounded-full border border-dashed border-panel-edge px-3 text-sm text-bone-faint"
                >
                  {p.name}
                  <span className="sr-only"> — {t('day.abstain')}</span>
                </Tooltip>
              );
            }
            // Roles whose vote is fixed by their card, or who have left the village today.
            const locked =
              p.status.banished
                ? { hint: t('day.banishedHint'), label: t('day.banished') }
                : p.roleId === 'villageIdiot'
                  ? { hint: t('day.idiotHint'), label: t('day.forcedYes') }
                  : p.roleId === 'pacifist'
                    ? { hint: t('day.pacifistHint'), label: t('day.forcedNo') }
                    : null;
            const on = nomination.voters.includes(p.id);
            if (locked) {
              return (
                <Tooltip
                  key={p.id}
                  content={locked.hint}
                  className={clsx(
                    'flex min-h-10 cursor-help items-center rounded-full border border-dashed px-3 text-sm',
                    on ? 'border-ember/70 bg-ember/15 text-bone' : 'border-panel-edge text-bone-faint',
                  )}
                >
                  {p.name}
                  <span className="sr-only"> — {locked.label}</span>
                </Tooltip>
              );
            }
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleVoter(p.id)}
                className={clsx(
                  'press min-h-10 rounded-full border px-3 text-sm font-medium',
                  on ? 'border-ember bg-ember/20 text-bone shadow-inner-ember' : 'border-panel-edge bg-panel-2 text-bone-dim',
                )}
              >
                {p.name}
                {p.roleId === 'mayor' && (
                  <span className="ml-1 font-display text-xs text-ember" title={t('day.mayorHint')}>
                    ×2
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="plain" onClick={() => engine.withdrawNomination(nomination.id)} icon={<Undo2 className="h-4 w-4" />}>
            {t('day.withdraw')}
          </Button>
          <div className="flex-1" />
          <Button variant="wolf" disabled={!majority} onClick={() => engine.execute(nomination.id)} icon={<Gavel className="h-4 w-4" />}>
            {t('day.execute')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function NominateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const engine = useGameEngine();
  const [accused, setAccused] = useState<string | null>(null);

  useEffect(() => {
    if (open) setAccused(null);
  }, [open]);

  const confirm = () => {
    if (!accused) return;
    engine.nominate(accused);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} tone="day" title={t('day.nominate')} closeLabel={t('settings.close')}>
      <div className="space-y-5 pb-4">
        <div>
          <SectionTitle>{t('day.accused')}</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {engine.alive.map((p) => (
              <PlayerToken
                key={p.id}
                player={p}
                accent="ember"
                selected={accused === p.id}
                disabled={p.status.banished}
                note={p.status.banished ? t('day.banished') : undefined}
                onClick={() => setAccused(p.id)}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <Button onClick={onClose}>{t('day.cancel')}</Button>
          <Button variant="ember" block disabled={!accused} onClick={confirm}>
            {t('day.confirm')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

const PRESETS = [120, 180, 300];

function DebateTimer() {
  const { t } = useI18n();
  const [duration, setDuration] = useState(180);
  const [left, setLeft] = useState(180);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (left === 0) setRunning(false);
  }, [left]);

  const mm = String(Math.floor(left / 60)).padStart(1, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div className="panel flex flex-wrap items-center gap-3 p-3">
      <Timer className={clsx('h-5 w-5', left <= 15 && running ? 'text-wolf-bright' : 'text-ember')} />
      <span
        className={clsx('w-20 font-display text-3xl font-bold tabular-nums', left === 0 ? 'text-wolf-bright' : 'text-bone')}
        aria-live="polite"
        aria-label={t('timer.title')}
      >
        {mm}:{ss}
      </span>
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setDuration(p);
              setLeft(p);
              setRunning(false);
            }}
            className={clsx(
              'min-h-9 rounded-lg border px-2 font-display text-xs',
              duration === p ? 'border-ember text-bone' : 'border-panel-edge text-bone-dim',
            )}
          >
            {p / 60}′
          </button>
        ))}
      </div>
      <div className="ml-auto flex gap-2">
        <Button size="sm" variant={running ? 'ghost' : 'ember'} onClick={() => setRunning(!running)} icon={running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}>
          {running ? t('timer.pause') : t('timer.start')}
        </Button>
        <Button
          size="sm"
          variant="plain"
          aria-label={t('timer.reset')}
          onClick={() => {
            setLeft(duration);
            setRunning(false);
          }}
          icon={<RotateCcw className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}
