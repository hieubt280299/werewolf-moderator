import clsx from 'clsx';
import { Repeat, Sparkles } from 'lucide-react';
import type { GameRecord, WinTeam } from '../../@types/game';
import { ROLES } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { TimelineView } from '../game/TimelineView';
import { TONES } from '../shared/tones';
import { Button, Chip, RoleBadge, SectionTitle, Sheet } from '../shared/ui';

export const TEAM_CHIP: Record<WinTeam, 'village' | 'werewolf' | 'vampire' | 'cult' | 'neutral' | 'muted'> = {
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

/** Date and time a game finished, in the active language. */
export function useGameDate() {
  const { language } = useI18n();
  return (iso: string) =>
    new Date(iso).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

interface GameHistoryDetailProps {
  game: GameRecord | null;
  onClose: () => void;
  /** "Start new game from lineup": the same players, seats and cards, opened on the Deal step. */
  onReplay: (game: GameRecord) => void;
}

/** Breakdown of a finished game: result, the roster in seat order and the full timeline. */
export function GameHistoryDetail({ game, onClose, onReplay }: GameHistoryDetailProps) {
  const { t } = useI18n();
  const fmt = useGameDate();
  const roster = game ? [...game.players].sort((a, b) => a.seat - b.seat) : [];

  return (
    <Sheet open={!!game} onClose={onClose} title={game ? t(`win.${game.winner}`) : ''} closeLabel={t('settings.close')}>
      {game && (
        <div className="space-y-6 pb-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-bone-faint">
              <Chip tone={TEAM_CHIP[game.winner]}>{t(`win.${game.winner}`)}</Chip>
              <span>{fmt(game.finishedAt)}</span>
              <span>
                · {t('history.players', { count: game.players.length })} · {t('history.rounds', { count: game.rounds })}
              </span>
              {game.poolName && <span>· {t('history.pool', { name: game.poolName })}</span>}
            </div>
            <Button variant="village" block onClick={() => onReplay(game)} icon={<Repeat className="h-4 w-4" />}>
              {t('history.replay')}
            </Button>
          </div>

          <div>
            <SectionTitle>{t('history.roster')}</SectionTitle>
            <ul className="grid grid-cols-2 gap-2">
              {roster.map((p) => (
                <li
                  key={p.seat}
                  className={clsx('flex items-center gap-2 rounded-xl border border-panel-edge bg-panel-2 p-2', !p.alive && 'opacity-60')}
                >
                  <RoleBadge roleId={p.roleId} size={34} dead={!p.alive} />
                  <span className="min-w-0 flex-1">
                    <span className={clsx('flex items-center gap-1 truncate text-sm font-semibold text-bone', !p.alive && 'line-through')}>
                      <span className="font-display text-xs text-bone-faint" aria-label={t('history.seat', { seat: p.seat + 1 })}>
                        {p.seat + 1}
                      </span>
                      {game.winnerSeats.includes(p.seat) && <Sparkles className="h-3 w-3 shrink-0 text-ember" />}
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className={clsx('block truncate text-xs', TONES[ROLES[p.roleId].cardTone].text)}>{t(`role.${p.roleId}.name`)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SectionTitle>{t('dash.log')}</SectionTitle>
            <TimelineView log={game.log} />
          </div>
        </div>
      )}
    </Sheet>
  );
}
