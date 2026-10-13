import { Minus, Moon, MoonStar, Plus, Scale, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import type { RoleId } from '../../@types/game';
import { ROLES } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { RoleCard } from './RoleCard';
import { TONES } from './tones';
import { Sheet } from './ui';

interface RoleDetailSheetProps {
  roleId: RoleId | null;
  onClose: () => void;
  /** When given, shows a deck-count stepper so the role can be added/removed from here. */
  count?: number;
  onAdjust?: (delta: 1 | -1) => void;
}

/** Full-size card with the complete rules text, so moderators can learn what a role does. */
export function RoleDetailSheet({ roleId, onClose, count, onAdjust }: RoleDetailSheetProps) {
  const { t } = useI18n();
  const role = roleId ? ROLES[roleId] : null;

  return (
    <Sheet open={!!roleId} onClose={onClose} title={roleId ? t(`role.${roleId}.name`) : ''} closeLabel={t('settings.close')}>
      {role && roleId && (
        <div className="flex flex-col items-center gap-4 pb-6">
          <RoleCard roleId={roleId} size="lg" showText={false} className="animate-pop" />
          <p className="max-w-sm text-center text-base leading-relaxed text-bone text-shadow-crisp">{t(`role.${roleId}.desc`)}</p>

          <div className="grid w-full max-w-sm grid-cols-2 gap-2 text-sm">
            <Fact icon={<Users className="h-4 w-4" />} label={t('card.team')}>
              <span className={TONES[role.faction].text}>{t(`team.${role.winTeam === 'loneWolf' ? 'loneWolf' : role.faction}`)}</span>
            </Fact>
            <Fact icon={<Scale className="h-4 w-4" />} label={t('card.weight')}>
              <span className={role.weight > 0 ? 'text-village' : role.weight < 0 ? 'text-wolf-bright' : 'text-bone'}>
                {role.weight > 0 ? `+${role.weight}` : role.weight}
              </span>
            </Fact>
            <Fact icon={role.nightAction ? <MoonStar className="h-4 w-4" /> : <Moon className="h-4 w-4" />} label="" wide>
              {role.nightAction === 'wolfKill' ? t('card.wolfPack') : role.nightAction ? t('card.nightAction') : t('card.noNight')}
            </Fact>
          </div>

          {onAdjust && count !== undefined && (
            <div className="flex w-full max-w-sm items-center justify-between rounded-xl border border-panel-edge bg-panel-2 px-2">
              <button type="button" aria-label="−" onClick={() => onAdjust(-1)} disabled={count === 0} className="press p-3 disabled:opacity-30">
                <Minus className="h-5 w-5" />
              </button>
              <span className="font-display text-sm uppercase tracking-grimoire text-bone-dim">
                {t('card.inDeck')}: <span className="text-lg text-bone">{count}</span>
              </span>
              <button type="button" aria-label="+" onClick={() => onAdjust(1)} disabled={count >= role.maxCopies} className="press p-3 disabled:opacity-30">
                <Plus className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Fact({ icon, label, children, wide }: { icon: ReactNode; label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border border-panel-edge bg-panel-2 px-3 py-2 ${wide ? 'col-span-2' : ''}`}>
      <span className="text-bone-dim">{icon}</span>
      {label && <span className="text-bone-dim">{label}</span>}
      <span className="ml-auto font-semibold">{children}</span>
    </div>
  );
}
