import type { SlotSymbolId } from './strips';

export const LINES = 5;

export const PAYLINES: number[][] = [
    [1, 1, 1],
    [0, 0, 0],
    [2, 2, 2],
    [0, 1, 2],
    [2, 1, 0],
];

export const PAY_ORDER: SlotSymbolId[] = ['crown', 'seven', 'horseshoe', 'bell', 'diamond', 'club', 'heart', 'spade'];

export const TRIPLE_PAY: Record<SlotSymbolId, number> = {
    crown:     300,
    seven:     100,
    horseshoe:  50,
    bell:       25,
    diamond:    15,
    club:       12,
    heart:      10,
    spade:       8,
};

export const SUITS_PAY = 2;

const SUITS: SlotSymbolId[] = ['spade', 'heart', 'diamond', 'club'];
const isSuit = (s: SlotSymbolId) => SUITS.indexOf(s) >= 0;

export interface LineHit { kind: 'triple' | 'suits'; symbol: SlotSymbolId; mult: number }

export function lineResult(a: SlotSymbolId, b: SlotSymbolId, c: SlotSymbolId): LineHit | null {
    if (a === b && b === c) return { kind: 'triple', symbol: a, mult: TRIPLE_PAY[a] };
    if (isSuit(a) && isSuit(b) && isSuit(c)) return { kind: 'suits', symbol: a, mult: SUITS_PAY };
    return null;
}

export interface EvaluatedLine { line: number; kind: 'triple' | 'suits'; symbol: string; pay: number }

export function evaluateLines(grid: SlotSymbolId[][], bet: number): EvaluatedLine[] {
    const out: EvaluatedLine[] = [];
    for (let i = 0; i < PAYLINES.length; i++) {
        const rows = PAYLINES[i];
        const hit = lineResult(grid[rows[0]][0], grid[rows[1]][1], grid[rows[2]][2]);
        if (hit) out.push({ line: i + 1, kind: hit.kind, symbol: hit.kind === 'suits' ? 'suits' : hit.symbol, pay: hit.mult * bet });
    }
    return out;
}
