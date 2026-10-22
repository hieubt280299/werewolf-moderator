import clsx from 'clsx';
import { Heart } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Player, RebalanceRules } from '../../@types/game';
import { roleFaction } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { RoleCard } from '../shared/RoleCard';
import { TONES } from '../shared/tones';
import { Button } from '../shared/ui';

/**
 * Full-screen view for the Lovers on night 1: just the two of them, by name and role, on a
 * black screen with nothing else, so the moderator can turn the device toward them.
 */
export function LoversReveal({ lovers, rules, onClose }: { lovers: Player[]; rules?: RebalanceRules | null; onClose: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('night.loversTitle')}
      className="fixed inset-0 z-[70] flex animate-fade-in flex-col items-center justify-center gap-8 overflow-y-auto bg-ink px-4 py-8"
    >
      <h2 className="flex items-center gap-2 text-2xl text-bone text-shadow-title">
        <Heart className="h-6 w-6 fill-current text-vampire" /> {t('night.loversTitle')}
      </h2>
      <div className="flex items-start justify-center gap-4 sm:gap-10">
        {lovers.map((p) => (
          <div key={p.id} className="flex flex-col items-center gap-3">
            <RoleCard roleId={p.roleId} size="md" showText={false} showWeight={false} className="w-32 sm:w-44" />
            <p className="max-w-[10rem] break-words text-center font-display text-2xl text-bone text-shadow-crisp">{p.name}</p>
            <p className={clsx('text-center font-display text-lg uppercase tracking-grimoire', TONES[roleFaction(p.roleId, rules)].text)}>
              {t(`role.${p.roleId}.name`)}
            </p>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="lg" onClick={onClose} className="min-w-40">
        {t('night.loversDone')}
      </Button>
    </div>,
    document.body,
  );
}
