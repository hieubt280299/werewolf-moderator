import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { CardTone } from '../../@types/game';
import { sheet } from '../../utils/motion';

type ButtonVariant = 'village' | 'wolf' | 'ember' | 'ghost' | 'plain';

const VARIANTS: Record<ButtonVariant, string> = {
  village: 'bg-village-deep/90 text-bone shadow-glow-village hover:bg-village-deep border border-village/60',
  wolf: 'bg-wolf text-bone shadow-glow-wolf hover:bg-wolf-bright border border-wolf-bright/60',
  ember: 'bg-gradient-to-r from-ember-deep to-ember text-bone shadow-glow-ember border border-ember/60',
  ghost: 'bg-panel-2 text-bone border border-panel-edge hover:border-bone/30',
  plain: 'bg-transparent text-bone-dim hover:text-bone',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  block?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'ghost', icon, block, size = 'md', className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-display font-semibold uppercase tracking-grimoire text-shadow-crisp transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
        size === 'sm' && 'min-h-9 px-3 text-xs',
        size === 'md' && 'min-h-11 px-4 text-sm',
        size === 'lg' && 'min-h-14 px-6 text-base',
        block && 'w-full',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

interface SheetProps {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Night sheets stay low-contrast so they don't light up faces in the dark. */
  tone?: 'night' | 'day' | 'neutral';
  closeLabel?: string;
}

/** Mobile bottom sheet; becomes a centred dialog on wide screens. */
export function Sheet({ open, onClose, title, children, tone = 'neutral', closeLabel = 'Close' }: SheetProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            variants={sheet}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className={clsx(
              'grimoire-texture relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border-t sm:rounded-3xl sm:border',
              tone === 'night' && 'border-village/30 shadow-[0_-10px_40px_-10px_rgba(0,163,224,0.25)]',
              tone === 'day' && 'border-ember/50 shadow-glow-ember',
              tone === 'neutral' && 'border-panel-edge',
            )}
          >
            {tone === 'day' && <div className="h-1 w-full bg-day-border" />}
            {(title || onClose) && (
              <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
                <h2 className="text-lg text-bone text-shadow-crisp">{title}</h2>
                {onClose && (
                  <button type="button" onClick={onClose} aria-label={closeLabel} className="rounded-full p-2 text-bone-dim hover:text-bone">
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
            <div className="overflow-y-auto px-5 pb-safe">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const TONE_CHIP: Record<CardTone | 'ember' | 'neutral', string> = {
  village: 'border-village/50 bg-village/15 text-village',
  werewolf: 'border-wolf/50 bg-wolf/15 text-wolf-bright',
  vampire: 'border-vampire/50 bg-vampire/15 text-vampire',
  cult: 'border-cult/50 bg-cult/15 text-cult',
  ember: 'border-ember/50 bg-ember/15 text-ember',
  neutral: 'border-panel-edge bg-panel-2 text-bone-dim',
};

export function Chip({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: keyof typeof TONE_CHIP;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        TONE_CHIP[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-sm text-bone-dim">{children}</h3>
      {aside}
    </div>
  );
}
