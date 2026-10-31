import clsx from 'clsx';
import { Scale } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { balanceVerdict } from '../../utils/gameCalculations';

const RANGE = 20;

/** Tug-of-war bar: wolves pull left (crimson), village pulls right (cyan). */
export function BalanceMeter({ sum, target }: { sum: number; target: number }) {
  const { t } = useI18n();
  const verdict = balanceVerdict(sum, target);
  const pct = (v: number) => ((Math.max(-RANGE, Math.min(RANGE, v)) + RANGE) / (2 * RANGE)) * 100;
  const label = sum > 0 ? `+${sum}` : `${sum}`;

  return (
    // overflow-hidden: the marker layer is translated up to 100% of the track width and
    // would otherwise widen the page (horizontal scroll). The padding keeps the marker visible.
    <div className="panel overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-display text-sm tracking-wide text-bone-dim">
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
      <div className="relative h-3 rounded-full bg-gradient-to-r from-wolf/70 via-panel-edge to-village/70">
        <div className="absolute inset-y-0 w-0.5 bg-bone/50" style={{ left: `${pct(target)}%` }} aria-hidden />
        {/* Full-width track moved with translate3d so the marker glides on the compositor. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 will-change-transform"
          style={{ transform: `translate3d(${pct(sum)}%,0,0)`, transition: 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <div className="absolute -top-1.5 h-6 w-1.5 -translate-x-1/2 rounded-full bg-bone shadow-[0_0_10px_rgba(245,245,247,.8)]" />
        </div>
      </div>
      <div className="mt-3 flex justify-between gap-2 text-xs text-bone-dim">
        <span className={clsx(verdict === 'wolves' && 'font-semibold text-wolf-bright')}>{t('balance.wolves')}</span>
        <span className={clsx('text-center', verdict === 'balanced' && 'font-semibold text-bone')}>
          {t('balance.balanced')} · {t('balance.target', { target: target > 0 ? `+${target}` : target })}
        </span>
        <span className={clsx('text-right', verdict === 'village' && 'font-semibold text-village')}>{t('balance.village')}</span>
      </div>
    </div>
  );
}
