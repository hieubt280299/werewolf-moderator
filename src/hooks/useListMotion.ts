import { useLayoutEffect, useRef } from 'react';

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const GHOST = 'data-list-motion-ghost';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const layoutBox = (el: HTMLElement): Box => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });

/**
 * Animates a list's children when it re-renders (FLIP): items glide to their new place,
 * new items fade in, removed items fade out where they were. Attach the returned ref to the
 * list element, which must be `position: relative` (offsets are measured against it).
 *
 * Measures only after its owner commits — no per-item observers or polling timers — and
 * animates transform/opacity with the Web Animations API, so it stays on the compositor.
 */
export function useListMotion<T extends HTMLElement>(duration = 260) {
  const ref = useRef<T>(null);
  const boxes = useRef(new Map<HTMLElement, Box>());
  const moves = useRef(new WeakMap<HTMLElement, Animation>());
  const ready = useRef(false);

  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    const animate = ready.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prev = boxes.current;
    const next = new Map<HTMLElement, Box>();
    let listRect: DOMRect | null = null;

    for (const child of Array.from(list.children)) {
      if (!(child instanceof HTMLElement) || child.hasAttribute(GHOST)) continue;
      const box = layoutBox(child); // offsets ignore transforms, so a running animation can't skew them
      next.set(child, box);
      if (!animate) continue;
      const before = prev.get(child);
      if (!before) {
        child.animate(
          [{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }],
          { duration, easing: EASE_OUT },
        );
        continue;
      }
      if (before.x === box.x && before.y === box.y) continue;
      // Start from where the item is drawn right now (mid-glide if it was already moving).
      let from = before;
      const running = moves.current.get(child);
      if (running?.playState === 'running') {
        listRect ??= list.getBoundingClientRect();
        const r = child.getBoundingClientRect();
        from = { ...box, x: r.left - listRect.left - list.clientLeft, y: r.top - listRect.top - list.clientTop };
        running.cancel();
      }
      moves.current.set(
        child,
        child.animate(
          [{ transform: `translate(${from.x - box.x}px, ${from.y - box.y}px)` }, { transform: 'none' }],
          { duration, easing: EASE_OUT },
        ),
      );
    }

    // Removed items: a detached copy fades out in the old spot while the rest close the gap.
    if (animate) {
      prev.forEach((box, el) => {
        if (next.has(el)) return;
        const ghost = el.cloneNode(true) as HTMLElement;
        ghost.setAttribute(GHOST, '');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.inert = true;
        Object.assign(ghost.style, {
          position: 'absolute',
          left: `${box.x}px`,
          top: `${box.y}px`,
          width: `${box.w}px`,
          height: `${box.h}px`,
          margin: '0',
          pointerEvents: 'none',
        });
        list.appendChild(ghost);
        ghost
          .animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], {
            duration: duration * 0.75,
            easing: 'cubic-bezier(0.4, 0, 1, 1)',
            fill: 'forwards',
          })
          .finished.catch(() => undefined)
          .finally(() => ghost.remove());
      });
    }

    boxes.current = next;
    ready.current = true;
  });

  // Reflows that happen without a re-render (window resize, breakpoints) would leave stale
  // positions behind and make the next update glide from the wrong place, so re-record them.
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      boxes.current.forEach((_, el) => {
        if (el.parentElement === list) boxes.current.set(el, layoutBox(el));
      });
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  return ref;
}
