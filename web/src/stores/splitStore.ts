import { create } from 'zustand';

import { useThemeStore } from './themeStore';

export const SPLIT_EXIT_MS = 280;

export type SplitSide = 'left' | 'right';

interface SplitStore {
    appId:   string | null;
    /** null follows the fold, which is what an untouched phone wants; swapping pins it. */
    side:    SplitSide | null;
    closing: boolean;
    open:    (id: string) => void;
    close:   () => void;
    clear:   () => void;
    swap:    () => void;
}

let exitTimer: ReturnType<typeof setTimeout> | null = null;

function stopExit(): void {
    if (exitTimer !== null) { clearTimeout(exitTimer); exitTimer = null; }
}

export const useSplitStore = create<SplitStore>()((set, get) => ({
    appId:   null,
    side:    null,
    closing: false,

    // Nothing to say about the side at open time: choosing the app IS the gesture, and the side
    // is either the one the fold reveals or the one the player pinned with the seam.
    open: (id) => {
        stopExit();
        set({ appId: id, closing: false });
    },

    // Plays the pane out before dropping it, so the app leaves the way it arrived rather than
    // blinking off. The id is held for the length of the exit; only then does the deck hand the
    // host back to the pool.
    close: () => {
        if (!get().appId || get().closing) return;
        set({ closing: true });
        stopExit();
        exitTimer = setTimeout(() => {
            exitTimer = null;
            set({ appId: null, closing: false });
        }, SPLIT_EXIT_MS);
    },

    clear: () => {
        stopExit();
        set({ appId: null, closing: false });
    },

    // Pins the side. Until this is called the pane follows the fold; afterwards it stays where
    // the player put it, for the rest of the session.
    swap: () => set(s => ({ side: (s.side ?? revealSide()) === 'left' ? 'right' : 'left' })),

}));

export function useSplitId(): string | null {
    return useSplitStore(s => s.appId);
}

// Which half the phone reveals when it unfolds. The body grows away from the edge it is anchored
// to, so a right-aligned phone opens its new half on the LEFT. Putting the pane there is what
// keeps the app you were already using where you left it, instead of shunting it aside so the
// new one can take the spot your eye is already on.
function sideForAlign(align: string | null | undefined): SplitSide {
    return (align ?? 'bottom-right').includes('right') ? 'left' : 'right';
}

export function revealSide(): SplitSide {
    return sideForAlign(useThemeStore.getState().phoneAlign);
}

export function useSplitSide(): SplitSide {
    // Both stores, because the answer moves with either: the player's own choice wins, and until
    // they make one it tracks wherever they have parked the phone.
    const pinned = useSplitStore(s => s.side);
    const align  = useThemeStore(s => s.phoneAlign);
    return pinned ?? sideForAlign(align);
}

export function useSplitClosing(): boolean {
    return useSplitStore(s => s.closing);
}

/** A split pane is holding the other half of the screen, so this half is one phone wide. */
export function useSplitPaneActive(): boolean {
    return useSplitStore(s => s.appId !== null && !s.closing);
}
