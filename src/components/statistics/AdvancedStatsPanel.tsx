import clsx from 'clsx';
import { CalendarClock, Layers, Percent, Trophy, Users } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { GameRecord, RoleId } from '../../@types/game';
import { ROLES } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { historyRecords, MIN_WINS_FOR_RATE, percentOf, type Leaderboard, type RoleTally } from '../../utils/historyAnalytics';
import { TEAM_CHIP, useGameDate } from '../history/GameHistoryDetail';
import { RoleDetailSheet } from '../shared/RoleDetailSheet';
import { TONES } from '../shared/tones';
import { Chip, RoleBadge, SectionTitle } from '../shared/ui';

interface AdvancedStatsPanelProps {
  /** Finished games, newest first. */
  games: GameRecord[];
  /** Opens a game's breakdown (the same sheet as the game list). */
  onOpenGame: (game: GameRecord) => void;
}

/**
 * Records across the moderator's history: most played role (Villagers and Werewolves aside),
 * most wins, best win rate (3+ wins to qualify), longest game and biggest table. Role
 * records count games, not cards dealt. Up to three tied holders are shown
 * side by side. Role records open the role's card; game records open the game.
 */
export function AdvancedStatsPanel({ games, onOpenGame }: AdvancedStatsPanelProps) {
  const { t } = useI18n();
  const records = useMemo(() => historyRecords(games), [games]);
  const [role, setRole] = useState<RoleId | null>(null);

  if (games.length === 0) return null;

  const plural = (count: number, one: Parameters<typeof t>[0], many: Parameters<typeof t>[0]) =>
    count === 1 ? t(one) : t(many, { count });

  return (
    <section className="animate-step-in space-y-4">
      <SectionTitle aside={<span className="text-xs text-bone-faint">{plural(games.length, 'stats.basisOne', 'stats.basis')}</span>}>
        {t('stats.title')}
      </SectionTitle>

      <div className="grid gap-3 lg:grid-cols-2">
        <RecordBlock
          icon={<Layers className="h-4 w-4" />}
          title={t('stats.mostPlayed')}
          hint={t('stats.mostPlayedHint')}
          board={records.mostPlayed}
        >
          {(r: RoleTally) => (
            <RoleEntry
              key={r.roleId}
              roleId={r.roleId}
              onOpen={setRole}
              primary={plural(r.played, 'stats.playedOne', 'stats.played')}
              secondary={plural(r.wins, 'stats.winsOne', 'stats.wins')}
            />
          )}
        </RecordBlock>

        <RecordBlock icon={<Trophy className="h-4 w-4" />} title={t('stats.mostWins')} board={records.mostWins}>
          {(r: RoleTally) => (
            <RoleEntry
              key={r.roleId}
              roleId={r.roleId}
              onOpen={setRole}
              primary={plural(r.wins, 'stats.winsOne', 'stats.wins')}
              secondary={plural(r.played, 'stats.playedOne', 'stats.played')}
            />
          )}
        </RecordBlock>

        <RecordBlock
          icon={<Percent className="h-4 w-4" />}
          title={t('stats.bestRate')}
          hint={t('stats.bestRateHint', { min: MIN_WINS_FOR_RATE })}
          board={records.bestRate}
        >
          {(r: RoleTally) => (
            <RoleEntry
              key={r.roleId}
              roleId={r.roleId}
              onOpen={setRole}
              primary={t('stats.rate', { percent: percentOf(r.wins, r.played) })}
              secondary={t('stats.rateDetail', { wins: r.wins, played: r.played })}
            />
          )}
        </RecordBlock>

        <RecordBlock icon={<CalendarClock className="h-4 w-4" />} title={t('stats.longest')} board={records.longest}>
          {(g: GameRecord) => (
            <GameEntry key={g.id} game={g} onOpen={onOpenGame} primary={plural(g.rounds, 'stats.nightsOne', 'stats.nights')} />
          )}
        </RecordBlock>

        <RecordBlock icon={<Users className="h-4 w-4" />} title={t('stats.biggest')} board={records.biggest}>
          {(g: GameRecord) => (
            <GameEntry key={g.id} game={g} onOpen={onOpenGame} primary={t('history.players', { count: g.players.length })} />
          )}
        </RecordBlock>
      </div>

      <RoleDetailSheet roleId={role} onClose={() => setRole(null)} />
    </section>
  );
}

/**
 * One record: its title, then its holders in a row. Ties beyond the shown three are counted.
 * On narrow screens the row scrolls sideways (snapping per card) instead of squeezing.
 */
function RecordBlock<T>({
  icon,
  title,
  hint,
  board,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  board: Leaderboard<T> | null;
  children: (entry: T) => ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="panel border border-panel-edge p-3">
      <div className="mb-2.5">
        <p className="flex items-center gap-1.5 font-display text-xs tracking-wide text-bone-dim">
          <span className="shrink-0 text-ember">{icon}</span>
          {title}
        </p>
        {/* Kept (empty) without a hint, so side-by-side records line up their holders. */}
        <p aria-hidden={!hint} className="mt-0.5 min-h-4 text-[11px] leading-4 text-bone-faint">
          {hint}
        </p>
      </div>
      {board ? (
        <>
          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">{board.entries.map(children)}</div>
          {board.tied > board.entries.length && (
            <p className="mt-1.5 text-[11px] text-bone-faint">{t('stats.more', { count: board.tied - board.entries.length })}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-bone-faint">{t('stats.none')}</p>
      )}
    </div>
  );
}

const ENTRY =
  'press flex min-h-[72px] min-w-[150px] flex-1 snap-start items-center gap-2.5 rounded-xl border border-panel-edge bg-panel-2 p-2 text-left hover:border-bone/30';

function RoleEntry({
  roleId,
  primary,
  secondary,
  onOpen,
}: {
  roleId: RoleId;
  primary: string;
  secondary?: string;
  onOpen: (roleId: RoleId) => void;
}) {
  const { t } = useI18n();
  const name = t(`role.${roleId}.name`);
  return (
    <button type="button" onClick={() => onOpen(roleId)} aria-label={`${name}: ${primary}`} className={ENTRY}>
      <RoleBadge roleId={roleId} size={44} />
      <span className="min-w-0 flex-1">
        <span className={clsx('block truncate font-display text-sm font-semibold uppercase tracking-wide', TONES[ROLES[roleId].cardTone].text)}>
          {name}
        </span>
        <span className="block font-display text-lg font-bold leading-tight text-bone">{primary}</span>
        {secondary && <span className="block text-[11px] text-bone-faint">{secondary}</span>}
      </span>
    </button>
  );
}

function GameEntry({ game, primary, onOpen }: { game: GameRecord; primary: string; onOpen: (game: GameRecord) => void }) {
  const { t } = useI18n();
  const fmt = useGameDate();
  return (
    <button type="button" onClick={() => onOpen(game)} className={ENTRY}>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block font-display text-lg font-bold leading-tight text-bone">{primary}</span>
        <Chip tone={TEAM_CHIP[game.winner]}>{t(`win.${game.winner}`)}</Chip>
        <span className="block truncate text-[11px] text-bone-faint">{fmt(game.finishedAt)}</span>
      </span>
    </button>
  );
}
