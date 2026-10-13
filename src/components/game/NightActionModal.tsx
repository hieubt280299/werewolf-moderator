import clsx from 'clsx';
import { ChevronLeft, ChevronRight, EyeOff, FlaskConical, Ghost, Info, Sunrise, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { ReactNode } from 'react';
import type { NightActionField, NightActionKind, NightStep, Player } from '../../@types/game';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useI18n } from '../../i18n/I18nContext';
import { PlayerToken } from '../shared/PlayerToken';
import { RoleCard } from '../shared/RoleCard';
import { Button, Sheet } from '../shared/ui';

const SINGLE_FIELD: Partial<Record<NightActionKind, NightActionField>> = {
  seerInspect: 'seerTarget',
  sorceressInspect: 'sorceressTarget',
  bodyguardProtect: 'bodyguardTarget',
  vampireBite: 'vampireTarget',
  spellcasterSilence: 'spellcasterTarget',
  cultRecruit: 'cultTarget',
};

const ACCENT: Partial<Record<NightActionKind, 'village' | 'wolf' | 'vampire' | 'cult'>> = {
  wolfKill: 'wolf',
  sorceressInspect: 'wolf',
  vampireBite: 'vampire',
  cultRecruit: 'cult',
};

/** Step-by-step wake-up assistant. Low-contrast cyan UI so it doesn't light faces in a dark room. */
export function NightActionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const engine = useGameEngine();
  const { state, nightSteps } = engine;
  const total = nightSteps.length;
  const index = Math.min(state.nightStepIndex, Math.max(0, total - 1));
  const step = nightSteps[index];
  const isLast = index >= total - 1;

  const finish = () => {
    engine.resolveNight();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} tone="night" title={t('night.title', { round: state.round })} closeLabel={t('night.dismiss')}>
      {total > 0 && (
        <div className="mb-4 flex gap-1" aria-label={t('night.stepOf', { current: index + 1, total })}>
          {nightSteps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => engine.goToNightStep(i)}
              aria-label={t(`role.${s.roleId}.name`)}
              className={clsx(
                'h-1.5 flex-1 rounded-full transition-colors',
                i < index && 'bg-village/50',
                i === index && 'bg-village shadow-glow-village',
                i > index && 'bg-panel-edge',
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

      <div className="sticky bottom-0 -mx-5 mt-2 border-t border-village/15 bg-panel/95 px-5 pt-3 backdrop-blur pb-safe">
        {step && (
          <p className="mb-3 flex items-center gap-2 text-sm italic text-village/80">
            <EyeOff className="h-4 w-4 shrink-0" />
            {t('night.close', { role: t(`role.${step.roleId}.name`) })}
          </p>
        )}
        <div className="flex gap-3">
          <Button disabled={index === 0} onClick={() => engine.goToNightStep(index - 1)} icon={<ChevronLeft className="h-4 w-4" />}>
            {t('night.back')}
          </Button>
          {isLast ? (
            <Button variant="ember" block onClick={finish} icon={<Sunrise className="h-4 w-4" />}>
              {t('night.finish')}
            </Button>
          ) : (
            <Button variant="village" block onClick={() => engine.goToNightStep(index + 1)}>
              {t('night.next')} <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

function StepView({ step }: { step: NightStep }) {
  const { t } = useI18n();
  const engine = useGameEngine();
  const { state, byId } = engine;
  const roleName = t(`role.${step.roleId}.name`);
  const actors = step.actors.map((id) => byId.get(id)).filter((p): p is Player => !!p);
  const script = t(`role.${step.roleId}.script`);

  return (
    <div className="space-y-4">
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
      {step.note === 'wolvesSkip' && <Notice tone="ember">{t('night.wolvesSkip')}</Notice>}
      {step.note === 'wolvesDouble' && !step.ghost && <Notice tone="wolf">{t('night.wolvesDouble')}</Notice>}
      {step.note === 'noPotions' && !step.ghost && <Notice>{t('night.noPotions')}</Notice>}

      {/* Results sit above the picker so the sticky footer never hides them. */}
      {step.action === 'seerInspect' && state.nightActions.seerTarget && <SeerResult playerId={state.nightActions.seerTarget} />}
      {step.action === 'sorceressInspect' && state.nightActions.sorceressTarget && (
        <SorceressResult playerId={state.nightActions.sorceressTarget} />
      )}

      {step.targetCount > 0 && (step.action === 'witchPotion' ? <WitchPanel step={step} /> : <TargetPicker step={step} />)}
    </div>
  );
}

function TargetPicker({ step }: { step: NightStep }) {
  const { t } = useI18n();
  const engine = useGameEngine();
  const { state } = engine;
  const targets = engine.targetsFor(step);
  const field = SINGLE_FIELD[step.action];
  const selected = step.action === 'wolfKill' ? state.nightActions.wolfTargets : field ? [state.nightActions[field]].filter(Boolean) : [];
  const lastProtected = step.action === 'bodyguardProtect' ? state.modifiers.bodyguardLastTarget : null;
  const candidates = lastProtected
    ? [...targets, ...state.players.filter((p) => p.id === lastProtected && p.alive)]
    : targets;

  const toggle = (id: string) => {
    if (step.action === 'wolfKill') {
      const cur = state.nightActions.wolfTargets;
      if (cur.includes(id)) engine.setWolfTargets(cur.filter((x) => x !== id));
      else engine.setWolfTargets([...cur, id].slice(-step.targetCount));
    } else if (field) {
      engine.setNightAction(field, state.nightActions[field] === id ? null : id);
    }
  };

  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wide text-bone-dim">
        {step.targetCount > 1 ? t('night.chooseTargets', { count: step.targetCount }) : t('night.chooseTarget')}
      </p>
      {candidates.length === 0 ? (
        <p className="text-sm text-bone-faint">{t('night.noTargets')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {candidates
            .sort((a, b) => a.seat - b.seat)
            .map((p) => (
              <PlayerToken
                key={p.id}
                player={p}
                accent={ACCENT[step.action] ?? 'village'}
                selected={selected.includes(p.id)}
                disabled={p.id === lastProtected}
                note={p.id === lastProtected ? t('night.lastProtected') : undefined}
                onClick={() => toggle(p.id)}
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
  const victims = state.nightActions.wolfTargets.map((id) => byId.get(id)).filter((p): p is Player => !!p);
  const killTargets = engine.targetsFor(step, 'kill');
  const { witchHealUsed, witchKillUsed } = state.modifiers;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-bone-dim">
          <FlaskConical className="h-3.5 w-3.5 text-village" /> {t('night.witchVictims')} · {t('night.witchSave')}
          {witchHealUsed && <span className="text-bone-faint">({t('night.witchUsed')})</span>}
        </p>
        {victims.length === 0 ? (
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
      </div>
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-bone-dim">
          <FlaskConical className="h-3.5 w-3.5 text-wolf-bright" /> {t('night.witchKill')}
          {witchKillUsed && <span className="text-bone-faint">({t('night.witchUsed')})</span>}
        </p>
        {!witchKillUsed && (
          <div className="grid grid-cols-2 gap-2">
            {killTargets
              .sort((a, b) => a.seat - b.seat)
              .map((p) => (
                <PlayerToken
                  key={p.id}
                  player={p}
                  accent="wolf"
                  selected={state.nightActions.witchKillTarget === p.id}
                  onClick={() => engine.setNightAction('witchKillTarget', state.nightActions.witchKillTarget === p.id ? null : p.id)}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SeerResult({ playerId }: { playerId: string }) {
  const { t } = useI18n();
  const { byId, seerResult } = useGameEngine();
  const p = byId.get(playerId);
  if (!p) return null;
  const wolf = seerResult(p) === 'werewolf';
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
  const { byId, sorceressResult } = useGameEngine();
  const p = byId.get(playerId);
  if (!p) return null;
  const hit = sorceressResult(p);
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
