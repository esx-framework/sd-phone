import { colorOf } from './wheel';

export type BetKind =
    | 'straight' | 'split' | 'street' | 'corner' | 'basket' | 'line'
    | 'column' | 'dozen' | 'color' | 'parity' | 'half';

export interface BetInfo {
    kind:    BetKind;
    pockets: number[];
    odds:    number;
}

export interface BetAnchor {
    row: number;
    col: number;
    ox:  number;
    oy:  number;
}

export const ROW_ZERO   = -1;
export const ROW_COLUMN = 12;
export const ROW_DOZEN  = 13;
export const ROW_OUT_A  = 14;
export const ROW_OUT_B  = 15;

export const OUTSIDE_IDS = ['red', 'black', 'odd', 'even', 'low', 'high'] as const;

function span(from: number, to: number): number[] {
    const out: number[] = [];
    for (let n = from; n <= to; n++) out.push(n);
    return out;
}

const NUMBERS = span(1, 36);

const FIXED: Record<string, BetInfo> = {
    red:   { kind: 'color',  pockets: NUMBERS.filter(n => colorOf(n) === 'red'),   odds: 1 },
    black: { kind: 'color',  pockets: NUMBERS.filter(n => colorOf(n) === 'black'), odds: 1 },
    odd:   { kind: 'parity', pockets: NUMBERS.filter(n => n % 2 === 1),            odds: 1 },
    even:  { kind: 'parity', pockets: NUMBERS.filter(n => n % 2 === 0),            odds: 1 },
    low:   { kind: 'half',   pockets: span(1, 18),                                 odds: 1 },
    high:  { kind: 'half',   pockets: span(19, 36),                                odds: 1 },
    bk:    { kind: 'basket', pockets: [0, 1, 2, 3],                                odds: 8 },
};

function uint(raw: string): number | null {
    if (!/^(0|[1-9]\d?)$/.test(raw)) return null;
    return Number(raw);
}

function splitInfo(tail: string): BetInfo | null {
    const dash = tail.indexOf('-');
    if (dash <= 0) return null;
    const lo = uint(tail.slice(0, dash));
    const hi = uint(tail.slice(dash + 1));
    if (lo === null || hi === null || lo >= hi || hi > 36) return null;
    const zero       = lo === 0 && hi <= 3;
    const horizontal = lo >= 1 && hi === lo + 1 && lo % 3 !== 0 && lo <= 35;
    const vertical   = lo >= 1 && hi === lo + 3 && lo <= 33;
    if (!zero && !horizontal && !vertical) return null;
    return { kind: 'split', pockets: [lo, hi], odds: 17 };
}

export function betInfo(id: string): BetInfo | null {
    const fixed = FIXED[id];
    if (fixed) return fixed;

    const sep = id.indexOf(':');
    if (sep <= 0) return null;
    const head = id.slice(0, sep);
    const tail = id.slice(sep + 1);

    if (head === 'p') return splitInfo(tail);

    const n = uint(tail);
    if (n === null) return null;

    switch (head) {
        case 's':
            return n <= 36 ? { kind: 'straight', pockets: [n], odds: 35 } : null;
        case 't':
            return n >= 1 && n <= 34 && n % 3 === 1 ? { kind: 'street', pockets: [n, n + 1, n + 2], odds: 11 } : null;
        case 'c':
            return n >= 1 && n <= 32 && n % 3 !== 0 ? { kind: 'corner', pockets: [n, n + 1, n + 3, n + 4], odds: 8 } : null;
        case 'l':
            return n >= 1 && n <= 31 && n % 3 === 1 ? { kind: 'line', pockets: span(n, n + 5), odds: 5 } : null;
        case 'col':
            return n >= 1 && n <= 3 ? { kind: 'column', pockets: NUMBERS.filter(v => v % 3 === n % 3), odds: 2 } : null;
        case 'dz':
            return n >= 1 && n <= 3 ? { kind: 'dozen', pockets: span(n * 12 - 11, n * 12), odds: 2 } : null;
        default:
            return null;
    }
}

export function cellOf(pocket: number): { row: number; col: number } {
    return { row: Math.floor((pocket - 1) / 3), col: (pocket - 1) % 3 };
}

const OUT_SLOT: Record<string, number> = { red: 0, black: 1, odd: 2, even: 3, low: 4, high: 5 };

export function anchorFor(id: string): BetAnchor | null {
    const info = betInfo(id);
    if (!info) return null;

    if (id === 'bk') return { row: ROW_ZERO, col: 0, ox: 0, oy: 1 };

    const slot = OUT_SLOT[id];
    if (slot !== undefined) return { row: slot < 3 ? ROW_OUT_A : ROW_OUT_B, col: slot % 3, ox: 0.5, oy: 0.5 };

    if (info.kind === 'column') return { row: ROW_COLUMN, col: Number(id.slice(4)) - 1, ox: 0.5, oy: 0.5 };
    if (info.kind === 'dozen')  return { row: ROW_DOZEN,  col: Number(id.slice(3)) - 1, ox: 0.5, oy: 0.5 };

    const first = info.pockets[0];

    switch (info.kind) {
        case 'straight':
            return first === 0
                ? { row: ROW_ZERO, col: 1, ox: 0.5, oy: 0.5 }
                : { ...cellOf(first), ox: 0.5, oy: 0.5 };
        case 'split': {
            const [lo, hi] = info.pockets;
            if (lo === 0) return { row: ROW_ZERO, col: hi - 1, ox: 0.5, oy: 1 };
            return hi === lo + 1 ? { ...cellOf(lo), ox: 1, oy: 0.5 } : { ...cellOf(lo), ox: 0.5, oy: 1 };
        }
        case 'street':
            return { ...cellOf(first), ox: 0, oy: 0.5 };
        case 'corner':
            return { ...cellOf(first), ox: 1, oy: 1 };
        case 'line':
            return { ...cellOf(first), ox: 0, oy: 1 };
        default:
            return null;
    }
}

export function mergeBets(list: { id: string; amount: number }[]): { id: string; amount: number }[] {
    const totals = new Map<string, number>();
    for (const b of list) totals.set(b.id, (totals.get(b.id) ?? 0) + b.amount);
    return [...totals].map(([id, amount]) => ({ id, amount }));
}

export function stakeOf(list: { amount: number }[]): number {
    let total = 0;
    for (const b of list) total += b.amount;
    return total;
}
