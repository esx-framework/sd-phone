import { useLayoutEffect, type RefObject } from 'react';

export function useAutoScrollToEnd<T extends HTMLElement>(ref: RefObject<T | null>, dep: unknown, enabled = true) {
    useLayoutEffect(() => {
        if (!enabled) return;
        const el = ref.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [ref, dep, enabled]);
}
