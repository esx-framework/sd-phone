import { type Card, type Rank, freshDeck } from '../cards';

export type BaccaratSpot = 'player' | 'banker' | 'tie' | 'ppair' | 'bpair';
export type BaccaratOutcome = 'player' | 'banker' | 'tie';
export type BaccaratBets = Record<BaccaratSpot, number>;

export interface BaccaratSide { cards: Card[]; total: number }

export interface BaccaratHand {
    player:  BaccaratSide;
    banker:  BaccaratSide;
    outcome: BaccaratOutcome;
    natural: boolean;
    ppair:   boolean;
    bpair:   boolean;
}

export const SPOTS: BaccaratSpot[] = ['player', 'banker', 'tie', 'ppair', 'bpair'];

export const MIN_BET = 25;
export const MAX_BET = 100000;
export const MAX_SIDE_BET = 10000;
export const MAX_TOTAL = 200000;
export const SHOE_DECKS = 8;

export function spotMax(spot: BaccaratSpot): number {
    return spot === 'ppair' || spot === 'bpair' ? MAX_SIDE_BET : MAX_BET;
}

export function emptyBets(): BaccaratBets {
    return { player: 0, banker: 0, tie: 0, ppair: 0, bpair: 0 };
}

export function stakeOf(bets: BaccaratBets): number {
    let total = 0;
    for (const spot of SPOTS) total += bets[spot];
    return total;
}

const POINTS: Record<Rank, number> = {
    A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    '10': 0, J: 0, Q: 0, K: 0,
};

export function pointsOf(rank: Rank): number {
    return POINTS[rank];
}

export function totalOf(cards: Card[]): number {
    let sum = 0;
    for (const card of cards) sum += pointsOf(card.rank);
    return sum % 10;
}

export function playerDraws(total: number): boolean {
    return total <= 5;
}

export function bankerDraws(total: number, playerThird: number | null): boolean {
    if (total >= 7) return false;
    if (playerThird === null) return total <= 5;
    if (total <= 2) return true;
    if (total === 3) return playerThird !== 8;
    if (total === 4) return playerThird >= 2 && playerThird <= 7;
    if (total === 5) return playerThird >= 4 && playerThird <= 7;
    return playerThird === 6 || playerThird === 7;
}

export function freshShoe(decks: number): Card[] {
    const shoe: Card[] = [];
    for (let d = 0; d < decks; d++) shoe.push(...freshDeck());
    for (let i = shoe.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = shoe[i];
        shoe[i] = shoe[j];
        shoe[j] = tmp;
    }
    return shoe;
}

export function resolveHand(shoe: Card[]): BaccaratHand {
    const p: Card[] = [shoe.pop()!];
    const b: Card[] = [shoe.pop()!];
    p.push(shoe.pop()!);
    b.push(shoe.pop()!);

    let pt = totalOf(p);
    let bt = totalOf(b);
    const natural = pt >= 8 || bt >= 8;

    if (!natural) {
        let playerThird: number | null = null;
        if (playerDraws(pt)) {
            const third = shoe.pop()!;
            p.push(third);
            playerThird = pointsOf(third.rank);
            pt = totalOf(p);
        }
        if (bankerDraws(bt, playerThird)) {
            b.push(shoe.pop()!);
            bt = totalOf(b);
        }
    }

    const outcome: BaccaratOutcome = pt > bt ? 'player' : bt > pt ? 'banker' : 'tie';

    return {
        player:  { cards: p, total: pt },
        banker:  { cards: b, total: bt },
        outcome,
        natural,
        ppair:   p[0].rank === p[1].rank,
        bpair:   b[0].rank === b[1].rank,
    };
}

export function payouts(bets: BaccaratBets, hand: BaccaratHand): { pays: BaccaratBets; win: number } {
    const pays = emptyBets();
    const { outcome } = hand;

    if (bets.player > 0) {
        if (outcome === 'player') pays.player = bets.player * 2;
        else if (outcome === 'tie') pays.player = bets.player;
    }
    if (bets.banker > 0) {
        if (outcome === 'banker') pays.banker = bets.banker + Math.floor((bets.banker * 95 + 50) / 100);
        else if (outcome === 'tie') pays.banker = bets.banker;
    }
    if (bets.tie > 0 && outcome === 'tie') pays.tie = bets.tie * 9;
    if (bets.ppair > 0 && hand.ppair) pays.ppair = bets.ppair * 12;
    if (bets.bpair > 0 && hand.bpair) pays.bpair = bets.bpair * 12;

    return { pays, win: stakeOf(pays) };
}
