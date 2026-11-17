import { Scale, type LucideIcon } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { roleValue, SCORING } from '../../utils/scoring';
import { Sheet } from '../shared/ui';
import { CATEGORY_ICON, formatPoints as f } from './Scoreboard';

/**
 * "How scores work": the whole formula in plain words. Every number is read from SCORING, so
 * the sheet can't drift from the maths.
 */
export function ScoringGuide({ open, onClose, pickPoints }: { open: boolean; onClose: () => void; pickPoints: number }) {
  const { t } = useI18n();
  const S = SCORING;
  const sections: { icon: LucideIcon; title: string; text: string }[] = [
    { icon: CATEGORY_ICON.result, title: t('score.cat.result'), text: t('scoring.resultText', { win: f(S.win), alive: f(S.alive) }) },
    {
      icon: Scale,
      title: t('scoring.value'),
      text: t('scoring.valueText', {
        min: S.valueMin,
        max: S.valueMax,
        cupid: roleValue('cupid'),
        villager: roleValue('villager'),
        bodyguard: roleValue('bodyguard'),
        werewolf: roleValue('werewolf'),
        seer: roleValue('seer'),
        bigBadWolf: roleValue('bigBadWolf'),
      }),
    },
    {
      icon: CATEGORY_ICON.kills,
      title: t('score.cat.kills'),
      text: t('scoring.killsText', { werewolf: roleValue('werewolf'), cult: f(S.cultRecruit) }),
    },
    {
      icon: CATEGORY_ICON.saves,
      title: t('score.cat.saves'),
      text: t('scoring.savesText', {
        werewolf: roleValue('werewolf'),
        enemySave: f(-Math.round(roleValue('werewolf') * S.enemySaveCost)),
        diseased: f(S.diseased),
        toughGuy: f(S.toughGuy),
        prince: f(S.prince),
      }),
    },
    {
      icon: CATEGORY_ICON.intel,
      title: t('score.cat.intel'),
      text: t('scoring.intelText', {
        seer: f(S.intel.seer.found),
        aura: f(S.intel.auraSeer.found),
        sorceress: f(S.intel.sorceress.found),
        cleared: f(S.intel.seer.cleared),
        piCleared: f(S.intel.pi.cleared),
        payoff: f(S.payoff),
      }),
    },
    {
      icon: CATEGORY_ICON.votes,
      title: t('score.cat.votes'),
      text: t('scoring.votesText', {
        enemy: f(S.voteEnemy),
        plain: f(S.voteEnemy + S.votePlainBonus),
        ally: f(S.voteAlly),
        wolfEnemy: f(S.wolfVoteEnemy),
        wolfAlly: f(S.wolfVoteAlly),
        escape: f(S.escape),
      }),
    },
    {
      icon: CATEGORY_ICON.pick,
      title: t('score.cat.pick'),
      text: t('scoring.pickText', { base: f(S.pickBase), perRound: S.pickPerRound, max: S.pickMax, points: f(pickPoints) }),
    },
  ];

  return (
    <Sheet open={open} onClose={onClose} title={t('mvp.howTo')} closeLabel={t('settings.close')}>
      <div className="space-y-4 pb-6">
        <p className="text-sm text-bone-dim">{t('scoring.intro')}</p>
        <dl className="space-y-3.5">
          {sections.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
              <div className="min-w-0">
                <dt className="font-display text-sm font-semibold tracking-wide text-bone">{title}</dt>
                <dd className="text-sm leading-snug text-bone/80">{text}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </Sheet>
  );
}
