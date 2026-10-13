import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Biohazard, FlaskConical, Moon, PawPrint, ScrollText, Sun, Users } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Player } from '../../@types/game';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useI18n } from '../../i18n/I18nContext';
import { fadeStep } from '../../utils/motion';
import { VotingPanel } from '../day/VotingPanel';
import { NightActionModal } from '../night/NightActionModal';
import { Button, Chip, SectionTitle } from '../shared/ui';
import { DawnReport } from './DawnReport';
import { GameOverPanel } from './GameOverPanel';
import { HunterTriggerSheet } from './HunterTriggerSheet';
import { PhaseTimeline } from './PhaseTimeline';
import { PlayerSheet } from './PlayerSheet';
import { PlayerTile } from './PlayerTile';

/**
 * Main moderator hub: phase timeline, the control panel for the current phase
 * (night script / dawn report / day voting / results) and the live player grid.
 */
export function ModeratorDashboard() {
  const { t } = useI18n();
  const engine = useGameEngine();
  const { state, alive } = engine;
  const [nightOpen, setNightOpen] = useState(false);
  const [inspected, setInspected] = useState<string | null>(null);
  const lastNight = useRef<number | null>(null);

  // Open the wake-up assistant automatically each time a new night begins.
  useEffect(() => {
    if (state.phase === 'night' && lastNight.current !== state.round) {
      lastNight.current = state.round;
      setNightOpen(true);
    }
    if (state.phase !== 'night') setNightOpen(false);
  }, [state.phase, state.round]);

  const isNight = state.phase === 'night';
  const isDay = state.phase === 'day' || state.phase === 'dawn';
  const inspectedPlayer = state.players.find((p) => p.id === inspected) ?? null;
  const shieldedId = isNight ? state.nightActions.bodyguardTarget : null;

  return (
    <div
      className={clsx(
        'min-h-dvh transition-colors duration-700',
        isNight && 'bg-[radial-gradient(120%_60%_at_50%_0%,rgba(0,130,200,0.12),transparent_70%)]',
      )}
    >
      {/* Day transitions: striking ember border across the top. */}
      <AnimatePresence>
        {isDay && (
          <motion.div
            key="day-border"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0 }}
            className="fixed inset-x-0 top-0 z-40 h-1 origin-left bg-day-border shadow-glow-ember"
          />
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-6xl space-y-5 px-4 pb-16 pt-4">
        <PhaseTimeline phase={state.phase} round={state.round} />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* Control panel */}
          <section
            className={clsx(
              'panel h-fit overflow-hidden border',
              isNight && 'border-village/25',
              isDay && 'border-ember/40',
              state.phase === 'gameOver' && 'border-panel-edge',
            )}
          >
            {isDay && <div className="h-1 bg-day-border" />}
            <div className="space-y-4 p-4 sm:p-5">
              <AnimatePresence mode="wait">
                <motion.div key={`${state.phase}-${state.round}`} variants={fadeStep} initial="hidden" animate="show" exit="exit" className="space-y-4">
                  {isNight && (
                    <>
                      <PanelHeading icon={<Moon className="h-5 w-5 text-village" />} title={t('dash.night', { round: state.round })} />
                      <p className="text-bone/80">{t('dash.nightIntro')}</p>
                      <ModifierChips />
                      <Button variant="village" size="lg" block onClick={() => setNightOpen(true)} icon={<ScrollText className="h-5 w-5" />}>
                        {t('dash.openNight')}
                      </Button>
                    </>
                  )}

                  {state.phase === 'dawn' && state.lastReport && (
                    <>
                      <PanelHeading icon={<Sun className="h-5 w-5 text-ember" />} title={t('dawn.title')} />
                      <p className="text-bone/80">{t('dash.dayIntro')}</p>
                      <DawnReport report={state.lastReport} />
                      <Button variant="ember" size="lg" block onClick={engine.startDay} icon={<Sun className="h-5 w-5" />}>
                        {t('dash.startDay')}
                      </Button>
                    </>
                  )}

                  {state.phase === 'day' && (
                    <>
                      <PanelHeading icon={<Sun className="h-5 w-5 text-ember" />} title={t('day.title', { round: state.round })} />
                      <VotingPanel />
                      {state.dayStep === 'closed' && (
                        <Button variant="village" size="lg" block onClick={engine.startNight} icon={<Moon className="h-5 w-5" />}>
                          {t('dash.nightfall')}
                        </Button>
                      )}
                    </>
                  )}

                  {state.phase === 'gameOver' && state.winner && <GameOverPanel winner={state.winner} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </section>

          {/* Player grid */}
          <section>
            <SectionTitle
              aside={
                <span className="flex items-center gap-1.5 text-xs text-bone-dim">
                  <Users className="h-3.5 w-3.5" />
                  {t('dash.alive', { alive: alive.length, total: state.players.length })}
                </span>
              }
            >
              {t('dash.players')}
            </SectionTitle>
            <motion.div layout className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {sortForGrid(state.players).map((p) => (
                <PlayerTile key={p.id} player={p} shielded={p.id === shieldedId} onClick={() => setInspected(p.id)} />
              ))}
            </motion.div>

            <Chronicle />
          </section>
        </div>
      </div>

      <NightActionModal open={nightOpen && isNight} onClose={() => setNightOpen(false)} />
      <HunterTriggerSheet />
      <PlayerSheet player={inspectedPlayer} onClose={() => setInspected(null)} />
    </div>
  );
}

/** Living players first in seat order; the dead sink to the bottom. */
const sortForGrid = (players: Player[]) =>
  [...players].sort((a, b) => Number(b.alive) - Number(a.alive) || a.seat - b.seat);

function PanelHeading({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="text-2xl text-bone text-shadow-crisp">{title}</h2>
    </div>
  );
}

function ModifierChips() {
  const { t } = useI18n();
  const { state } = useGameEngine();
  const m = state.modifiers;
  const hasWitch = state.deck.includes('witch');
  if (!m.wolvesSkipNextNight && !m.wolvesDoubleKill && !(hasWitch && (m.witchHealUsed || m.witchKillUsed))) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {m.wolvesSkipNextNight && <Chip tone="ember" icon={<Biohazard className="h-3 w-3" />}>{t('mod.wolvesSkip')}</Chip>}
      {m.wolvesDoubleKill && <Chip tone="werewolf" icon={<PawPrint className="h-3 w-3" />}>{t('mod.wolvesDouble')}</Chip>}
      {hasWitch && m.witchHealUsed && <Chip icon={<FlaskConical className="h-3 w-3" />}>{t('mod.witchHeal')}</Chip>}
      {hasWitch && m.witchKillUsed && <Chip icon={<FlaskConical className="h-3 w-3" />}>{t('mod.witchKill')}</Chip>}
    </div>
  );
}

function Chronicle() {
  const { t, tx } = useI18n();
  const { state } = useGameEngine();
  const entries = [...state.log].reverse();

  return (
    <details className="panel group mt-5 overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-display text-sm uppercase tracking-grimoire text-bone-dim">
        <span className="flex items-center gap-2">
          <ScrollText className="h-4 w-4" /> {t('dash.log')}
        </span>
        <span className="text-xs">{state.log.length}</span>
      </summary>
      <ol className="max-h-72 space-y-1.5 overflow-y-auto border-t border-panel-edge px-4 py-3 text-sm">
        {entries.length === 0 && <li className="text-bone-faint">{t('dash.logEmpty')}</li>}
        {entries.map((e) => {
          const params = e.params?.team ? { ...e.params, team: tx(`team.${e.params.team}`) } : e.params;
          return (
            <li key={e.id} className="flex gap-3">
              <span className="w-8 shrink-0 font-display text-xs text-bone-faint">{e.round > 0 ? `#${e.round}` : '—'}</span>
              <span className="text-bone/85">{tx(e.key, params)}</span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
