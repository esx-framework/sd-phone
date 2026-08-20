import { isFiveM } from '@/core/nui';
import { apiCall } from '@/core/api';
import { writeJson } from '@/lib/storage';
import { betInfo, mergeBets, stakeOf } from './bets';
import { type PocketColor, POCKETS, colorOf, wheelIndexOf } from './wheel';

export interface PlacedBet { id: string; amount: number }
export interface RouletteHit extends PlacedBet { payout: number }

export interface RouletteResult {
    pocket: number;
    index:  number;
    color:  PocketColor;
    stake:  number;
    hits:   RouletteHit[];
    win:    number;
    net:    number;
    chips:  number;
}

export interface SpinReply { ok: boolean; data?: RouletteResult; message?: string }

const MIN_CHIP = 5;
const CHIP_KEY = 'sd-phone:casino-chips:v1';

function devChips(): number { return Math.max(0, Number(localStorage.getItem(CHIP_KEY) ?? '2000') || 0); }
function setDevChips(n: number) { writeJson(CHIP_KEY, Math.max(0, Math.floor(n))); }

function devSpin(bets: PlacedBet[]): SpinReply {
    if (!bets.length) return { ok: false, message: 'Place a bet first' };
    for (const b of bets) {
        if (!betInfo(b.id)) return { ok: false, message: 'Bet not recognised' };
        const amount = Math.floor(Number(b.amount));
        if (!Number.isFinite(amount) || amount < MIN_CHIP) return { ok: false, message: 'Enter a valid amount' };
    }

    const merged = mergeBets(bets.map(b => ({ id: b.id, amount: Math.floor(b.amount) })));
    const stake  = stakeOf(merged);
    const held   = devChips();
    if (stake > held) return { ok: false, message: 'Not enough chips' };
    setDevChips(held - stake);

    const pocket = Math.floor(Math.random() * POCKETS);
    const hits: RouletteHit[] = [];
    let win = 0;
    for (const b of merged) {
        const info = betInfo(b.id);
        if (!info || !info.pockets.includes(pocket)) continue;
        const payout = b.amount * (info.odds + 1);
        win += payout;
        hits.push({ ...b, payout });
    }

    const chips = held - stake + win;
    setDevChips(chips);
    return {
        ok: true,
        data: { pocket, index: wheelIndexOf(pocket), color: colorOf(pocket), stake, hits, win, net: win - stake, chips },
    };
}

export async function rouletteSpin(bets: PlacedBet[]): Promise<SpinReply> {
    if (!isFiveM) return devSpin(bets);
    const res = await apiCall<RouletteResult>('sd-phone:games:rouletteSpin', { bets });
    return res.success && res.data ? { ok: true, data: res.data } : { ok: false, message: res.message };
}
