import { toneUrl } from '@/apps/settings/tones';

export interface NearbyRing {
    id:     number;
    tone:   string;
    volume: number;
}

interface LiveRing {
    audio: HTMLAudioElement;
    tone:  string;
}

const live = new Map<number, LiveRing>();

function clampVol(vol: number): number {
    if (!Number.isFinite(vol)) return 0;
    return Math.min(1, Math.max(0, vol));
}

function stop(id: number): void {
    const entry = live.get(id);
    if (!entry) return;
    live.delete(id);
    try {
        entry.audio.pause();
        entry.audio.currentTime = 0;
    } catch { return; }
}

function start(ring: NearbyRing): void {
    try {
        const audio = new Audio(toneUrl('ringtone', ring.tone));
        audio.loop = true;
        audio.volume = clampVol(ring.volume);
        live.set(ring.id, { audio, tone: ring.tone });
        void audio.play().catch(() => {});
    } catch { return; }
}

export function applyNearbyRings(rings: NearbyRing[]): void {
    const heard = new Set<number>();

    for (const ring of rings) {
        heard.add(ring.id);
        const entry = live.get(ring.id);
        if (!entry) {
            start(ring);
        } else if (entry.tone !== ring.tone) {
            stop(ring.id);
            start(ring);
        } else {
            entry.audio.volume = clampVol(ring.volume);
        }
    }

    for (const id of Array.from(live.keys())) {
        if (!heard.has(id)) stop(id);
    }
}
