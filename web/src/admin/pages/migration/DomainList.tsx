import clsx from 'clsx';
import { Check, X } from 'lucide-react';

import type { MigrationDomain, MigrationState } from '../../types';
import { Badge, Checkbox } from '../../ui';
import { comma } from './format';

interface Props {
    domains:  MigrationDomain[];
    state:    MigrationState;
    selected: Set<string>;
    required: string;
    locked:   boolean;
    onToggle: (key: string) => void;
}

interface Standing {
    word:  string;
    tone:  'idle' | 'ready' | 'live' | 'good' | 'bad' | 'off';
}

function standingOf(d: MigrationDomain, state: MigrationState): Standing {
    const run = state.domains?.[d.key];
    if (run?.status === 'running') return { word: 'moving now', tone: 'live' };
    if (run?.status === 'failed')  return { word: 'stopped short', tone: 'bad' };
    if (run?.status === 'done')    return { word: 'brought across', tone: 'good' };
    if (run?.status === 'queued')  return { word: 'up next', tone: 'idle' };
    if (d.status === 'disabled')   return { word: 'skipped by config', tone: 'off' };
    if (d.status === 'done')       return { word: 'already across', tone: 'good' };
    if (d.rows === 0)              return { word: 'nothing to bring', tone: 'off' };
    return { word: 'waiting', tone: 'ready' };
}

const RAIL: Record<Standing['tone'], string> = {
    idle:  'bg-zinc-700',
    ready: 'bg-ios-blue/60',
    live:  'bg-ios-blue',
    good:  'bg-ios-green',
    bad:   'bg-ios-red',
    off:   'bg-zinc-800',
};

const WORD: Record<Standing['tone'], string> = {
    idle:  'text-zinc-500',
    ready: 'text-zinc-400',
    live:  'text-ios-blue',
    good:  'text-ios-green',
    bad:   'text-ios-red',
    off:   'text-zinc-600',
};

export function DomainList({ domains, state, selected, required, locked, onToggle }: Props) {
    return (
        <div className="divide-y divide-white/[0.05]">
            {domains.map(d => {
                const run = state.domains?.[d.key];
                const standing = standingOf(d, state);
                const isRequired = d.key === required;
                const settled = d.locked === true;
                const isLive = run?.status === 'running';
                const fill = isLive && state.currentTotal
                    ? Math.min(100, ((state.currentRows ?? 0) / state.currentTotal) * 100)
                    : run?.status === 'done' ? 100 : 0;

                return (
                    <label
                        key={d.key}
                        className={clsx(
                            'relative flex items-center gap-3.5 px-4 py-3 transition-colors',
                            locked || isRequired || settled ? 'cursor-default' : 'cursor-pointer hover:bg-white/[0.025]',
                            selected.has(d.key) ? 'bg-white/[0.012]' : 'opacity-[0.82]',
                        )}
                        title={settled ? 'Finished. Everything it could place is already placed.' : undefined}
                    >
                        <span className={clsx('absolute inset-y-0 left-0 w-[2px]', RAIL[standing.tone])} />

                        {settled ? (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] bg-ios-green/15">
                                <Check size={11} strokeWidth={3.5} className="text-ios-green" />
                            </span>
                        ) : (
                            <Checkbox
                                checked={selected.has(d.key)}
                                disabled={locked || isRequired}
                                onChange={() => onToggle(d.key)}
                            />
                        )}

                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="text-[13px] font-semibold text-zinc-200">{d.title ?? d.label}</span>
                                <span className="font-mono text-[10.5px] text-zinc-600">{d.label}</span>
                                {isRequired && !settled && <Badge>Required</Badge>}
                                {run?.status === 'failed' && <X size={13} className="text-ios-red" />}
                            </div>
                            <div className="mt-0.5 truncate text-[11.5px] leading-relaxed text-zinc-500">
                                {run?.summary ?? (settled ? d.summary : undefined) ?? d.blurb}
                            </div>
                            {settled && d.stats?.skipped ? (
                                <div className="mt-0.5 text-[11px] text-zinc-600">
                                    {comma(d.stats.skipped)} already covered by another of the same player's phones
                                </div>
                            ) : null}
                        </div>

                        <div className="w-[112px] shrink-0 pl-2 text-right">
                            <div className="font-mono text-[13px] font-semibold text-zinc-200 tabular-nums">
                                {comma(d.rows)}
                            </div>
                            <div className={clsx('text-[11px] font-medium', WORD[standing.tone])}>
                                {standing.word}
                            </div>
                        </div>

                        {fill > 0 && (
                            <span
                                className={clsx(
                                    'absolute bottom-0 left-0 h-[2px] transition-[width] duration-300 ease-out',
                                    run?.status === 'done' ? 'bg-ios-green/50' : 'bg-ios-blue',
                                )}
                                style={{ width: `${fill}%` }}
                            />
                        )}
                    </label>
                );
            })}
        </div>
    );
}
