import { useCallback, useEffect, useRef } from 'react';
import clsx from 'clsx';

import type { MigrationLine } from '../../types';
import { clockOf } from './format';

const LEVEL_TEXT: Record<MigrationLine['level'], string> = {
    info:  'text-zinc-300',
    ok:    'text-ios-green',
    warn:  'text-ios-orange',
    error: 'text-ios-red',
};

const LEVEL_RAIL: Record<MigrationLine['level'], string> = {
    info:  'bg-transparent',
    ok:    'bg-ios-green/60',
    warn:  'bg-ios-orange/70',
    error: 'bg-ios-red/70',
};

export function MigrationLog({ lines, className }: { lines: MigrationLine[]; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const pinned = useRef(true);

    useEffect(() => {
        const el = ref.current;
        if (el && pinned.current) el.scrollTop = el.scrollHeight;
    }, [lines]);

    const onScroll = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 28;
    }, []);

    return (
        <div
            ref={ref}
            onScroll={onScroll}
            className={clsx(
                'admin-scroll overflow-y-auto rounded-lg bg-black/35 font-mono text-[11.5px] leading-relaxed ring-1 ring-white/[0.05]',
                className,
            )}
        >
            {lines.length === 0 ? (
                <div className="px-4 py-3 text-zinc-600">
                    The run writes here line by line. Pick your domains and start the import.
                </div>
            ) : (
                lines.map(l => (
                    <div key={l.id} className="relative flex gap-3 px-4 py-[3px] hover:bg-white/[0.02]">
                        <span className={clsx('absolute inset-y-0 left-0 w-[2px]', LEVEL_RAIL[l.level])} />
                        <span className="shrink-0 text-zinc-600 tabular-nums">{clockOf(l.at)}</span>
                        <span className={clsx('min-w-0 break-words', LEVEL_TEXT[l.level])}>{l.text}</span>
                    </div>
                ))
            )}
        </div>
    );
}
