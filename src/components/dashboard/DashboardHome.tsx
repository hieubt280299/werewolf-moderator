import clsx from 'clsx';
import { ChevronRight, History, Layers, Play, Plus, UserCog } from 'lucide-react';
import type { ReactNode } from 'react';
import { MAX_DECKS, type RoleId } from '../../@types/game';
import { useAuth } from '../../context/AuthContext';
import { isActiveGame, useGame } from '../../context/GameContext';
import { useI18n } from '../../i18n/I18nContext';
import { RoleBadge } from '../shared/ui';
import type { View } from '../../App';

/** Authenticated landing hub: career snapshot + navigation. */
export function DashboardHome({ onNavigate, onOpenSettings }: { onNavigate: (view: View) => void; onOpenSettings: () => void }) {
  const { t } = useI18n();
  const { profile } = useAuth();
  const { state, dispatch } = useGame();
  const active = isActiveGame(state);
  const stats = profile?.stats;

  const startNew = () => {
    if (active && !window.confirm(t('hub.confirmNew'))) return;
    if (active || state.phase === 'gameOver') dispatch({ type: 'NEW_GAME' });
    onNavigate('game');
  };

  const continueHint = active
    ? `${state.phase === 'night' ? t('dash.night', { round: state.round }) : t('dash.day', { round: state.round })} · ${t('dash.alive', {
        alive: state.players.filter((p) => p.alive).length,
        total: state.players.length,
      })}`
    : t('hub.continueNone');

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-6">
      <header className="animate-step-in">
        <h1 className="text-xl text-bone text-shadow-title sm:text-3xl">{t('hub.greeting', { name: profile?.displayName ?? '' })}</h1>
        <p className="mt-1 text-sm text-bone-dim">{t('hub.subtitle')}</p>
      </header>

      {stats && (
        <div className="grid animate-step-in grid-cols-3 gap-2.5" style={{ animationDelay: '60ms' }}>
          <Stat label={t('history.games')} value={stats.gamesModerated} />
          <Stat label={t('history.wolfWins')} value={stats.werewolfWins} tone="wolf" />
          <Stat label={t('history.villageWins')} value={stats.villageWins} tone="village" />
        </div>
      )}

      <nav className="grid gap-3 sm:grid-cols-2">
        <HubTile
          primary
          tone="wolf"
          icon={<Plus className="h-6 w-6" />}
          title={t('hub.newGame')}
          hint={t('hub.newGameHint')}
          art={['werewolf', 'seer', 'villager']}
          onClick={startNew}
          delay={100}
        />
        <HubTile
          tone="village"
          icon={<Play className="h-6 w-6" />}
          title={t('hub.continue')}
          hint={continueHint}
          disabled={!active}
          onClick={() => onNavigate('game')}
          delay={140}
        />
        <HubTile
          icon={<Layers className="h-6 w-6" />}
          title={t('hub.decks')}
          hint={t('hub.decksHint', { count: profile?.decks.length ?? 0, max: MAX_DECKS })}
          art={['witch', 'hunter', 'bodyguard']}
          onClick={() => onNavigate('decks')}
          delay={180}
        />
        <HubTile
          icon={<History className="h-6 w-6" />}
          title={t('hub.history')}
          hint={t('hub.historyHint', { count: stats?.gamesModerated ?? 0 })}
          onClick={() => onNavigate('history')}
          delay={220}
        />
        <HubTile
          icon={<UserCog className="h-6 w-6" />}
          title={t('hub.profile')}
          hint={t('hub.profileHint')}
          onClick={onOpenSettings}
          delay={260}
        />
      </nav>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'wolf' | 'village' }) {
  return (
    <div
      className={clsx(
        'panel border p-3 text-center',
        tone === 'wolf' ? 'border-wolf/30 shadow-inner-wolf' : tone === 'village' ? 'border-village/30 shadow-inner-village' : 'border-panel-edge',
      )}
    >
      <p className={clsx('font-display text-3xl font-bold', tone === 'wolf' ? 'text-wolf-bright' : tone === 'village' ? 'text-village' : 'text-bone')}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] uppercase leading-tight tracking-wide text-bone-dim">{label}</p>
    </div>
  );
}

function HubTile({
  icon,
  title,
  hint,
  onClick,
  disabled,
  primary,
  tone,
  art,
  delay = 0,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  tone?: 'wolf' | 'village';
  art?: RoleId[];
  delay?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ animationDelay: `${delay}ms` }}
      className={clsx(
        'press relative flex min-h-[96px] animate-step-in items-center gap-4 overflow-hidden rounded-2xl border bg-panel-gradient p-4 text-left shadow-card disabled:opacity-40',
        primary && 'sm:col-span-2 sm:min-h-[120px]',
        tone === 'wolf' ? 'border-wolf/50' : tone === 'village' ? 'border-village/40' : 'border-panel-edge',
      )}
    >
      <span
        aria-hidden
        className={clsx('absolute inset-y-0 left-0 w-1.5', tone === 'wolf' ? 'bg-wolf' : tone === 'village' ? 'bg-village' : 'bg-panel-edge')}
      />
      <span
        className={clsx(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
          tone === 'wolf' ? 'bg-wolf/15 text-wolf-bright shadow-inner-wolf' : tone === 'village' ? 'bg-village/15 text-village shadow-inner-village' : 'bg-ink/60 text-bone-dim',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-semibold uppercase tracking-grimoire text-bone text-shadow-crisp">{title}</span>
        <span className="block truncate text-sm text-bone-dim">{hint}</span>
      </span>
      {art && (
        <span className="hidden -space-x-3 sm:flex">
          {art.map((r) => (
            <RoleBadge key={r} roleId={r} size={44} />
          ))}
        </span>
      )}
      <ChevronRight className="h-5 w-5 shrink-0 text-bone-faint" />
    </button>
  );
}
