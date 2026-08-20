export const K = 0.00016;

export const MIN_X100 = 100;
export const MAX_X100 = 10000;
export const MAX_MS = 28783;

export const VIEW_W = 340;
export const VIEW_H = 180;

const BASE_Y = 180;
const SPAN_Y = 176;
const SAMPLES = 240;
const Y_EXP = 0.45;
const HEAD_STOPS = 21;
const HOUSE_BASIS = 97;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function multAt(ms: number): number {
    if (!(ms > 0)) return MIN_X100;
    const v = Math.floor(100 * Math.exp(K * ms));
    return v > MAX_X100 ? MAX_X100 : v;
}

export function bustAtMs(x100: number): number {
    if (x100 <= MIN_X100) return 0;
    const capped = x100 > MAX_X100 ? MAX_X100 : x100;
    return Math.ceil(Math.log(capped / 100) / K);
}

export function payoutAt(stake: number, x100: number): number {
    return Math.floor(stake * x100 / 100);
}

export function fmtMult(x100: number): string {
    return (x100 / 100).toFixed(2);
}

export function bustFromHash(hash: string, ceiling = MAX_X100): number {
    if (typeof hash !== 'string' || hash.length < 13) return MIN_X100;
    const head = parseInt(hash.slice(0, 13), 16);
    if (!Number.isFinite(head)) return MIN_X100;
    const x = head / 2 ** 52;
    if (x >= 1) return ceiling;
    const raw = Math.floor(HOUSE_BASIS / (1 - x));
    if (raw < MIN_X100) return MIN_X100;
    return raw > ceiling ? ceiling : raw;
}

export function xAt(ms: number): number {
    const clamped = ms < 0 ? 0 : ms > MAX_MS ? MAX_MS : ms;
    return VIEW_W * clamped / MAX_MS;
}

export function yAt(x100: number): number {
    const clamped = x100 < MIN_X100 ? MIN_X100 : x100 > MAX_X100 ? MAX_X100 : x100;
    const share = (clamped - MIN_X100) / (MAX_X100 - MIN_X100);
    return BASE_Y - SPAN_Y * share ** Y_EXP;
}

export function headAt(ms: number): { x: number; y: number } {
    const clamped = ms < 0 ? 0 : ms > MAX_MS ? MAX_MS : ms;
    return { x: round2(xAt(clamped)), y: round2(yAt(100 * Math.exp(K * clamped))) };
}

function samples(count: number): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i <= count; i++) out.push(headAt(MAX_MS * i / count));
    return out;
}

const POINTS = samples(SAMPLES);

export const CURVE_PATH = POINTS.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

export const AREA_PATH = `${CURVE_PATH} L ${VIEW_W} ${BASE_Y} L 0 ${BASE_Y} Z`;

export const HEAD_KEYFRAMES = (() => {
    const frames: string[] = [];
    for (let i = 0; i < HEAD_STOPS; i++) {
        const at = i / (HEAD_STOPS - 1);
        const p = headAt(MAX_MS * at);
        frames.push(`${round2(at * 100)}% { transform: translate(${p.x}px, ${p.y}px); }`);
    }
    return `@keyframes crash-head { ${frames.join(' ')} }`;
})();

export const GRID: { x100: number; y: number }[] = [200, 500, 2000, 5000].map(x100 => ({ x100, y: round2(yAt(x100)) }));
