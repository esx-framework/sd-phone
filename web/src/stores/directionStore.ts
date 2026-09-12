import { create } from 'zustand';

import { useLocaleStore } from './localeStore';

export type Direction = 'ltr' | 'rtl';

const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur']);

export function isRtlLanguage(code: string): boolean {
    return RTL_LANGUAGES.has(code.split('-')[0].toLowerCase());
}

interface DirectionState {
    forceLtr: boolean;
    setForceLtr: (forceLtr: boolean) => void;
}

export const useDirectionStore = create<DirectionState>()(set => ({
    forceLtr: false,
    setForceLtr: forceLtr => set({ forceLtr }),
}));

export function useDirection(): Direction {
    const forceLtr = useDirectionStore(s => s.forceLtr);
    const locale = useLocaleStore(s => s.locale);
    return !forceLtr && isRtlLanguage(locale) ? 'rtl' : 'ltr';
}

export function getDirection(): Direction {
    return !useDirectionStore.getState().forceLtr && isRtlLanguage(useLocaleStore.getState().locale)
        ? 'rtl'
        : 'ltr';
}

export function useIsRtl(): boolean {
    return useDirection() === 'rtl';
}

export function dirSign(): 1 | -1 {
    return getDirection() === 'rtl' ? -1 : 1;
}
