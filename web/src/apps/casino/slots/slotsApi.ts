import { isFiveM } from '@/core/nui';
import { apiCall } from '@/core/api';
import { writeJson } from '@/lib/storage';
import { STRIP_LEN, windowAt, type SlotSymbolId } from './strips';
import { LINES, evaluateLines } from './paytable';

export interface SlotLine { line: number; kind: 'triple' | 'suits'; symbol: string; pay: number }

export interface SlotResult {
    bet:   number;
    stake: number;
    stops: number[];
    grid:  string[][];
    lines: SlotLine[];
    win:   number;
    net:   number;
    chips: number;
}

export interface SpinReply { ok: boolean; data?: SlotResult; message?: string }

const CHIP_KEY = 'sd-phone:casino-chips:v1';
const MIN_LINE_BET = 5;
const MAX_LINE_BET = 5000;

function devChips(): number { return Math.max(0, Number(localStorage.getItem(CHIP_KEY) ?? '2000') || 0); }
function setDevChips(n: number) { writeJson(CHIP_KEY, Math.max(0, Math.floor(n))); }

function devSpin(raw: number): SpinReply {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < MIN_LINE_BET) return { ok: false, message: 'Enter a valid amount' };
    const bet = Math.min(n, MAX_LINE_BET);
    const stake = bet * LINES;
    const held = devChips();
    if (held < stake) return { ok: false, message: 'Not enough chips' };
    setDevChips(held - stake);

    const stops = [0, 1, 2].map(() => 1 + Math.floor(Math.random() * STRIP_LEN));
    const cols = stops.map((stop, reel) => windowAt(reel, stop));
    const grid: SlotSymbolId[][] = [0, 1, 2].map(row => [cols[0][row], cols[1][row], cols[2][row]]);
    const lines = evaluateLines(grid, bet);
    const win = lines.reduce((sum, l) => sum + l.pay, 0);
    const chips = held - stake + win;
    if (win > 0) setDevChips(chips);

    return { ok: true, data: { bet, stake, stops, grid, lines, win, net: win - stake, chips } };
}

export async function slotsSpin(bet: number): Promise<SpinReply> {
    if (!isFiveM) return devSpin(bet);
    const r = await apiCall<SlotResult>('sd-phone:games:slotsSpin', { bet });
    return r.success && r.data ? { ok: true, data: r.data } : { ok: false, message: r.message };
}
