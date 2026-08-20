export type CasinoGame = 'blackjack' | 'holdem' | 'crash' | 'baccarat' | 'roulette' | 'slots';

export interface CasinoGameProps {
    chips: number;
    onChips: (n: number) => void;
    onBack: () => void;
    onCashier: () => void;
}

export const CASINO_TAG = 'casino';

export const GAME_ACCENT: Record<CasinoGame, string> = {
    blackjack: '#1C8A4E',
    holdem:    '#5A3488',
    crash:     '#E0632B',
    baccarat:  '#8E1B2E',
    roulette:  '#C1272D',
    slots:     '#D4AF5F',
};
