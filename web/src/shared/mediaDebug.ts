const RING = 300;

export interface MediaDebugEntry {
    t: number;
    scope: string;
    event: string;
    data?: Record<string, unknown>;
}

const ring: MediaDebugEntry[] = [];

export function mediaDebug(scope: string, event: string, data?: Record<string, unknown>): void {
    ring.push({ t: Date.now(), scope, event, data });
    if (ring.length > RING) ring.shift();
}

declare global {
    interface Window {
        __sdMedia?: (sinceMs?: number) => MediaDebugEntry[];
        __sdMediaClear?: () => void;
    }
}

if (typeof window !== 'undefined') {
    window.__sdMedia = (sinceMs?: number) => {
        if (typeof sinceMs !== 'number') return ring.slice();
        const cut = Date.now() - sinceMs;
        return ring.filter(e => e.t >= cut);
    };
    window.__sdMediaClear = () => { ring.length = 0; };
}
