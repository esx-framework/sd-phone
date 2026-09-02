import { create } from 'zustand';

import { device } from '@device';
import { subscribeNui } from '@/hooks/useNuiEvent';
import type { FindMyLostPush } from '@/core/types';

export type LostUnlock = 'passcode' | 'face' | 'blocked';

interface FindMyStore {
    lost:      boolean;
    message:   string | null;
    contact:   string | null;
    unlock:    LostUnlock;
    pinLength: number;
    apply:     (push: FindMyLostPush | undefined) => void;
}

const CLEARED = { lost: false, message: null, contact: null, unlock: 'passcode' as LostUnlock, pinLength: 4 };

export const useFindMyStore = create<FindMyStore>()(set => ({
    ...CLEARED,
    apply: push => {
        if (!push || (push.kind ?? 'phone') !== device.id) return;
        if (!push.on) { set(CLEARED); return; }
        set({
            lost:      true,
            message:   push.message ?? null,
            contact:   push.contact ?? null,
            unlock:    push.unlock === 'face' || push.unlock === 'blocked' ? push.unlock : 'passcode',
            pinLength: push.pinLength && push.pinLength >= 4 && push.pinLength <= 6 ? push.pinLength : 4,
        });
    },
}));

subscribeNui('sd-phone:findmy:lost', data => useFindMyStore.getState().apply(data));

export function useLostMode() {
    const lost      = useFindMyStore(s => s.lost);
    const message   = useFindMyStore(s => s.message);
    const contact   = useFindMyStore(s => s.contact);
    const unlock    = useFindMyStore(s => s.unlock);
    const pinLength = useFindMyStore(s => s.pinLength);
    return { lost, message, contact, unlock, pinLength };
}
