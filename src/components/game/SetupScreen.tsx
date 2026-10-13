import clsx from 'clsx';
import { AlertTriangle, ChevronLeft, ChevronRight, Dices, Moon, Trash2, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ExperienceLevel, Player, SetupDraft } from '../../@types/game';
import { useGame } from '../../context/GameContext';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useI18n } from '../../i18n/I18nContext';
import { dealRoles, MAX_PLAYERS, MIN_PLAYERS, validateDeck } from '../../utils/gameCalculations';
import { Button, SectionTitle } from '../shared/ui';
import { DeckSelection } from './DeckSelection';
import { RoleDealPicker } from './RoleDealPicker';

type Step = 'players' | 'deck' | 'deal';
const STEPS: Step[] = ['players', 'deck', 'deal'];
const LEVELS: ExperienceLevel[] = ['beginner', 'standard', 'veteran'];

/** New-game wizard: seat players → select / build the deck → deal with swap-enabled review. */
export function SetupScreen() {
  const { t } = useI18n();
  const { state, dispatch } = useGame();
  const { startGame } = useGameEngine();
  const { names, deck, pool, experience, deckId } = state.setup;
  const [step, setStep] = useState<Step>('players');
  const [dealt, setDealt] = useState<Player[] | null>(null);

  const filledNames = names.map((n, i) => n.trim() || t('setup.playerPlaceholder', { n: i + 1 }));
  const playerCount = names.length;
  const issues = useMemo(() => validateDeck(deck, playerCount), [deck, playerCount]);
  const canLeavePlayers = playerCount >= MIN_PLAYERS;
  const stepIndex = STEPS.indexOf(step);

  const updateSetup = (patch: Partial<SetupDraft>) => dispatch({ type: 'UPDATE_SETUP', patch });

  const goTo = (next: Step) => {
    if (next === 'deal') setDealt(dealRoles(filledNames, deck));
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-3xl flex-col px-4 pb-28 pt-4">
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

      <section key={step} className="flex-1 animate-step-in">
        {step === 'players' && (
          <PlayersStep
            names={names}
            experience={experience}
            onNames={(next) => updateSetup({ names: next })}
            onExperience={(e) => updateSetup({ experience: e })}
          />
        )}
        {step === 'deck' && (
          <DeckSelection deck={deck} pool={pool} deckId={deckId} playerCount={playerCount} experience={experience} onChange={updateSetup} />
        )}
        {step === 'deal' && dealt && <RoleDealPicker players={dealt} onChange={setDealt} onReshuffle={() => setDealt(dealRoles(filledNames, deck))} />}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-panel-edge bg-ink/95 pb-safe pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4">
          {stepIndex > 0 && (
            <Button onClick={() => goTo(STEPS[stepIndex - 1])} icon={<ChevronLeft className="h-4 w-4" />}>
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
                'press min-h-[64px] rounded-xl border px-2 py-2 text-center transition-colors',
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
        <Button className="mt-3" block disabled={names.length >= MAX_PLAYERS} onClick={() => onNames([...names, ''])} icon={<UserPlus className="h-4 w-4" />}>
          {t('setup.addPlayer')}
        </Button>
      </div>
    </div>
  );
}
