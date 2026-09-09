import { create } from 'zustand';

import { device } from '@device';

const FOLD_MS = 460;
const TICK_MS = 16;
const EASE: readonly [number, number, number, number] = [0.32, 0.72, 0, 1];

function bezierAxis(a: number, b: number, s: number): number {
    const inv = 1 - s;
    return 3 * inv * inv * s * a + 3 * inv * s * s * b + s * s * s;
}

function ease(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (bezierAxis(EASE[0], EASE[2], mid) < t) lo = mid; else hi = mid;
    }
    return bezierAxis(EASE[1], EASE[3], (lo + hi) / 2);
}

interface FoldStore {
    foldable: boolean;
    openW:    number;
    open:     boolean;
    w:        number;
    applyShell: (foldable: boolean, openW: number) => void;
    setOpen:  (open: boolean) => void;
    toggle:   () => void;
}

let timer: ReturnType<typeof setInterval> | null = null;

function stopTimer(): void {
    if (timer !== null) { clearInterval(timer); timer = null; }
}

function targetW(s: Pick<FoldStore, 'foldable' | 'open' | 'openW'>): number {
    return s.foldable && s.open ? s.openW : device.screen.w;
}

export const useFoldStore = create<FoldStore>()((set, get) => {
    function animateTo(to: number): void {
        stopTimer();
        const from = get().w;
        if (from === to) return;
        if (typeof window === 'undefined') { set({ w: to }); return; }

        const started = Date.now();
        timer = setInterval(() => {
            const p = Math.min(1, (Date.now() - started) / FOLD_MS);
            if (p >= 1) { stopTimer(); set({ w: to }); }
            else set({ w: from + (to - from) * ease(p) });
        }, TICK_MS);
    }

    return {
        foldable: false,
        openW:    device.screen.w * 2,
        open:     false,
        w:        device.screen.w,

        applyShell: (foldable, openW) => {
            set(s => ({
                foldable,
                openW: openW > device.screen.w ? openW : device.screen.w * 2,
                open:  foldable ? s.open : false,
            }));
            animateTo(targetW(get()));
        },

        setOpen: (open) => {
            set(s => (s.foldable ? { open } : { open: false }));
            animateTo(targetW(get()));
        },

        toggle: () => {
            const s = get();
            if (!s.foldable) return;
            set({ open: !s.open });
            animateTo(targetW(get()));
        },
    };
});

export function useFoldable(): boolean {
    return useFoldStore(s => s.foldable);
}

export function useFoldOpen(): boolean {
    return useFoldStore(s => s.foldable && s.open);
}

export function useScreenW(): number {
    return useFoldStore(s => s.w);
}
