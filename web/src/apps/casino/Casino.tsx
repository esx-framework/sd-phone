import { useCallback, useEffect, useRef, useState } from 'react';

import { t } from '@/i18n';
import { Cashier } from '@/apps/_games/Cashier';
import { GameHeader } from '@/apps/_games/GameHeader';
import { loadChips } from '@/apps/_games/chipsApi';
import { useDeckActive } from '@/shell/deckActive';
import { useStatusBarLight } from '@/shell/useStatusBarLight';
import { useSessionState } from '@/hooks/useSessionState';

import { primeSamples } from './samples';
import { Baccarat } from './baccarat/Baccarat';
import { Blackjack } from './blackjack/Blackjack';
import { Crash } from './crash/Crash';
import { Holdem } from './holdem/Holdem';
import { Roulette } from './roulette/Roulette';
import { Slots } from './slots/Slots';
import { Lobby } from './Lobby';
import { LeaderboardScreen } from './LeaderboardScreen';
import { RulesSheet } from './RulesSheet';
import { CASINO_TAG, type CasinoGame, type CasinoGameProps } from './casinoApi';
import { ACCENT, APP_BG, SB_H, TABLE } from './theme';

type Screen = 'lobby' | 'blackjack' | 'holdem' | 'crash' | 'baccarat' | 'roulette' | 'slots' | 'cashier' | 'leaderboard';

export function Casino({ onClose: _onClose }: { onClose: () => void }) {
    useStatusBarLight(true);

    const [screen, setScreen] = useState<Screen>('lobby');
    const [chips,  setChips]  = useState(0);
    const [bank,   setBank]   = useState(0);

    const [rulesGame, setRulesGame] = useSessionState<CasinoGame>('casino:rulesGame', 'blackjack');
    const [rulesOpen, setRulesOpen] = useState(false);

    const syncChips = useCallback(() => {
        void loadChips().then(s => { setChips(s.chips); setBank(s.bank); });
    }, []);

    useEffect(() => { syncChips(); }, [syncChips]);
    useEffect(() => { primeSamples(); }, []);

    const deckActive = useDeckActive();
    const wasActive  = useRef(deckActive);
    useEffect(() => {
        const rising = deckActive && !wasActive.current;
        wasActive.current = deckActive;
        if (!rising) return;
        const id = window.setTimeout(syncChips, 420);
        return () => window.clearTimeout(id);
    }, [deckActive, syncChips]);

    const toLobby = useCallback(() => { setScreen('lobby'); syncChips(); }, [syncChips]);
    const toCashier = useCallback(() => { setScreen('cashier'); }, []);

    function openGame(game: CasinoGame) { setScreen(game); }

    function openRules(game: CasinoGame) { setRulesGame(game); setRulesOpen(true); }

    const gameProps: CasinoGameProps = { chips, onChips: setChips, onBack: toLobby, onCashier: toCashier };
    const stackTitle = screen === 'cashier' ? t('casino.cashier', 'Cashier') : t('casino.leaderboards', 'Leaderboards');

    return (
        <div className="absolute inset-0 z-10 flex flex-col select-none" style={{ background: APP_BG, color: '#fff' }}>
            <div className="shrink-0" style={{ height: SB_H }} />

            {(screen === 'cashier' || screen === 'leaderboard') && (
                <GameHeader title={stackTitle} accent={TABLE.chip} onBack={toLobby} />
            )}

            <div key={screen} className="flex min-h-0 flex-1 flex-col animate-swipe-in-left">
                {screen === 'lobby' && (
                    <Lobby chips={chips} onPlay={openGame} onCashier={toCashier} onLeaderboards={() => setScreen('leaderboard')} onRules={openRules} />
                )}
                {screen === 'blackjack' && <Blackjack {...gameProps} />}
                {screen === 'holdem'    && <Holdem {...gameProps} />}
                {screen === 'crash'     && <Crash {...gameProps} />}
                {screen === 'baccarat'  && <Baccarat {...gameProps} />}
                {screen === 'roulette'  && <Roulette {...gameProps} />}
                {screen === 'slots'     && <Slots {...gameProps} />}
                {screen === 'cashier'   && (
                    <Cashier chips={chips} bank={bank} accent={ACCENT} game={CASINO_TAG} onChange={s => { setChips(s.chips); setBank(s.bank); }} />
                )}
                {screen === 'leaderboard' && <LeaderboardScreen />}
            </div>

            {rulesOpen && <RulesSheet game={rulesGame} onClose={() => setRulesOpen(false)} />}
        </div>
    );
}
