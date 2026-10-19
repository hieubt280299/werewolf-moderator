import clsx from 'clsx';
import { X } from 'lucide-react';
import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { CardTone, RoleId } from '../../@types/game';
import { ROLES } from '../../data/roles';
import { RoleAvatar } from './RoleAvatar';
import { toneAccentFill, toneBadge, TONES } from './tones';

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

export function Button({ variant = 'ghost', icon, block, size = 'md', className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        'press inline-flex items-center justify-center gap-2 rounded-xl font-display font-semibold uppercase tracking-grimoire text-shadow-crisp disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
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

/**
 * Mobile bottom sheet; a centred dialog on wide screens. Pure CSS keyframes
 * (translate3d/opacity), kept mounted just long enough to play the exit animation.
 */
export function Sheet({ open, onClose, title, children, tone = 'neutral', closeLabel = 'Close' }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  // Mount in the same render that opens (not an effect afterwards), so the sheet starts
  // animating one commit sooner.
  if (open && !mounted) setMounted(true);
  const closing = mounted && !open;

  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  // Portalled to <body> so no transformed ancestor can trap the fixed overlay.
  return createPortal(
    <div
      className={clsx(
        'fixed inset-0 z-50 flex items-end justify-center bg-ink/80 sm:items-center sm:p-6',
        closing ? 'animate-fade-out' : 'animate-fade-in',
      )}
      onClick={onClose}
      onAnimationEnd={(e) => e.target === e.currentTarget && closing && setMounted(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          'grimoire-texture relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border-t will-change-transform sm:rounded-3xl sm:border',
          closing ? 'animate-sheet-out' : 'animate-sheet-in',
          tone === 'night' && 'border-village/30 shadow-[0_-10px_40px_-10px_rgba(0,163,224,0.25)]',
          tone === 'day' && 'border-ember/50 shadow-glow-ember',
          tone === 'neutral' && 'border-panel-edge',
        )}
      >
        {tone === 'day' && <div className="h-1 w-full shrink-0 bg-day-border" />}
        {(title || onClose) && (
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-4">
            <h2 className="min-w-0 truncate text-lg text-bone text-shadow-crisp">{title}</h2>
            {onClose && (
              <button type="button" onClick={onClose} aria-label={closeLabel} className="rounded-full p-2 text-bone-dim hover:text-bone">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain px-5 pb-safe">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

const TONE_CHIP: Record<CardTone | 'ember' | 'muted', string> = {
  village: 'border-village/50 bg-village/15 text-village',
  werewolf: 'border-wolf/50 bg-wolf/15 text-wolf-bright',
  vampire: 'border-vampire/50 bg-vampire/15 text-vampire',
  cult: 'border-cult/50 bg-cult/15 text-cult',
  neutral: 'border-[#C48A3F]/50 bg-[#C48A3F]/15 text-[#D9A35A]',
  dual: 'border-wolf/40 bg-gradient-to-r from-village/15 to-wolf/15 text-bone',
  ember: 'border-ember/50 bg-ember/15 text-ember',
  muted: 'border-panel-edge bg-panel-2 text-bone-dim',
};

export function Chip({
  tone = 'muted',
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

/** Round character token — the small-list variant of the card portrait. */
export function RoleBadge({ roleId, size = 40, dead, className }: { roleId: RoleId; size?: number; dead?: boolean; className?: string }) {
  const tone = TONES[ROLES[roleId].cardTone];
  return (
    <span
      className={clsx('relative inline-block shrink-0 overflow-hidden rounded-full', dead && 'opacity-50 grayscale', className)}
      style={{
        width: size,
        height: size,
        // Ring drawn as a border-box background so split tones (Cursed) get a two-colour ring.
        border: '1.5px solid transparent',
        background: `${toneBadge(tone)} padding-box, ${toneAccentFill(tone, '90deg')} border-box`,
        boxShadow: `0 0 10px -2px ${tone.glow}`,
      }}
    >
      <RoleAvatar roleId={roleId} variant="badge" className="h-full w-full" />
    </span>
  );
}

export function TextField({ label, hint, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block font-display text-xs uppercase tracking-grimoire text-bone-dim">{label}</span>
      <input
        className="min-h-12 w-full rounded-xl border border-panel-edge bg-ink px-3 text-base text-bone placeholder:text-bone-faint focus:border-village focus:outline-none"
        {...rest}
      />
      {hint && <span className="mt-1 block text-[11px] text-bone-faint">{hint}</span>}
    </label>
  );
}

/** Shared ± stepper button: clearly dimmed and inert when it can't be used. */
export function StepperButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'press flex items-center justify-center rounded-md p-2',
        disabled ? 'cursor-not-allowed text-bone-faint/30' : 'bg-white/10 text-bone hover:bg-white/20',
      )}
    >
      {children}
    </button>
  );
}
