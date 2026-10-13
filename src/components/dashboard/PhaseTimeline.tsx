import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Moon, Sun, Sunrise, Trophy } from 'lucide-react';
import type { Phase } from '../../@types/game';
import { useI18n } from '../../i18n/I18nContext';
import { stepped } from '../../utils/motion';

const SEGMENTS: { phase: Phase; icon: typeof Moon; active: string; glow: string }[] = [
  { phase: 'night', icon: Moon, active: 'bg-village-night text-village border-village/60', glow: 'shadow-glow-village' },
  { phase: 'dawn', icon: Sunrise, active: 'bg-ember/15 text-ember border-ember/60', glow: 'shadow-glow-ember' },
  { phase: 'day', icon: Sun, active: 'bg-gradient-to-r from-ember-deep/40 to-wolf/30 text-bone border-ember', glow: 'shadow-glow-ember' },
];

/** Night → Dawn → Day progress for the current round, with a stepped indicator. */
export function PhaseTimeline({ phase, round }: { phase: Phase; round: number }) {
  const { t } = useI18n();
  const activeIndex = SEGMENTS.findIndex((s) => s.phase === phase);

  if (phase === 'gameOver') {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-ember/50 bg-ember/10 py-2 font-display uppercase tracking-grimoire text-ember">
        <Trophy className="h-4 w-4" /> {t('phase.gameOver')}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="grid grid-cols-3 gap-1.5">
        {SEGMENTS.map((seg, i) => {
          const Icon = seg.icon;
          const isActive = i === activeIndex;
          const isDone = i < activeIndex;
          return (
            <div
              key={seg.phase}
              className={clsx(
                'relative flex min-h-11 items-center justify-center gap-1.5 overflow-hidden rounded-xl border font-display text-xs uppercase tracking-grimoire',
                isActive ? [seg.active, seg.glow] : isDone ? 'border-panel-edge bg-panel-2 text-bone-dim' : 'border-panel-edge/60 bg-ink text-bone-faint',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>
                {t(`phase.${seg.phase}`)} {seg.phase !== 'dawn' && round > 0 ? round : ''}
              </span>
              {isActive && (
                <motion.span
                  aria-hidden
                  className="absolute bottom-0 left-0 h-0.5 bg-current"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={stepped(6, 0.6)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
