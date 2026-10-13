import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Scale } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { balanceVerdict } from '../../utils/gameCalculations';
import { stepped } from '../../utils/motion';

const RANGE = 20;

/** Tug-of-war bar: wolves pull left (crimson), village pulls right (cyan). */
export function BalanceMeter({ sum, target }: { sum: number; target: number }) {
  const { t } = useI18n();
  const verdict = balanceVerdict(sum, target);
  const pos = (v: number) => `${((Math.max(-RANGE, Math.min(RANGE, v)) + RANGE) / (2 * RANGE)) * 100}%`;
  const label = sum > 0 ? `+${sum}` : `${sum}`;

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-display text-sm uppercase tracking-grimoire text-bone-dim">
          <Scale className="h-4 w-4" /> {t('balance.title')}
        </span>
        <span
          className={clsx(
            'font-display text-2xl font-bold text-shadow-crisp',
            verdict === 'village' && 'text-village',
            verdict === 'wolves' && 'text-wolf-bright',
            verdict === 'balanced' && 'text-bone',
          )}
        >
          {label}
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-gradient-to-r from-wolf/70 via-panel-edge to-village/70">
        <div className="absolute inset-y-0 w-0.5 bg-bone/50" style={{ left: pos(target) }} aria-hidden />
      </div>
      <div className="relative h-0">
        <motion.div
          className="absolute -top-[18px] h-6 w-1.5 -translate-x-1/2 rounded-full bg-bone shadow-[0_0_10px_rgba(245,245,247,.8)]"
          animate={{ left: pos(sum) }}
          transition={stepped(5, 0.3)}
        />
      </div>
      <div className="mt-3 flex justify-between text-xs text-bone-dim">
        <span className={clsx(verdict === 'wolves' && 'font-semibold text-wolf-bright')}>{t('balance.wolves')}</span>
        <span className={clsx(verdict === 'balanced' && 'font-semibold text-bone')}>
          {t('balance.balanced')} · {t('balance.target', { target: target > 0 ? `+${target}` : target })}
        </span>
        <span className={clsx(verdict === 'village' && 'font-semibold text-village')}>{t('balance.village')}</span>
      </div>
    </div>
  );
}
