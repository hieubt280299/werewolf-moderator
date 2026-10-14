import { useAutoAnimate } from '@formkit/auto-animate/react';
import { CheckCheck, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { MAX_POOLS, type RolePool } from '../../@types/game';
import { useAuth } from '../../context/AuthContext';
import { ALWAYS_IN_POOL, ROLE_ORDER, withFillers } from '../../data/roles';
import { useI18n } from '../../i18n/I18nContext';
import { createId } from '../../utils/gameCalculations';
import { RoleGrid } from '../shared/RoleGrid';
import { Button, RoleBadge, SectionTitle } from '../shared/ui';

/** Custom role pools: build, edit and store up to MAX_POOLS named sets of roles. */
export function PoolBuilder() {
  const { t } = useI18n();
  const { profile, savePool, deletePool } = useAuth();
  const pools = profile?.pools ?? [];
  const [draft, setDraft] = useState<RolePool | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listRef] = useAutoAnimate<HTMLUListElement>({ duration: 220 });

  const startNew = () => {
    const now = new Date().toISOString();
    setDraft({ id: createId('pool'), name: '', roles: [...ALWAYS_IN_POOL], createdAt: now, updatedAt: now });
    setError(null);
  };

  const save = async () => {
    if (!draft) return;
    try {
      await savePool({ ...draft, name: draft.name.trim() || t('pools.untitled'), roles: withFillers(draft.roles), updatedAt: new Date().toISOString() });
      setDraft(null);
    } catch (err) {
      setError(t('pools.saveError', { error: err instanceof Error ? err.message : String(err) }));
    }
  };

  const remove = async (pool: RolePool) => {
    if (window.confirm(t('pools.deleteConfirm', { name: pool.name }))) await deletePool(pool.id);
  };

  if (draft) {
    const allSelected = ROLE_ORDER.every((id) => draft.roles.includes(id));
    return (
      <div className="mx-auto max-w-3xl space-y-5 px-4 pb-28 pt-4">
        <label className="block animate-step-in">
          <span className="mb-1.5 block font-display text-xs uppercase tracking-grimoire text-bone-dim">{t('pools.name')}</span>
          <input
            value={draft.name}
            maxLength={40}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={t('pools.namePlaceholder')}
            className="min-h-12 w-full rounded-xl border border-panel-edge bg-ink px-3 text-lg text-bone placeholder:text-bone-faint focus:border-village focus:outline-none"
          />
        </label>
        <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-2 border-y border-panel-edge bg-ink/95 px-4 py-3 backdrop-blur">
          <span className="whitespace-nowrap font-display text-sm uppercase tracking-grimoire text-bone">{t('pools.selected', { count: draft.roles.length })}</span>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="plain"
            className="whitespace-nowrap"
            onClick={() => setDraft({ ...draft, roles: allSelected ? [...ALWAYS_IN_POOL] : [...ROLE_ORDER] })}
            icon={allSelected ? <X className="h-4 w-4" /> : <CheckCheck className="h-4 w-4" />}
          >
            {allSelected ? t('pools.deselectAll') : t('pools.selectAll')}
          </Button>
        </div>
        <RoleGrid
          mode="select"
          selected={withFillers(draft.roles)}
          onSelected={(roles) => setDraft({ ...draft, roles: withFillers(roles) })}
          sectionToggles={['village', 'wolves']}
        />

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-panel-edge bg-ink/95 pb-safe pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4">
            <Button onClick={() => setDraft(null)}>{t('pools.cancel')}</Button>
            <p className="min-w-0 flex-1 truncate text-xs text-ember">{error}</p>
            <Button variant="village" onClick={() => void save()} icon={<Save className="h-4 w-4" />}>
              {t('pools.save')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-16 pt-6">
      <SectionTitle aside={<span className="text-xs text-bone-faint">{pools.length}/{MAX_POOLS}</span>}>{t('pools.title')}</SectionTitle>
      {pools.length === 0 && <p className="rounded-xl border border-dashed border-panel-edge p-6 text-center text-sm text-bone-faint">{t('pools.empty')}</p>}
      <ul ref={listRef} className="space-y-3">
        {pools.map((pool) => (
          <li key={pool.id} className="panel flex animate-step-in items-center gap-3 border border-panel-edge p-3">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="truncate font-display text-base font-semibold uppercase tracking-grimoire text-bone">{pool.name}</p>
              <div className="flex flex-wrap gap-1">
                {pool.roles.map((r) => (
                  <RoleBadge key={r} roleId={r} size={28} />
                ))}
              </div>
              <p className="text-xs text-bone-dim">{t('pools.roleCount', { count: pool.roles.length })}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={() => setDraft(pool)} icon={<Pencil className="h-4 w-4" />}>
                {t('pools.edit')}
              </Button>
              <Button size="sm" variant="plain" onClick={() => void remove(pool)} icon={<Trash2 className="h-4 w-4" />}>
                {t('pools.delete')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="village" size="lg" block disabled={pools.length >= MAX_POOLS} onClick={startNew} icon={<Plus className="h-5 w-5" />}>
        {t('pools.new')}
      </Button>
      {pools.length >= MAX_POOLS && <p className="text-center text-xs text-bone-faint">{t('pools.limit', { max: MAX_POOLS })}</p>}
    </div>
  );
}
