import { Crosshair } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useI18n } from '../../i18n/I18nContext';
import { PlayerToken } from '../shared/PlayerToken';
import { RoleCard } from '../shared/RoleCard';
import { Button, Sheet } from '../shared/ui';

/** Death rattle: blocks the game until the Hunter fires (or holds). */
export function HunterTriggerSheet() {
  const { t } = useI18n();
  const engine = useGameEngine();
  const trigger = engine.pendingTrigger;
  const hunter = trigger ? engine.byId.get(trigger.sourcePlayerId) : undefined;
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => setTarget(null), [trigger?.id]);

  return (
    <Sheet open={!!trigger && !!hunter} title={t('trigger.hunter.title')} tone="day">
      {trigger && hunter && (
        <div className="space-y-4 pb-4">
          <div className="flex items-center gap-4">
            <RoleCard roleId="hunter" size="sm" />
            <p className="text-bone">{t('trigger.hunter.body', { name: hunter.name })}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {engine.alive.map((p) => (
              <PlayerToken key={p.id} player={p} accent="wolf" selected={target === p.id} onClick={() => setTarget(target === p.id ? null : p.id)} />
            ))}
          </div>
          <div className="flex gap-3">
            <Button onClick={() => engine.hunterShot(trigger.id, null)}>{t('trigger.hunter.hold')}</Button>
            <Button variant="wolf" block disabled={!target} onClick={() => engine.hunterShot(trigger.id, target)} icon={<Crosshair className="h-4 w-4" />}>
              {t('trigger.hunter.fire')}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
