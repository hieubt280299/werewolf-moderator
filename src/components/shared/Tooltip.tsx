import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const WIDTH = 240;
const MARGIN = 12;

/**
 * Hover (desktop) or tap (touch) tooltip. Rendered in a fixed-position portal and clamped
 * to the viewport, so clipping containers can't cut it off. Tapping elsewhere closes it.
 */
export function Tooltip({ content, children, className }: { content: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const pointer = useRef<string>('mouse');

  const show = () => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(MARGIN, r.left + r.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - MARGIN);
    const above = r.top > 96;
    setPos({ left, top: above ? r.top - 8 : r.bottom + 8, above });
  };
  const hide = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    const close = (e: Event) => {
      if (e.target instanceof Node && anchor.current?.contains(e.target)) return;
      hide();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('scroll', hide, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', hide, true);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-describedby={pos ? id : undefined}
        onPointerDown={(e) => (pointer.current = e.pointerType)}
        // Touch fires a synthetic hover before click, so hover only counts for a real mouse;
        // taps toggle instead.
        onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
        onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}
        onClick={() => (pointer.current === 'mouse' ? show() : pos ? hide() : show())}
        onBlur={hide}
        className={className}
      >
        {children}
      </button>
      {pos &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className="pointer-events-none fixed z-[60] animate-fade-in rounded-lg border border-panel-edge bg-panel-2 px-3 py-2 text-xs leading-snug text-bone shadow-card"
            style={{ left: pos.left, top: pos.top, width: WIDTH, transform: pos.above ? 'translate3d(0,-100%,0)' : undefined }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
