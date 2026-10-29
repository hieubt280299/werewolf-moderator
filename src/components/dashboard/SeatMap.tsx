import clsx from 'clsx';
import { Check, CircleDot, Heart, LayoutGrid, Link2, LocateFixed, Lock, RotateCcw, RotateCw, Shield, Skull } from 'lucide-react';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import type { Player } from '../../@types/game';
import { ROLES } from '../../data/roles';
import { seatRotation, type BoardView } from '../../hooks/useSeatMapPrefs';
import { useI18n } from '../../i18n/I18nContext';
import type { DeathLink } from '../../utils/gameRules';
import { LINK_TONE, linkBadges } from '../shared/PlayerToken';
import { toneAccentFill, TONES, type Tone } from '../shared/tones';
import { Button, RoleBadge } from '../shared/ui';

/** A death link's line colour: the role that made it. */
const linkColor = (kind: DeathLink['kind']) => {
  const tone = TONES[LINK_TONE[kind]];
  return tone.split ? tone.split[1].accent : tone.accent;
};

export type SeatAccent = 'village' | 'wolf' | 'vampire' | 'cult';

const ACCENT_TONE: Record<SeatAccent, Tone> = {
  village: TONES.village,
  wolf: TONES.werewolf,
  vampire: TONES.vampire,
  cult: TONES.cult,
};

interface SeatMapProps {
  players: Player[];
  /**
   * A seat was tapped. On the board this opens the player's detail sheet (the same one the
   * player list opens); in the night script it picks or unpicks a target.
   */
  onSelect: (playerId: string) => void;
  /** Bodyguard target while the night is in progress. */
  shieldedId?: string | null;
  /** Died in the phase that just ended: ringed in red instead of greyed out. */
  freshIds?: ReadonlySet<string>;
  /** Picker mode: only these players can be tapped; every other seat is shown dimmed. */
  selectable?: ReadonlySet<string>;
  selected?: readonly string[];
  /** Highlight colour of picked seats. */
  accent?: SeatAccent;
  /** Why a seat can't be picked, by player id (shown with the seat). */
  notes?: Readonly<Record<string, string>>;
  /** Death links (Virginia Woolf, Dire Wolf), drawn as arrows towards whoever dies along. */
  links?: readonly DeathLink[];
  /** Text in the middle of the table. */
  centerLabel?: string;
  /** Turning tips under the buttons; left out where space is tight. */
  showHint?: boolean;
  /** Width cap of the map. */
  className?: string;
}

const NODE_MIN = 40;
const NODE_MAX = 96;
/** Below this width one ring is too crowded, and seats alternate between two rings. */
const STAGGER_BELOW = 64;
/** Gap between the outermost node and the edge of the map. */
const EDGE = 4;
/** How far a press may travel and still count as a tap on a seat. */
const DRAG_SLOP = 6;
/** Presses this close to the pivot have no stable angle, so they don't turn the table. */
const DEAD_ZONE = 12;
const KEY_STEP = 15;
const SETTLE = 'group-data-[settle]:transition-transform group-data-[settle]:duration-500 group-data-[settle]:ease-[cubic-bezier(0.22,1,0.36,1)]';
const RESTING = '0 8px 20px -8px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06)';

export interface SeatLayout {
  /** Node width in px. */
  width: number;
  /** Radius of the ring of node centres (even seats when staggered). */
  outer: number;
  /** Radius of the inner ring of node centres (odd seats when staggered; = outer otherwise). */
  inner: number;
  staggered: boolean;
}

/** Node height for a node width: the portrait plus two lines of text. */
const nodeHeight = (width: number) => width * 0.5 + 30;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function fitRings(size: number, seats: number, rings: 1 | 2): SeatLayout {
  const half = size / 2;
  let width = NODE_MAX;
  let outer = 0;
  let inner = 0;
  // Bigger nodes push the ring inwards, which shortens the gap between seats: settle on a
  // width that fits the gap it leaves.
  for (let i = 0; i < 6; i++) {
    const height = nodeHeight(width);
    outer = half - Math.max(width, height) / 2 - EDGE;
    inner = rings === 2 ? outer - height : outer;
    // Neighbours on the same ring are one seat apart on one ring, two seats apart on two.
    width = clamp(2 * inner * Math.sin((Math.PI * rings) / seats) * 0.94, NODE_MIN, NODE_MAX);
  }
  const height = nodeHeight(width);
  outer = half - Math.max(width, height) / 2 - EDGE;
  inner = rings === 2 ? outer - height : outer;
  return { width, outer, inner, staggered: rings === 2 };
}

/** Node size and ring radii for `seats` players around a square map `size` px wide. */
export function seatLayout(size: number, seats: number): SeatLayout {
  const single = fitRings(size, seats, 1);
  if (seats < 8 || single.width >= STAGGER_BELOW) return single;
  const double = fitRings(size, seats, 2);
  return double.width >= single.width ? double : single;
}

/** Seat 1 at the top, then clockwise, like going round the physical table. */
const seatAngle = (seat: number, seats: number) => -Math.PI / 2 + (2 * Math.PI * seat) / seats;
const normalize = (deg: number) => ((deg % 360) + 360) % 360;
/** Smallest signed difference between two angles, in degrees (−180..180]. */
const angleDelta = (from: number, to: number) => {
  const d = normalize(to - from);
  return d > 180 ? d - 360 : d;
};

interface Drag {
  pointerId: number;
  x: number;
  y: number;
  /** Pointer angle around the pivot at the last move, in degrees. */
  angle: number;
  /** Past the tap slop: the table is turning. */
  turning: boolean;
}

/**
 * The table seen from above: players around a circle in seat order, each with their seat
 * number, name, role (in team colour) and portrait. The circle turns with a drag (touch or
 * mouse), the arrow keys or the preset buttons, so the moderator can line it up with the
 * real table from wherever they stand. Labels counter-rotate to stay upright. The mouse
 * wheel is left alone: it scrolls the page or the night script, as everywhere else.
 *
 * The orientation is shared by every seat map in the app (the board and the night script):
 * turning one turns them all. While turning, the angle goes straight to a CSS variable (no
 * re-render per frame); the drawing and every seat read it, so they turn together on the
 * compositor.
 */
export const SeatMap = memo(function SeatMap({
  players,
  onSelect,
  shieldedId,
  freshIds,
  selectable,
  selected,
  accent = 'village',
  notes,
  links,
  centerLabel,
  showHint = true,
  className = 'max-w-[560px]',
}: SeatMapProps) {
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const self = useRef(Symbol('seat-map'));
  const rotation = useRef(seatRotation.get());
  const drag = useRef<Drag | null>(null);
  const swallowClick = useRef(false);
  const [size, setSize] = useState(0);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setSize(Math.round(el.clientWidth));
    const observer = new ResizeObserver(([entry]) => setSize(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** Shows the table at `deg`; `settle` eases there instead of following the pointer. */
  const apply = useCallback((deg: number, settle: boolean) => {
    rotation.current = deg;
    const root = rootRef.current;
    if (!root) return;
    if (settle) root.dataset.settle = '';
    else delete root.dataset.settle;
    root.style.setProperty('--seat-rot', `${deg}deg`);
  }, []);

  // Another seat map turned (e.g. the night script's, over the board): follow it.
  useEffect(() => seatRotation.subscribe((change) => change.source !== self.current && apply(change.deg, change.settle)), [apply]);

  const rotateTo = useCallback(
    (deg: number, settle: boolean) => {
      apply(deg, settle);
      seatRotation.set(deg, settle, self.current);
    },
    [apply],
  );

  const turn = useCallback((delta: number) => rotateTo(rotation.current + delta, true), [rotateTo]);
  // Ease back the short way to upright, however many turns the table has made.
  const reset = useCallback(() => rotateTo(Math.round(rotation.current / 360) * 360, true), [rotateTo]);

  /** The pointer's angle around the pivot in degrees, or null too close to the centre. */
  const pointerAngle = (e: PointerEvent<HTMLDivElement>): number | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    return Math.hypot(dx, dy) < DEAD_ZONE ? null : (Math.atan2(dy, dx) * 180) / Math.PI;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swallowClick.current = false;
    const angle = pointerAngle(e);
    drag.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, angle: angle ?? 0, turning: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const angle = pointerAngle(e);
    if (!d.turning) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_SLOP) return;
      // A drag, not a tap: keep receiving the pointer even when it leaves the map.
      d.turning = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (angle === null) return;
    rotateTo(rotation.current + angleDelta(d.angle, angle), false);
    d.angle = angle;
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    // The click that follows a drag must not open the seat it ended on.
    swallowClick.current = d.turning;
    drag.current = null;
  };

  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    swallowClick.current = false;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      turn(e.key === 'ArrowLeft' ? -KEY_STEP : KEY_STEP);
    }
  };

  const seats = players.length;
  const layout = size > 0 && seats > 0 ? seatLayout(size, seats) : null;
  const half = size / 2;
  const tableRadius = layout ? Math.max(24, layout.inner - nodeHeight(layout.width) / 2 - 8) : 0;
  const seated = [...players].sort((a, b) => a.seat - b.seat);
  // Cupid's Lovers, joined across the table (the list marks them with a "Lover" chip).
  const lovers = seated.filter((p) => p.status.lover);
  const loverAngles = lovers.length === 2 ? lovers.map((p) => seatAngle(p.seat, seats)) : null;
  const loverRadius = tableRadius - 9;
  // Virginia Woolf's and the Dire Wolf's links: each kind on its own chord, so a pair joined
  // twice still shows both lines.
  const byId = new Map(players.map((p) => [p.id, p]));
  const linkLines = (links ?? []).flatMap((l, i) => {
    const from = byId.get(l.from);
    const to = byId.get(l.to);
    if (!from || !to) return [];
    const r = tableRadius - (l.kind === 'virginia' ? 16 : 23);
    const a = seatAngle(from.seat, seats);
    const b = seatAngle(to.seat, seats);
    return [{ key: `${l.kind}-${i}`, kind: l.kind, x1: half + Math.cos(a) * r, y1: half + Math.sin(a) * r, x2: half + Math.cos(b) * r, y2: half + Math.sin(b) * r, live: from.alive && to.alive }];
  });
  const badges = linkBadges(players, links ?? []);

  return (
    <div className="space-y-3">
      <div
        ref={rootRef}
        role="group"
        tabIndex={0}
        aria-label={t('seatMap.label')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
        className={clsx(
          'group relative mx-auto aspect-square w-full cursor-grab touch-none select-none rounded-full active:cursor-grabbing',
          className,
        )}
        style={{ '--seat-rot': `${rotation.current}deg` } as CSSProperties}
      >
        {/*
          * No rotated wrapper box here: a turned square pokes its corners past the map and
          * widens the page. The drawing turns inside its SVG (which clips), and each seat
          * places itself on the turned circle while staying inside the square.
          */}
        {layout && (
          <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
            <defs>
              <radialGradient id="seat-map-felt" cx="50%" cy="40%" r="65%">
                <stop offset="0%" stopColor="#1A1D26" />
                <stop offset="100%" stopColor="#0B0C11" />
              </radialGradient>
              {(['virginia', 'direWolf'] as const).map((kind) => (
                <marker key={kind} id={`seat-link-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" fill={linkColor(kind)} />
                </marker>
              ))}
            </defs>
            <g className={SETTLE} style={{ transform: 'rotate(var(--seat-rot))', transformOrigin: `${half}px ${half}px` }}>
              <circle cx={half} cy={half} r={layout.outer} fill="none" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 6" />
              {layout.staggered && (
                <circle cx={half} cy={half} r={layout.inner} fill="none" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 6" />
              )}
              <circle cx={half} cy={half} r={tableRadius} fill="url(#seat-map-felt)" stroke="#2A2E3B" strokeWidth={1.5} />
              {/* A tick from the table's edge towards each seat, in the seat's team colour. */}
              {seated.map((p) => {
                const a = seatAngle(p.seat, seats);
                const tone = TONES[ROLES[p.roleId].cardTone];
                const color = tone.split ? tone.split[1].accent : tone.accent;
                return (
                  <line
                    key={p.id}
                    x1={half + Math.cos(a) * (tableRadius - 7)}
                    y1={half + Math.sin(a) * (tableRadius - 7)}
                    x2={half + Math.cos(a) * (tableRadius + 1)}
                    y2={half + Math.sin(a) * (tableRadius + 1)}
                    stroke={p.alive ? color : '#3A3F4F'}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                );
              })}
              {loverAngles && (
                <line
                  x1={half + Math.cos(loverAngles[0]) * loverRadius}
                  y1={half + Math.sin(loverAngles[0]) * loverRadius}
                  x2={half + Math.cos(loverAngles[1]) * loverRadius}
                  y2={half + Math.sin(loverAngles[1]) * loverRadius}
                  stroke={TONES.vampire.accent}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                  opacity={lovers.some((p) => p.alive) ? 0.8 : 0.3}
                />
              )}
              {/* Death links point at whoever dies along; dimmed once either end is gone. */}
              {linkLines.map((l) => (
                <line
                  key={l.key}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke={linkColor(l.kind)}
                  strokeWidth={2}
                  strokeDasharray="1 4"
                  strokeLinecap="round"
                  markerEnd={`url(#seat-link-${l.kind})`}
                  opacity={l.live ? 0.85 : 0.3}
                />
              ))}
            </g>
          </svg>
        )}

        {layout &&
          seated.map((p) => (
            <SeatNode
              key={p.id}
              player={p}
              center={half}
              angle={(seatAngle(p.seat, seats) * 180) / Math.PI}
              radius={layout.staggered && p.seat % 2 === 1 ? layout.inner : layout.outer}
              width={layout.width}
              shielded={p.id === shieldedId}
              fresh={!!freshIds?.has(p.id)}
              enabled={!selectable || selectable.has(p.id)}
              selected={!!selected?.includes(p.id)}
              accent={accent}
              note={notes?.[p.id]}
              linkColor={badges.has(p.id) ? linkColor(badges.get(p.id)![0].kind) : undefined}
              linkLabel={badges
                .get(p.id)
                ?.map((b) => t(b.diesWith ? 'status.diesWith' : 'status.takesAlong', { name: b.partner }))
                .join(', ')}
              onSelect={onSelect}
            />
          ))}

        {centerLabel && (
          <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center font-display text-xs uppercase tracking-grimoire text-bone-dim">
            {centerLabel}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" onClick={() => turn(-90)} icon={<RotateCcw className="h-4 w-4" />}>
          {t('seatMap.rotateLeft')}
        </Button>
        <Button size="sm" onClick={() => turn(90)} icon={<RotateCw className="h-4 w-4" />}>
          {t('seatMap.rotateRight')}
        </Button>
        <Button size="sm" variant="plain" onClick={reset} icon={<LocateFixed className="h-4 w-4" />}>
          {t('seatMap.reset')}
        </Button>
      </div>
      {showHint && <p className="text-center text-xs text-bone-faint">{t('seatMap.hint')}</p>}
    </div>
  );
});

interface SeatNodeProps {
  player: Player;
  /** The map's pivot, in px from its top-left corner. */
  center: number;
  /** The seat's angle round the table before it turns, in degrees (0 = right, clockwise). */
  angle: number;
  /** Distance from the pivot to the node's centre, in px. */
  radius: number;
  width: number;
  shielded: boolean;
  /** Died in the phase that just ended. */
  fresh: boolean;
  /** Can be tapped (picker mode dims the rest). */
  enabled: boolean;
  selected: boolean;
  accent: SeatAccent;
  note?: string;
  /** Colour of the seat's death-link badge (Virginia Woolf, Dire Wolf), if it has one. */
  linkColor?: string;
  /** The seat's death links, read out with it ("Dies with An"). */
  linkLabel?: string;
  onSelect: (playerId: string) => void;
}

/** One seat: a small upright card that counter-rotates against the table. */
const SeatNode = memo(function SeatNode({
  player,
  center,
  angle,
  radius,
  width,
  shielded,
  fresh,
  enabled,
  selected,
  accent,
  note,
  linkColor: linkTint,
  linkLabel,
  onSelect,
}: SeatNodeProps) {
  const { t } = useI18n();
  const tone = TONES[ROLES[player.roleId].cardTone];
  const pick = ACCENT_TONE[accent];
  const roleName = t(`role.${player.roleId}.name`);
  const avatar = Math.round(clamp(width * 0.5, 22, 48));
  const nameSize = clamp(width * 0.14, 9, 13);
  const roleSize = clamp(width * 0.115, 8, 11);
  const seatSize = Math.round(clamp(width * 0.22, 14, 20));
  const lover = player.status.lover;
  const seatLabel = t('seatMap.seat', { seat: player.seat + 1, name: player.name, role: roleName });
  const label = [seatLabel, lover && t('status.lover'), linkLabel].filter(Boolean).join(', ');
  // A fresh death keeps its colours and is ringed in red; earlier deaths fade to grey.
  const faded = !player.alive && !fresh;

  return (
    <div
      className={clsx('absolute', SETTLE)}
      style={{
        left: center,
        top: center,
        width,
        // Out along the turned seat angle, then turned back upright. Each step eases with the
        // others, so the seat glides round the arc and its label never tilts.
        transform: `translate(-50%, -50%) rotate(calc(var(--seat-rot) + ${angle}deg)) translateX(${radius}px) rotate(calc((var(--seat-rot) + ${angle}deg) * -1))`,
      }}
    >
      <button
        type="button"
        disabled={!enabled}
        onClick={() => onSelect(player.id)}
        aria-label={note ? `${label} (${note})` : label}
        aria-pressed={selected || undefined}
        title={note}
        className={clsx(
          'press relative flex w-full flex-col items-center overflow-hidden rounded-xl border bg-panel-gradient px-1 pb-1 pt-1.5 text-center',
          selected ? 'border-transparent' : player.alive ? 'border-panel-edge' : fresh ? 'border-wolf/70' : 'border-panel-edge/50',
          faded && 'grayscale',
          !enabled ? 'cursor-not-allowed opacity-35' : faded && 'opacity-50',
        )}
        style={{
          boxShadow: selected
            ? `0 0 0 2px ${pick.accent}, ${pick.inner}`
            : shielded && player.alive
              ? TONES.village.inner
              : fresh && !player.alive
                ? `0 0 0 1px ${TONES.werewolf.accent}, ${TONES.werewolf.inner}`
                : RESTING,
        }}
      >
        {/* Team edge along the top, like the coloured plate of the physical card. */}
        <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: toneAccentFill(tone, '90deg') }} />
        <span
          aria-hidden
          className="absolute left-0.5 top-1 flex items-center justify-center rounded-full bg-ink/80 font-display leading-none text-bone"
          style={{ width: seatSize, height: seatSize, fontSize: seatSize * 0.6 }}
        >
          {player.seat + 1}
        </span>
        {(selected || note) && (
          <span
            aria-hidden
            className="absolute right-0.5 top-1 flex items-center justify-center rounded-full text-bone"
            style={{ width: seatSize, height: seatSize, background: selected ? pick.accent : 'rgba(5,5,5,0.8)' }}
          >
            {selected ? <Check style={{ width: seatSize * 0.65, height: seatSize * 0.65 }} /> : <Lock style={{ width: seatSize * 0.55, height: seatSize * 0.55 }} />}
          </span>
        )}
        <span className="relative">
          <RoleBadge roleId={player.roleId} size={avatar} />
          {!player.alive && (
            <Skull
              aria-hidden
              className={clsx('absolute inset-0 m-auto', fresh ? 'text-wolf-bright drop-shadow' : 'text-bone')}
              style={{ width: avatar * 0.55, height: avatar * 0.55 }}
            />
          )}
          {shielded && player.alive && <Shield aria-hidden className="absolute -right-1 -top-1 h-3.5 w-3.5 text-village" />}
          {lover && (
            <span aria-hidden className="absolute -bottom-1 -left-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink/85">
              <Heart className="h-2.5 w-2.5 fill-current text-vampire" />
            </span>
          )}
          {linkTint && (
            <span aria-hidden className="absolute -bottom-1 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink/85">
              <Link2 className="h-2.5 w-2.5" style={{ color: linkTint }} />
            </span>
          )}
        </span>
        <span
          className={clsx('mt-0.5 block w-full truncate font-semibold leading-tight text-bone text-shadow-crisp', !player.alive && 'line-through')}
          style={{ fontSize: nameSize }}
        >
          {player.name}
        </span>
        <span
          className={clsx('mx-auto block max-w-full truncate font-display uppercase leading-tight tracking-wide', tone.text)}
          style={{ fontSize: roleSize }}
        >
          {roleName}
        </span>
      </button>
    </div>
  );
});

/** List / seat map switch, shared by every player picker (the choice applies everywhere). */
export function BoardViewSwitch({ view, onChange }: { view: BoardView; onChange: (view: BoardView) => void }) {
  const { t } = useI18n();
  return (
    <span role="group" aria-label={t('board.view')} className="flex shrink-0 rounded-lg border border-panel-edge bg-panel-2 p-0.5">
      {(['list', 'map'] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          title={t(`board.${v}`)}
          onClick={() => onChange(v)}
          className={clsx(
            'press flex min-h-8 items-center gap-1 rounded-md px-2 font-display text-[11px] uppercase tracking-wide',
            view === v ? 'bg-village/20 text-village shadow-inner-village' : 'text-bone-dim hover:text-bone',
          )}
        >
          {v === 'list' ? <LayoutGrid className="h-3.5 w-3.5" /> : <CircleDot className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{t(`board.${v}`)}</span>
        </button>
      ))}
    </span>
  );
}
