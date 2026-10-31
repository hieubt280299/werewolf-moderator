import clsx from 'clsx';
import { EyeOff, MonitorSmartphone, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Faction, RoleId } from '../../@types/game';
import { useI18n } from '../../i18n/I18nContext';
import { RoleCard } from '../shared/RoleCard';
import { TONES } from '../shared/tones';
import { Button } from '../shared/ui';

/** A message for some players' eyes only. */
export interface SilentNotice {
  /** Who it's for, by role ("the Werewolves"), never by name. */
  audience: string;
  message: string;
  /** Colours the message and icon. */
  faction: Faction;
  /** A card shown with the message, e.g. the role someone just became, or else an icon. */
  roleId?: RoleId;
  Icon?: LucideIcon;
}

/**
 * Full-screen notice for the players the moderator turns the device toward, e.g. the
 * Werewolves after the Wolf Cub's death. Nothing is said aloud, so the rest of the table
 * learns nothing: just the message on a black screen, like the Lovers' reveal.
 */
export function SilentNotificationModal({ notice, onClose }: { notice: SilentNotice; onClose: () => void }) {
  const { t } = useI18n();
  const { audience, message, Icon, faction, roleId } = notice;
  const tone = TONES[faction].text;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('silent.for', { audience })}
      className="fixed inset-0 z-[70] flex animate-fade-in flex-col items-center justify-center gap-6 overflow-y-auto bg-ink px-6 py-8 text-center"
    >
      <p className="flex items-center gap-2 text-sm text-bone-dim">
        <EyeOff className="h-4 w-4" /> {t('silent.for', { audience })}
      </p>
      {roleId ? (
        <RoleCard roleId={roleId} size="md" showText={false} showWeight={false} className="w-36 sm:w-44" />
      ) : (
        Icon && <Icon aria-hidden className={clsx('h-16 w-16', tone)} />
      )}
      <p className={clsx('max-w-md font-display text-3xl font-bold leading-tight text-shadow-crisp sm:text-4xl', tone)}>{message}</p>
      <Button variant="ghost" size="lg" onClick={onClose} className="min-w-40">
        {t('silent.done')}
      </Button>
    </div>,
    document.body,
  );
}

/** Opens a silent notice from the night script, with a reminder of how to show it. */
export function SilentNoticeButton({ notice }: { notice: SilentNotice }) {
  const { t } = useI18n();
  const [showing, setShowing] = useState(false);
  return (
    <div className="space-y-2">
      <Button block onClick={() => setShowing(true)} icon={<MonitorSmartphone className="h-4 w-4" />}>
        {t('silent.show', { audience: notice.audience })}
      </Button>
      <p className="text-xs text-bone-faint">{t('silent.hint')}</p>
      {showing && <SilentNotificationModal notice={notice} onClose={() => setShowing(false)} />}
    </div>
  );
}
