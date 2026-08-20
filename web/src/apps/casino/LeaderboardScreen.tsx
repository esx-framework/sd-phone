import { useEffect, useRef, useState } from 'react';

import { t } from '@/i18n';
import { Leaderboard } from '@/apps/_games/Leaderboard';
import { loadLeaderboard, type GameLeaderboard } from '@/apps/_games/statsApi';
import { useSessionState } from '@/hooks/useSessionState';

import type { CasinoGame } from './casinoApi';
import { ACCENT, SURFACE } from './theme';

const BOARD_GAMES: CasinoGame[] = ['blackjack', 'holdem', 'crash', 'baccarat', 'roulette', 'slots'];

const BOARD_LABEL: Record<CasinoGame, () => string> = {
    blackjack: () => t('casino.blackjack', 'Blackjack'),
    holdem:    () => t('casino.holdem', "Texas Hold'em"),
    crash:     () => t('casino.crash', 'Crash'),
    baccarat:  () => t('casino.baccarat', 'Baccarat'),
    roulette:  () => t('casino.roulette', 'Roulette'),
    slots:     () => t('casino.slots', 'Slots'),
};

export function LeaderboardScreen() {
    const [game, setGame] = useSessionState<CasinoGame>('casino:lbGame', 'blackjack');
    const cache = useRef<Partial<Record<CasinoGame, GameLeaderboard>>>({});
    const [board, setBoard] = useState<GameLeaderboard | null>(() => cache.current[game] ?? null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const cached = cache.current[game];
        if (cached) { setBoard(cached); setLoading(false); return; }
        let live = true;
        setBoard(null);
        setLoading(true);
        void loadLeaderboard(game).then(data => {
            cache.current[game] = data;
            if (!live) return;
            setBoard(data);
            setLoading(false);
        }).catch(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, [game]);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-5 pb-1 pt-1">
                <div className="flex flex-wrap gap-2">
                    {BOARD_GAMES.map(g => {
                        const on = g === game;
                        return (
                            <button
                                key={g}
                                type="button"
                                onClick={() => setGame(g)}
                                className="shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-bold active:opacity-70"
                                style={on
                                    ? { background: ACCENT, color: '#fff' }
                                    : { background: SURFACE.soft, color: 'rgba(255,255,255,0.65)' }}
                            >
                                {BOARD_LABEL[g]()}
                            </button>
                        );
                    })}
                </div>
            </div>
            <Leaderboard data={board} loading={loading} accent={ACCENT} variant="chips" />
        </div>
    );
}
