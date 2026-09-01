export type CasinoGame = 'blackjack' | 'holdem' | 'crash' | 'baccarat' | 'roulette' | 'slots';

export interface CasinoGameProps {
    chips: number;
    onChips: (n: number) => void;
    onBack: () => void;
    onCashier: () => void;
}

export const CASINO_TAG = 'casino';

const ALL_GAMES: CasinoGame[] = ['blackjack', 'holdem', 'crash', 'baccarat', 'roulette', 'slots'];

let offered: CasinoGame[] = [...ALL_GAMES];

export function setCasinoGames(games: string[] | undefined): void {
    if (!Array.isArray(games)) {
        offered = [...ALL_GAMES];
        return;
    }
    const wanted = new Set(games);
    offered = ALL_GAMES.filter(game => wanted.has(game));
}

export function casinoGames(): CasinoGame[] {
    return offered;
}

export const GAME_ACCENT: Record<CasinoGame, string> = {
    blackjack: '#1C8A4E',
    holdem:    '#5A3488',
    crash:     '#E0632B',
    baccarat:  '#8E1B2E',
    roulette:  '#C1272D',
    slots:     '#D4AF5F',
};
