import { isFiveM } from '@/core/nui';
import { apiCall } from '@/core/api';
import { writeJson } from '@/lib/storage';

import type { Card } from '../cards';
import {
    type BaccaratBets, type BaccaratOutcome,
    MAX_TOTAL, MIN_BET, SHOE_DECKS, SPOTS, freshShoe, payouts, resolveHand, spotMax, stakeOf,
} from './logic';

export interface BaccaratResult {
    bets:    BaccaratBets;
    stake:   number;
    player:  { cards: Card[]; total: number };
    banker:  { cards: Card[]; total: number };
    outcome: BaccaratOutcome;
    natural: boolean;
    ppair:   boolean;
    bpair:   boolean;
    pays:    BaccaratBets;
    win:     number;
    net:     number;
    chips:   number;
}

export interface BaccaratReply { ok: boolean; data?: BaccaratResult; message?: string }

const CHIP_KEY = 'sd-phone:casino-chips:v1';

function devChips(): number { return Math.max(0, Number(localStorage.getItem(CHIP_KEY) ?? '2000') || 0); }
function setDevChips(n: number) { writeJson(CHIP_KEY, Math.max(0, Math.floor(n))); }

function sanitise(bets: BaccaratBets): BaccaratBets | null {
    const clean: BaccaratBets = { player: 0, banker: 0, tie: 0, ppair: 0, bpair: 0 };
    for (const spot of SPOTS) {
        const raw = bets[spot];
        if (!raw) continue;
        const amount = Math.floor(Number(raw));
        if (!Number.isFinite(amount) || amount < MIN_BET) return null;
        clean[spot] = Math.min(amount, spotMax(spot));
    }
    return clean;
}

function devDeal(bets: BaccaratBets): BaccaratReply {
    const clean = sanitise(bets);
    if (!clean) return { ok: false, message: 'Enter a valid amount' };

    const stake = stakeOf(clean);
    if (stake <= 0) return { ok: false, message: 'Place a bet' };
    if (stake > MAX_TOTAL) return { ok: false, message: 'Table limit' };

    const held = devChips();
    if (stake > held) return { ok: false, message: 'Not enough chips' };
    setDevChips(held - stake);

    const resolved = resolveHand(freshShoe(SHOE_DECKS));
    const { pays, win } = payouts(clean, resolved);
    const chips = held - stake + win;
    setDevChips(chips);

    return {
        ok: true,
        data: {
            bets:    clean,
            stake,
            player:  resolved.player,
            banker:  resolved.banker,
            outcome: resolved.outcome,
            natural: resolved.natural,
            ppair:   resolved.ppair,
            bpair:   resolved.bpair,
            pays,
            win,
            net:     win - stake,
            chips,
        },
    };
}

export async function baccaratDeal(bets: BaccaratBets): Promise<BaccaratReply> {
    if (!isFiveM) return devDeal(bets);
    const res = await apiCall<BaccaratResult>('sd-phone:games:baccaratDeal', bets);
    return res.success && res.data ? { ok: true, data: res.data } : { ok: false, message: res.message };
}
