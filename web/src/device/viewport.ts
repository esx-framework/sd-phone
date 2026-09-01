import { useSyncExternalStore } from 'react';

export const REF_VIEWPORT_H = 1080;

export function viewportScale(h: number): number {
    return Number.isFinite(h) && h > 0 ? h / REF_VIEWPORT_H : 1;
}

function read(): number {
    return typeof window === 'undefined' ? 1 : viewportScale(window.innerHeight);
}

let snapshot = read();
const listeners = new Set<() => void>();

function onResize(): void {
    const next = read();
    if (next === snapshot) return;
    snapshot = next;
    for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
    if (listeners.size === 0) {
        snapshot = read();
        window.addEventListener('resize', onResize);
    }
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
        if (listeners.size === 0) window.removeEventListener('resize', onResize);
    };
}

function getSnapshot(): number {
    return snapshot;
}

export function useViewportScale(): number {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
