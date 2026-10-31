import clsx from 'clsx';
import { Moon, ScrollText, Sun, Trophy, Users } from 'lucide-react';
import { Fragment } from 'react';
import type { Faction, GameLogEntry, WinTeam } from '../../@types/game';
import { useHouseRules } from '../../context/HouseRulesContext';
import { roleFaction } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { groupTimeline, timelineParts } from '../../utils/gameCalculations';
import { TONES } from '../shared/tones';
import { Tooltip } from '../shared/Tooltip';

const PHASE_ICON = { night: Moon, dawn: Moon, day: Sun, setup: Users, gameOver: Trophy } as const;

/** Colour of a winning team's name (the Couple takes Cupid's violet). */
const TEAM_TONE: Partial<Record<WinTeam, Faction>> = {
  village: 'village',
  werewolf: 'werewolf',
  loneWolf: 'werewolf',
  vampire: 'vampire',
  cult: 'cult',
  couple: 'vampire',
  tanner: 'neutral',
  neutral: 'neutral',
};

/**
 * Chronological game timeline — oldest first, grouped into phase blocks
 * (Night 1 → Day 1 → Night 2…). Every event names the player and their role.
 */
export function TimelineView({ log, className }: { log: readonly GameLogEntry[]; className?: string }) {
  const { t, tx } = useI18n();
  const houseRules = useHouseRules();
  const groups = groupTimeline(log, tx);

  if (groups.length === 0) return <p className={clsx('text-sm text-bone-faint', className)}>{t('dash.logEmpty')}</p>;

  return (
    <ol className={clsx('relative space-y-4 border-l border-panel-edge pl-5', className)}>
      {groups.map((group, gi) => {
        const phase = group.entries[0].phase;
        const Icon = PHASE_ICON[phase];
        const night = phase === 'night' || phase === 'dawn';
        return (
          <li key={gi} className="relative">
            <span
              className={clsx(
                'absolute -left-[31px] top-0 flex h-5 w-5 items-center justify-center rounded-full border bg-ink',
                night ? 'border-village/60 text-village' : phase === 'day' ? 'border-ember/60 text-ember' : 'border-panel-edge text-bone-dim',
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
            <p className={clsx('mb-1.5 font-display text-xs tracking-wide', night ? 'text-village' : phase === 'day' ? 'text-ember' : 'text-bone-dim')}>
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.entries.map((entry) => (
                <li key={entry.id} className="text-sm leading-snug text-bone/85">
                  {/* Role and team names are tinted in their team's colour. */}
                  {timelineParts(entry, tx).map((part, i) => {
                    // "4 people": hover or tap to see who voted, with their roles.
                    if (part.people) {
                      return (
                        <Tooltip
                          key={i}
                          className="font-semibold text-bone underline decoration-dotted underline-offset-2"
                          content={
                            <>
                              <p className="mb-1 font-display tracking-wide text-bone-dim">{t(part.peopleTitle ?? 'log.votersTitle')}</p>
                              <ul className="space-y-0.5">
                                {part.people.map((p, j) => (
                                  <li key={j}>
                                    {p.name} (<span className={clsx('font-semibold', TONES[roleFaction(p.role, houseRules)].text)}>{tx(`role.${p.role}.name`)}</span>)
                                  </li>
                                ))}
                              </ul>
                            </>
                          }
                        >
                          {part.text}
                        </Tooltip>
                      );
                    }
                    const faction = part.role ? roleFaction(part.role, houseRules) : part.team ? TEAM_TONE[part.team] : undefined;
                    return faction ? (
                      <span key={i} className={clsx('font-semibold', TONES[faction].text)}>
                        {part.text}
                      </span>
                    ) : (
                      <Fragment key={i}>{part.text}</Fragment>
                    );
                  })}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

/** Collapsible timeline panel for the in-game board. */
export function TimelinePanel({ log }: { log: readonly GameLogEntry[] }) {
  const { t } = useI18n();
  return (
    <details className="panel group mt-5 overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-display text-sm tracking-wide text-bone-dim">
        <span className="flex items-center gap-2">
          <ScrollText className="h-4 w-4" /> {t('dash.log')}
        </span>
        <span className="text-xs">{log.length}</span>
      </summary>
      <div className="max-h-96 overflow-y-auto overscroll-contain border-t border-panel-edge px-4 py-4">
        <TimelineView log={log} />
      </div>
    </details>
  );
}
