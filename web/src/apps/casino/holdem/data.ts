import type { Card } from '@/apps/casino/cards';
import { t } from '@/i18n';

export type SeatState = 'empty' | 'sitting' | 'in' | 'folded' | 'allin' | 'sitout';
export type HoldemStreet = 'idle' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type HoldemAction = 'fold' | 'check' | 'call' | 'raise';

export interface HoldemSeat { i: number; name: string | null; stack: number; committed: number; state: SeatState; hole: Card[] | null; me: boolean }
export interface HoldemLegal { fold: boolean; check: boolean; call: boolean; callAmount: number; minRaiseTo: number; maxRaiseTo: number }
export interface HoldemPot { amount: number; eligible: number[] }
export interface HoldemStatePush { tableId: string; handId: number; street: HoldemStreet; button: number; actor: number | null; deadline: number; now: number; board: Card[]; pots: HoldemPot[]; seats: HoldemSeat[]; legal: HoldemLegal | null; handRank: string | null; sb: number; bb: number }
export interface HoldemHandEnd { tableId: string; handId: number; pots: HoldemPot[]; awards: { seat: number; amount: number }[]; shown: { seat: number; hole: Card[]; best: Card[]; cat: string }[] }

export interface HoldemTableInfo { id: string; name: string; sb: number; bb: number; minBuyIn: number; maxBuyIn: number; seated: number; playing: boolean; custom: boolean; ownerName: string | null }
export interface HoldemCreateLimits { enabled: boolean; nameMax: number; blinds: number[]; bbRatioMax: number; minBuyInBB: number; maxBuyInBB: number }
export interface HoldemCreateOpts { name: string; sb: number; bb: number; minBuyIn: number; maxBuyIn: number }
export interface HoldemLobby { tables: HoldemTableInfo[]; create: HoldemCreateLimits }

export const NO_CREATE: HoldemCreateLimits = { enabled: false, nameMax: 24, blinds: [], bbRatioMax: 2, minBuyInBB: 20, maxBuyInBB: 400 };

export function normalizeLobby(data: Partial<HoldemLobby> | null | undefined): HoldemLobby {
    const limits = data?.create;
    return {
        tables: (data?.tables ?? []).map(x => ({ ...x, custom: x.custom === true, ownerName: x.ownerName ?? null })),
        create: limits
            ? {
                enabled:    limits.enabled === true,
                nameMax:    limits.nameMax ?? NO_CREATE.nameMax,
                blinds:     Array.isArray(limits.blinds) ? limits.blinds : [],
                bbRatioMax: limits.bbRatioMax ?? NO_CREATE.bbRatioMax,
                minBuyInBB: limits.minBuyInBB ?? NO_CREATE.minBuyInBB,
                maxBuyInBB: limits.maxBuyInBB ?? NO_CREATE.maxBuyInBB,
            }
            : NO_CREATE,
    };
}

export function potTotal(pots: HoldemPot[]): number {
    let n = 0;
    for (const p of pots) n += p.amount;
    return n;
}

export function liveChips(seats: HoldemSeat[]): number {
    let n = 0;
    for (const s of seats) n += s.committed;
    return n;
}

export function seatOf(seats: HoldemSeat[], i: number | null): HoldemSeat | null {
    if (i === null) return null;
    for (const s of seats) if (s.i === i) return s;
    return null;
}

export function mySeat(seats: HoldemSeat[]): HoldemSeat | null {
    for (const s of seats) if (s.me) return s;
    return null;
}

export function handCatLabel(cat: string): string {
    if (cat === 'straightFlush') return t('holdem.straightFlush', 'Straight flush');
    if (cat === 'quads')         return t('holdem.quads', 'Four of a kind');
    if (cat === 'fullHouse')     return t('holdem.fullHouse', 'Full house');
    if (cat === 'flush')         return t('holdem.flush', 'Flush');
    if (cat === 'straight')      return t('holdem.straight', 'Straight');
    if (cat === 'trips')         return t('holdem.trips', 'Three of a kind');
    if (cat === 'twoPair')       return t('holdem.twoPair', 'Two pair');
    if (cat === 'pair')          return t('holdem.pair', 'Pair');
    return t('holdem.highCard', 'High card');
}

export function sameCard(a: Card, b: Card): boolean {
    return a.rank === b.rank && a.suit === b.suit;
}

export function inCards(list: Card[] | null | undefined, card: Card): boolean {
    if (!list) return false;
    for (const c of list) if (sameCard(c, card)) return true;
    return false;
}
