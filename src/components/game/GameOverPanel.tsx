import { RotateCcw, Sparkles, Trophy } from 'lucide-react';
import type { WinResult, WinTeam } from '../../@types/game';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useI18n } from '../../i18n/I18nContext';
import { RoleCard } from '../shared/RoleCard';
import { TONES, type Tone } from '../shared/tones';
import { Button, SectionTitle } from '../shared/ui';

const TEAM_TONE: Record<WinTeam, Tone | null> = {
  village: TONES.village,
  werewolf: TONES.werewolf,
  loneWolf: TONES.werewolf,
  // The Couple glows in Cupid's rose-violet.
  couple: TONES.vampire,
  tanner: TONES.neutral,
  neutral: TONES.neutral,
  vampire: TONES.vampire,
  cult: TONES.cult,
  draw: null,
};

export function GameOverPanel({ winner }: { winner: WinResult }) {
  const { t } = useI18n();
  const engine = useGameEngine();
  const tone = TEAM_TONE[winner.team];
  const winners = new Set(winner.winnerIds);

  return (
    <div className="space-y-5">
      <div
        className="relative animate-pop overflow-hidden rounded-2xl border p-6 text-center"
        style={{
          borderColor: tone?.accent ?? '#2A2E3B',
          background: tone ? `radial-gradient(120% 100% at 50% 0%, ${tone.mist}, ${tone.night} 60%, #050505)` : '#12141C',
          boxShadow: tone ? `0 0 40px -8px ${tone.glow}, ${tone.inner}` : undefined,
        }}
      >
        <Trophy className="mx-auto mb-2 h-10 w-10 text-bone" style={{ filter: tone ? `drop-shadow(0 0 10px ${tone.glow})` : undefined }} />
        <h2 className="text-3xl text-bone text-shadow-title sm:text-4xl">{t(`win.${winner.team}`)}</h2>
      </div>

      <div>
        <SectionTitle>{t('win.reveal')}</SectionTitle>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4" style={{ perspective: 800 }}>
          {engine.state.players.map((p, i) => (
            <div key={p.id} className="flex animate-deal flex-col items-center gap-1.5" style={{ animationDelay: `${i * 40}ms` }}>
              <RoleCard roleId={p.roleId} size="sm" dead={!p.alive} className="!w-full" />
              <span className="flex max-w-full items-center gap-1 truncate text-sm font-semibold text-bone">
                {winners.has(p.id) && <Sparkles className="h-3.5 w-3.5 shrink-0 text-ember" aria-label={t('win.winners')} />}
                {p.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="village" size="lg" onClick={engine.rematch} icon={<RotateCcw className="h-4 w-4" />}>
          {t('win.rematch')}
        </Button>
        <Button size="lg" onClick={engine.newGame}>
          {t('win.newGame')}
        </Button>
      </div>
    </div>
  );
}
