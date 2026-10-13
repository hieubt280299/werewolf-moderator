import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ChevronLeft, ChevronRight, Dices, Eraser, Minus, Moon, Plus, Shuffle, Trash2, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ExperienceLevel, Player, RoleId } from '../../@types/game';
import { useGame } from '../../context/GameContext';
import { ROLES, ROLE_ORDER } from '../../data/roles';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useI18n } from '../../i18n/I18nContext';
import {
  calculateBalance,
  countRoles,
  dealRoles,
  EXPERIENCE_TARGET,
  generateBalancedDeck,
  MAX_PLAYERS,
  MIN_PLAYERS,
  sortDeck,
  validateDeck,
} from '../../utils/gameCalculations';
import { cardDeal, fadeStep } from '../../utils/motion';
import { BalanceMeter } from '../shared/BalanceMeter';
import { RoleCard } from '../shared/RoleCard';
import { TONES } from '../shared/tones';
import { Button, SectionTitle } from '../shared/ui';

type Step = 'players' | 'deck' | 'deal';
const STEPS: Step[] = ['players', 'deck', 'deal'];
const LEVELS: ExperienceLevel[] = ['beginner', 'standard', 'veteran'];

export function SetupScreen() {
  const { t } = useI18n();
  const { state, dispatch } = useGame();
  const { startGame } = useGameEngine();
  const { names, deck, pool, experience } = state.setup;
  const [step, setStep] = useState<Step>('players');
  const [dealt, setDealt] = useState<Player[] | null>(null);

  const filledNames = names.map((n, i) => n.trim() || t('setup.playerPlaceholder', { n: i + 1 }));
  const playerCount = names.length;
  const issues = useMemo(() => validateDeck(deck, playerCount), [deck, playerCount]);
  const canLeavePlayers = playerCount >= MIN_PLAYERS;
  const stepIndex = STEPS.indexOf(step);

  const updateSetup = (patch: Partial<typeof state.setup>) => dispatch({ type: 'UPDATE_SETUP', patch });

  const goTo = (next: Step) => {
    if (next === 'deal') setDealt(dealRoles(filledNames, deck));
    setStep(next);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pb-28 pt-4">
      {/* Stepper */}
      <nav className="mb-5 grid grid-cols-3 gap-2" aria-label={t('setup.title')}>
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-col gap-1.5">
            <div className={clsx('h-1 rounded-full', i <= stepIndex ? 'bg-village shadow-glow-village' : 'bg-panel-edge')} />
            <span className={clsx('font-display text-xs uppercase tracking-grimoire', i === stepIndex ? 'text-bone' : 'text-bone-faint')}>
              {i + 1}. {t(`setup.step.${s}`)}
            </span>
          </div>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.section key={step} variants={fadeStep} initial="hidden" animate="show" exit="exit" className="flex-1">
          {step === 'players' && (
            <PlayersStep
              names={names}
              experience={experience}
              onNames={(next) => updateSetup({ names: next })}
              onExperience={(e) => updateSetup({ experience: e })}
            />
          )}
          {step === 'deck' && (
            <DeckStep
              deck={deck}
              pool={pool}
              playerCount={playerCount}
              experience={experience}
              onDeck={(next) => updateSetup({ deck: sortDeck(next) })}
              onPool={(next) => updateSetup({ pool: next })}
            />
          )}
          {step === 'deal' && dealt && (
            <DealStep players={dealt} onChange={setDealt} onReshuffle={() => setDealt(dealRoles(filledNames, deck))} />
          )}
        </motion.section>
      </AnimatePresence>

      {/* Footer actions */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-panel-edge bg-ink/95 backdrop-blur pb-safe pt-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4">
          {stepIndex > 0 && (
            <Button onClick={() => setStep(STEPS[stepIndex - 1])} icon={<ChevronLeft className="h-4 w-4" />}>
              {t('setup.back')}
            </Button>
          )}
          <div className="min-w-0 flex-1 text-xs text-bone-dim">
            {step === 'players' && !canLeavePlayers && t('setup.minPlayers', { min: MIN_PLAYERS })}
            {step === 'deck' && issues[0] && (
              <span className="flex items-center gap-1 text-ember">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {t(issues[0].key as 'issue.deckSize', issues[0].params)}
              </span>
            )}
          </div>
          {step === 'players' && (
            <Button variant="village" disabled={!canLeavePlayers} onClick={() => goTo('deck')}>
              {t('setup.next')} <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {step === 'deck' && (
            <Button variant="village" disabled={issues.length > 0} onClick={() => goTo('deal')} icon={<Dices className="h-4 w-4" />}>
              {t('setup.deal')}
            </Button>
          )}
          {step === 'deal' && dealt && (
            <Button variant="wolf" onClick={() => startGame(dealt)} icon={<Moon className="h-4 w-4" />}>
              {t('setup.begin')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PlayersStep({
  names,
  experience,
  onNames,
  onExperience,
}: {
  names: string[];
  experience: ExperienceLevel;
  onNames: (names: string[]) => void;
  onExperience: (level: ExperienceLevel) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>{t('setup.experience')}</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => onExperience(level)}
              aria-pressed={experience === level}
              className={clsx(
                'min-h-[64px] rounded-xl border px-2 py-2 text-center transition-colors',
                experience === level ? 'border-village bg-village/10 shadow-inner-village' : 'border-panel-edge bg-panel-2',
              )}
            >
              <span className="block font-display text-sm font-semibold uppercase tracking-grimoire">{t(`exp.${level}`)}</span>
              <span className="block text-[11px] text-bone-dim">{t(`exp.${level}.hint`)}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle aside={<span className="text-xs text-bone-dim">{t('setup.playerCount', { count: names.length })}</span>}>
          {t('setup.step.players')}
        </SectionTitle>
        <ol className="grid gap-2 sm:grid-cols-2">
          {names.map((name, i) => (
            <li key={i} className="flex items-center gap-2 rounded-xl border border-panel-edge bg-panel-2 pl-3">
              <span className="w-6 font-display text-sm text-bone-faint">{i + 1}</span>
              <input
                value={name}
                maxLength={24}
                onChange={(e) => onNames(names.map((n, j) => (j === i ? e.target.value : n)))}
                placeholder={t('setup.playerPlaceholder', { n: i + 1 })}
                className="min-h-12 min-w-0 flex-1 bg-transparent text-base text-bone placeholder:text-bone-faint focus:outline-none"
              />
              <button
                type="button"
                aria-label={t('setup.removePlayer')}
                disabled={names.length <= MIN_PLAYERS}
                onClick={() => onNames(names.filter((_, j) => j !== i))}
                className="p-3 text-bone-faint hover:text-wolf-bright disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ol>
        <Button
          className="mt-3"
          block
          disabled={names.length >= MAX_PLAYERS}
          onClick={() => onNames([...names, ''])}
          icon={<UserPlus className="h-4 w-4" />}
        >
          {t('setup.addPlayer')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function DeckStep({
  deck,
  pool,
  playerCount,
  experience,
  onDeck,
  onPool,
}: {
  deck: RoleId[];
  pool: RoleId[];
  playerCount: number;
  experience: ExperienceLevel;
  onDeck: (deck: RoleId[]) => void;
  onPool: (pool: RoleId[]) => void;
}) {
  const { t } = useI18n();
  const counts = countRoles(deck);
  const sum = calculateBalance(deck);
  const target = EXPERIENCE_TARGET[experience];

  const adjust = (id: RoleId, delta: 1 | -1) => {
    if (delta > 0) {
      if ((counts[id] ?? 0) < ROLES[id].maxCopies) onDeck([...deck, id]);
    } else {
      const idx = deck.lastIndexOf(id);
      if (idx >= 0) onDeck(deck.filter((_, i) => i !== idx));
    }
  };

  const togglePool = (id: RoleId) =>
    onPool(pool.includes(id) ? pool.filter((r) => r !== id) : [...pool, id]);

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-20 -mx-4 bg-ink/95 px-4 pb-3 pt-1 backdrop-blur">
        <BalanceMeter sum={sum} target={target} />
        <div className="mt-3 flex items-center gap-2">
          <span
            className={clsx(
              'font-display text-sm uppercase tracking-grimoire',
              deck.length === playerCount ? 'text-bone' : 'text-ember',
            )}
          >
            {t('setup.cards', { cards: deck.length, players: playerCount })}
          </span>
          <div className="flex-1" />
          <Button size="sm" variant="plain" onClick={() => onDeck([])} icon={<Eraser className="h-4 w-4" />}>
            {t('setup.clearDeck')}
          </Button>
          <Button
            size="sm"
            variant="village"
            onClick={() => onDeck(generateBalancedDeck({ playerCount, pool, experience }))}
            icon={<Shuffle className="h-4 w-4" />}
          >
            {t('setup.autoBalance')}
          </Button>
        </div>
        <p className="mt-2 text-xs text-bone-faint">{t('setup.poolHint')}</p>
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5">
        {ROLE_ORDER.map((id) => {
          const n = counts[id] ?? 0;
          const inPool = pool.includes(id) || id === 'villager' || id === 'werewolf';
          const tone = TONES[ROLES[id].cardTone];
          return (
            <div key={id} className="flex flex-col items-center gap-2">
              <RoleCard roleId={id} size="sm" muted={n === 0} className="!w-full" onClick={() => adjust(id, 1)}>
                {n > 0 && (
                  <span
                    className="absolute left-1.5 top-1.5 flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 font-display text-sm font-bold text-bone shadow-card"
                    style={{ background: tone.accent }}
                  >
                    ×{n}
                  </span>
                )}
              </RoleCard>
              <div className="flex w-full items-center justify-between rounded-lg border border-panel-edge bg-panel-2">
                <button type="button" aria-label="−" onClick={() => adjust(id, -1)} disabled={n === 0} className="p-2 disabled:opacity-30">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-display text-sm">{n}</span>
                <button
                  type="button"
                  aria-label="+"
                  onClick={() => adjust(id, 1)}
                  disabled={n >= ROLES[id].maxCopies}
                  className="p-2 disabled:opacity-30"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {id !== 'villager' && id !== 'werewolf' && (
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] uppercase tracking-wide text-bone-dim">
                  <input
                    type="checkbox"
                    checked={inPool}
                    onChange={() => togglePool(id)}
                    className="h-4 w-4 accent-[#00A3E0]"
                  />
                  {t('setup.inPool')}
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function DealStep({
  players,
  onChange,
  onReshuffle,
}: {
  players: Player[];
  onChange: (players: Player[]) => void;
  onReshuffle: () => void;
}) {
  const { t } = useI18n();
  const setRole = (id: string, roleId: RoleId) =>
    onChange(players.map((p) => (p.id === id ? { ...p, roleId, originalRoleId: roleId } : p)));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-bone-dim">{t('setup.assignHint')}</p>
        <Button size="sm" onClick={onReshuffle} icon={<Shuffle className="h-4 w-4" />}>
          {t('setup.reshuffle')}
        </Button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2" style={{ perspective: 800 }}>
        {players.map((p, i) => (
          <motion.li
            key={p.id}
            custom={i}
            variants={cardDeal}
            initial="hidden"
            animate="show"
            className="flex min-h-[112px] items-center gap-3 rounded-2xl border border-panel-edge bg-panel-gradient p-2 pr-3 shadow-card"
          >
            <RoleCard roleId={p.roleId} size="xs" showWeight={false} />
            <div className="min-w-0 flex-1">
              <span className="font-display text-xs text-bone-faint">#{p.seat + 1}</span>
              <p className="truncate text-lg font-semibold text-bone text-shadow-crisp">{p.name}</p>
              <select
                value={p.roleId}
                onChange={(e) => setRole(p.id, e.target.value as RoleId)}
                className={clsx('mt-1 w-full rounded-lg border border-panel-edge bg-ink px-2 py-2 text-sm', TONES[ROLES[p.roleId].cardTone].text)}
              >
                {ROLE_ORDER.map((id) => (
                  <option key={id} value={id}>
                    {t(`role.${id}.name`)}
                  </option>
                ))}
              </select>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
