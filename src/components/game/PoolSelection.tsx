import clsx from 'clsx';
import { Check, CheckCheck, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MAX_POOLS, type RoleId, type RolePool, type SetupDraft } from '../../@types/game';
import { useAuth } from '../../context/AuthContext';
import { ALWAYS_IN_POOL, ROLE_ORDER, withFillers } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { createId } from '../../utils/gameCalculations';
import { RoleGrid } from '../shared/RoleGrid';
import { Button, RoleBadge, SectionTitle, Sheet } from '../shared/ui';

interface PoolSelectionProps {
  pool: RoleId[];
  poolId?: string | null;
  onChange: (patch: Partial<SetupDraft>) => void;
}

/**
 * Role Pool step: choose which roles this game may use — by loading a saved pool or by
 * ticking roles — and optionally save the selection. The Deck step and auto-balance only
 * draw from this pool.
 */
export function PoolSelection({ pool, poolId, onChange }: PoolSelectionProps) {
  const { t } = useI18n();
  const { profile } = useAuth();
  const pools = profile?.pools ?? [];
  const [saving, setSaving] = useState(false);
  const allSelected = ROLE_ORDER.every((id) => pool.includes(id));

  // Tapping the active pool again deselects it (and clears its roles).
  const toggleSaved = (p: RolePool) =>
    p.id === poolId
      ? onChange({ pool: [...ALWAYS_IN_POOL], poolId: null, poolName: null })
      : onChange({ pool: withFillers(p.roles), poolId: p.id, poolName: p.name });
  // Any manual change makes it a custom pool again.
  const setRoles = (roles: RoleId[]) => onChange({ pool: withFillers(roles), poolId: null, poolName: null });

  return (
    <div className="space-y-5">
      <div>
        <SectionTitle aside={<span className="text-xs text-bone-faint">{pools.length}/{MAX_POOLS}</span>}>{t('pools.mine')}</SectionTitle>
        {pools.length === 0 ? (
          <p className="rounded-xl border border-dashed border-panel-edge p-4 text-sm text-bone-faint">{t('pools.none')}</p>
        ) : (
          <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {pools.map((p) => (
              <SavedPoolButton key={p.id} pool={p} selected={p.id === poolId} onClick={() => toggleSaved(p)} />
            ))}
          </div>
        )}
      </div>

      <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-2 border-y border-panel-edge bg-ink/95 px-4 py-3">
        <span className="whitespace-nowrap font-display text-sm tracking-wide text-bone">{t('pools.selected', { count: pool.length })}</span>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="plain"
          className="whitespace-nowrap"
          onClick={() => setRoles(allSelected ? [] : [...ROLE_ORDER])}
          icon={allSelected ? <X className="h-4 w-4" /> : <CheckCheck className="h-4 w-4" />}
        >
          {allSelected ? t('pools.deselectAll') : t('pools.selectAll')}
        </Button>
        <Button size="sm" variant="village" className="whitespace-nowrap" onClick={() => setSaving(true)} icon={<Save className="h-4 w-4" />}>
          {t('pools.save')}
        </Button>
      </div>

      <p className="text-xs text-bone-faint">{t('pools.hint')}</p>
      <RoleGrid mode="select" selected={withFillers(pool)} onSelected={setRoles} sectionToggles={['village', 'wolves']} />

      <SavePoolSheet
        open={saving}
        roles={pool}
        currentId={poolId ?? null}
        onClose={() => setSaving(false)}
        onSaved={(saved) => onChange({ poolId: saved.id, poolName: saved.name })}
      />
    </div>
  );
}

function SavedPoolButton({ pool, selected, onClick }: { pool: RolePool; selected: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        'press relative flex w-56 shrink-0 snap-start flex-col gap-2 rounded-2xl border bg-panel-gradient p-3 text-left',
        selected ? 'border-village shadow-inner-village' : 'border-panel-edge',
      )}
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold tracking-wide text-bone">{pool.name}</span>
        {selected && <Check className="h-4 w-4 text-village" />}
      </span>
      <span className="flex -space-x-2">
        {pool.roles.slice(0, 7).map((r) => (
          <RoleBadge key={r} roleId={r} size={26} />
        ))}
        {pool.roles.length > 7 && <span className="pl-3 text-xs text-bone-faint">+{pool.roles.length - 7}</span>}
      </span>
      <span className="text-xs text-bone-dim">{t('pools.roleCount', { count: pool.roles.length })}</span>
    </button>
  );
}

/** Asks for a name and whether to save as a new pool or replace an existing one. */
function SavePoolSheet({
  open,
  roles,
  currentId,
  onClose,
  onSaved,
}: {
  open: boolean;
  roles: RoleId[];
  currentId: string | null;
  onClose: () => void;
  onSaved: (pool: RolePool) => void;
}) {
  const { t } = useI18n();
  const { profile, savePool } = useAuth();
  const pools = profile?.pools ?? [];
  const full = pools.length >= MAX_POOLS;
  const [name, setName] = useState('');
  const [target, setTarget] = useState<string>('new');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const current = pools.find((p) => p.id === currentId);
    // Default: replace the pool this selection came from, or a new one if there's room.
    const initial = current?.id ?? (full ? (pools[0]?.id ?? 'new') : 'new');
    setTarget(initial);
    setName(current?.name ?? pools.find((p) => p.id === initial)?.name ?? '');
    setError(null);
  }, [open]);

  const pick = (id: string) => {
    setTarget(id);
    const existing = pools.find((p) => p.id === id);
    if (existing) setName(existing.name);
  };

  const save = async () => {
    const now = new Date().toISOString();
    const existing = pools.find((p) => p.id === target);
    const pool: RolePool = {
      id: existing?.id ?? createId('pool'),
      name: name.trim() || t('pools.untitled'),
      roles: withFillers(roles),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await savePool(pool);
      onSaved(pool);
      onClose();
    } catch (err) {
      setError(t('pools.saveError', { error: err instanceof Error ? err.message : String(err) }));
    }
  };

  const option = (id: string, label: string, disabled = false) => (
    <button
      key={id}
      type="button"
      role="radio"
      aria-checked={target === id}
      disabled={disabled}
      onClick={() => pick(id)}
      className={clsx(
        'press flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40',
        target === id ? 'border-village bg-village/10 text-bone' : 'border-panel-edge bg-panel-2 text-bone-dim',
      )}
    >
      <span className={clsx('h-4 w-4 shrink-0 rounded-full border-2', target === id ? 'border-village bg-village' : 'border-bone-faint')} />
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <Sheet open={open} onClose={onClose} title={t('pools.save')} closeLabel={t('settings.close')}>
      <div className="space-y-4 pb-5">
        <label className="block">
          <span className="mb-1.5 block font-display text-xs tracking-wide text-bone-dim">{t('pools.name')}</span>
          <input
            autoFocus
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('pools.namePlaceholder')}
            className="min-h-12 w-full rounded-xl border border-panel-edge bg-ink px-3 text-base text-bone placeholder:text-bone-faint focus:border-village focus:outline-none"
          />
        </label>
        <div role="radiogroup" className="space-y-2">
          {option('new', t('pools.saveAsNew'), full)}
          {full && <p className="text-xs text-bone-faint">{t('pools.limit', { max: MAX_POOLS })}</p>}
          {pools.length > 0 && <p className="pt-1 font-display text-xs tracking-wide text-bone-dim">{t('pools.overwrite')}</p>}
          {pools.map((p) => option(p.id, p.name))}
        </div>
        {error && <p className="text-xs text-wolf-bright">{error}</p>}
        <div className="flex gap-3">
          <Button onClick={onClose}>{t('pools.cancel')}</Button>
          <Button variant="village" block onClick={() => void save()} icon={<Save className="h-4 w-4" />}>
            {t('pools.save')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
