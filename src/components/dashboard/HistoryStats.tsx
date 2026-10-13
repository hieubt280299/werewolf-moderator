import clsx from 'clsx';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { GameRecord, WinTeam } from '../../@types/game';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { TimelineView } from '../game/TimelineView';
import { Chip, RoleBadge, SectionTitle, Sheet } from '../shared/ui';

const TEAM_CHIP: Record<WinTeam, 'village' | 'werewolf' | 'vampire' | 'cult' | 'neutral' | 'muted'> = {
  village: 'village',
  werewolf: 'werewolf',
  loneWolf: 'werewolf',
  couple: 'vampire',
  tanner: 'neutral',
  neutral: 'neutral',
  vampire: 'vampire',
  cult: 'cult',
  draw: 'muted',
};

/** Career statistics and the log of finished games. */
export function HistoryStats() {
  const { t, language } = useI18n();
  const { profile, listGames } = useAuth();
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<GameRecord | null>(null);
  const stats = profile?.stats;

  useEffect(() => {
    listGames()
      .then(setGames)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [listGames]);

  const total = stats ? Math.max(1, stats.werewolfWins + stats.villageWins + stats.otherWins) : 1;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

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
              <span className="bg-wolf" style={{ width: `${(stats.werewolfWins / total) * 100}%` }} />
              <span className="bg-village" style={{ width: `${(stats.villageWins / total) * 100}%` }} />
              <span className="bg-vampire" style={{ width: `${(stats.otherWins / total) * 100}%` }} />
            </div>
          </div>
        </section>
      )}

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
                    {g.deckName && ` · ${t('history.deck', { name: g.deckName })}`}
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

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? t(`win.${open.winner}`) : ''} closeLabel={t('settings.close')}>
        {open && (
          <div className="space-y-6 pb-6">
            <p className="text-xs text-bone-faint">{fmt(open.finishedAt)}</p>
            <div>
              <SectionTitle>{t('history.roster')}</SectionTitle>
              <ul className="grid grid-cols-2 gap-2">
                {open.players.map((p) => (
                  <li key={p.seat} className={clsx('flex items-center gap-2 rounded-xl border border-panel-edge bg-panel-2 p-2', !p.alive && 'opacity-60')}>
                    <RoleBadge roleId={p.roleId} size={34} dead={!p.alive} />
                    <span className="min-w-0 flex-1">
                      <span className={clsx('flex items-center gap-1 truncate text-sm font-semibold text-bone', !p.alive && 'line-through')}>
                        {open.winnerSeats.includes(p.seat) && <Sparkles className="h-3 w-3 shrink-0 text-ember" />}
                        {p.name}
                      </span>
                      <span className="block truncate text-xs text-bone-dim">{t(`role.${p.roleId}.name`)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionTitle>{t('dash.log')}</SectionTitle>
              <TimelineView log={open.log} />
            </div>
          </div>
        )}
      </Sheet>
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
