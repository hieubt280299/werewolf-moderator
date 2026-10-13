import clsx from 'clsx';
import { Check, Eraser, Save, Shuffle } from 'lucide-react';
import { useState } from 'react';
import { MAX_DECKS, type Deck, type ExperienceLevel, type RoleId, type SetupDraft } from '../../@types/game';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { calculateBalance, createId, EXPERIENCE_TARGET, generateBalancedDeck, sortDeck } from '../../utils/gameCalculations';
import { BalanceMeter } from '../shared/BalanceMeter';
import { RoleCountGrid } from '../shared/RoleCountGrid';
import { Button, RoleBadge, SectionTitle } from '../shared/ui';

interface DeckSelectionProps {
  deck: RoleId[];
  pool: RoleId[];
  deckId?: string | null;
  playerCount: number;
  experience: ExperienceLevel;
  onChange: (patch: Partial<SetupDraft>) => void;
}

const specialsOf = (roles: RoleId[]) => [...new Set(roles)].filter((r) => r !== 'villager' && r !== 'werewolf');

/**
 * Deck picker for game setup: load one of the moderator's saved presets, or compose a
 * role pool on the fly (manual counts or auto-balance) and optionally save it.
 */
export function DeckSelection({ deck, pool, deckId, playerCount, experience, onChange }: DeckSelectionProps) {
  const { t } = useI18n();
  const { profile, saveDeck } = useAuth();
  const decks = profile?.decks ?? [];
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = (d: Deck) => onChange({ deck: sortDeck(d.roles), deckId: d.id, deckName: d.name, pool: specialsOf(d.roles) });
  // Any manual edit turns the setup back into a custom pool.
  const edit = (patch: Partial<SetupDraft>) => onChange({ ...patch, deckId: null, deckName: null });

  const save = async () => {
    const deckName = name.trim() || t('decks.untitled');
    const now = new Date().toISOString();
    const saved: Deck = { id: createId('deck'), name: deckName, roles: sortDeck(deck), createdAt: now, updatedAt: now };
    try {
      await saveDeck(saved);
      onChange({ deckId: saved.id, deckName });
      setNaming(false);
      setName('');
      setError(null);
    } catch (err) {
      setError(t('decks.saveError', { error: err instanceof Error ? err.message : String(err) }));
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <SectionTitle aside={<span className="text-xs text-bone-faint">{decks.length}/{MAX_DECKS}</span>}>{t('deckSel.saved')}</SectionTitle>
        {decks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-panel-edge p-4 text-sm text-bone-faint">{t('deckSel.none')}</p>
        ) : (
          <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {decks.map((d) => (
              <SavedDeckButton key={d.id} deck={d} selected={d.id === deckId} playerCount={playerCount} onClick={() => load(d)} />
            ))}
          </div>
        )}
      </div>

      <div className="sticky top-14 z-20 -mx-4 bg-ink/95 px-4 pb-3 pt-1 backdrop-blur">
        <BalanceMeter sum={calculateBalance(deck)} target={EXPERIENCE_TARGET[experience]} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={clsx('font-display text-sm uppercase tracking-grimoire', deck.length === playerCount ? 'text-bone' : 'text-ember')}>
            {t('setup.cards', { cards: deck.length, players: playerCount })}
          </span>
          <div className="flex-1" />
          <Button size="sm" variant="plain" onClick={() => edit({ deck: [] })} icon={<Eraser className="h-4 w-4" />}>
            {t('setup.clearDeck')}
          </Button>
          <Button
            size="sm"
            variant="village"
            onClick={() => edit({ deck: generateBalancedDeck({ playerCount, pool, experience }) })}
            icon={<Shuffle className="h-4 w-4" />}
          >
            {t('setup.autoBalance')}
          </Button>
        </div>
      </div>

      <div>
        <SectionTitle
          aside={
            !deckId &&
            deck.length > 0 &&
            !naming && (
              <Button size="sm" disabled={decks.length >= MAX_DECKS} onClick={() => setNaming(true)} icon={<Save className="h-4 w-4" />}>
                {t('deckSel.saveAs')}
              </Button>
            )
          }
        >
          {t('deckSel.custom')}
        </SectionTitle>
        {naming && (
          <div className="mb-4 flex animate-step-in gap-2">
            <input
              autoFocus
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void save()}
              placeholder={t('decks.namePlaceholder')}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-panel-edge bg-ink px-3 text-bone placeholder:text-bone-faint focus:border-village focus:outline-none"
            />
            <Button variant="village" onClick={() => void save()}>
              {t('decks.save')}
            </Button>
            <Button variant="plain" onClick={() => setNaming(false)}>
              {t('decks.cancel')}
            </Button>
          </div>
        )}
        {decks.length >= MAX_DECKS && !deckId && <p className="mb-3 text-xs text-bone-faint">{t('decks.limit', { max: MAX_DECKS })}</p>}
        {error && <p className="mb-3 text-xs text-wolf-bright">{error}</p>}
        <p className="mb-4 text-xs text-bone-faint">{t('setup.poolHint')}</p>
        <RoleCountGrid deck={deck} onDeck={(next) => edit({ deck: next })} pool={pool} onPool={(next) => onChange({ pool: next })} />
      </div>
    </div>
  );
}

function SavedDeckButton({ deck, selected, playerCount, onClick }: { deck: Deck; selected: boolean; playerCount: number; onClick: () => void }) {
  const { t } = useI18n();
  const sum = calculateBalance(deck.roles);
  const fits = deck.roles.length === playerCount;
  const unique = [...new Set(deck.roles)];
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
        <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold uppercase tracking-grimoire text-bone">{deck.name}</span>
        {selected && <Check className="h-4 w-4 text-village" />}
      </span>
      <span className="flex -space-x-2">
        {unique.slice(0, 7).map((r) => (
          <RoleBadge key={r} roleId={r} size={26} />
        ))}
        {unique.length > 7 && <span className="pl-3 text-xs text-bone-faint">+{unique.length - 7}</span>}
      </span>
      <span className="flex items-center justify-between text-xs">
        <span className={fits ? 'text-village' : 'text-ember'}>
          {fits ? t('deckSel.fits', { players: playerCount }) : t('deckSel.mismatch', { cards: deck.roles.length })}
        </span>
        <span className={clsx('font-display font-semibold', sum > 2 ? 'text-village' : sum < -2 ? 'text-wolf-bright' : 'text-bone')}>
          {sum > 0 ? `+${sum}` : sum}
        </span>
      </span>
    </button>
  );
}

