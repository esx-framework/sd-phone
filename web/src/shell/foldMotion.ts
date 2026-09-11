export const FOLD_LEAF_ANIM = 'sd-fold-leaf';
export const LEAF_SHADE_MAX = 0.35;
export const HINGE_SHADOW_MAX = 0.18;

const SETTLE = 7.5;
const SAMPLES = 64;

function rawSpring(x: number): number {
    return 1 - (1 + x) * Math.exp(-x);
}

const RAW_END = rawSpring(SETTLE);

export function springProgress(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return Math.min(1, rawSpring(SETTLE * t) / RAW_END);
}

export function springTimeAt(progress: number): number {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 48; i++) {
        const mid = (lo + hi) / 2;
        if (springProgress(mid) < progress) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
}

function round(n: number): number {
    const r = Math.round(n * 10000) / 10000;
    return Object.is(r, -0) ? 0 : r;
}

export function faceShade(angle: number): number {
    return round(LEAF_SHADE_MAX * (1 - Math.abs(Math.cos((angle * Math.PI) / 180))));
}

export function hingeShadow(angle: number): number {
    return round(HINGE_SHADOW_MAX * Math.abs(Math.sin((angle * Math.PI) / 180)));
}

export interface FoldFrames {
    leaf:  Keyframe[];
    book:  Keyframe[];
    inner: Keyframe[];
    cover: Keyframe[];
    hinge: Keyframe[];
}

export function foldFrames(opening: boolean, drift: number): FoldFrames {
    const frames: FoldFrames = { leaf: [], book: [], inner: [], cover: [], hinge: [] };
    for (let i = 0; i <= SAMPLES; i++) {
        const offset = i / SAMPLES;
        const p = springProgress(offset);
        const angle = round(opening ? 180 * (1 - p) : 180 * p);
        const shift = round(opening ? drift * (1 - p) : drift * p);
        const shade = faceShade(angle);
        frames.leaf.push({ offset, transform: `rotateY(${angle}deg)` });
        frames.book.push({ offset, transform: `translateX(${shift}px)` });
        frames.inner.push({ offset, opacity: shade });
        frames.cover.push({ offset, opacity: shade });
        frames.hinge.push({ offset, opacity: hingeShadow(angle) });
    }
    return frames;
}
