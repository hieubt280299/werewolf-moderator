import clsx from 'clsx';
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  FlaskConical,
  Flame,
  Ghost,
  Hand,
  HeartCrack,
  Heart,
  Info,
  Lock,
  ShieldOff,
  Sunrise,
  Swords,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { LeprechaunMove, NightActionField, NightActionKind, NightStep, NightTargetListField, Player, RoleId } from '../../@types/game';
import { ROLES } from '../../data/roles';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useNightSequence } from '../../hooks/useNightSequence';
import { useBoardView } from '../../hooks/useSeatMapPrefs';
import { useI18n } from '../../i18n/I18nContext';
import { deathLinks, drunkRoleOptions, leprechaunShifts, type DebuffShield, type KillDebuffs } from '../../utils/gameRules';
import { BoardViewSwitch, SeatMap, type SeatAccent } from '../dashboard/SeatMap';
import { PlayerToken } from '../shared/PlayerToken';
import { RoleCard } from '../shared/RoleCard';
import { LoversReveal } from './LoversReveal';
import { Button, Chip, Sheet } from '../shared/ui';

const SINGLE_FIELD: Partial<Record<NightActionKind, NightActionField>> = {
  seerInspect: 'seerTarget',
  sorceressInspect: 'sorceressTarget',
  bodyguardProtect: 'bodyguardTarget',
  vampireBite: 'vampireTarget',
  spellcasterSilence: 'spellcasterTarget',
  cultRecruit: 'cultTarget',
  direWolfCompanion: 'direWolfTarget',
  doppelgangerCopy: 'doppelgangerTarget',
  virginiaFear: 'virginiaTarget',
  auraInspect: 'auraSeerTarget',
  piInspect: 'piTarget',
  priestBless: 'priestTarget',
  oldHagBanish: 'oldHagTarget',
  hookerSeduce: 'hookerTarget',
  hunterLink: 'hunterTarget',
  bigBadWolfStrike: 'bigBadWolfTarget',
};

/** Steps that pick several players at once. */
const LIST_FIELD: Partial<Record<NightActionKind, NightTargetListField>> = {
  wolfKill: 'wolfTargets',
  cupidLink: 'cupidTargets',
};

/** Powers the role may decline (the moderator just moves on). */
const OPTIONAL = new Set<NightActionKind>(['piInspect', 'priestBless', 'troublemakerStir', 'hookerSeduce']);

const ACCENT: Partial<Record<NightActionKind, SeatAccent>> = {
  wolfKill: 'wolf',
  bigBadWolfStrike: 'wolf',
  hookerSeduce: 'vampire',
  sorceressInspect: 'wolf',
  vampireBite: 'vampire',
  cultRecruit: 'cult',
  direWolfCompanion: 'wolf',
  cupidLink: 'vampire',
};

type Translate = ReturnType<typeof useI18n>['t'];

/** A call's name: its role's, or "The Lovers" for their meeting. */
const stepName = (t: Translate, step: NightStep) => (step.action === 'loversMeet' ? t('night.lovers') : t(`role.${step.roleId}.name`));

/** Step-by-step wake-up assistant. Low-contrast cyan UI so it doesn't light faces in a dark room. */
export function NightActionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const night = useNightSequence();
  const { steps: nightSteps, step, index, total, isLast } = night;
  const { state } = useGameEngine();

  const finish = () => {
    night.finish();
    onClose();
  };

  const footer = (
    <>
      {step && night.setupPending ? (
        <p className="mb-3 flex items-center gap-2 text-sm text-ember">
          <Lock className="h-4 w-4 shrink-0" />
          {t('night.setupRequired')}
        </p>
      ) : (
        step && (
          <p className="mb-3 flex items-center gap-2 text-sm italic text-village/80">
            <EyeOff className="h-4 w-4 shrink-0" />
            {SILENT.has(step.action) ? t('night.closeSilent') : t('night.close', { role: stepName(t, step) })}
          </p>
        )
      )}
      <div className="flex gap-3">
        <Button disabled={night.isFirst} onClick={night.back} icon={<ChevronLeft className="h-4 w-4" />}>
          {t('night.back')}
        </Button>
        {isLast ? (
          <Button variant="ember" block onClick={finish} disabled={!night.canFinish} icon={<Sunrise className="h-4 w-4" />}>
            {t('night.finish')}
          </Button>
        ) : (
          <Button variant="village" block onClick={night.next} disabled={night.setupPending}>
            {t('night.next')} <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tone="night"
      title={t('night.title', { round: state.round })}
      closeLabel={t('night.dismiss')}
      footer={footer}
    >
      {total > 0 && (
        <div className="mb-4 flex gap-1" aria-label={t('night.stepOf', { current: index + 1, total })}>
          {nightSteps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => night.goTo(i)}
              disabled={night.locked(i)}
              aria-label={stepName(t, s)}
              className={clsx(
                'h-1.5 flex-1 rounded-full transition-colors disabled:cursor-not-allowed',
                // A wider gap marks where each block of the night begins.
                i > 0 && night.opensGroup(i) && 'ml-1.5',
                i < index && 'bg-village/50',
                i === index && 'bg-village shadow-glow-village',
                i > index && (night.locked(i) ? 'bg-panel-edge/40' : 'bg-panel-edge'),
              )}
            />
          ))}
        </div>
      )}

      {step ? (
        <div key={step.id} className="animate-step-in pb-4">
          <StepView step={step} />
        </div>
      ) : (
        <p key="empty" className="py-8 text-center text-bone-dim">
          {t('dash.nightIntro')}
        </p>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

/** What a seduced role's moderator note says, by night power. */
const SEDUCED_NOTE: Partial<Record<NightActionKind, 'Pack' | 'BigBadWolf' | 'Inspect' | 'Witch' | 'Hunter'>> = {
  wolfKill: 'Pack',
  bigBadWolfStrike: 'BigBadWolf',
  seerInspect: 'Inspect',
  auraInspect: 'Inspect',
  piInspect: 'Inspect',
  sorceressInspect: 'Inspect',
  witchPotion: 'Witch',
  hunterLink: 'Hunter',
};

/** Scripts for calls that aren't a role's own night power. */
const STEP_SCRIPT: Partial<Record<NightActionKind, 'night.script.lovers' | 'night.script.bigBadWolf' | 'night.script.hunter'>> = {
  loversMeet: 'night.script.lovers',
  bigBadWolfStrike: 'night.script.bigBadWolf',
  hunterLink: 'night.script.hunter',
};

/**
 * Calls that are never spoken: the moderator silently taps the player awake, so the table
 * can't tell anything happened (the Doppelgänger shown her new role).
 */
const SILENT = new Set<NightActionKind>(['doppelgangerAwaken']);

function StepView({ step }: { step: NightStep }) {
  const { t } = useI18n();
  const engine = useGameEngine();
  const night = useNightSequence();
  const { state, byId } = engine;
  const roleName = stepName(t, step);
  const actors = step.actors.map((id) => byId.get(id)).filter((p): p is Player => !!p);
  const scriptKey = STEP_SCRIPT[step.action];
  const silent = SILENT.has(step.action);
  const script = silent ? '' : scriptKey ? t(scriptKey) : t(`role.${step.roleId}.script`);
  const seduced = step.ghost ? null : night.seducedActor(step);
  const seducedNote = SEDUCED_NOTE[step.action] ?? 'Generic';

  return (
    <div className="space-y-4">
      <p className="font-display text-[11px] uppercase tracking-grimoire text-village/70">{t(`night.group.${step.group}`)}</p>
      <div className="flex gap-4">
        <RoleCard roleId={step.roleId} size="sm" dead={step.ghost} showWeight={false} />
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="text-xl text-bone text-shadow-crisp">{roleName}</h3>
          {script && <p className="text-base leading-relaxed text-bone/85">“{script}”</p>}
          {actors.length > 0 && (
            <p className="text-xs uppercase tracking-wide text-village/80">
              {t('night.wakes')}: <span className="normal-case text-bone-dim">{actors.map((a) => a.name).join(', ')}</span>
            </p>
          )}
        </div>
      </div>

      {step.ghost && <Notice icon={<Ghost className="h-4 w-4" />}>{t('night.ghost')}</Notice>}
      {silent && !step.ghost && (
        <Notice tone="ember" icon={<Hand className="h-4 w-4" />}>
          {t('night.silentTap', { names: actors.map((a) => a.name).join(', ') })}
        </Notice>
      )}
      {step.note === 'wolvesSkip' && <Notice tone="ember">{t(step.action === 'bigBadWolfStrike' ? 'night.wolvesSkipBbw' : 'night.wolvesSkip')}</Notice>}
      {step.note === 'wolvesDouble' && !step.ghost && <Notice tone="wolf">{t('night.wolvesDouble')}</Notice>}
      {!!step.joining?.length && !step.ghost && (
        <Notice tone="wolf">{t('night.cursedJoins', { names: step.joining.map((id) => byId.get(id)?.name ?? '?').join(', ') })}</Notice>
      )}
      {step.note === 'noPotions' && !step.ghost && <Notice>{t('night.noPotions')}</Notice>}
      {step.note === 'bigBadWolf' && !step.ghost && <Notice tone="wolf">{t('night.bigBadWolf')}</Notice>}
      {step.note === 'fruitBrute' && <Notice tone="ember">{t('night.fruitBrute')}</Notice>}
      {step.note === 'used' && <Notice>{t('night.used')}</Notice>}
      {seduced && (
        <Notice tone="wolf" icon={<HeartCrack className="h-4 w-4" />}>
          {t(`night.seduced${seducedNote}`, { name: seduced.name })}
        </Notice>
      )}
      {step.action === 'hookerSeduce' && step.targetCount > 0 && <p className="text-xs text-bone-faint">{t('night.hookerOnce')}</p>}
      {step.action === 'bodyguardProtect' && step.targetCount > 0 && (
        <p className="text-xs text-bone-faint">{t(night.rules.bigBadWolf ? 'night.bodyguardRuleBbw' : 'night.bodyguardRule')}</p>
      )}
      {step.action === 'bigBadWolfStrike' && step.targetCount > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-bone-faint">
          <ShieldOff className="mt-px h-3.5 w-3.5 shrink-0 text-wolf-bright" />
          {t('night.bigBadWolfRule')}
        </p>
      )}
      {OPTIONAL.has(step.action) && step.targetCount > 0 && <p className="text-xs text-bone-faint">{t('night.optional')}</p>}

      {/* Results sit above the picker so the sticky footer never hides them. */}
      {step.action === 'seerInspect' && state.nightActions.seerTarget && <SeerResult playerId={state.nightActions.seerTarget} />}
      {step.action === 'sorceressInspect' && state.nightActions.sorceressTarget && (
        <SorceressResult playerId={state.nightActions.sorceressTarget} />
      )}
      {step.action === 'auraInspect' && state.nightActions.auraSeerTarget && <AuraResult playerId={state.nightActions.auraSeerTarget} />}
      {step.action === 'piInspect' && state.nightActions.piTarget && <PiResult playerId={state.nightActions.piTarget} />}
      {step.action === 'bigBadWolfStrike' && step.targetCount > 0 && <WolfTargetSummary />}
      {step.kind === 'direction' && step.targetCount > 0 && <LeprechaunPanel seduced={!!seduced} />}
      {/* Rebalanced Big Bad Wolf: how tonight's stacked kills resolve, before anyone else acts on them. */}
      {(step.action === 'leprechaunRedirect' || step.action === 'bigBadWolfStrike') && step.targetCount > 0 && night.rules.bigBadWolf && (
        <KillDebuffPanel />
      )}

      {step.kind === 'info' && !step.ghost && <InfoPanel step={step} />}
      {step.kind === 'toggle' && step.targetCount > 0 && <TroublemakerToggle step={step} />}
      {step.kind === 'role' && step.targetCount > 0 && <DrunkRolePicker />}
      {step.kind === 'targets' && step.targetCount > 0 && (step.action === 'witchPotion' ? <WitchPanel step={step} /> : <TargetPicker step={step} />)}
    </div>
  );
}

function TargetPicker({ step }: { step: NightStep }) {
  const { t } = useI18n();
  const engine = useGameEngine();
  const { state } = engine;
  const targets = engine.targetsFor(step);
  const field = SINGLE_FIELD[step.action];
  const listField = LIST_FIELD[step.action];
  const selected: string[] = listField
    ? state.nightActions[listField]
    : field
      ? [state.nightActions[field]].filter((x): x is string => !!x)
      : [];
  // Shown but locked, so the restriction is visible: the Bodyguard's last protégé, and
  // everyone the Hooker has already seduced.
  const lastProtected = step.action === 'bodyguardProtect' ? state.modifiers.bodyguardLastTarget : null;
  const visited = step.action === 'hookerSeduce' ? state.modifiers.hookerVisited : [];
  const locked = new Map<string, string>(visited.map((id) => [id, t('night.alreadySeduced')]));
  if (lastProtected) locked.set(lastProtected, t('night.lastProtected'));
  const candidates = [...targets, ...state.players.filter((p) => locked.has(p.id) && p.alive && !step.actors.includes(p.id))];

  const toggle = (id: string) => {
    if (listField) {
      const cur = state.nightActions[listField];
      if (cur.includes(id)) engine.setTargetList(listField, cur.filter((x) => x !== id));
      else engine.setTargetList(listField, [...cur, id].slice(-step.targetCount));
    } else if (field) {
      engine.setNightAction(field, state.nightActions[field] === id ? null : id);
    }
  };

  return (
    <PlayerPicker
      label={
        step.action === 'cupidLink'
          ? t('night.chooseLovers')
          : step.targetCount > 1
            ? t('night.chooseTargets', { count: step.targetCount })
            : t('night.chooseTarget')
      }
      candidates={candidates}
      selected={selected}
      accent={ACCENT[step.action] ?? 'village'}
      locked={locked}
      onToggle={toggle}
    />
  );
}

interface PlayerPickerProps {
  label: ReactNode;
  /** Players offered for this call (locked ones included, shown but not pickable). */
  candidates: Player[];
  selected: readonly string[];
  accent: SeatAccent;
  /** Shown but not pickable, with the reason (the Bodyguard's last protégé, the Hooker's past visits). */
  locked?: ReadonlyMap<string, string>;
  onToggle: (playerId: string) => void;
}

/**
 * Players to choose from, as a list or round the table. The view and the table's orientation
 * are the board's: switching or turning here changes both.
 */
function PlayerPicker({ label, candidates, selected, accent, locked, onToggle }: PlayerPickerProps) {
  const { t } = useI18n();
  const { state } = useGameEngine();
  const [view, setView] = useBoardView();
  const pickable = new Set(candidates.filter((p) => !locked?.has(p.id)).map((p) => p.id));
  const lockedPlayers = candidates.filter((p) => locked?.has(p.id)).sort((a, b) => a.seat - b.seat);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-bone-dim">{label}</p>
        <BoardViewSwitch view={view} onChange={setView} />
      </div>
      {candidates.length === 0 ? (
        <p className="text-sm text-bone-faint">{t('night.noTargets')}</p>
      ) : view === 'map' ? (
        <div className="space-y-2">
          {/* Every seat is drawn so the table reads as it sits; only the candidates can be picked. */}
          <SeatMap
            players={state.players}
            selectable={pickable}
            selected={selected}
            accent={accent}
            notes={locked ? Object.fromEntries(locked) : undefined}
            links={deathLinks(state)}
            onSelect={onToggle}
            showHint={false}
            className="max-w-[420px]"
          />
          {lockedPlayers.length > 0 && (
            <ul className="space-y-0.5 text-[11px] text-bone-faint">
              {lockedPlayers.map((p) => (
                <li key={p.id}>
                  {p.seat + 1}. {p.name}: {locked?.get(p.id)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {[...candidates]
            .sort((a, b) => a.seat - b.seat)
            .map((p) => (
              <PlayerToken
                key={p.id}
                player={p}
                accent={accent}
                selected={selected.includes(p.id)}
                disabled={locked?.has(p.id)}
                note={locked?.get(p.id)}
                onClick={() => onToggle(p.id)}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function WitchPanel({ step }: { step: NightStep }) {
  const { t } = useI18n();
  const engine = useGameEngine();
  const { state, byId } = engine;
  // After the Leprechaun's redirect: the Witch sees who will really be attacked.
  const victims = engine.wolfVictims().map((id) => byId.get(id)).filter((p): p is Player => !!p);
  const killTargets = engine.targetsFor(step, 'kill');
  const { witchHealUsed, witchKillUsed } = state.modifiers;
  const { witchSeesVictims, debuffsOf } = useNightSequence();
  // Victims the Big Bad Wolf struck too: her potion only lifts the pack's kill.
  const doomed = victims.filter((p) => {
    const hit = debuffsOf(p.id);
    return !!hit?.debuffs.includes('bbwKill') && !hit.dispelled.bbwKill;
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-bone-dim">
          <FlaskConical className="h-3.5 w-3.5 text-village" /> {t('night.witchVictims')} · {t('night.witchSave')}
          {witchHealUsed && <span className="text-bone-faint">({t('night.witchUsed')})</span>}
        </p>
        {!witchSeesVictims ? (
          <Notice icon={<EyeOff className="h-4 w-4" />}>{t('night.witchBlind')}</Notice>
        ) : victims.length === 0 ? (
          <p className="text-sm text-bone-faint">{t('night.witchNoVictim')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {victims.map((p) => (
              <PlayerToken
                key={p.id}
                player={p}
                disabled={witchHealUsed}
                selected={state.nightActions.witchSaveTarget === p.id}
                onClick={() => engine.setNightAction('witchSaveTarget', state.nightActions.witchSaveTarget === p.id ? null : p.id)}
              />
            ))}
          </div>
        )}
        {/* Two victims on a Wolf Cub night (or with the standard Big Bad Wolf): one heal only. */}
        {witchSeesVictims && !witchHealUsed && victims.length > 1 && <p className="mt-2 text-xs text-bone-faint">{t('night.witchOneSave')}</p>}
        {witchSeesVictims && !witchHealUsed && doomed.length > 0 && (
          <div className="mt-2">
            <Notice tone="wolf" icon={<ShieldOff className="h-4 w-4" />}>
              {t('night.witchBbw', { names: doomed.map((p) => p.name).join(', ') })}
            </Notice>
          </div>
        )}
      </div>
      {witchKillUsed ? (
        <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-bone-dim">
          <FlaskConical className="h-3.5 w-3.5 text-wolf-bright" /> {t('night.witchKill')}
          <span className="text-bone-faint">({t('night.witchUsed')})</span>
        </p>
      ) : (
        <PlayerPicker
          label={
            <>
              <FlaskConical className="h-3.5 w-3.5 text-wolf-bright" /> {t('night.witchKill')}
            </>
          }
          candidates={killTargets}
          selected={[state.nightActions.witchKillTarget].filter((x): x is string => !!x)}
          accent="wolf"
          onToggle={(id) => engine.setNightAction('witchKillTarget', state.nightActions.witchKillTarget === id ? null : id)}
        />
      )}
    </div>
  );
}

function SeerResult({ playerId }: { playerId: string }) {
  const { t } = useI18n();
  const { byId } = useGameEngine();
  const { inspection } = useNightSequence();
  const p = byId.get(playerId);
  if (!p) return null;
  // Already inverted if the Seer was seduced tonight.
  const wolf = !!inspection('seerInspect', playerId);
  return (
    <ResultBanner wolf={wolf} key={playerId}>
      <span className="text-sm text-bone-dim">{t('night.seerResult', { name: p.name })}</span>
      <span className={clsx('flex items-center gap-2 font-display text-3xl font-bold uppercase tracking-grimoire', wolf ? 'text-wolf-bright' : 'text-village')}>
        {wolf ? <ThumbsUp className="h-7 w-7" /> : <ThumbsDown className="h-7 w-7" />}
        {wolf ? t('night.resultWerewolf') : t('night.resultVillager')}
      </span>
      <span className="text-[11px] text-bone-faint">{t('night.thumbs')}</span>
    </ResultBanner>
  );
}

function SorceressResult({ playerId }: { playerId: string }) {
  const { t } = useI18n();
  const { byId } = useGameEngine();
  const { inspection } = useNightSequence();
  const p = byId.get(playerId);
  if (!p) return null;
  const hit = !!inspection('sorceressInspect', playerId);
  return (
    <ResultBanner wolf={hit} key={playerId}>
      <span className={clsx('font-display text-2xl font-bold uppercase tracking-grimoire', hit ? 'text-wolf-bright' : 'text-bone')}>
        {hit ? t('night.sorceressYes', { name: p.name }) : t('night.sorceressNo', { name: p.name })}
      </span>
    </ResultBanner>
  );
}

function ResultBanner({ wolf, children }: { wolf: boolean; children: ReactNode }) {
  return (
    <div
      className={clsx(
        'flex animate-pop flex-col items-center gap-1 rounded-2xl border p-4 text-center',
        wolf ? 'border-wolf/60 bg-wolf/10 shadow-inner-wolf' : 'border-village/50 bg-village/10 shadow-inner-village',
      )}
    >
      {children}
    </div>
  );
}

function Notice({ children, icon, tone = 'village' }: { children: ReactNode; icon?: ReactNode; tone?: 'village' | 'wolf' | 'ember' }) {
  return (
    <div
      className={clsx(
        'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm',
        tone === 'village' && 'border-village/30 bg-village/5 text-bone/85',
        tone === 'wolf' && 'border-wolf/50 bg-wolf/10 text-bone',
        tone === 'ember' && 'border-ember/50 bg-ember/10 text-bone',
      )}
    >
      <span className="mt-0.5 shrink-0">{icon ?? <Info className="h-4 w-4" />}</span>
      <span>{children}</span>
    </div>
  );
}

function InfoPanel({ step }: { step: NightStep }) {
  const { t } = useI18n();
  const { alive, byId } = useGameEngine();
  if (step.action === 'loversMeet') return <LoversPanel />;
  if (step.action === 'doppelgangerAwaken') {
    // Woken to learn the role they changed into: show it to them.
    const woken = step.actors.map((id) => byId.get(id)).filter((p): p is Player => !!p);
    return (
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-bone-dim">{t('night.doppelgangerShow')}</p>
        {woken.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <RoleCard roleId={p.roleId} size="sm" showWeight={false} />
            <div className="min-w-0 flex-1">
              <PlayerToken player={p} accent={ROLES[p.roleId].isWolf ? 'wolf' : 'village'} selected />
            </div>
          </div>
        ))}
      </div>
    );
  }
  // Masons meet each other; the Minion is shown the wolves.
  const minion = step.action === 'minionMeet';
  const shown = minion ? alive.filter((p) => ROLES[p.roleId].isWolf) : alive.filter((p) => step.actors.includes(p.id));
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wide text-bone-dim">{minion ? t('night.minionSees') : t('night.masons')}</p>
      <div className="grid grid-cols-2 gap-2">
        {shown.map((p) => (
          <PlayerToken key={p.id} player={p} accent={minion ? 'wolf' : 'village'} selected />
        ))}
      </div>
    </div>
  );
}

/** The Lovers' call: opens a full-screen view of just the two of them, to show the Lovers. */
function LoversPanel() {
  const { t } = useI18n();
  const { state, byId } = useGameEngine();
  const [showing, setShowing] = useState(false);
  const lovers = state.nightActions.cupidTargets.map((id) => byId.get(id)).filter((p): p is Player => !!p);
  if (lovers.length !== 2) return <Notice>{t('night.loversNone')}</Notice>;
  return (
    <div className="space-y-2">
      <Button variant="village" size="lg" block onClick={() => setShowing(true)} icon={<Heart className="h-5 w-5" />}>
        {t('night.loversShow')}
      </Button>
      <p className="text-xs text-bone-faint">{t('night.loversHint')}</p>
      {showing && <LoversReveal lovers={lovers} rules={state.rules} onClose={() => setShowing(false)} />}
    </div>
  );
}

/** The pack's targets (two on a Wolf Cub night), for the Big Bad Wolf to strike next to. */
function WolfTargetSummary() {
  const { t } = useI18n();
  const { state, byId } = useGameEngine();
  const targets = [...new Set(state.nightActions.wolfTargets)].map((id) => byId.get(id)).filter((p): p is Player => !!p);
  if (targets.length === 0) return <Notice>{t('night.leprechaunNoTarget')}</Notice>;
  return (
    <div className="space-y-2">
      <div className={clsx('grid gap-2', targets.length > 1 && 'grid-cols-2')}>
        {targets.map((p) => (
          <PlayerToken key={p.id} player={p} accent="wolf" selected />
        ))}
      </div>
      <p className="text-xs text-bone-faint">{t(targets.length > 1 ? 'night.bigBadWolfNextTwo' : 'night.bigBadWolfNext')}</p>
    </div>
  );
}

const MOVES: { move: LeprechaunMove | null; label: 'night.moveLeft' | 'night.noMove' | 'night.moveRight'; hint?: 'night.clockwise' | 'night.counterClockwise' }[] = [
  { move: 'left', label: 'night.moveLeft', hint: 'night.clockwise' },
  { move: null, label: 'night.noMove' },
  { move: 'right', label: 'night.moveRight', hint: 'night.counterClockwise' },
];

/**
 * The Leprechaun never sees the Werewolves' target: they point left, right, or not at all, and
 * every pack target shifts one seat that way. The moderator sees where the attack lands.
 */
function LeprechaunPanel({ seduced }: { seduced: boolean }) {
  const { t } = useI18n();
  const engine = useGameEngine();
  const { state, byId } = engine;
  const chosen = state.nightActions.leprechaunMove;
  // A seduced Leprechaun's move does nothing: every target stays.
  const landing = new Map(seduced ? [] : leprechaunShifts(state).map((m) => [m.from, m.to]));
  const targets = [...new Set(state.nightActions.wolfTargets)].map((id) => byId.get(id)).filter((p): p is Player => !!p);

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wide text-bone-dim">{t('night.leprechaunPick')}</p>
      <div className="grid grid-cols-3 gap-2">
        {MOVES.map(({ move, label, hint }) => {
          const on = chosen === move;
          const Icon = move === 'left' ? ArrowLeft : move === 'right' ? ArrowRight : Ban;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              onClick={() => engine.setNightAction('leprechaunMove', move)}
              className={clsx(
                'press flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 text-center',
                on ? 'border-village bg-village/15 text-bone shadow-inner-village' : 'border-panel-edge bg-panel-2 text-bone-dim',
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="font-display text-sm uppercase tracking-grimoire">{t(label)}</span>
              {hint && <span className="text-[10px] leading-tight text-bone-faint">{t(hint)}</span>}
            </button>
          );
        })}
      </div>
      <div className="space-y-1.5 rounded-xl border border-panel-edge bg-panel-2/60 p-3">
        <p className="text-[11px] uppercase tracking-wide text-bone-faint">{t('night.leprechaunResult')}</p>
        {targets.length === 0 ? (
          <p className="text-sm text-bone-faint">{t('night.leprechaunNoAttack')}</p>
        ) : (
          targets.map((p) => {
            const to = byId.get(landing.get(p.id) ?? '');
            return (
              <p key={p.id} className="flex flex-wrap items-center gap-x-2 text-sm text-bone">
                <span className={clsx(to && 'text-bone-dim line-through')}>
                  {p.seat + 1}. {p.name}
                </span>
                {to ? (
                  <>
                    <ArrowRight className="h-3.5 w-3.5 text-bone-faint" />
                    <span className="font-semibold text-wolf-bright">
                      {to.seat + 1}. {to.name}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-bone-faint">· {t('night.leprechaunStays')}</span>
                )}
              </p>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Who lifted a debuff, named by their role. */
const SHIELD_ROLE: Record<DebuffShield, RoleId> = { hooker: 'hooker', priest: 'priest', bodyguard: 'bodyguard', witch: 'witch' };

type Outcome = 'dies' | 'saved' | 'cancelled' | 'turns' | 'wounded';

/** What dawn brings this victim, as the night stands. */
function outcomeOf(hit: KillDebuffs, p: Player): Outcome {
  if (!hit.lands) return Object.values(hit.dispelled).every((x) => x === 'hooker') ? 'cancelled' : 'saved';
  if (p.roleId === 'cursed') return 'turns';
  if (p.roleId === 'toughGuy' && p.status.woundedRound === null) return 'wounded';
  return 'dies';
}

const OUTCOME_TONE: Record<Outcome, string> = {
  dies: 'text-wolf-bright',
  saved: 'text-village',
  cancelled: 'text-bone-dim',
  turns: 'text-ember',
  wounded: 'text-ember',
};

/**
 * Moderator-only resolution of tonight's wolf attacks: each victim's kill debuffs
 * (`[Wolfpack, Big Bad Wolf]`), what lifted each one so far, and what that means at dawn.
 */
function KillDebuffPanel() {
  const { t } = useI18n();
  const { byId } = useGameEngine();
  const { debuffs } = useNightSequence();
  if (debuffs.length === 0) return null;
  return (
    <div className="space-y-2.5 rounded-xl border border-wolf/30 bg-wolf/5 p-3">
      <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-bone-dim">
        <Swords className="h-3.5 w-3.5 text-wolf-bright" /> {t('debuff.title')}
      </p>
      <ul className="space-y-2.5">
        {debuffs.map((hit) => {
          const p = byId.get(hit.targetId);
          if (!p) return null;
          const outcome = outcomeOf(hit, p);
          return (
            <li key={hit.targetId} className="space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-sm text-bone">
                  {p.seat + 1}. {p.name}
                </span>
                <span className={clsx('text-xs font-semibold uppercase tracking-wide', OUTCOME_TONE[outcome])}>{t(`debuff.outcome.${outcome}`)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {hit.debuffs.map((d) => {
                  const by = hit.dispelled[d];
                  return (
                    <Chip key={d} tone={by ? 'muted' : 'werewolf'} icon={d === 'bbwKill' ? <ShieldOff className="h-3 w-3" /> : undefined}>
                      <span className={clsx(by && 'line-through')}>{t(`debuff.${d}`)}</span>
                      {by && <span className="normal-case">· {t(`role.${SHIELD_ROLE[by]}.name`)}</span>}
                    </Chip>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-bone-faint">{t('debuff.hint')}</p>
    </div>
  );
}

function TroublemakerToggle({ step }: { step: NightStep }) {
  const { t } = useI18n();
  const engine = useGameEngine();
  const on = !!engine.state.nightActions.troublemakerActor;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => engine.setNightAction('troublemakerActor', on ? null : (step.actors[0] ?? null))}
      className={clsx(
        'press flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border font-display uppercase tracking-grimoire',
        on ? 'border-ember bg-ember/15 text-bone shadow-inner-ember' : 'border-panel-edge bg-panel-2 text-bone-dim',
      )}
    >
      <Flame className="h-5 w-5" />
      {on ? t('night.stirOn') : t('night.stir')}
    </button>
  );
}

function DrunkRolePicker() {
  const { t } = useI18n();
  const engine = useGameEngine();
  const { drunkRole: chosen } = engine.state.nightActions;
  const options = drunkRoleOptions(engine.state.rules);
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wide text-bone-dim">{t('night.drunkPick')}</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {options.map((id: RoleId) => (
          <RoleCard
            key={id}
            roleId={id}
            size="xs"
            showWeight={false}
            className="!w-full"
            selected={chosen === id}
            onClick={() => engine.setNightAction('drunkRole', chosen === id ? null : id)}
          />
        ))}
      </div>
    </div>
  );
}

function AuraResult({ playerId }: { playerId: string }) {
  const { t } = useI18n();
  const { byId } = useGameEngine();
  const { inspection } = useNightSequence();
  const p = byId.get(playerId);
  if (!p) return null;
  const special = !!inspection('auraInspect', playerId);
  return (
    <ResultBanner wolf={special} key={playerId}>
      <span className={clsx('font-display text-xl font-bold uppercase tracking-grimoire', special ? 'text-wolf-bright' : 'text-village')}>
        {special ? t('night.auraSpecial', { name: p.name }) : t('night.auraOrdinary', { name: p.name })}
      </span>
    </ResultBanner>
  );
}

function PiResult({ playerId }: { playerId: string }) {
  const { t } = useI18n();
  const { byId } = useGameEngine();
  const { inspection } = useNightSequence();
  const p = byId.get(playerId);
  if (!p) return null;
  const found = !!inspection('piInspect', playerId);
  return (
    <ResultBanner wolf={found} key={playerId}>
      <span className={clsx('font-display text-xl font-bold uppercase tracking-grimoire', found ? 'text-wolf-bright' : 'text-village')}>
        {found ? t('night.piYes', { name: p.name }) : t('night.piNo', { name: p.name })}
      </span>
    </ResultBanner>
  );
}
