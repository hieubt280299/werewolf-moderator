import clsx from 'clsx';
import { Award, ChevronDown, Eye, Gavel, Megaphone, Shield, Sparkles, Swords, Trophy, type LucideIcon } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useHouseRules } from '../../context/HouseRulesContext';
import { roleFaction } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { timelineParts } from '../../utils/gameCalculations';
import { SCORE_CATEGORIES, standings, type PlayerScore, type ScoreBoard, type ScoreCategory, type ScoreLine } from '../../utils/scoring';
import { RoleCard } from '../shared/RoleCard';
import { TONES } from '../shared/tones';
import { RoleBadge } from '../shared/ui';

export const CATEGORY_ICON: Record<ScoreCategory, LucideIcon> = {
  result: Trophy,
  kills: Swords,
  saves: Shield,
  intel: Eye,
  votes: Gavel,
  pick: Megaphone,
};

/** "+3", "−2" (a true minus sign), "0". */
export const formatPoints = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** "12 points", "1 point". */
function usePointsLabel() {
  const { t } = useI18n();
  return (n: number) => (n === 1 ? t('mvp.pointsOne') : t('mvp.points', { points: n }));
}

/**
 * What the moderator picked: a player and the bonus, nobody (`null`), or a pick that no longer
 * counts (a game played on after the pick ended with the player off the winning side).
 */
export function PickLine({ name, counted, points }: { name: string | null; counted: boolean; points: number }) {
  const { t } = useI18n();
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-sm text-bone-dim">
      <Megaphone className="h-4 w-4 shrink-0 text-ember" />
      <span className="min-w-0">{name === null ? t('mvp.noPick') : counted ? t('mvp.picked', { name, points }) : t('mvp.pickVoid', { name })}</span>
    </p>
  );
}

/** The MVP, large: their card, name and total. Co-MVPs stand side by side. */
export function MvpSpotlight({ board }: { board: ScoreBoard }) {
  const { t } = useI18n();
  const points = usePointsLabel();
  const mvps = board.ranking.filter((s) => board.mvpIds.includes(s.player.id));

  if (mvps.length === 0) {
    return <p className="rounded-xl border border-dashed border-panel-edge p-4 text-center text-sm text-bone-faint">{t('mvp.none')}</p>;
  }

  return (
    <div
      className="relative animate-pop overflow-hidden rounded-2xl border border-ember/60 p-5 text-center shadow-glow-ember"
      style={{ background: 'radial-gradient(120% 100% at 50% 0%, rgba(242,106,33,0.24), #12141C 62%, #050505)' }}
    >
      <Award className="mx-auto h-9 w-9 text-ember" style={{ filter: 'drop-shadow(0 0 10px rgba(242,106,33,0.7))' }} />
      <p className="mt-1 font-display text-lg font-bold uppercase tracking-grimoire text-ember text-shadow-crisp">
        {t(mvps.length > 1 ? 'mvp.coTitle' : 'mvp.title')}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-5" style={{ perspective: 800 }}>
        {mvps.map((s, i) => (
          <div key={s.player.id} className="flex w-28 animate-deal flex-col items-center gap-1.5" style={{ animationDelay: `${120 + i * 80}ms` }}>
            <RoleCard roleId={s.player.roleId} size="sm" dead={!s.player.alive} className="!w-full" />
            <span className="max-w-full truncate font-display text-xl font-bold text-bone text-shadow-crisp">{s.player.name}</span>
            <span className="font-display text-sm text-ember">{points(s.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Every player's score, highest first (equal totals share a rank). The MVP's row glows. Tap a
 * row for the plays behind it.
 */
export function Scoreboard({ board }: { board: ScoreBoard }) {
  const ranks = standings(board.ranking);
  const mvps = new Set(board.mvpIds);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ol className="space-y-2">
      {board.ranking.map((score, i) => (
        <ScoreRow
          key={score.player.id}
          score={score}
          rank={ranks[i]}
          mvp={mvps.has(score.player.id)}
          open={open === score.player.id}
          onToggle={() => setOpen(open === score.player.id ? null : score.player.id)}
        />
      ))}
    </ol>
  );
}

function ScoreRow({ score, rank, mvp, open, onToggle }: { score: PlayerScore; rank: number; mvp: boolean; open: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  const points = usePointsLabel();
  const houseRules = useHouseRules();
  const { player } = score;

  return (
    <li className={clsx('panel overflow-hidden border', mvp ? 'border-ember/60 shadow-glow-ember' : 'border-panel-edge')}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={t('mvp.details', { name: player.name, points: points(score.total) })}
        onClick={onToggle}
        className="press flex w-full items-center gap-2.5 p-2.5 text-left"
      >
        <span className="flex w-6 shrink-0 justify-center font-display text-sm font-bold text-bone-dim">
          {mvp ? <Award className="h-5 w-5 text-ember" aria-label={t('mvp.title')} /> : rank}
        </span>
        <RoleBadge roleId={player.roleId} size={36} dead={!player.alive} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-sm font-semibold text-bone">
            {score.won && <Sparkles className="h-3.5 w-3.5 shrink-0 text-ember" aria-label={t('win.winners')} />}
            <span className={clsx('truncate', !player.alive && 'text-bone-dim')}>{player.name}</span>
            {score.picked && <Megaphone className="h-3.5 w-3.5 shrink-0 text-ember" aria-label={t('mvp.pickTitle')} />}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px]">
            <span className={clsx('font-semibold', TONES[roleFaction(player.roleId, houseRules)].text)}>{t(`role.${player.roleId}.name`)}</span>
            {SCORE_CATEGORIES.filter((c) => score.byCategory[c] !== 0).map((c) => {
              const Icon = CATEGORY_ICON[c];
              const value = score.byCategory[c];
              return (
                <span key={c} className={clsx('flex items-center gap-0.5 tabular-nums', value < 0 ? 'text-wolf-bright' : 'text-bone-dim')}>
                  <Icon className="h-3 w-3" aria-label={t(`score.cat.${c}`)} />
                  {formatPoints(value)}
                </span>
              );
            })}
          </span>
        </span>
        <span className={clsx('shrink-0 font-display text-2xl font-bold tabular-nums', mvp ? 'text-ember' : score.total < 0 ? 'text-wolf-bright' : 'text-bone')}>
          {score.total < 0 ? formatPoints(score.total) : score.total}
        </span>
        <ChevronDown className={clsx('h-4 w-4 shrink-0 text-bone-faint transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul className="animate-fade-in space-y-2 border-t border-panel-edge px-3 py-2.5">
          {score.lines.length === 0 && <li className="text-sm text-bone-faint">0</li>}
          {score.lines.map((line, i) => (
            <ScoreLineItem key={i} line={line} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** One play: what happened (role names tinted), when, and its points. */
function ScoreLineItem({ line }: { line: ScoreLine }) {
  const { t, tx } = useI18n();
  const houseRules = useHouseRules();
  const Icon = CATEGORY_ICON[line.category];
  const parts = timelineParts({ id: '', round: line.round ?? 0, phase: 'gameOver', key: line.key, params: line.params }, tx);
  const details = [
    line.round ? t(line.phase === 'day' ? 'day.title' : 'dash.night', { round: line.round }) : null,
    line.shared ? t('score.shared', { count: line.shared }) : null,
    line.note ? tx(`score.note.${line.note}`) : null,
  ].filter(Boolean);

  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bone-faint" />
      <span className="min-w-0 flex-1 leading-snug text-bone/85">
        {parts.map((part, i) =>
          part.role ? (
            <span key={i} className={clsx('font-semibold', TONES[roleFaction(part.role, houseRules)].text)}>
              {part.text}
            </span>
          ) : (
            <Fragment key={i}>{part.text}</Fragment>
          ),
        )}
        {details.length > 0 && <span className="block text-[11px] text-bone-faint">{details.join(' · ')}</span>}
      </span>
      <span
        className={clsx(
          'shrink-0 font-display font-semibold tabular-nums',
          line.points < 0 ? 'text-wolf-bright' : line.category === 'pick' ? 'text-ember' : 'text-bone',
        )}
      >
        {formatPoints(line.points)}
      </span>
    </li>
  );
}
