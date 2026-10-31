import clsx from 'clsx';
import { Check, CheckCheck, Lock, Minus, Plus, X } from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';
import type { RoleId } from '../../@types/game';
import { useHouseRules } from '../../context/HouseRulesContext';
import { ALWAYS_IN_POOL, ROLES, ROLE_SECTIONS, type RoleSectionId } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { addsTeam, countRoles, sortDeck } from '../../utils/gameCalculations';
import { RoleCard } from './RoleCard';
import { RoleDetailSheet } from './RoleDetailSheet';
import { toneAccentFill, TONES } from './tones';
import { StepperButton } from './ui';

type RoleGridProps =
  | {
      /** Role Pool step / pool editor: tick the roles to include. */
      mode: 'select';
      selected: RoleId[];
      onSelected: (roles: RoleId[]) => void;
      /** Limit which roles are shown (default: all). */
      roles?: RoleId[];
      /** Sections that get their own Select all / Deselect all button. */
      sectionToggles?: RoleSectionId[];
    }
  | {
      /** Deck step: how many copies of each role. */
      mode: 'count';
      deck: RoleId[];
      onDeck: (deck: RoleId[]) => void;
      roles?: RoleId[];
    };

/**
 * Role picker grouped into Village / Wolves / Other, easiest roles first. Tapping a card
 * opens its full preview; selection or counts are changed with the controls underneath.
 */
export function RoleGrid(props: RoleGridProps) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<RoleId | null>(null);
  const visible = props.roles ? new Set(props.roles) : null;
  const counts = props.mode === 'count' ? countRoles(props.deck) : {};
  const houseRules = useHouseRules();
  // A game has at most three teams: + is locked on roles that would bring a fourth.
  const blocked = (id: RoleId) => props.mode === 'count' && addsTeam(props.deck, id, houseRules);

  const locked = props.mode === 'select' ? LOCKED : NONE_LOCKED;
  // Latest props for the stable callbacks below, so memoized cards skip re-rendering when a
  // sibling changes.
  const latest = useRef({ props, houseRules });
  latest.current = { props, houseRules };

  const adjust = useCallback((id: RoleId, delta: 1 | -1) => {
    const { props: p, houseRules: rules } = latest.current;
    if (p.mode !== 'count') return;
    if (delta > 0) {
      if ((countRoles(p.deck)[id] ?? 0) < ROLES[id].maxCopies && !addsTeam(p.deck, id, rules)) p.onDeck(sortDeck([...p.deck, id]));
    } else {
      const idx = p.deck.lastIndexOf(id);
      if (idx >= 0) p.onDeck(p.deck.filter((_, i) => i !== idx));
    }
  }, []);
  const toggle = useCallback((id: RoleId) => {
    const p = latest.current.props;
    if (p.mode !== 'select' || LOCKED.has(id)) return;
    p.onSelected(p.selected.includes(id) ? p.selected.filter((r) => r !== id) : [...p.selected, id]);
  }, []);
  /** Select or clear a whole section; locked roles always stay. */
  const toggleSection = (roles: RoleId[], allOn: boolean) => {
    if (props.mode !== 'select') return;
    const { selected, onSelected } = props;
    const section = new Set(roles);
    onSelected(allOn ? selected.filter((r) => !section.has(r) || locked.has(r)) : [...new Set([...selected, ...roles])]);
  };

  return (
    <>
      <div className="space-y-6">
        {ROLE_SECTIONS.map((section) => {
          const roles = section.roles.filter((id) => !visible || visible.has(id));
          if (roles.length === 0) return null;
          const sectionAllOn = props.mode === 'select' && roles.every((r) => props.selected.includes(r));
          const showToggle = props.mode === 'select' && props.sectionToggles?.includes(section.id);
          return (
            <section key={section.id}>
              <h3 className="mb-3 flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-bone-dim">
                <span
                  aria-hidden
                  className={clsx(
                    'h-2.5 w-2.5 rounded-full',
                    section.id === 'village' ? 'bg-village' : section.id === 'wolves' ? 'bg-wolf' : 'bg-vampire',
                  )}
                />
                {t(`roles.section.${section.id}`)}
                <span className="text-xs text-bone-faint">· {roles.length}</span>
                {showToggle && (
                  <button
                    type="button"
                    onClick={() => toggleSection(roles, sectionAllOn)}
                    className="press ml-auto flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 font-display text-xs tracking-wide text-bone-dim hover:text-bone"
                  >
                    {sectionAllOn ? <X className="h-3.5 w-3.5" /> : <CheckCheck className="h-3.5 w-3.5" />}
                    {t(sectionAllOn ? `pools.deselectSection.${section.id}` : `pools.selectSection.${section.id}`)}
                  </button>
                )}
              </h3>
              <div className="role-grid">
                {roles.map((id) =>
                  props.mode === 'count' ? (
                    <RoleGridItem key={id} roleId={id} mode="count" count={counts[id] ?? 0} blocked={blocked(id)} onPreview={setPreview} onAdjust={adjust} />
                  ) : (
                    <RoleGridItem key={id} roleId={id} mode="select" on={props.selected.includes(id)} locked={locked.has(id)} onPreview={setPreview} onToggle={toggle} />
                  ),
                )}
              </div>
            </section>
          );
        })}
      </div>
      <RoleDetailSheet
        roleId={preview}
        onClose={() => setPreview(null)}
        count={props.mode === 'count' && preview ? (counts[preview] ?? 0) : undefined}
        onAdjust={props.mode === 'count' && preview ? (delta) => adjust(preview, delta) : undefined}
        addBlocked={!!preview && blocked(preview)}
      />
    </>
  );
}

const LOCKED = new Set<RoleId>(ALWAYS_IN_POOL);
const NONE_LOCKED = new Set<RoleId>();

type RoleGridItemProps = { roleId: RoleId; onPreview: (id: RoleId) => void } & (
  | { mode: 'count'; count: number; blocked: boolean; onAdjust: (id: RoleId, delta: 1 | -1) => void }
  | { mode: 'select'; on: boolean; locked: boolean; onToggle: (id: RoleId) => void }
);

/** One card plus its stepper or Include toggle. Memoized: re-renders only when its own role changes. */
const RoleGridItem = memo(function RoleGridItem(props: RoleGridItemProps) {
  const { t } = useI18n();
  const { roleId: id, onPreview } = props;
  const n = props.mode === 'count' ? props.count : 0;
  const on = props.mode === 'select' ? props.on : n > 0;
  const tone = TONES[ROLES[id].cardTone];
  const preview = useCallback(() => onPreview(id), [onPreview, id]);
  return (
    <div className="flex w-[var(--card-w)] flex-col items-center gap-2">
      <RoleCard roleId={id} size="sm" muted={!on} className="!w-full" onClick={preview}>
        {props.mode === 'count' && n > 0 && (
          <span
            className="absolute left-1.5 top-1.5 flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 font-display text-sm font-bold text-bone shadow-card"
            style={{ background: toneAccentFill(tone, '90deg') }}
          >
            ×{n}
          </span>
        )}
      </RoleCard>
      {props.mode === 'count' ? (
        <div className="flex w-full items-center justify-between rounded-lg border border-panel-edge bg-panel-2 p-0.5">
          <StepperButton label="−" disabled={n === 0} onClick={() => props.onAdjust(id, -1)}>
            <Minus className="h-4 w-4" />
          </StepperButton>
          <span className={clsx('font-display text-sm', n > 0 ? 'text-bone' : 'text-bone-faint')}>{n}</span>
          <StepperButton label="+" disabled={n >= ROLES[id].maxCopies || props.blocked} onClick={() => props.onAdjust(id, 1)}>
            <Plus className="h-4 w-4" />
          </StepperButton>
        </div>
      ) : (
        <button
          type="button"
          role="checkbox"
          aria-checked={on}
          aria-disabled={props.locked || undefined}
          aria-label={t(`role.${id}.name`)}
          onClick={() => props.onToggle(id)}
          className={clsx(
            'flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-semibold',
            props.locked ? 'cursor-not-allowed' : 'press',
            on ? 'border-village bg-village/15 text-bone shadow-inner-village' : 'border-panel-edge bg-panel-2 text-bone-faint',
          )}
        >
          <span
            aria-hidden
            className={clsx('flex h-4 w-4 items-center justify-center rounded border', on ? 'border-village bg-village text-ink' : 'border-bone-faint')}
          >
            {on && <Check className="h-3 w-3" strokeWidth={3} />}
          </span>
          {t('pools.include')}
          {props.locked && <Lock className="h-3 w-3 text-bone-dim" />}
        </button>
      )}
    </div>
  );
});
