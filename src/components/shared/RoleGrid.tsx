import clsx from 'clsx';
import { Check, CheckCheck, Lock, Minus, Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { RoleId } from '../../@types/game';
import { ALWAYS_IN_POOL, ROLES, ROLE_SECTIONS, type RoleSectionId } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { countRoles, sortDeck } from '../../utils/gameCalculations';
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

  const adjust = (id: RoleId, delta: 1 | -1) => {
    if (props.mode !== 'count') return;
    const { deck, onDeck } = props;
    if (delta > 0) {
      if ((counts[id] ?? 0) < ROLES[id].maxCopies) onDeck(sortDeck([...deck, id]));
    } else {
      const idx = deck.lastIndexOf(id);
      if (idx >= 0) onDeck(deck.filter((_, i) => i !== idx));
    }
  };
  const locked = new Set<RoleId>(props.mode === 'select' ? ALWAYS_IN_POOL : []);
  const toggle = (id: RoleId) => {
    if (props.mode !== 'select' || locked.has(id)) return;
    const { selected, onSelected } = props;
    onSelected(selected.includes(id) ? selected.filter((r) => r !== id) : [...selected, id]);
  };
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
                    className="press ml-auto flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 font-display text-xs uppercase tracking-grimoire text-bone-dim hover:text-bone"
                  >
                    {sectionAllOn ? <X className="h-3.5 w-3.5" /> : <CheckCheck className="h-3.5 w-3.5" />}
                    {t(sectionAllOn ? `pools.deselectSection.${section.id}` : `pools.selectSection.${section.id}`)}
                  </button>
                )}
              </h3>
              <div className="role-grid">
                {roles.map((id) => {
                  const n = counts[id] ?? 0;
                  const on = props.mode === 'select' ? props.selected.includes(id) : n > 0;
                  const tone = TONES[ROLES[id].cardTone];
                  return (
                    <div key={id} className="flex w-[var(--card-w)] flex-col items-center gap-2">
                      <RoleCard roleId={id} size="sm" muted={!on} className="!w-full" onClick={() => setPreview(id)}>
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
                          <StepperButton label="−" disabled={n === 0} onClick={() => adjust(id, -1)}>
                            <Minus className="h-4 w-4" />
                          </StepperButton>
                          <span className={clsx('font-display text-sm', n > 0 ? 'text-bone' : 'text-bone-faint')}>{n}</span>
                          <StepperButton label="+" disabled={n >= ROLES[id].maxCopies} onClick={() => adjust(id, 1)}>
                            <Plus className="h-4 w-4" />
                          </StepperButton>
                        </div>
                      ) : (
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          aria-disabled={locked.has(id) || undefined}
                          aria-label={t(`role.${id}.name`)}
                          onClick={() => toggle(id)}
                          className={clsx(
                            'flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
                            locked.has(id) ? 'cursor-not-allowed' : 'press',
                            on ? 'border-village bg-village/15 text-bone shadow-inner-village' : 'border-panel-edge bg-panel-2 text-bone-faint',
                          )}
                        >
                          <span
                            aria-hidden
                            className={clsx(
                              'flex h-4 w-4 items-center justify-center rounded border',
                              on ? 'border-village bg-village text-ink' : 'border-bone-faint',
                            )}
                          >
                            {on && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                          {t('pools.include')}
                          {locked.has(id) && <Lock className="h-3 w-3 text-bone-dim" />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <RoleDetailSheet
        roleId={preview}
        onClose={() => setPreview(null)}
        count={props.mode === 'count' && preview ? (counts[preview] ?? 0) : undefined}
        onAdjust={props.mode === 'count' ? (delta) => preview && adjust(preview, delta) : undefined}
      />
    </>
  );
}
