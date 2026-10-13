import { useAutoAnimate } from '@formkit/auto-animate/react';
import clsx from 'clsx';
import { Biohazard, FlaskConical, Moon, PawPrint, ScrollText, Sun, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Player } from '../../@types/game';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useI18n } from '../../i18n/I18nContext';
import { Button, Chip, SectionTitle } from '../shared/ui';
import { ChroniclePanel } from './ChronicleView';
import { DawnReport } from './DawnReport';
import { GameOverPanel } from './GameOverPanel';
import { HunterTriggerSheet } from './HunterTriggerSheet';
import { NightActionModal } from './NightActionModal';
import { PhaseTimeline } from './PhaseTimeline';
import { PlayerSheet } from './PlayerSheet';
import { PlayerTile } from './PlayerTile';
import { VotingPanel } from './VotingPanel';

/**
 * In-game moderator board: phase timeline, the control panel for the current phase
 * (night script / dawn report / day voting / results), the live player grid and chronicle.
 */
export function ModeratorDashboard() {
  const { t } = useI18n();
  const engine = useGameEngine();
  const { state, alive } = engine;
  const [nightOpen, setNightOpen] = useState(false);
  const [inspected, setInspected] = useState<string | null>(null);
  const lastNight = useRef<number | null>(null);
  const [gridRef] = useAutoAnimate<HTMLDivElement>({ duration: 260 });

  // Open the wake-up assistant automatically each time a new night begins.
  useEffect(() => {
    if (state.phase === 'night' && lastNight.current !== state.round) {
      lastNight.current = state.round;
      setNightOpen(true);
    }
    if (state.phase !== 'night') setNightOpen(false);
  }, [state.phase, state.round]);

  const closeNight = useCallback(() => setNightOpen(false), []);
  const closeInspect = useCallback(() => setInspected(null), []);

  const isNight = state.phase === 'night';
  const isDay = state.phase === 'day' || state.phase === 'dawn';
  const inspectedPlayer = state.players.find((p) => p.id === inspected) ?? null;
  const shieldedId = isNight ? state.nightActions.bodyguardTarget : null;

  return (
    <div
      className={clsx(
        'min-h-[calc(100dvh-3.5rem)]',
        isNight && 'bg-[radial-gradient(120%_60%_at_50%_0%,rgba(0,130,200,0.12),transparent_70%)]',
      )}
    >
      {/* Day transitions: striking ember border across the top. */}
      {isDay && <div key="day-border" className="fixed inset-x-0 top-0 z-40 h-1 origin-left animate-grow-x bg-day-border shadow-glow-ember" />}

      <div className="mx-auto max-w-6xl space-y-5 px-4 pb-16 pt-4">
        <PhaseTimeline phase={state.phase} round={state.round} />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <section
            className={clsx(
              'panel h-fit overflow-hidden border',
              isNight && 'border-village/25',
              isDay && 'border-ember/40',
              state.phase === 'gameOver' && 'border-panel-edge',
            )}
          >
            {isDay && <div className="h-1 bg-day-border" />}
            <div key={`${state.phase}-${state.round}`} className="animate-step-in space-y-4 p-4 sm:p-5">
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
            </div>
          </section>

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
            <div ref={gridRef} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {sortForGrid(state.players).map((p) => (
                <PlayerTile key={p.id} player={p} shielded={p.id === shieldedId} onClick={() => setInspected(p.id)} />
              ))}
            </div>

            <ChroniclePanel log={state.log} />
          </section>
        </div>
      </div>

      <NightActionModal open={nightOpen && isNight} onClose={closeNight} />
      <HunterTriggerSheet />
      <PlayerSheet player={inspectedPlayer} onClose={closeInspect} />
    </div>
  );
}

/** Living players first in seat order; the dead sink to the bottom. */
const sortForGrid = (players: Player[]) => [...players].sort((a, b) => Number(b.alive) - Number(a.alive) || a.seat - b.seat);

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
