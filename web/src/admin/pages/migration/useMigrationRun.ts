import { useCallback, useEffect, useRef, useState } from 'react';

import { useNuiEvent } from '@/hooks/useNuiEvent';
import { adminMigrateState, adminMigrateWatch } from '../../adminApi';
import type {
    MigrationLine, MigrationMark, MigrationPush, MigrationSample, MigrationState,
} from '../../types';

const MAX_SAMPLES = 1500;
const SAMPLE_MS = 500;

export interface MigrationRun {
    state:     MigrationState;
    lines:     MigrationLine[];
    samples:   MigrationSample[];
    marks:     MigrationMark[];
    now:       number;
    running:   boolean;
    elapsed:   number;
    eta:       number | null;
    rate:      number;
    peak:      number;
    pct:       number;
}

function rateBetween(a: MigrationSample, b: MigrationSample): number {
    const dt = b.t - a.t;
    if (dt <= 0) return 0;
    return Math.max(0, (b.rows - a.rows) / dt);
}

export function useMigrationRun(): MigrationRun {
    const [state, setState] = useState<MigrationState>({ phase: 'idle' });
    const [lines, setLines] = useState<MigrationLine[]>([]);
    const [samples, setSamples] = useState<MigrationSample[]>([]);
    const [marks, setMarks] = useState<MigrationMark[]>([]);
    const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

    const syncedAt = useRef(Math.floor(Date.now() / 1000));
    const lastSample = useRef(0);

    const running = state.phase === 'running';

    useEffect(() => {
        void adminMigrateState().then(res => {
            if (!res.success || !res.data) return;
            setState(res.data.state);
            setLines(res.data.lines);
            setSamples(res.data.series ?? []);
            setMarks(res.data.marks ?? []);
        });
        return () => { void adminMigrateWatch(false); };
    }, []);

    useNuiEvent('sd-phone:admin:migrate', useCallback((data: MigrationPush | undefined) => {
        if (!data) return;

        if (data.reset) {
            setLines([]);
            setSamples([]);
            setMarks([]);
            lastSample.current = 0;
        }

        if (data.state) {
            const next = data.state;
            syncedAt.current = Math.floor(Date.now() / 1000);
            setState(prev => {
                if (next.currentDomain && next.currentDomain !== prev.currentDomain && next.startedAt) {
                    const at = Date.now() / 1000 - next.startedAt;
                    setMarks(m => (m.some(x => x.key === next.currentDomain) ? m : [...m, { t: at, key: next.currentDomain! }]));
                }
                return next;
            });

            if (next.startedAt && next.doneRows !== undefined) {
                const ms = Date.now();
                if (ms - lastSample.current >= SAMPLE_MS) {
                    lastSample.current = ms;
                    const t = ms / 1000 - next.startedAt;
                    setSamples(prev => {
                        const appended = [...prev, { t, rows: next.doneRows! }];
                        return appended.length > MAX_SAMPLES ? appended.slice(-MAX_SAMPLES) : appended;
                    });
                }
            }
        }

        if (data.lines?.length) {
            setLines(prev => {
                const seen = new Set(prev.map(l => l.id));
                const fresh = data.lines!.filter(l => !seen.has(l.id));
                return fresh.length ? [...prev, ...fresh] : prev;
            });
        }
    }, []));

    useEffect(() => {
        if (!running) return;
        const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
        return () => window.clearInterval(id);
    }, [running]);

    const total = state.totalRows ?? 0;
    const done = state.doneRows ?? 0;

    const elapsed = state.startedAt ? ((state.finishedAt ?? now) - state.startedAt) : 0;
    const eta = running && state.etaSeconds !== undefined
        ? Math.max(0, state.etaSeconds - (now - syncedAt.current))
        : null;

    const tail = samples.slice(-6);
    const rate = tail.length >= 2 ? rateBetween(tail[0], tail[tail.length - 1]) : 0;

    let peak = 0;
    for (let i = 1; i < samples.length; i++) {
        const r = rateBetween(samples[i - 1], samples[i]);
        if (r > peak) peak = r;
    }

    const pct = total > 0 ? Math.min(100, (done / total) * 100) : running ? 0 : 0;

    return { state, lines, samples, marks, now, running, elapsed, eta, rate, peak, pct };
}
