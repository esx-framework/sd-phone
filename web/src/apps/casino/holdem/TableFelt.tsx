import { useEffect, useRef, useState } from 'react';

import { t } from '@/i18n';
import { CardFace } from '@/apps/casino/CardFace';
import { Chip } from '@/apps/casino/roulette/Chip';
import type { Card } from '@/apps/casino/cards';

import { FELT, GOLD, GOLD_FRAME, SEAT, TABLE, fmtChips } from '../theme';
import { inCards, liveChips, potTotal, type HoldemHandEnd, type HoldemSeat, type HoldemStatePush } from './data';
import { POD_W, SeatPod, type BlindMark } from './Seat';

const FELT_W = 374;
const FELT_H = 470;
const BAND_H = 182;
const BLOCK_H = 82;
const SWEEP_MS = 460;

const POD_POS = [
    { left: 2,  top: 100, tx: 0 },
    { left: 20, top: 16,  tx: -50 },
    { left: 50, top: 0,   tx: -50 },
    { left: 80, top: 16,  tx: -50 },
    { left: 98, top: 100, tx: -100 },
];

const POT_X = FELT_W / 2;
const POT_Y = BAND_H + 81;
const HERO_Y = FELT_H - 16;

function chipOrigin(i: number): { x: number; y: number } {
    const pos = POD_POS[i];
    return {
        x: (pos.left / 100) * FELT_W + (pos.tx / 100) * POD_W + POD_W / 2,
        y: pos.top + BLOCK_H + 10,
    };
}

function sweepKeyframes(): string {
    const lines: string[] = [];
    for (let i = 0; i < POD_POS.length; i++) {
        const from = chipOrigin(i);
        lines.push(`@keyframes hd-toPot-${i} { from { transform: translate(0, 0) scale(1); opacity: 1 } to { transform: translate(${Math.round(POT_X - from.x)}px, ${Math.round(POT_Y - from.y)}px) scale(0.6); opacity: 0 } }`);
    }
    lines.push(`@keyframes hd-toPot-hero { from { transform: translate(0, 0) scale(1); opacity: 1 } to { transform: translate(0px, ${Math.round(POT_Y - HERO_Y)}px) scale(0.6); opacity: 0 } }`);
    return lines.join('\n');
}

export function ringFrom(hero: number, count: number): number[] {
    const out: number[] = [];
    for (let step = 1; step <= count - 1; step++) out.push(((hero - 1 + step) % count) + 1);
    return out;
}

function dealtIn(seat: HoldemSeat): boolean {
    return seat.state === 'in' || seat.state === 'folded' || seat.state === 'allin';
}

function nextDealt(seats: HoldemSeat[], from: number): number {
    for (let step = 1; step <= seats.length; step++) {
        const i = ((from - 1 + step) % seats.length) + 1;
        const seat = seats.find(s => s.i === i);
        if (seat && dealtIn(seat)) return i;
    }
    return from;
}

export function blindMarks(state: HoldemStatePush): Record<number, BlindMark> {
    const out: Record<number, BlindMark> = {};
    const live = state.seats.filter(dealtIn);
    if (live.length < 2) return out;
    const sb = live.length === 2 ? state.button : nextDealt(state.seats, state.button);
    const bb = nextDealt(state.seats, sb);
    out[sb] = 'sb';
    out[bb] = 'bb';
    return out;
}

interface Sweep { key: number; chips: { seat: number; amount: number }[] }

export function TableFelt({ state, heroSeat, handEnd, onSit }: {
    state:    HoldemStatePush;
    heroSeat: number | null;
    handEnd:  HoldemHandEnd | null;
    onSit:    ((seat: number) => void) | null;
}) {
    const [sweep, setSweep] = useState<Sweep | null>(null);
    const prevStreet = useRef(state.street);
    const prevCommitted = useRef<{ seat: number; amount: number }[]>([]);
    const sweepId = useRef(0);
    const sweepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => { if (sweepTimer.current !== null) clearTimeout(sweepTimer.current); }, []);

    useEffect(() => {
        if (state.street !== prevStreet.current) {
            const chips = prevCommitted.current.filter(c => c.amount > 0);
            if (chips.length) {
                sweepId.current += 1;
                setSweep({ key: sweepId.current, chips });
                if (sweepTimer.current !== null) clearTimeout(sweepTimer.current);
                sweepTimer.current = setTimeout(() => { setSweep(null); sweepTimer.current = null; }, SWEEP_MS);
            }
        }
        prevStreet.current = state.street;
        prevCommitted.current = state.seats.map(s => ({ seat: s.i, amount: s.committed }));
    }, [state]);

    const anchor = heroSeat ?? (state.seats.find(s => s.name === null)?.i ?? 1);
    const ring = ringFrom(anchor, state.seats.length);
    const marks = blindMarks(state);
    const showdown = handEnd !== null || state.street === 'showdown';

    const bestBySeat = new Map<number, Card[]>();
    if (handEnd) for (const s of handEnd.shown) bestBySeat.set(s.seat, s.best);
    const winners = new Set<number>();
    if (handEnd) for (const a of handEnd.awards) winners.add(a.seat);

    const boardBest: Card[] | null = handEnd && handEnd.shown.length
        ? (handEnd.shown.find(s => winners.has(s.seat))?.best ?? null)
        : null;

    const inFront = liveChips(state.seats);
    const total = potTotal(state.pots);
    const mainPot = showdown ? total : Math.max(0, total - inFront);
    const sidePots = showdown && state.pots.length > 1 ? state.pots : [];

    function sweptFor(seat: number): number | null {
        if (!sweep) return null;
        const hit = sweep.chips.find(c => c.seat === seat);
        return hit ? hit.amount : null;
    }

    const hero = heroSeat !== null ? state.seats.find(s => s.i === heroSeat) ?? null : null;
    const heroSwept = heroSeat !== null ? sweptFor(heroSeat) : null;

    return (
        <div className="flex min-h-0 flex-1 items-start justify-center px-2">
            <style>{sweepKeyframes()}</style>

            <div className="relative flex w-full flex-col" style={{ height: '100%', minHeight: 300, maxHeight: FELT_H }}>
                <div
                    className="absolute inset-0"
                    style={{
                        borderRadius: '50% / 38%',
                        background: `radial-gradient(120% 80% at 50% 6%, ${FELT.top} 0%, ${FELT.mid} 52%, ${FELT.bot} 100%)`,
                        boxShadow: `inset 0 0 0 6px ${FELT.rail}, inset 0 0 34px rgba(0,0,0,0.34), 0 8px 24px rgba(0,0,0,0.32)`,
                    }}
                />

                <div className="relative shrink-0" style={{ height: BAND_H }}>
                    {ring.map((seatIndex, i) => {
                        const seat = state.seats.find(s => s.i === seatIndex) ?? null;
                        const pos = POD_POS[i];
                        const swept = sweptFor(seatIndex);
                        return (
                            <div
                                key={seatIndex}
                                className="absolute"
                                style={{ left: `${pos.left}%`, top: pos.top, transform: `translateX(${pos.tx}%)`, width: POD_W }}
                            >
                                <SeatPod
                                    seat={seat}
                                    isButton={state.button === seatIndex && seat !== null && seat.name !== null}
                                    isActor={state.actor === seatIndex}
                                    blind={marks[seatIndex] ?? null}
                                    best={showdown ? (bestBySeat.get(seatIndex) ?? null) : null}
                                    onSit={onSit && (!seat || seat.name === null) ? () => onSit(seatIndex) : null}
                                />
                                {seat && seat.committed > 0 && !sweep && (
                                    <div className="absolute left-1/2 -translate-x-1/2" style={{ top: BLOCK_H + 4 }}>
                                        <Chip value={seat.committed} size={22} />
                                    </div>
                                )}
                                {swept !== null && (
                                    <div
                                        key={`${sweep?.key}-${seatIndex}`}
                                        className="absolute left-1/2 -translate-x-1/2"
                                        style={{ top: BLOCK_H + 4, animation: `hd-toPot-${i} ${SWEEP_MS}ms cubic-bezier(0.4,0,0.6,1) forwards` }}
                                    >
                                        <Chip value={swept} size={22} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5">
                    <div
                        className="flex items-center gap-1.5 rounded-full px-3 py-1"
                        style={{ background: GOLD_FRAME, color: FELT.bot, boxShadow: `inset 0 1px 0 ${GOLD.hi}, 0 2px 6px rgba(0,0,0,0.35)` }}
                    >
                        <span className="text-[11px] font-black uppercase tracking-wide">{t('holdem.pot', 'Pot')}</span>
                        <span className="text-[15px] font-extrabold tabular-nums">{fmtChips(mainPot)}</span>
                    </div>

                    {sidePots.map((pot, i) => (
                        <div
                            key={i}
                            className="rounded-full px-2.5 py-[3px] text-[11px] font-bold tabular-nums"
                            style={{ background: 'rgba(0,0,0,0.42)', color: GOLD.top, boxShadow: `inset 0 0 0 1px ${SEAT.podHi}` }}
                        >
                            {i === 0
                                ? t('holdem.mainPotAmount', 'Main {n}', { n: fmtChips(pot.amount) })
                                : t('holdem.sidePotAmount', 'Side {n}', { n: fmtChips(pot.amount) })}
                        </div>
                    ))}

                    <div className="flex items-center" style={{ gap: 6 }}>
                        {[0, 1, 2, 3, 4].map(i => {
                            const card = state.board[i];
                            if (!card) {
                                return <div key={i} style={{ width: 44, height: 62, borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.12)' }} />;
                            }
                            const lit = boardBest ? inCards(boardBest, card) : false;
                            return (
                                <div
                                    key={`${card.rank}${card.suit}`}
                                    style={{
                                        animation: 'hd-deal 300ms cubic-bezier(0.2,0.8,0.3,1) both',
                                        animationDelay: `${Math.max(0, i - 2) * 110}ms`,
                                    }}
                                >
                                    <div
                                        style={{
                                            borderRadius: 10,
                                            opacity: boardBest && !lit ? 0.45 : 1,
                                            boxShadow: lit ? `0 0 0 2px ${GOLD.top}` : undefined,
                                        }}
                                    >
                                        <CardFace card={card} w={44} h={62} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {state.street === 'idle' && (
                        <div className="text-[13px] font-semibold" style={{ color: TABLE.push }}>
                            {t('holdem.waitingPlayers', 'Waiting for players')}
                        </div>
                    )}
                </div>

                {hero && hero.committed > 0 && !sweep && (
                    <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 4 }}>
                        <Chip value={hero.committed} size={24} />
                    </div>
                )}
                {heroSwept !== null && (
                    <div
                        key={`${sweep?.key}-hero`}
                        className="absolute left-1/2 -translate-x-1/2"
                        style={{ bottom: 4, animation: `hd-toPot-hero ${SWEEP_MS}ms cubic-bezier(0.4,0,0.6,1) forwards` }}
                    >
                        <Chip value={heroSwept} size={24} />
                    </div>
                )}
            </div>
        </div>
    );
}
