import type { ReactNode } from 'react';

import { t } from '@/i18n';
import { Sheet } from '@/ui/Sheet';

import { BaccaratRules } from './baccarat/Rules';
import { CrashRules } from './crash/Rules';
import { HoldemRules } from './holdem/Rules';
import type { CasinoGame } from './casinoApi';
import { GOLD, SURFACE, TABLE } from './theme';

const HOUSE_EDGE: Record<CasinoGame, string> = {
    blackjack: '0.50', holdem: '0.00', crash: '3.00',
    baccarat: '1.06', roulette: '2.70', slots: '4.65',
};

const GAME_NAME: Record<CasinoGame, () => string> = {
    blackjack: () => t('casino.blackjack', 'Blackjack'),
    holdem:    () => t('casino.holdem', "Texas Hold'em"),
    crash:     () => t('casino.crash', 'Crash'),
    baccarat:  () => t('casino.baccarat', 'Baccarat'),
    roulette:  () => t('casino.roulette', 'Roulette'),
    slots:     () => t('casino.slots', 'Slots'),
};

const SLOT_PAYS: { symbol: () => string; pay: number }[] = [
    { symbol: () => t('slots.symbolCrown', 'Crown'),         pay: 300 },
    { symbol: () => t('slots.symbolSeven', 'Seven'),         pay: 100 },
    { symbol: () => t('slots.symbolHorseshoe', 'Horseshoe'), pay: 50 },
    { symbol: () => t('slots.symbolBell', 'Bell'),           pay: 25 },
    { symbol: () => t('slots.symbolDiamond', 'Diamond'),     pay: 15 },
    { symbol: () => t('slots.symbolClub', 'Club'),           pay: 12 },
    { symbol: () => t('slots.symbolHeart', 'Heart'),         pay: 10 },
    { symbol: () => t('slots.symbolSpade', 'Spade'),         pay: 8 },
];

const ROULETTE_ODDS: { label: () => string; odds: string }[] = [
    { label: () => t('roulette.straight', 'Straight'), odds: '35:1' },
    { label: () => t('roulette.split', 'Split'),       odds: '17:1' },
    { label: () => t('roulette.street', 'Street'),     odds: '11:1' },
    { label: () => t('roulette.corner', 'Corner'),     odds: '8:1' },
    { label: () => t('roulette.basket', 'Basket'),     odds: '8:1' },
    { label: () => t('roulette.line', 'Six line'),     odds: '5:1' },
    { label: () => t('roulette.column', 'Column'),     odds: '2:1' },
    { label: () => t('roulette.dozen', 'Dozen'),       odds: '2:1' },
    { label: () => `${t('roulette.red', 'Red')} / ${t('roulette.black', 'Black')}`, odds: '1:1' },
    { label: () => `${t('roulette.odd', 'Odd')} / ${t('roulette.even', 'Even')}`,   odds: '1:1' },
    { label: () => `${t('roulette.low', '1-18')} / ${t('roulette.high', '19-36')}`, odds: '1:1' },
];

export function RulesSheet({ game, onClose }: { game: CasinoGame; onClose: () => void }) {
    return (
        <Sheet onClose={onClose} fit="content" forceDark className="bg-[#0A472C] text-white">
            {api => (
                <div className="flex flex-col px-5 pb-2 pt-1">
                    <h2 className="text-center text-[20px] font-extrabold tracking-tight text-white">{t('casino.paytable', 'Paytable')}</h2>
                    <div className="mt-1 text-center text-[13px] font-semibold text-white/55">{GAME_NAME[game]()}</div>

                    <div className="mt-4 rounded-[16px] px-4 py-2" style={{ background: SURFACE.panel, boxShadow: `inset 0 1px 0 ${SURFACE.hair}` }}>
                        {game === 'blackjack' && <BlackjackRules />}
                        {game === 'holdem' && <HoldemRules />}
                        {game === 'crash' && <CrashRules />}
                        {game === 'baccarat' && <BaccaratRules />}
                        {game === 'slots' && <SlotsRules />}
                        {game === 'roulette' && <RouletteRules />}
                    </div>

                    <div className="mt-3 text-center text-[13px] font-semibold text-white/45">
                        {t('casino.house', 'House edge {pct}%', { pct: HOUSE_EDGE[game] })}
                    </div>

                    <button
                        type="button"
                        onClick={api.close}
                        className="mt-4 w-full rounded-[16px] py-3.5 text-[17px] font-bold text-white active:opacity-80"
                        style={{ background: 'rgba(255,255,255,0.12)' }}
                    >
                        {t('casino.done', 'Done')}
                    </button>
                </div>
            )}
        </Sheet>
    );
}

function BlackjackRules() {
    return (
        <>
            <PayoutRow label={t('blackjack.payoutWin', 'Win')} sub={t('blackjack.payoutWinSub', 'Beat the dealer')} result={t('blackjack.betTimes2', 'Bet × 2')} example="100 → 200" />
            <PayoutRow label={t('blackjack.payoutBjLabel', 'Blackjack')} sub={t('blackjack.payoutBjSub', '21 on your first two cards')} result={t('blackjack.betTimes25', 'Bet × 2.5')} example="100 → 250" highlight />
            <PayoutRow label={t('blackjack.payoutPush', 'Push')} sub={t('blackjack.payoutPushSub', 'Tie with the dealer')} result={t('blackjack.betBack', 'Bet back')} example="100 → 100" />
            <p className="pb-2 pt-1 text-[13px] font-semibold text-white/55">{t('blackjack.dealerStops', 'The dealer stops drawing at 17.')}</p>
        </>
    );
}

function SlotsRules() {
    return (
        <>
            <div className="flex items-center justify-between pb-1 pt-2 text-[12px] font-bold uppercase tracking-wide text-white/45">
                <span>{t('slots.paylines', 'Paylines')}</span>
                <span>{t('slots.perLine', 'per line')}</span>
            </div>
            {SLOT_PAYS.map(row => (
                <OddsRow key={row.pay} label={t('slots.threeOf', 'Three {symbol}', { symbol: row.symbol() })} value={`${row.pay}×`} highlight={row.pay >= 100} />
            ))}
            <OddsRow label={t('slots.anySuits', 'Any three suits')} value="2×" />
            <p className="pb-2 pt-1 text-[13px] font-semibold text-white/55">{t('slots.rtp', 'Returns 95.35% over time')}</p>
        </>
    );
}

function RouletteRules() {
    return (
        <>
            <div className="flex items-center justify-between pb-1 pt-2 text-[12px] font-bold uppercase tracking-wide text-white/45">
                <span>{t('roulette.payouts', 'Payouts')}</span>
                <span>{t('roulette.chip', 'Chip')}</span>
            </div>
            {ROULETTE_ODDS.map(row => (
                <OddsRow key={row.label()} label={row.label()} value={row.odds} highlight={row.odds === '35:1'} />
            ))}
            <div className="pb-2" />
        </>
    );
}

function OddsRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className="flex items-center justify-between border-t py-2 first:border-t-0" style={{ borderColor: SURFACE.hair }}>
            <span className="text-[15px] font-semibold text-white/85">{label}</span>
            <span className="text-[15px] font-extrabold tabular-nums" style={{ color: highlight ? GOLD.top : '#fff' }}>{value}</span>
        </div>
    );
}

function PayoutRow({ label, sub, result, example, highlight }: { label: string; sub: string; result: string; example: ReactNode; highlight?: boolean }) {
    return (
        <div className="flex items-center justify-between border-t py-2 first:border-t-0" style={{ borderColor: SURFACE.hair }}>
            <span className="flex min-w-0 flex-col">
                <span className="text-[15px] font-bold text-white">{label}</span>
                <span className="text-[13px] font-semibold text-white/55">{sub}</span>
            </span>
            <span className="flex flex-col items-end">
                <span className="text-[15px] font-extrabold tabular-nums" style={{ color: highlight ? TABLE.chip : '#fff' }}>{result}</span>
                <span className="text-[13px] font-semibold tabular-nums text-white/55">{example}</span>
            </span>
        </div>
    );
}
