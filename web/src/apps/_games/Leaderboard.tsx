import { useState } from 'react';
import { Cpu, TrendingDown, TrendingUp, Trophy, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ChipLeaderEntry, GameLeaderboard, LeaderEntry, ScoreEntry } from './statsApi';
import { t } from '@/i18n';

const MEDAL = ['#FFD54F', '#C7CCD1', '#CD8E5A'];
const fmt = (n: number) => Math.abs(n).toLocaleString('en-US');

export function Leaderboard({ data, scores, loading, accent, variant = 'wl', cpuLabel }: {
    data?: GameLeaderboard | null;
    scores?: ScoreEntry[] | null;
    loading: boolean;
    accent: string;
    variant?: 'wl' | 'chips' | 'score';
    cpuLabel?: string;
}) {
    if (variant === 'score') return <ScoreBoard data={scores ?? null} loading={loading} accent={accent} />;
    return variant === 'chips'
        ? <ChipBoard data={data ?? null} loading={loading} accent={accent} />
        : <WinLossBoard data={data ?? null} loading={loading} accent={accent} cpuLabel={cpuLabel} />;
}

function WinLossBoard({ data, loading, accent, cpuLabel }: { data: GameLeaderboard | null; loading: boolean; accent: string; cpuLabel?: string }) {
    const [tab, setTab] = useState<'cpu' | 'online'>('cpu');
    const entries = (tab === 'cpu' ? data?.cpu : data?.online) ?? [];

    return (
        <Frame
            accent={accent}
            tab={tab}
            onTab={setTab}
            options={[{ v: 'cpu', label: cpuLabel ?? t('games.computer', 'Computer'), Icon: Cpu }, { v: 'online', label: t('games.players', 'Players'), Icon: Users }]}
            loading={loading}
            empty={entries.length === 0}
            head={<><span className="w-9 text-end">W</span><span className="w-9 text-end">L</span></>}
        >
            {entries.map((e, i) => <WlRow key={i} rank={i} entry={e} />)}
        </Frame>
    );
}

function ChipBoard({ data, loading, accent }: { data: GameLeaderboard | null; loading: boolean; accent: string }) {
    const [tab, setTab] = useState<'winners' | 'losers'>('winners');
    const entries = (tab === 'winners' ? data?.winners : data?.losers) ?? [];

    return (
        <Frame
            accent={accent}
            tab={tab}
            onTab={setTab}
            options={[{ v: 'winners', label: t('games.winners', 'Winners'), Icon: TrendingUp }, { v: 'losers', label: t('games.losers', 'Losers'), Icon: TrendingDown }]}
            loading={loading}
            empty={entries.length === 0}
            head={<span className="w-24 text-end">{t('games.netChips', 'Net chips')}</span>}
        >
            {entries.map((e, i) => <ChipRow key={i} rank={i} entry={e} />)}
        </Frame>
    );
}

function ScoreBoard({ data, loading, accent }: { data: ScoreEntry[] | null; loading: boolean; accent: string }) {
    const entries = data ?? [];
    return (
        <div className="flex min-h-0 flex-1 flex-col px-4 pt-3 pb-10">
            <div
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-[11px] py-2.5 text-[15px] font-bold text-white"
                style={{ background: accent, boxShadow: '0 1px 3px rgba(0,0,0,0.35)' }}
            >
                <Trophy className="h-[16px] w-[16px]" strokeWidth={2.3} /> {t('games.highScores', 'High scores')}
            </div>
            <div className="mt-3 flex min-h-0 flex-1 flex-col">
                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto rounded-[14px] px-2 py-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    {loading ? (
                        <Note text={t('games.loading', 'Loading…')} />
                    ) : entries.length === 0 ? (
                        <Note text={t('games.noScoresYet', 'No scores yet')} />
                    ) : (
                        <>
                            <div className="flex items-center gap-2 px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/35">
                                <span className="w-6 shrink-0 text-center">#</span>
                                <span className="flex-1">{t('games.player', 'Player')}</span>
                                <span className="w-24 text-end">{t('games.score', 'Score')}</span>
                            </div>
                            {entries.map((e, i) => <ScoreRow key={i} rank={i} entry={e} />)}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function Frame<T extends string>({ accent, tab, onTab, options, loading, empty, head, children }: {
    accent: string; tab: T; onTab: (v: T) => void; options: { v: T; label: string; Icon: LucideIcon }[];
    loading: boolean; empty: boolean; head: React.ReactNode; children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-0 flex-1 flex-col px-4 pt-3 pb-10">
            <div className="flex shrink-0 rounded-[11px] p-[3px]" style={{ background: 'rgba(0,0,0,0.3)' }}>
                {options.map(o => {
                    const active = tab === o.v;
                    return (
                        <button
                            key={o.v}
                            type="button"
                            onClick={() => onTab(o.v)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-2 text-[15px] font-bold transition-colors"
                            style={{ background: active ? accent : 'transparent', color: active ? '#fff' : 'rgba(255,255,255,0.65)', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.35)' : undefined }}
                        >
                            <o.Icon className="h-[16px] w-[16px]" strokeWidth={2.3} /> {o.label}
                        </button>
                    );
                })}
            </div>

            <div key={tab} className="mt-3 flex min-h-0 flex-1 flex-col animate-swipe-in-left">
                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto rounded-[14px] px-2 py-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    {loading ? (
                        <Note text={t('games.loading', 'Loading…')} />
                    ) : empty ? (
                        <Note text={t('games.noGamesYet', 'No games played yet')} />
                    ) : (
                        <>
                            <div className="flex items-center gap-2 px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/35">
                                <span className="w-6 shrink-0 text-center">#</span>
                                <span className="flex-1">{t('games.player', 'Player')}</span>
                                {head}
                            </div>
                            {children}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function WlRow({ rank, entry }: { rank: number; entry: LeaderEntry }) {
    return (
        <div className="flex items-center gap-2 rounded-[9px] px-2 py-2.5 text-[15px]" style={{ background: rank % 2 ? 'rgba(255,255,255,0.035)' : 'transparent' }}>
            <Rank rank={rank} />
            <span dir="auto" className="flex-1 truncate font-semibold text-white/90">{entry.name || t('games.unknown', 'Unknown')}</span>
            <span className="w-9 text-end font-bold text-[#9CCC65]">{entry.wins}</span>
            <span className="w-9 text-end font-bold text-[#FF8A80]">{entry.losses}</span>
        </div>
    );
}

function ChipRow({ rank, entry }: { rank: number; entry: ChipLeaderEntry }) {
    const up = entry.net >= 0;
    return (
        <div className="flex items-center gap-2 rounded-[9px] px-2 py-2.5 text-[15px]" style={{ background: rank % 2 ? 'rgba(255,255,255,0.035)' : 'transparent' }}>
            <Rank rank={rank} />
            <span dir="auto" className="flex-1 truncate font-semibold text-white/90">{entry.name || t('games.unknown', 'Unknown')}</span>
            <span dir="ltr" className="w-24 text-end font-extrabold tabular-nums" style={{ color: up ? '#9CCC65' : '#FF8A80' }}>
                {up ? '+' : '-'}{fmt(entry.net)}
            </span>
        </div>
    );
}

function ScoreRow({ rank, entry }: { rank: number; entry: ScoreEntry }) {
    return (
        <div className="flex items-center gap-2 rounded-[9px] px-2 py-2.5 text-[15px]" style={{ background: rank % 2 ? 'rgba(255,255,255,0.035)' : 'transparent' }}>
            <Rank rank={rank} />
            <span dir="auto" className="flex-1 truncate font-semibold text-white/90">{entry.name || t('games.unknown', 'Unknown')}</span>
            <span className="w-24 text-end font-extrabold tabular-nums text-white">{entry.score.toLocaleString('en-US')}</span>
        </div>
    );
}

function Rank({ rank }: { rank: number }) {
    return <span className="w-6 shrink-0 text-center text-[15px] font-extrabold" style={{ color: MEDAL[rank] ?? 'rgba(255,255,255,0.4)' }}>{rank + 1}</span>;
}

function Note({ text }: { text: string }) {
    return <div className="px-2 py-4 text-[14px] text-white/35">{text}</div>;
}
