import clsx from 'clsx';
import { Sparkles, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Feat, RoleId } from '../../@types/game';
import { useI18n } from '../../i18n/I18nContext';
import { featPoints, roleValue, SCORING } from '../../utils/scoring';
import { RoleBadge, Sheet } from '../shared/ui';
import { CATEGORY_ICON, formatPoints as f } from './Scoreboard';

/** Roles shown as examples of what a player is worth, cheapest first. */
const VALUE_EXAMPLES: RoleId[] = ['cupid', 'villager', 'bodyguard', 'werewolf', 'seer', 'bigBadWolf'];

/** Points for an example play, worked out by the scoring itself so the sheet can't drift from it. */
const example = (feat: Partial<Feat> & Pick<Feat, 'kind'>): number =>
  featPoints({ round: 1, phase: 'night', playerId: '', actorRole: 'villager', ...feat });

function Heading({ children }: { children: ReactNode }) {
  return <h4 className="mb-2 font-display text-sm font-semibold tracking-wide text-ember">{children}</h4>;
}

/**
 * "How scores work", in plain words: the points for each kind of play, what a player is worth,
 * then a few examples. Every number is read from the scoring.
 */
export function ScoringGuide({ open, onClose, pickPoints }: { open: boolean; onClose: () => void; pickPoints: number }) {
  const { t } = useI18n();
  const S = SCORING;
  const value = t('scoring.value');
  const half = S.enemySaveCost === 0.5 ? '½' : `${S.enemySaveCost}×`;
  const pair = (...points: number[]) => points.map(f).join(' / ');

  const rows: { icon?: LucideIcon; label: string; points: string }[] = [
    { icon: CATEGORY_ICON.result, label: t('scoring.row.result'), points: pair(S.win, S.alive) },
    { icon: CATEGORY_ICON.kills, label: t('scoring.row.kill'), points: `+${value} / −${value}` },
    { icon: CATEGORY_ICON.saves, label: t('scoring.row.save'), points: `+${value} / −${half} ${value}` },
    { icon: CATEGORY_ICON.intel, label: t('scoring.row.intel'), points: pair(S.intel.seer.found, S.intel.seer.cleared) },
    { label: t('scoring.row.payoff'), points: f(S.payoff) },
    { icon: CATEGORY_ICON.votes, label: t('scoring.row.vote'), points: pair(S.voteEnemy, S.voteAlly) },
    { label: t('scoring.row.votePlain'), points: pair(S.voteEnemy + S.votePlainBonus, S.voteAlly) },
    { label: t('scoring.row.voteWolf'), points: pair(S.wolfVoteEnemy, S.wolfVoteAlly) },
    { label: t('scoring.row.escape'), points: f(S.escape) },
    { icon: Sparkles, label: t('scoring.row.special'), points: pair(S.diseased, S.toughGuy, S.prince) },
    { icon: CATEGORY_ICON.pick, label: t('scoring.row.pick'), points: f(pickPoints) },
  ];

  const examples: { label: string; points: number }[] = [
    { label: t('scoring.ex.save'), points: example({ kind: 'save', actorRole: 'bodyguard', via: 'bodyguard', targetRole: 'seer', against: 'ally' }) },
    { label: t('scoring.ex.pack'), points: example({ kind: 'kill', actorRole: 'werewolf', via: 'pack', targetRole: 'villager', against: 'enemy', shared: 2 }) },
    { label: t('scoring.ex.vote'), points: example({ kind: 'vote', phase: 'day', targetRole: 'werewolf', against: 'enemy' }) },
    { label: t('scoring.ex.mistake'), points: example({ kind: 'kill', actorRole: 'witch', via: 'witch', targetRole: 'seer', against: 'ally' }) },
  ];

  return (
    <Sheet open={open} onClose={onClose} title={t('mvp.howTo')} closeLabel={t('settings.close')}>
      <div className="space-y-5 pb-6">
        <p className="text-sm text-bone/85">{t('scoring.intro')}</p>

        <section>
          <Heading>{t('scoring.formula')}</Heading>
          <ul className="divide-y divide-panel-edge rounded-xl border border-panel-edge bg-panel-2">
            {rows.map(({ icon: Icon, label, points }) => (
              <li key={label} className="flex items-center gap-2.5 px-3 py-2">
                <span className="flex w-4 shrink-0 justify-center">{Icon && <Icon className="h-4 w-4 text-bone-faint" />}</span>
                <span className={clsx('min-w-0 flex-1 text-sm leading-snug', Icon ? 'text-bone' : 'text-bone-dim')}>{label}</span>
                <span className="shrink-0 text-right font-display text-sm font-semibold tabular-nums text-bone">{points}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-snug text-bone-faint">
            {t('scoring.more', { aura: f(S.intel.auraSeer.found), pi: f(S.intel.pi.cleared), cult: f(S.cultRecruit) })}
          </p>
        </section>

        <section>
          <Heading>{t('scoring.valueTitle')}</Heading>
          <p className="text-sm leading-snug text-bone/85">{t('scoring.valueText')}</p>
          <ul className="mt-2.5 grid grid-cols-3 gap-2">
            {VALUE_EXAMPLES.map((id) => (
              <li key={id} className="flex min-w-0 items-center gap-2 rounded-xl border border-panel-edge bg-panel-2 p-1.5">
                <RoleBadge roleId={id} size={30} />
                <span className="min-w-0">
                  <span className="block font-display text-lg font-bold leading-none text-ember">{roleValue(id)}</span>
                  <span className="block break-words text-[11px] leading-tight text-bone-dim">{t(`role.${id}.name`)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-snug text-bone-faint">{t('scoring.cursed', { werewolf: roleValue('werewolf') })}</p>
        </section>

        <section>
          <Heading>{t('scoring.examples')}</Heading>
          <ul className="space-y-2">
            {examples.map(({ label, points }) => (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 leading-snug text-bone/85">{label}</span>
                <span className={clsx('shrink-0 font-display font-semibold tabular-nums', points < 0 ? 'text-wolf-bright' : 'text-bone')}>{f(points)}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-bone-faint">{t('scoring.tie')}</p>
      </div>
    </Sheet>
  );
}
