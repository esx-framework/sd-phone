import { useEffect, useState } from 'react';

import { t } from '@/i18n';
import { Slider } from '@/ui/Slider';

import { FELT, GOLD, GOLD_FRAME, PAD_B, SEAT, SURFACE, TABLE, fmtChips } from '../theme';
import type { HoldemAction, HoldemLegal } from './data';

const QUICK: { key: string; label: () => string; fraction: number }[] = [
    { key: 'half',  label: () => t('holdem.halfPot', '1/2 Pot'),         fraction: 0.5 },
    { key: 'three', label: () => t('holdem.threeQuarterPot', '3/4 Pot'), fraction: 0.75 },
    { key: 'pot',   label: () => t('holdem.fullPot', 'Pot'),             fraction: 1 },
];

function clamp(n: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, n));
}

export function ActionBar({ legal, pot, heroCommitted, bb, waitingFor, onAct }: {
    legal:         HoldemLegal | null;
    pot:           number;
    heroCommitted: number;
    bb:            number;
    waitingFor:    string | null;
    onAct:         (action: HoldemAction, to?: number) => void;
}) {
    const [tray, setTray] = useState(false);
    const [amount, setAmount] = useState(0);

    const canRaise = !!legal && legal.maxRaiseTo > 0 && legal.maxRaiseTo >= legal.minRaiseTo;
    const minTo = legal ? legal.minRaiseTo : 0;
    const maxTo = legal ? legal.maxRaiseTo : 0;

    useEffect(() => {
        if (!legal) { setTray(false); return; }
        setAmount(a => clamp(a || minTo, minTo, maxTo));
    }, [legal, minTo, maxTo]);

    if (!legal) {
        return (
            <div className="flex shrink-0 items-center justify-center px-4 pt-2" style={{ paddingBottom: PAD_B }}>
                <div
                    className="flex w-full items-center justify-center rounded-[16px] py-3 text-[14px] font-semibold"
                    style={{ background: SURFACE.sunken, color: 'rgba(255,255,255,0.6)' }}
                >
                    {waitingFor
                        ? t('holdem.waitingFor', 'Waiting for {name}', { name: waitingFor })
                        : t('holdem.waitingPlayers', 'Waiting for players')}
                </div>
            </div>
        );
    }

    const betToCall = heroCommitted + legal.callAmount;
    const potAfterCall = pot + legal.callAmount;

    function quickTo(fraction: number): number {
        return clamp(betToCall + Math.round(fraction * potAfterCall), minTo, maxTo);
    }

    function confirmRaise() {
        setTray(false);
        onAct('raise', clamp(amount, minTo, maxTo));
    }

    return (
        <div className="relative shrink-0" style={{ paddingBottom: PAD_B }}>
            {tray && canRaise && (
                <div
                    className="absolute inset-x-3 bottom-full z-10 mb-2 rounded-[18px] px-4 pb-3 pt-2.5"
                    style={{
                        background: 'rgba(6,46,29,0.98)',
                        boxShadow: `inset 0 0 0 1px ${SEAT.podHi}, 0 -8px 22px rgba(0,0,0,0.45)`,
                        animation: 'hd-tray 180ms cubic-bezier(0.2,0.8,0.3,1) both',
                    }}
                >
                    <div className="flex items-baseline justify-between">
                        <span className="text-[12px] font-bold uppercase tracking-wide text-white/50">{t('holdem.raiseLabel', 'Raise to')}</span>
                        <span className="text-[20px] font-extrabold tabular-nums" style={{ color: GOLD.top }}>{fmtChips(amount)}</span>
                    </div>

                    <Slider
                        value={amount}
                        min={minTo}
                        max={maxTo}
                        step={Math.max(1, Math.min(bb, Math.max(1, maxTo - minTo)))}
                        onChange={setAmount}
                        ariaLabel={t('holdem.raise', 'Raise')}
                        className="mt-1"
                    />

                    <div className="mt-1 flex gap-1.5">
                        {QUICK.map(q => (
                            <button
                                key={q.key}
                                type="button"
                                onClick={() => setAmount(quickTo(q.fraction))}
                                className="flex-1 rounded-full py-1.5 text-[12px] font-bold text-white/80 active:opacity-70"
                                style={{ background: SURFACE.soft, boxShadow: `inset 0 0 0 1px ${SURFACE.hair}` }}
                            >
                                {q.label()}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setAmount(maxTo)}
                            className="flex-1 rounded-full py-1.5 text-[12px] font-bold active:opacity-70"
                            style={{ background: 'rgba(255,213,90,0.16)', color: TABLE.win, boxShadow: `inset 0 0 0 1px rgba(255,213,90,0.34)` }}
                        >
                            {t('holdem.allIn', 'All in')}
                        </button>
                    </div>

                    <div className="mt-2 flex gap-2">
                        <button
                            type="button"
                            onClick={() => setTray(false)}
                            className="rounded-[14px] px-4 py-2.5 text-[15px] font-bold text-white/80 active:opacity-70"
                            style={{ background: 'rgba(0,0,0,0.32)', boxShadow: `inset 0 0 0 1px ${SURFACE.hair}` }}
                        >
                            {t('holdem.cancel', 'Cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={confirmRaise}
                            className="flex-1 rounded-[14px] py-2.5 text-[15px] font-extrabold active:scale-[0.97]"
                            style={{ background: GOLD_FRAME, color: FELT.bot, boxShadow: `inset 0 1px 0 ${GOLD.hi}`, transition: 'transform 0.08s' }}
                        >
                            {t('holdem.raiseTo', 'Raise to {n}', { n: fmtChips(amount) })}
                        </button>
                    </div>
                </div>
            )}

            <div className="flex h-[72px] items-center gap-2 px-3">
                <button
                    type="button"
                    onClick={() => { setTray(false); onAct('fold'); }}
                    className="h-[56px] flex-1 rounded-[16px] text-[16px] font-bold text-white active:opacity-70"
                    style={{ background: 'rgba(0,0,0,0.32)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)' }}
                >
                    {t('holdem.fold', 'Fold')}
                </button>

                <button
                    type="button"
                    onClick={() => { setTray(false); onAct(legal.check ? 'check' : 'call'); }}
                    className="h-[56px] flex-[1.3] rounded-[16px] text-[16px] font-extrabold active:opacity-80"
                    style={{ background: '#F3F6F4', color: FELT.bot, boxShadow: '0 1px 0 rgba(0,0,0,0.35)' }}
                >
                    {legal.check
                        ? t('holdem.check', 'Check')
                        : t('holdem.callAmount', 'Call {n}', { n: fmtChips(legal.callAmount) })}
                </button>

                <button
                    type="button"
                    onClick={() => setTray(v => !v)}
                    disabled={!canRaise}
                    className="h-[56px] flex-[1.3] rounded-[16px] text-[16px] font-extrabold active:scale-[0.97]"
                    style={{
                        background: canRaise ? GOLD_FRAME : SURFACE.soft,
                        color: canRaise ? FELT.bot : 'rgba(255,255,255,0.35)',
                        boxShadow: canRaise ? `inset 0 1px 0 ${GOLD.hi}, 0 1px 0 rgba(0,0,0,0.35)` : 'none',
                        transition: 'transform 0.08s',
                    }}
                >
                    {maxTo > 0 && maxTo === minTo ? t('holdem.allIn', 'All in') : t('holdem.raise', 'Raise')}
                </button>
            </div>
        </div>
    );
}
