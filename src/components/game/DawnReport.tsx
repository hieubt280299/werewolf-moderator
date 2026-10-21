import { Bandage, DoorOpen, Droplet, EyeOff, Flame, Heart, HeartPulse, Megaphone, PawPrint, Swords, VolumeX } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import type { NightReport } from '../../@types/game';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useI18n } from '../../i18n/I18nContext';
import { roleFaction } from '../../data/roles';
import { TONES } from '../shared/tones';
import { Chip, RoleBadge } from '../shared/ui';

/**
 * Morning summary: public announcements first, moderator-only secrets below.
 * Deaths are announced without the cause (the village shouldn't learn who killed);
 * the row is tinted by the victim's side so the moderator can reveal it if their table does.
 */
export function DawnReport({ report }: { report: NightReport }) {
  const { t } = useI18n();
  const { byId, playMetallic, state } = useGameEngine();

  // The Wolverine's tell is heard by everyone — play it once when the report opens.
  useEffect(() => {
    if (report.metallic) playMetallic();
  }, [report.metallic, report.round, playMetallic]);
  const name = (id: string | null) => (id ? byId.get(id)?.name ?? '?' : '');

  const secrets: { icon: ReactNode; text: string }[] = [
    ...report.saved.map((id) => ({ icon: <HeartPulse className="h-4 w-4 text-village" />, text: t('dawn.saved', { name: name(id) }) })),
    ...report.transformed.map((id) => ({ icon: <PawPrint className="h-4 w-4 text-wolf-bright" />, text: t('dawn.transformed', { name: name(id) }) })),
    ...(report.vampireMarked ? [{ icon: <Droplet className="h-4 w-4 text-vampire" />, text: t('dawn.vampire', { name: name(report.vampireMarked) }) }] : []),
    ...(report.recruited ? [{ icon: <Flame className="h-4 w-4 text-cult" />, text: t('dawn.recruited', { name: name(report.recruited) }) }] : []),
    ...(report.lovers?.length === 2
      ? [{ icon: <Heart className="h-4 w-4 text-vampire" />, text: t('dawn.lovers', { name: name(report.lovers[0]), name2: name(report.lovers[1]) }) }]
      : []),
    ...(report.wounded ?? []).map((id) => ({ icon: <Bandage className="h-4 w-4 text-ember" />, text: t('dawn.wounded', { name: name(id) }) })),
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-ember">
          <Megaphone className="h-3.5 w-3.5" /> {t('dawn.announce')}
        </p>
        <ul className="space-y-2">
          {report.deaths.length === 0 && (
            <li className="animate-step-in rounded-xl border border-village/30 bg-village/5 px-4 py-3 text-bone">
              {t('dawn.peaceful')}
            </li>
          )}
          {report.deaths.map((d) => {
            const player = byId.get(d.playerId);
            if (!player) return null;
            // Tinted by the side the victim played for (the reworked Tanner is a Villager).
            const faction = roleFaction(player.roleId, state.rules);
            const tone = TONES[faction];
            return (
              <li
                key={d.playerId}
                className="animate-step-in flex items-center gap-3 rounded-xl border px-3 py-2.5"
                style={{ borderColor: `${tone.accent}80`, background: `${tone.accent}14`, boxShadow: tone.inner }}
              >
                <RoleBadge roleId={player.roleId} size={36} dead />
                <span className="min-w-0 flex-1 font-semibold text-bone text-shadow-crisp">{t('dawn.died', { name: player.name })}</span>
                <Chip tone={faction}>{t(`role.${player.roleId}.name`)}</Chip>
              </li>
            );
          })}
          {report.metallic && (
            <li className="animate-step-in flex items-center gap-3 rounded-xl border border-wolf/40 bg-wolf/10 px-4 py-3">
              <Swords className="h-5 w-5 shrink-0 text-wolf-bright" />
              <span className="italic text-bone">{t('dawn.metallic')}</span>
            </li>
          )}
          {report.banished && (
            <li className="animate-step-in flex items-center gap-3 rounded-xl border border-[#C48A3F]/40 bg-[#C48A3F]/10 px-4 py-3">
              <DoorOpen className="h-5 w-5 shrink-0 text-[#D9A35A]" />
              <span className="text-bone">{t('dawn.banished', { name: name(report.banished) })}</span>
            </li>
          )}
          {report.silenced && (
            <li className="animate-step-in flex items-center gap-3 rounded-xl border border-ember/40 bg-ember/10 px-4 py-3">
              <VolumeX className="h-5 w-5 shrink-0 text-ember" />
              <span className="text-bone">{t('dawn.silenced', { name: name(report.silenced) })}</span>
            </li>
          )}
        </ul>
      </div>

      {secrets.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-bone-faint">
            <EyeOff className="h-3.5 w-3.5" /> {t('dawn.secret')}
          </p>
          <ul className="space-y-1.5">
            {secrets.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-bone-dim">
                {s.icon}
                {s.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
