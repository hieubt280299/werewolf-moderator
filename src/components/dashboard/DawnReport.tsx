import { motion } from 'framer-motion';
import { Droplet, EyeOff, Flame, HeartPulse, Megaphone, PawPrint, Skull, VolumeX } from 'lucide-react';
import type { ReactNode } from 'react';
import type { NightReport } from '../../@types/game';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useI18n } from '../../i18n/I18nContext';
import { fadeStep, stagger } from '../../utils/motion';
import { Chip } from '../shared/ui';

/** Morning summary: public announcements first, moderator-only secrets below. */
export function DawnReport({ report }: { report: NightReport }) {
  const { t } = useI18n();
  const { byId } = useGameEngine();
  const name = (id: string | null) => (id ? byId.get(id)?.name ?? '?' : '');

  const secrets: { icon: ReactNode; text: string }[] = [
    ...report.saved.map((id) => ({ icon: <HeartPulse className="h-4 w-4 text-village" />, text: t('dawn.saved', { name: name(id) }) })),
    ...report.transformed.map((id) => ({ icon: <PawPrint className="h-4 w-4 text-wolf-bright" />, text: t('dawn.transformed', { name: name(id) }) })),
    ...(report.vampireMarked ? [{ icon: <Droplet className="h-4 w-4 text-vampire" />, text: t('dawn.vampire', { name: name(report.vampireMarked) }) }] : []),
    ...(report.recruited ? [{ icon: <Flame className="h-4 w-4 text-cult" />, text: t('dawn.recruited', { name: name(report.recruited) }) }] : []),
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-ember">
          <Megaphone className="h-3.5 w-3.5" /> {t('dawn.announce')}
        </p>
        <ul className="space-y-2">
          {report.deaths.length === 0 && (
            <motion.li variants={fadeStep} className="rounded-xl border border-village/30 bg-village/5 px-4 py-3 text-bone">
              {t('dawn.peaceful')}
            </motion.li>
          )}
          {report.deaths.map((d) => (
            <motion.li
              key={d.playerId}
              variants={fadeStep}
              className="flex items-center gap-3 rounded-xl border border-wolf/50 bg-wolf/10 px-4 py-3 shadow-inner-wolf"
            >
              <Skull className="h-5 w-5 shrink-0 text-wolf-bright" />
              <span className="flex-1 font-semibold text-bone text-shadow-crisp">{t('dawn.died', { name: name(d.playerId) })}</span>
              <Chip tone="werewolf">{t(`cause.${d.cause}`)}</Chip>
            </motion.li>
          ))}
          {report.silenced && (
            <motion.li variants={fadeStep} className="flex items-center gap-3 rounded-xl border border-ember/40 bg-ember/10 px-4 py-3">
              <VolumeX className="h-5 w-5 shrink-0 text-ember" />
              <span className="text-bone">{t('dawn.silenced', { name: name(report.silenced) })}</span>
            </motion.li>
          )}
        </ul>
      </div>

      {secrets.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-bone-faint">
            <EyeOff className="h-3.5 w-3.5" /> {t('dawn.secret')}
          </p>
          <ul className="space-y-1.5">
            {secrets.map((s, i) => (
              <motion.li key={i} variants={fadeStep} className="flex items-center gap-2 text-sm text-bone-dim">
                {s.icon}
                {s.text}
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
