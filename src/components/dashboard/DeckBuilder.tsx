import { useAutoAnimate } from '@formkit/auto-animate/react';
import clsx from 'clsx';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { MAX_DECKS, type Deck } from '../../@types/game';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { calculateBalance, createId, EXPERIENCE_TARGET, sortDeck, validateDeck } from '../../utils/gameCalculations';
import { BalanceMeter } from '../shared/BalanceMeter';
import { RoleCountGrid } from '../shared/RoleCountGrid';
import { Button, RoleBadge, SectionTitle } from '../shared/ui';

/** Deck studio: build, edit and store up to MAX_DECKS role presets. */
export function DeckBuilder() {
  const { t } = useI18n();
  const { profile, saveDeck, deleteDeck } = useAuth();
  const decks = profile?.decks ?? [];
  const [draft, setDraft] = useState<Deck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listRef] = useAutoAnimate<HTMLUListElement>({ duration: 220 });

  const startNew = () => {
    const now = new Date().toISOString();
    setDraft({ id: createId('deck'), name: '', roles: [], createdAt: now, updatedAt: now });
    setError(null);
  };

  const save = async () => {
    if (!draft) return;
    try {
      await saveDeck({ ...draft, name: draft.name.trim() || t('decks.untitled'), roles: sortDeck(draft.roles), updatedAt: new Date().toISOString() });
      setDraft(null);
    } catch (err) {
      setError(t('decks.saveError', { error: err instanceof Error ? err.message : String(err) }));
    }
  };

  const remove = async (deck: Deck) => {
    if (window.confirm(t('decks.deleteConfirm', { name: deck.name }))) await deleteDeck(deck.id);
  };

  if (draft) {
    const issues = draft.roles.length ? validateDeck(draft.roles, draft.roles.length) : [];
    return (
      <div className="mx-auto max-w-3xl space-y-5 px-4 pb-28 pt-4">
        <label className="block animate-step-in">
          <span className="mb-1.5 block font-display text-xs uppercase tracking-grimoire text-bone-dim">{t('decks.name')}</span>
          <input
            value={draft.name}
            maxLength={40}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={t('decks.namePlaceholder')}
            className="min-h-12 w-full rounded-xl border border-panel-edge bg-ink px-3 text-lg text-bone placeholder:text-bone-faint focus:border-village focus:outline-none"
          />
        </label>
        <div className="sticky top-14 z-20 -mx-4 bg-ink/95 px-4 pb-3 pt-1 backdrop-blur">
          <BalanceMeter sum={calculateBalance(draft.roles)} target={EXPERIENCE_TARGET.standard} />
          <p className="mt-2 font-display text-sm uppercase tracking-grimoire text-bone">{t('decks.cards', { count: draft.roles.length })}</p>
        </div>
        <RoleCountGrid deck={draft.roles} onDeck={(roles) => setDraft({ ...draft, roles })} />

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-panel-edge bg-ink/95 pb-safe pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4">
            <Button onClick={() => setDraft(null)}>{t('decks.cancel')}</Button>
            <p className="min-w-0 flex-1 truncate text-xs text-ember">{error ?? (issues[0] ? t(issues[0].key as 'issue.noThreat', issues[0].params) : '')}</p>
            <Button variant="village" disabled={draft.roles.length === 0} onClick={() => void save()} icon={<Save className="h-4 w-4" />}>
              {t('decks.save')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-16 pt-6">
      <SectionTitle aside={<span className="text-xs text-bone-faint">{decks.length}/{MAX_DECKS}</span>}>{t('decks.title')}</SectionTitle>
      {decks.length === 0 && <p className="rounded-xl border border-dashed border-panel-edge p-6 text-center text-sm text-bone-faint">{t('decks.empty')}</p>}
      <ul ref={listRef} className="space-y-3">
        {decks.map((deck) => {
          const sum = calculateBalance(deck.roles);
          const unique = [...new Set(deck.roles)];
          return (
            <li key={deck.id} className="panel flex animate-step-in items-center gap-3 border border-panel-edge p-3">
              <div className="min-w-0 flex-1 space-y-2">
                <p className="truncate font-display text-base font-semibold uppercase tracking-grimoire text-bone">{deck.name}</p>
                <div className="flex flex-wrap gap-1">
                  {unique.map((r) => (
                    <RoleBadge key={r} roleId={r} size={28} />
                  ))}
                </div>
                <p className="text-xs text-bone-dim">
                  {t('decks.cards', { count: deck.roles.length })} ·{' '}
                  <span className={clsx('font-semibold', sum > 2 ? 'text-village' : sum < -2 ? 'text-wolf-bright' : 'text-bone')}>
                    {sum > 0 ? `+${sum}` : sum}
                  </span>
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button size="sm" onClick={() => setDraft(deck)} icon={<Pencil className="h-4 w-4" />}>
                  {t('decks.edit')}
                </Button>
                <Button size="sm" variant="plain" onClick={() => void remove(deck)} icon={<Trash2 className="h-4 w-4" />}>
                  {t('decks.delete')}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <Button variant="village" size="lg" block disabled={decks.length >= MAX_DECKS} onClick={startNew} icon={<Plus className="h-5 w-5" />}>
        {t('decks.new')}
      </Button>
      {decks.length >= MAX_DECKS && <p className="text-center text-xs text-bone-faint">{t('decks.limit', { max: MAX_DECKS })}</p>}
    </div>
  );
}
