import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import clsx from 'clsx';
import { Eraser, Plus, Shuffle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { RoleId } from '../../@types/game';
import { ROLES } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { countRoles, emptyDeal, moveCard, randomDeal, type DealLocation, type DealState } from '../../utils/gameCalculations';
import { RoleCard } from '../shared/RoleCard';
import { TONES } from '../shared/tones';
import { Button } from '../shared/ui';

interface RoleDealPickerProps {
  names: string[];
  deck: RoleId[];
  deal: DealState;
  onChange: (deal: DealState) => void;
}

/**
 * Drop on whatever seat the pointer / finger is over, so the whole seat is a target.
 * Falls back to card overlap when no pointer position is available.
 */
const dropUnderPointer: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

const sameLocation = (a: DealLocation | null, b: DealLocation) =>
  !!a && a.kind === b.kind && (a.kind !== 'slot' || (b.kind === 'slot' && a.index === b.index)) && (a.kind !== 'tray' || (b.kind === 'tray' && a.roleId === b.roleId));

/**
 * Deal board. Player seats stay put; the moderator drags each card from the tray onto the
 * player who received it. Dropping on a filled seat swaps, dragging a seated card back to
 * the tray unassigns it. Tap-to-place works as a fallback (tap a card, then a seat).
 */
export function RoleDealPicker({ names, deck, deal, onChange }: RoleDealPickerProps) {
  const { t } = useI18n();
  const [dragging, setDragging] = useState<RoleId | null>(null);
  const [selected, setSelected] = useState<DealLocation | null>(null);
  useEdgeScroll(dragging !== null);
  const sensors = useSensors(
    // Mouse: drag after a small move so plain clicks still select.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch: press-and-hold, so swiping still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
  );

  const move = (from: DealLocation, to: DealLocation) => {
    onChange(moveCard(deal, from, to));
    setSelected(null);
  };

  const cardAt = (loc: DealLocation): RoleId | null => (loc.kind === 'tray' ? loc.roleId : loc.kind === 'slot' ? deal.slots[loc.index] : null);

  const onDragStart = (e: DragStartEvent) => {
    setSelected(null);
    setDragging(cardAt(e.active.data.current as DealLocation));
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const from = e.active.data.current as DealLocation | undefined;
    const to = e.over?.data.current as DealLocation | undefined;
    if (from && to) move(from, to);
  };

  /** Tap fallback: first tap picks a card, second tap chooses where it goes. */
  const tap = (loc: DealLocation) => {
    if (selected && !sameLocation(selected, loc) && loc.kind !== 'tray') return move(selected, loc);
    if (selected?.kind === 'slot' && loc.kind === 'tray') return move(selected, { kind: 'trayZone' });
    setSelected(sameLocation(selected, loc) || !cardAt(loc) ? null : loc);
  };

  const filled = deal.slots.filter(Boolean).length;
  const trayCounts = countRoles(deal.tray);
  const trayRoles = [...new Set(deal.tray)];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={dropUnderPointer}
      // dnd-kit's auto-scroll misreads the sticky tray and jumps the page mid-drag, shifting
      // the seats under the finger. A simple edge scroll (useEdgeScroll) replaces it.
      autoScroll={false}
      onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-bone-dim">{t('deal.hint')}</p>
            <p className="text-xs text-bone-faint">{t('deal.tapHint')}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button size="sm" onClick={() => onChange(randomDeal(deck))} icon={<Shuffle className="h-4 w-4" />}>
              {t('setup.reshuffle')}
            </Button>
            <Button size="sm" variant="plain" disabled={filled === 0} onClick={() => onChange(emptyDeal(names.length, deck))} icon={<Eraser className="h-4 w-4" />}>
              {t('deal.clear')}
            </Button>
          </div>
        </div>

        <Tray roles={trayRoles} counts={trayCounts} selected={selected} onTap={tap} />

        <p className="font-display text-xs uppercase tracking-grimoire text-bone-dim">{t('deal.assigned', { count: filled, total: names.length })}</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {names.map((name, index) => (
            <Seat
              key={index}
              index={index}
              name={name}
              roleId={deal.slots[index]}
              selected={selected?.kind === 'slot' && selected.index === index}
              armed={!!selected}
              onTap={() => tap({ kind: 'slot', index })}
            />
          ))}
        </ul>
      </div>

      <DragOverlay dropAnimation={{ duration: 160 }}>
        {dragging && <RoleCard roleId={dragging} size="sm" showWeight={false} className="rotate-3 shadow-2xl" />}
      </DragOverlay>
    </DndContext>
  );
}

// ---------------------------------------------------------------------------

const EDGE = 80; // px from the top/bottom of the screen where dragging scrolls the page
const MAX_SPEED = 18; // px per frame at the very edge

/** While a card is being dragged, scroll the page when the pointer nears the screen edge. */
function useEdgeScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let y: number | null = null;
    let frame = 0;
    const track = (e: PointerEvent | TouchEvent) => {
      y = 'touches' in e ? (e.touches[0]?.clientY ?? null) : e.clientY;
    };
    const tick = () => {
      if (y !== null) {
        const top = EDGE - y;
        const bottom = y - (window.innerHeight - EDGE);
        if (top > 0) window.scrollBy(0, -Math.ceil((top / EDGE) * MAX_SPEED));
        else if (bottom > 0) window.scrollBy(0, Math.ceil((bottom / EDGE) * MAX_SPEED));
      }
      frame = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', track, { passive: true });
    window.addEventListener('touchmove', track, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', track);
      window.removeEventListener('touchmove', track);
    };
  }, [active]);
}

function Tray({
  roles,
  counts,
  selected,
  onTap,
}: {
  roles: RoleId[];
  counts: Partial<Record<RoleId, number>>;
  selected: DealLocation | null;
  onTap: (loc: DealLocation) => void;
}) {
  const { t } = useI18n();
  const { setNodeRef, isOver } = useDroppable({ id: 'tray', data: { kind: 'trayZone' } satisfies DealLocation });
  return (
    <div
      ref={setNodeRef}
      onClick={() => selected?.kind === 'slot' && onTap({ kind: 'trayZone' } as DealLocation)}
      className={clsx(
        'sticky top-14 z-20 -mx-4 border-y bg-ink/95 px-4 py-3 backdrop-blur transition-colors',
        isOver ? 'border-village/60 shadow-inner-village' : 'border-panel-edge',
      )}
    >
      <p className="mb-2 font-display text-xs uppercase tracking-grimoire text-bone-dim">{t('deal.tray')}</p>
      {roles.length === 0 ? (
        <p className="py-6 text-center text-sm text-bone-faint">{t('deal.trayEmpty')}</p>
      ) : (
        <div className="scrollbar-none -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {roles.map((roleId) => (
            <TrayCard
              key={roleId}
              roleId={roleId}
              count={counts[roleId] ?? 0}
              selected={selected?.kind === 'tray' && selected.roleId === roleId}
              onTap={() => onTap({ kind: 'tray', roleId })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TrayCard({ roleId, count, selected, onTap }: { roleId: RoleId; count: number; selected: boolean; onTap: () => void }) {
  const { t } = useI18n();
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `tray:${roleId}`,
    data: { kind: 'tray', roleId } satisfies DealLocation,
  });
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        aria-label={t(`role.${roleId}.name`)}
        aria-pressed={selected}
        onClick={(e) => {
          e.stopPropagation();
          onTap();
        }}
        className={clsx('relative cursor-grab touch-manipulation rounded-lg active:cursor-grabbing', isDragging && 'opacity-40')}
      >
        <RoleCard roleId={roleId} size="sm" showWeight={false} selected={selected} />
        {count > 1 && (
          <span
            className="absolute -left-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1 font-display text-xs font-bold text-bone shadow-card"
            style={{ background: TONES[ROLES[roleId].cardTone].accent }}
          >
            ×{count}
          </span>
        )}
      </div>
    </div>
  );
}

function Seat({
  index,
  name,
  roleId,
  selected,
  armed,
  onTap,
}: {
  index: number;
  name: string;
  roleId: RoleId | null;
  selected: boolean;
  armed: boolean;
  onTap: () => void;
}) {
  const { t } = useI18n();
  const drop = useDroppable({ id: `seat:${index}`, data: { kind: 'slot', index } satisfies DealLocation });
  const drag = useDraggable({ id: `seat:${index}`, data: { kind: 'slot', index } satisfies DealLocation, disabled: !roleId });
  const tone = roleId ? TONES[ROLES[roleId].cardTone] : null;

  return (
    <li
      ref={drop.setNodeRef}
      onClick={onTap}
      className={clsx(
        'flex min-h-[156px] cursor-pointer items-center gap-4 rounded-2xl border-2 bg-panel-gradient p-3 pr-4 shadow-card transition-colors',
        drop.isOver
          ? 'border-village bg-village/10 shadow-inner-village'
          : selected
            ? 'border-bone'
            : armed
              ? 'border-village/40'
              : 'border-panel-edge',
      )}
    >
      {roleId ? (
        <div
          ref={drag.setNodeRef}
          {...drag.listeners}
          {...drag.attributes}
          aria-label={t(`role.${roleId}.name`)}
          className={clsx('cursor-grab touch-manipulation active:cursor-grabbing', drag.isDragging && 'opacity-30')}
        >
          <RoleCard roleId={roleId} size="sm" showWeight={false} selected={selected} />
        </div>
      ) : (
        <div
          className={clsx(
            'flex w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-[7%/5%] border-2 border-dashed transition-colors',
            drop.isOver ? 'border-village text-village' : 'border-panel-edge text-bone-faint',
          )}
          style={{ aspectRatio: '5 / 7' }}
        >
          <Plus className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <span className="font-display text-xs text-bone-faint">#{index + 1}</span>
        <p className="truncate text-lg font-semibold text-bone text-shadow-crisp">{name}</p>
        {roleId && tone ? (
          <p className={clsx('font-display text-sm uppercase tracking-grimoire', tone.text)}>{t(`role.${roleId}.name`)}</p>
        ) : (
          <p className="text-xs text-bone-faint">{t('deal.empty')}</p>
        )}
      </div>
    </li>
  );
}
