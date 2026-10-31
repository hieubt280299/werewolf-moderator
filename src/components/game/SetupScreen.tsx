import {
  closestCenter,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import clsx from 'clsx';
import { AlertTriangle, ChevronLeft, ChevronRight, Dices, GripVertical, ListPlus, Moon, Trash2, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { NO_REBALANCES, type ExperienceLevel, type RoleId, type SetupDraft } from '../../@types/game';
import { useAuth } from '../../context/AuthContext';
import { useHouseRules } from '../../context/HouseRulesContext';
import { useGame } from '../../context/GameContext';
import { useSettings } from '../../context/SettingsContext';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useI18n } from '../../i18n/I18nContext';
import {
  createPlayers,
  dealComplete,
  duplicateNames,
  emptyDeal,
  insertSeat,
  MAX_PLAYERS,
  MIN_PLAYERS,
  nameKey,
  swapSeats,
  validateDeck,
  type DealState,
} from '../../utils/gameCalculations';
import { Button, SectionTitle } from '../shared/ui';
import { DeckSelection } from './DeckSelection';
import { PoolSelection } from './PoolSelection';
import { RoleDealPicker } from './RoleDealPicker';

type Step = 'players' | 'pool' | 'deck' | 'deal';
const STEPS: Step[] = ['players', 'pool', 'deck', 'deal'];
const LEVELS: ExperienceLevel[] = ['beginner', 'standard', 'veteran'];

/** New-game wizard: seat players → select / build the deck → deal with swap-enabled review. */
export function SetupScreen() {
  const { t } = useI18n();
  const { state, dispatch } = useGame();
  const { startGame } = useGameEngine();
  const { profile } = useAuth();
  const houseRules = useHouseRules();
  const { fullPoolCalls } = useSettings();
  const { names, deck, pool, experience, poolId, previousDeck } = state.setup;
  // Kept in the saved setup draft (not local state), so navigating away never resets the wizard.
  const step: Step = state.setup.step ?? 'players';
  const deal: DealState | null = state.setup.deal ?? null;

  const filledNames = names.map((n, i) => n.trim() || t('setup.playerPlaceholder', { n: i + 1 }));
  const playerCount = names.length;
  const issues = useMemo(() => validateDeck(deck, playerCount, houseRules), [deck, playerCount, houseRules]);
  const canLeavePlayers = playerCount >= MIN_PLAYERS;
  const stepIndex = STEPS.indexOf(step);

  const updateSetup = (patch: Partial<SetupDraft>) => dispatch({ type: 'UPDATE_SETUP', patch });

  const goTo = (next: Step) => {
    // The deal board starts with every card in the tray.
    updateSetup(next === 'deal' ? { step: next, deal: emptyDeal(names.length, deck) } : { step: next });
    window.scrollTo({ top: 0 });
  };

  /** Two players with the same name are likely one typed twice: ask before moving on. */
  const leavePlayers = () => {
    const twins = duplicateNames(filledNames);
    if (twins.length > 0 && !window.confirm(t('setup.duplicateNames', { names: twins.join(', ') }))) return;
    goTo('pool');
  };

  return (
    <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-3xl flex-col px-4 pb-28 pt-4">
      <nav className="mb-5 grid grid-cols-4 gap-2" aria-label={t('setup.title')}>
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-col gap-1.5">
            <div className={clsx('h-1 rounded-full', i <= stepIndex ? 'bg-village shadow-glow-village' : 'bg-panel-edge')} />
            <span className={clsx('font-display text-xs tracking-wide', i === stepIndex ? 'text-bone' : 'text-bone-faint')}>
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
        {step === 'pool' && <PoolSelection pool={pool} poolId={poolId} onChange={updateSetup} />}
        {step === 'deck' && (
          <DeckSelection deck={deck} pool={pool} previousDeck={previousDeck} playerCount={playerCount} experience={experience} onChange={updateSetup} />
        )}
        {step === 'deal' && deal && <RoleDealPicker names={filledNames} deck={deck} deal={deal} onChange={(next) => updateSetup({ deal: next })} />}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-panel-edge bg-ink/95 pb-safe pt-3">
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
            <Button variant="village" disabled={!canLeavePlayers} onClick={leavePlayers}>
              {t('setup.next')} <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {step === 'pool' && (
            <Button variant="village" onClick={() => goTo('deck')}>
              {t('setup.next')} <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {step === 'deck' && (
            <Button variant="village" disabled={issues.length > 0} onClick={() => goTo('deal')} icon={<Dices className="h-4 w-4" />}>
              {t('setup.deal')}
            </Button>
          )}
          {step === 'deal' && deal && (
            <Button
              variant="wolf"
              disabled={!dealComplete(deal)}
              // The moderator's house rules and full pool calls are frozen into the game at this moment.
              onClick={() => startGame(createPlayers(filledNames, deal.slots as RoleId[]), { ...NO_REBALANCES, ...profile?.rebalances }, fullPoolCalls)}
              icon={<Moon className="h-4 w-4" />}
            >
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
  // Swap two seats: drag one seat's handle onto another, or tap two handles in turn.
  const [picked, setPicked] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const sensors = useSensors(
    // Mouse: drag after a small move so plain clicks still pick.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch: press-and-hold, so swiping still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
  );
  const twins = useMemo(() => new Set(duplicateNames(names).map(nameKey)), [names]);

  const swap = (a: number, b: number) => {
    onNames(swapSeats(names, a, b));
    setPicked(null);
  };
  const tapHandle = (index: number) => {
    if (picked === null) setPicked(index);
    else if (picked === index) setPicked(null);
    else swap(picked, index);
  };
  const onDragStart = (e: DragStartEvent) => {
    setPicked(null);
    setDragging((e.active.data.current as SeatData).index);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const to = e.over?.data.current as SeatData | undefined;
    if (to) swap((e.active.data.current as SeatData).index, to.index);
  };
  // Seats move under the rows, so a pick is dropped whenever seats are added or removed.
  const edit = (next: string[]) => {
    setPicked(null);
    onNames(next);
  };

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
                'press min-h-[64px] rounded-xl border px-2 py-2 text-center',
                experience === level ? 'border-village bg-village/10 shadow-inner-village' : 'border-panel-edge bg-panel-2',
              )}
            >
              <span className="block font-display text-sm font-semibold tracking-wide">{t(`exp.${level}`)}</span>
              <span className="block text-[11px] text-bone-dim">{t(`exp.${level}.hint`)}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle aside={<span className="text-xs text-bone-dim">{t('setup.playerCount', { count: names.length })}</span>}>
          {t('setup.step.players')}
        </SectionTitle>
        <p className="mb-3 text-xs text-bone-faint">{picked === null ? t('setup.seatHint') : t('setup.seatPicked', { n: picked + 1 })}</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <ol className="grid gap-2 sm:grid-cols-2">
            {names.map((name, i) => (
              <SeatRow
                key={i}
                index={i}
                name={name}
                picked={picked === i}
                armed={picked !== null}
                duplicate={twins.has(nameKey(name))}
                canInsert={names.length < MAX_PLAYERS}
                canRemove={names.length > MIN_PLAYERS}
                onHandle={() => tapHandle(i)}
                onName={(value) => onNames(names.map((n, j) => (j === i ? value : n)))}
                onInsert={() => edit(insertSeat(names, i))}
                onRemove={() => edit(names.filter((_, j) => j !== i))}
              />
            ))}
          </ol>
          <DragOverlay dropAnimation={{ duration: 160 }}>
            {dragging !== null && (
              <div className="flex min-h-12 items-center gap-2 rounded-xl border border-village bg-panel-2 px-3 shadow-glow-village">
                <GripVertical className="h-4 w-4 text-village" />
                <span className="font-display text-sm text-bone-faint">{dragging + 1}</span>
                <span className="truncate text-base text-bone">{names[dragging]?.trim() || t('setup.playerPlaceholder', { n: dragging + 1 })}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
        <Button className="mt-3" block disabled={names.length >= MAX_PLAYERS} onClick={() => edit([...names, ''])} icon={<UserPlus className="h-4 w-4" />}>
          {t('setup.addPlayer')}
        </Button>
      </div>
    </div>
  );
}

type SeatData = { index: number };

interface SeatRowProps {
  index: number;
  name: string;
  /** Tapped first, waiting for the seat to swap with. */
  picked: boolean;
  /** Some seat is picked: every other seat is a swap target. */
  armed: boolean;
  /** Another player has the same name. */
  duplicate: boolean;
  canInsert: boolean;
  canRemove: boolean;
  onHandle: () => void;
  onName: (name: string) => void;
  onInsert: () => void;
  onRemove: () => void;
}

/**
 * One seat: the handle (seat number) drags onto another seat to swap the two players, or is
 * tapped to pick the seat; the row itself is the drop target. Only the handle drags, so typing
 * a name never starts a drag.
 */
function SeatRow({ index, name, picked, armed, duplicate, canInsert, canRemove, onHandle, onName, onInsert, onRemove }: SeatRowProps) {
  const { t } = useI18n();
  const drop = useDroppable({ id: `seat:${index}`, data: { index } satisfies SeatData });
  const drag = useDraggable({ id: `seat:${index}`, data: { index } satisfies SeatData });
  return (
    <li
      ref={drop.setNodeRef}
      className={clsx(
        'flex min-w-0 items-center rounded-xl border bg-panel-2 transition-colors',
        drop.isOver && !drag.isDragging
          ? 'border-village bg-village/10 shadow-inner-village'
          : picked
            ? 'border-bone'
            : duplicate
              ? 'border-ember/60'
              : armed
                ? 'border-village/40'
                : 'border-panel-edge',
        drag.isDragging && 'opacity-40',
      )}
    >
      <button
        ref={drag.setNodeRef}
        type="button"
        {...drag.listeners}
        {...drag.attributes}
        aria-label={t('setup.moveSeat', { n: index + 1 })}
        aria-pressed={picked}
        onClick={onHandle}
        className={clsx(
          'flex min-h-12 shrink-0 cursor-grab touch-manipulation items-center gap-0.5 pl-2 pr-1 active:cursor-grabbing',
          picked || armed ? 'text-village' : 'text-bone-faint',
        )}
      >
        <GripVertical className="h-4 w-4" />
        <span className="w-6 text-left font-display text-sm">{index + 1}</span>
      </button>
      <input
        value={name}
        maxLength={24}
        onChange={(e) => onName(e.target.value)}
        placeholder={t('setup.playerPlaceholder', { n: index + 1 })}
        aria-invalid={duplicate || undefined}
        className="min-h-12 min-w-0 flex-1 bg-transparent text-base text-bone placeholder:text-bone-faint focus:outline-none"
      />
      <button
        type="button"
        aria-label={t('setup.insertSeat', { n: index + 2 })}
        title={t('setup.insertSeat', { n: index + 2 })}
        disabled={!canInsert}
        onClick={onInsert}
        className="p-3 text-bone-faint hover:text-village disabled:opacity-30"
      >
        <ListPlus className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={t('setup.removePlayer')}
        disabled={!canRemove}
        onClick={onRemove}
        className="p-3 pl-1 text-bone-faint hover:text-wolf-bright disabled:opacity-30"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
