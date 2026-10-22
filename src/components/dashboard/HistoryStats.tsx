import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { GameRecord } from '../../@types/game';
import type { View } from '../../App';
import { useAuth } from '../../context/AuthContext';
import { isActiveGame, useGame } from '../../context/GameContext';
import { useI18n } from '../../i18n/I18nContext';
import { checkLineup, lineupSetup } from '../../utils/gameCalculations';
import { winShares, type WinShareKey } from '../../utils/historyAnalytics';
import { GameHistoryDetail, TEAM_CHIP, useGameDate } from '../history/GameHistoryDetail';
import { AdvancedStatsPanel } from '../statistics/AdvancedStatsPanel';
import { Chip, RoleBadge, SectionTitle } from '../shared/ui';

const SHARE_STYLE: Record<WinShareKey, { bar: string; text: string; label: 'history.wolfWins' | 'history.villageWins' | 'history.otherWins' }> = {
  werewolf: { bar: 'bg-wolf', text: 'text-wolf-bright', label: 'history.wolfWins' },
  village: { bar: 'bg-village', text: 'text-village', label: 'history.villageWins' },
  other: { bar: 'bg-vampire', text: 'text-vampire', label: 'history.otherWins' },
};

/** Career statistics, records and the log of finished games. */
export function HistoryStats({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { t } = useI18n();
  const { profile, listGames } = useAuth();
  const { state, dispatch } = useGame();
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<GameRecord | null>(null);
  const stats = profile?.stats;
  const fmt = useGameDate();

  const replay = (game: GameRecord) => {
    if (isActiveGame(state) && !window.confirm(t('hub.confirmNew'))) return;
    dispatch({ type: 'LOAD_LINEUP', setup: checkLineup(lineupSetup(game), profile?.rebalances) });
    setOpen(null);
    onNavigate('game');
  };

  useEffect(() => {
    listGames()
      .then(setGames)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [listGames]);

  const shares = stats ? winShares(stats) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-6">
      {stats && (
        <section className="animate-step-in space-y-3">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatCard label={t('history.games')} value={stats.gamesModerated} />
            <StatCard label={t('history.wolfWins')} value={stats.werewolfWins} className="text-wolf-bright" />
            <StatCard label={t('history.villageWins')} value={stats.villageWins} className="text-village" />
            <StatCard label={t('history.otherWins')} value={stats.otherWins} className="text-vampire" />
          </div>
          <div className="panel p-4">
            <p className="mb-2 font-display text-xs uppercase tracking-grimoire text-bone-dim">{t('history.split')}</p>
            <div className="flex h-3 overflow-hidden rounded-full bg-panel-edge">
              {shares.map((s) => (
                <span key={s.key} className={SHARE_STYLE[s.key].bar} style={{ width: `${s.total ? (s.wins / s.total) * 100 : 0}%` }} />
              ))}
            </div>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-3">
              {shares.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-sm">
                  <span aria-hidden className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', SHARE_STYLE[s.key].bar)} />
                  <span className="text-bone-dim">{t(SHARE_STYLE[s.key].label)}:</span>
                  <span className={clsx('font-display font-semibold', SHARE_STYLE[s.key].text)}>
                    {t('history.share', { percent: s.percent, wins: s.wins, total: s.total })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {games && games.length > 0 && <AdvancedStatsPanel games={games} onOpenGame={setOpen} />}

      <section>
        <SectionTitle>{t('history.recent')}</SectionTitle>
        {error && <p className="text-sm text-wolf-bright">{t('settings.cloudError', { error })}</p>}
        {!games && !error && <p className="text-sm text-bone-faint">{t('history.loading')}</p>}
        {games?.length === 0 && <p className="rounded-xl border border-dashed border-panel-edge p-6 text-center text-sm text-bone-faint">{t('history.empty')}</p>}
        <ul className="space-y-2.5">
          {games?.map((g, i) => (
            <li key={g.id} className="animate-step-in" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <button
                type="button"
                onClick={() => setOpen(g)}
                className="press panel flex w-full items-center gap-3 border border-panel-edge p-3 text-left"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={TEAM_CHIP[g.winner]}>{t(`win.${g.winner}`)}</Chip>
                    <span className="text-xs text-bone-faint">{fmt(g.finishedAt)}</span>
                  </div>
                  <p className="text-sm text-bone-dim">
                    {t('history.players', { count: g.players.length })} · {t('history.rounds', { count: g.rounds })}
                    {g.poolName && ` · ${t('history.pool', { name: g.poolName })}`}
                  </p>
                  <div className="flex -space-x-1.5">
                    {g.players.slice(0, 12).map((p) => (
                      <RoleBadge key={p.seat} roleId={p.roleId} size={22} dead={!p.alive} />
                    ))}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-bone-faint" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <GameHistoryDetail game={open} onClose={() => setOpen(null)} onReplay={replay} />
    </div>
  );
}

function StatCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="panel p-3 text-center">
      <p className={clsx('font-display text-3xl font-bold text-bone', className)}>{value}</p>
      <p className="mt-0.5 text-[11px] uppercase leading-tight tracking-wide text-bone-dim">{label}</p>
    </div>
  );
}
