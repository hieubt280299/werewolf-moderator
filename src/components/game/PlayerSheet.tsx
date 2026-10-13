import { HeartPulse, Skull } from 'lucide-react';
import type { Player } from '../../@types/game';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useI18n } from '../../i18n/I18nContext';
import { StatusBadges } from '../shared/PlayerToken';
import { RoleCard } from '../shared/RoleCard';
import { Button, Sheet } from '../shared/ui';

/** Moderator detail view with manual overrides (eliminate / revive). */
export function PlayerSheet({ player, onClose }: { player: Player | null; onClose: () => void }) {
  const { t } = useI18n();
  const engine = useGameEngine();

  return (
    <Sheet open={!!player} onClose={onClose} title={player?.name} closeLabel={t('settings.close')}>
      {player && (
        <div className="flex flex-col items-center gap-4 pb-4">
          <RoleCard roleId={player.roleId} size="lg" dead={!player.alive} />
          {player.originalRoleId !== player.roleId && (
            <p className="text-sm text-bone-dim">{t('player.originalRole', { role: t(`role.${player.originalRoleId}.name`) })}</p>
          )}
          {player.eliminated && (
            <p className="text-sm text-bone-dim">
              {t('player.diedAt', {
                phase: t(`phase.${player.eliminated.phase}`),
                round: player.eliminated.round,
                cause: t(`cause.${player.eliminated.cause}`),
              })}
            </p>
          )}
          <StatusBadges player={player} />
          <div className="w-full">
            {player.alive ? (
              <Button
                variant="wolf"
                block
                disabled={engine.state.phase === 'gameOver'}
                onClick={() => {
                  engine.eliminate(player.id);
                  onClose();
                }}
                icon={<Skull className="h-4 w-4" />}
              >
                {t('player.eliminate')}
              </Button>
            ) : (
              <Button
                variant="village"
                block
                onClick={() => {
                  engine.revive(player.id);
                  onClose();
                }}
                icon={<HeartPulse className="h-4 w-4" />}
              >
                {t('player.revive')}
              </Button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
