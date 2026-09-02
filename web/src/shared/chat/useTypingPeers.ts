import { useCallback, useEffect, useRef, useState } from 'react';

import { isFiveM } from '@/core/nui';
import { useNuiEvent } from '@/hooks/useNuiEvent';

const CLEAR_AFTER_MS = 5000;

const DEV_DELAY_MS     = 2000;
const DEV_CONVERSATION = 'c-maya';
const DEV_FROM         = 'maya';

export type TypingPeers = Record<string, string>;

export function useTypingPeers(): TypingPeers {
    const [typing, setTyping] = useState<TypingPeers>({});
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    const clear = useCallback((conversation: string) => {
        const timer = timers.current.get(conversation);
        if (timer) { clearTimeout(timer); timers.current.delete(conversation); }
        setTyping(prev => {
            if (!(conversation in prev)) return prev;
            const next = { ...prev };
            delete next[conversation];
            return next;
        });
    }, []);

    const note = useCallback((conversation: string, from: string, on: boolean) => {
        if (!conversation) return;
        if (!on) { clear(conversation); return; }
        const timer = timers.current.get(conversation);
        if (timer) clearTimeout(timer);
        timers.current.set(conversation, setTimeout(() => clear(conversation), CLEAR_AFTER_MS));
        setTyping(prev => (prev[conversation] === from ? prev : { ...prev, [conversation]: from }));
    }, [clear]);

    useNuiEvent('sd-phone:messages:typing', useCallback((data: { conversation: string; from: string; on: boolean }) => {
        if (!data) return;
        note(data.conversation, data.from ?? '', data.on === true);
    }, [note]));

    useEffect(() => {
        const timerMap = timers.current;
        if (isFiveM) return () => { timerMap.forEach(clearTimeout); timerMap.clear(); };
        const seed = setTimeout(() => note(DEV_CONVERSATION, DEV_FROM, true), DEV_DELAY_MS);
        return () => {
            clearTimeout(seed);
            timerMap.forEach(clearTimeout);
            timerMap.clear();
        };
    }, [note]);

    return typing;
}
