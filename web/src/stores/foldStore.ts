import { create } from 'zustand';

import { device } from '@device';

export const FOLD_LEAF_MS = 850;
const FOLD_SETTLE_MS = FOLD_LEAF_MS + 1200;

export type FoldDir = 'open' | 'close';

export interface FoldSwing {
    dir: FoldDir;
    id:  number;
}

interface FoldStore {
    foldable: boolean;
    openW:    number;
    open:     boolean;
    w:        number;
    swing:    FoldSwing | null;
    applyShell: (foldable: boolean, openW: number, open?: boolean) => void;
    setOpen:  (open: boolean) => void;
    toggle:   () => void;
    endSwing: (id: number) => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let nextId = 1;

function stopTimer(): void {
    if (timer !== null) { clearTimeout(timer); timer = null; }
}

function targetW(s: Pick<FoldStore, 'foldable' | 'open' | 'openW'>): number {
    return s.foldable && s.open ? s.openW : device.screen.w;
}

export const useFoldStore = create<FoldStore>()((set, get) => {
    function swingTo(dir: FoldDir): void {
        const to = targetW(get());
        if (get().w === to) return;

        stopTimer();
        const id = nextId++;
        set({ w: to, swing: { dir, id } });
        timer = setTimeout(() => get().endSwing(id), FOLD_SETTLE_MS);
    }

    return {
        foldable: false,
        openW:    device.screen.w * 2,
        open:     false,
        w:        device.screen.w,
        swing:    null,

        applyShell: (foldable, openW, open) => {
            stopTimer();
            set(s => ({
                foldable,
                openW: openW > device.screen.w ? openW : device.screen.w * 2,
                open:  foldable ? (typeof open === 'boolean' ? open : s.open) : false,
            }));
            set({ w: targetW(get()), swing: null });
        },

        setOpen: (open) => {
            const was = get().open;
            set(s => (s.foldable ? { open } : { open: false }));
            if (get().open !== was) swingTo(get().open ? 'open' : 'close');
        },

        toggle: () => {
            const s = get();
            if (!s.foldable) return;
            if (s.swing) return;
            set({ open: !s.open });
            swingTo(get().open ? 'open' : 'close');
        },

        endSwing: (id) => {
            if (get().swing?.id !== id) return;
            stopTimer();
            set({ swing: null });
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

export function useFoldSwing(): FoldSwing | null {
    return useFoldStore(s => s.swing);
}
