import { create } from 'zustand';

import { readJson, writeJson } from '@/lib/storage';

const KEY = 'sd-phone:casino:muted';

interface MuteState {
    muted:  boolean;
    toggle: () => void;
}

export const useCasinoMute = create<MuteState>((set, get) => ({
    muted: readJson<boolean>(KEY, v => typeof v === 'boolean') ?? false,
    toggle: () => {
        const next = !get().muted;
        set({ muted: next });
        writeJson(KEY, next);
    },
}));
