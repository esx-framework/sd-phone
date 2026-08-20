import type { Card } from '../cards';

export { SUIT_GLYPH, isRed, freshDeck, fmtChips } from '../cards';
export type { Card } from '../cards';

export function handValue(cards: Card[]): { total: number; soft: boolean } {
    let total = 0;
    let aces = 0;
    for (const c of cards) {
        if (c.rank === 'A') { aces++; total += 11; }
        else if (c.rank === 'K' || c.rank === 'Q' || c.rank === 'J' || c.rank === '10') total += 10;
        else total += Number(c.rank);
    }
    let softAces = aces;
    while (total > 21 && softAces > 0) { total -= 10; softAces--; }
    return { total, soft: softAces > 0 };
}

export function isBlackjack(cards: Card[]): boolean {
    return cards.length === 2 && handValue(cards).total === 21;
}

export function isBust(cards: Card[]): boolean {
    return handValue(cards).total > 21;
}

export type Outcome = 'win' | 'lose' | 'push' | 'blackjack';

export function dealerShouldHit(dealer: Card[]): boolean {
    return handValue(dealer).total < 17;
}

export function outcomeVsDealer(player: Card[], dealer: Card[]): Outcome {
    const p = handValue(player).total;
    const d = handValue(dealer).total;
    const pBJ = isBlackjack(player);
    const dBJ = isBlackjack(dealer);
    if (pBJ && dBJ) return 'push';
    if (pBJ) return 'blackjack';
    if (dBJ) return 'lose';
    if (p > 21) return 'lose';
    if (d > 21) return 'win';
    if (p > d) return 'win';
    if (p < d) return 'lose';
    return 'push';
}

export function payoutFor(bet: number, outcome: Outcome): { credit: number; net: number } {
    switch (outcome) {
        case 'blackjack': return { credit: bet + Math.round(bet * 1.5), net: Math.round(bet * 1.5) };
        case 'win':       return { credit: bet * 2, net: bet };
        case 'push':      return { credit: bet,     net: 0 };
        case 'lose':      return { credit: 0,       net: -bet };
    }
}

export function statResultFor(outcome: Outcome): 'win' | 'loss' | 'draw' {
    if (outcome === 'win' || outcome === 'blackjack') return 'win';
    if (outcome === 'push') return 'draw';
    return 'loss';
}

const MIN_BET = 5;

export function openingBet(lastBet: number, chips: number): number {
    const wanted = Number.isFinite(lastBet) && lastBet > 0 ? Math.floor(lastBet) : 25;
    return Math.min(Math.max(wanted, MIN_BET), Math.max(0, Math.floor(chips)));
}
