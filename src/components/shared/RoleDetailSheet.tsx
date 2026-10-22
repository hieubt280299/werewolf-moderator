import { Gauge, Minus, Moon, MoonStar, Plus, Scale, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Difficulty, RoleId, WinTeam } from '../../@types/game';
import { roleDescKey, useHouseRules } from '../../context/HouseRulesContext';
import { roleFaction, roleWinTeam, ROLES } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { RoleCard } from './RoleCard';
import { TONES } from './tones';
import { Sheet, StepperButton } from './ui';

interface RoleDetailSheetProps {
  roleId: RoleId | null;
  onClose: () => void;
  /** When given, shows a deck-count stepper so the role can be added/removed from here. */
  count?: number;
  onAdjust?: (delta: 1 | -1) => void;
  /** Adding a copy would bring a fourth team into the deck. */
  addBlocked?: boolean;
}

/** Full-size card with the complete rules text, so moderators can learn what a role does. */
export function RoleDetailSheet({ roleId, onClose, count, onAdjust, addBlocked = false }: RoleDetailSheetProps) {
  const { t } = useI18n();
  const houseRules = useHouseRules();
  const role = roleId ? ROLES[roleId] : null;
  // House rules: the Hunter gains a night action, the Tanner joins the Village.
  const wakes = !!role?.nightAction || (roleId === 'hunter' && houseRules.hunter);

  return (
    <Sheet open={!!roleId} onClose={onClose} title={roleId ? t(`role.${roleId}.name`) : ''} closeLabel={t('settings.close')}>
      {role && roleId && (
        <div className="flex flex-col items-center gap-4 pb-6">
          <RoleCard roleId={roleId} size="lg" showText={false} className="animate-pop" />
          <p className="max-w-sm text-center text-base leading-relaxed text-bone text-shadow-crisp">{t(roleDescKey(roleId, houseRules))}</p>

          <div className="grid w-full max-w-sm grid-cols-2 gap-2 text-sm">
            <Fact icon={<Users className="h-4 w-4" />} label={t('card.team')}>
              <span className={TONES[roleFaction(roleId, houseRules)].text}>
                {t(`team.${teamLabel(roleWinTeam(roleId, houseRules))}`)}
                {/* Cursed starts with the Village but turns Wolf if attacked. */}
                {roleId === 'cursed' && <span className="text-wolf-bright"> → {t('team.werewolf')}</span>}
              </span>
            </Fact>
            <Fact icon={<Scale className="h-4 w-4" />} label={t('card.weight')}>
              <span className={role.weight > 0 ? 'text-village' : role.weight < 0 ? 'text-wolf-bright' : 'text-bone'}>
                {role.weight > 0 ? `+${role.weight}` : role.weight}
              </span>
            </Fact>
            <Fact icon={<Gauge className="h-4 w-4" />} label={t('card.difficulty')} wide>
              <DifficultyPips level={role.difficulty} label={t(`card.difficulty.${role.difficulty}`)} />
            </Fact>
            <Fact icon={wakes ? <MoonStar className="h-4 w-4" /> : <Moon className="h-4 w-4" />} label="" wide>
              {role.isWolf || role.nightAction === 'wolfKill'
                ? t('card.wolfPack')
                : role.firstNightOnly
                  ? t('card.firstNight')
                  : wakes
                    ? t('card.nightAction')
                    : t('card.noNight')}
            </Fact>
          </div>

          {onAdjust && count !== undefined && (
            <div className="flex w-full max-w-sm items-center justify-between rounded-xl border border-panel-edge bg-panel-2 p-1.5">
              <StepperButton label="−" onClick={() => onAdjust(-1)} disabled={count === 0}>
                <Minus className="h-5 w-5" />
              </StepperButton>
              <span className="font-display text-sm uppercase tracking-grimoire text-bone-dim">
                {t('card.inDeck')}: <span className="text-lg text-bone">{count}</span>
              </span>
              <StepperButton label="+" onClick={() => onAdjust(1)} disabled={count >= role.maxCopies || addBlocked}>
                <Plus className="h-5 w-5" />
              </StepperButton>
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

/** Solo roles show their own team name. */
const teamLabel = (team: WinTeam) => (team === 'neutral' ? 'tanner' : team);

const PIP_COLORS: Record<Difficulty, string> = { 1: 'bg-village', 2: 'bg-ember', 3: 'bg-wolf-bright' };

/** 1–3 pips: blue for beginner, ember for intermediate, crimson for advanced. */
export function DifficultyPips({ level, label }: { level: Difficulty; label?: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex gap-1" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-full ${i <= level ? PIP_COLORS[level] : 'bg-panel-edge'}`} />
        ))}
      </span>
      {label && <span>{label}</span>}
      <span className="sr-only">{level}/3</span>
    </span>
  );
}
