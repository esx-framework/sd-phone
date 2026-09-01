import { Footprints, Trophy } from 'lucide-react';

import { t } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import type { HealthBoard } from './healthApi';

const MEDAL = ['#FFD54F', '#C7CCD1', '#CD8E5A'];
const ACCENT = '#FB8C00';

export function LeaderboardTab({ board }: { board: HealthBoard | null }) {
    const entries = board?.entries ?? [];
    const mine    = entries.find(e => e.you);

    if (board === null) return <div className="px-3 pb-4 pt-1" />;

    if (entries.length === 0) {
        return (
            <div className="px-3 pb-4 pt-1">
                <EmptyState
                    icon={Trophy}
                    title={t('health.boardEmptyTitle', 'Nobody has moved yet')}
                    subtitle={t('health.boardEmptyBody', 'Steps counted today show up here. Go for a walk.')}
                />
            </div>
        );
    }

    const peak = Math.max(1, ...entries.map(e => e.steps));

    return (
        <div className="px-3 pb-4 pt-1">
            <div className="rounded-[18px] bg-surface px-4 py-4">
                <div className="flex items-center gap-1.5 text-[17px] font-semibold" style={{ color: ACCENT }}>
                    <Trophy className="h-[17px] w-[17px]" strokeWidth={2.5} />
                    <span>{t('health.boardTitle', "Today's Steps")}</span>
                </div>

                <div className="mt-3 flex flex-col">
                    {entries.map(entry => (
                        <Row key={`${entry.rank}-${entry.name}`} entry={entry} peak={peak} />
                    ))}
                </div>

                <p className="mt-3 border-t border-black/5 pt-3 text-center text-[13px] text-ios-gray dark:border-white/10">
                    {t('health.boardResets', 'Resets at midnight')}
                </p>
            </div>

            {board && !mine && (
                <div className="mt-2.5 rounded-[16px] bg-surface px-4 py-3.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[17px] font-semibold">{t('health.yourStanding', 'Your standing')}</span>
                        <span className="text-[17px] font-semibold tabular-nums" style={{ color: ACCENT }}>
                            {board.rank ? t('health.rankNum', '#{n}', { n: board.rank }) : t('health.unranked', 'Unranked')}
                        </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-[30px] font-semibold tabular-nums">{board.steps.toLocaleString()}</span>
                        <span className="text-[15px] text-ios-gray">{t('health.stepsUnit', 'steps')}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function Row({ entry, peak }: { entry: { rank: number; name: string; steps: number; you: boolean }; peak: number }) {
    const medal = entry.rank <= 3 ? MEDAL[entry.rank - 1] : null;

    return (
        <div className={`relative overflow-hidden rounded-[12px] px-2.5 py-2.5 ${entry.you ? 'bg-ios-blue/12' : ''}`}>
            <div
                className="absolute inset-y-0 left-0 rounded-[12px]"
                style={{ width: `${(entry.steps / peak) * 100}%`, background: ACCENT, opacity: 0.12 }}
            />
            <div className="relative flex items-center gap-3">
                <span className="flex w-7 shrink-0 items-center justify-center">
                    {medal ? (
                        <span
                            className="flex h-[24px] w-[24px] items-center justify-center rounded-full text-[14px] font-bold tabular-nums"
                            style={{ background: medal, color: '#1c1c1e' }}
                        >
                            {entry.rank}
                        </span>
                    ) : (
                        <span className="text-[16px] font-bold tabular-nums">{entry.rank}</span>
                    )}
                </span>
                <span className={`min-w-0 flex-1 truncate text-[17px] ${entry.you ? 'font-bold' : 'font-medium'}`}>
                    {entry.you ? t('health.you', 'You') : entry.name}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[17px] font-semibold tabular-nums">
                    <Footprints className="h-[15px] w-[15px] text-ios-gray" strokeWidth={2.5} />
                    {entry.steps.toLocaleString()}
                </span>
            </div>
        </div>
    );
}
