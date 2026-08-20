import { Plus } from 'lucide-react';

import { t } from '@/i18n';
import { CardBack, CardFace } from '@/apps/casino/CardFace';
import type { Card } from '@/apps/casino/cards';

import { GOLD, SEAT, SURFACE, TABLE, fmtChips } from '../theme';
import { handCatLabel, inCards, type HoldemSeat } from './data';

export const POD_W = 104;
export const POD_H = 62;

export type BlindMark = 'sb' | 'bb' | null;

function DealerChip({ side }: { side: 'left' | 'right' }) {
    return (
        <div
            className="absolute flex items-center justify-center rounded-full text-[11px] font-black"
            style={{
                width: 20,
                height: 20,
                bottom: -6,
                left: side === 'left' ? -6 : undefined,
                right: side === 'right' ? -6 : undefined,
                background: 'linear-gradient(160deg, #FFFDF4 0%, #E9E0C6 100%)',
                color: '#3A2A08',
                boxShadow: '0 1px 3px rgba(0,0,0,0.45)',
            }}
        >
            D
        </div>
    );
}

function BlindTag({ mark }: { mark: BlindMark }) {
    if (!mark) return null;
    return (
        <span className="text-[11px] font-black uppercase tracking-wide" style={{ color: GOLD.mid }}>
            {mark === 'sb' ? t('holdem.sbShort', 'SB') : t('holdem.bbShort', 'BB')}
        </span>
    );
}

function HoleCards({ seat, best, dealt }: { seat: HoldemSeat; best: Card[] | null; dealt: boolean }) {
    if (!dealt) return <div style={{ height: 36, marginBottom: -8 }} />;
    const faded = seat.state === 'folded';
    return (
        <div className="flex" style={{ height: 36, marginBottom: -8, opacity: faded ? 0.35 : 1 }}>
            {seat.hole
                ? seat.hole.map((card, i) => (
                    <div
                        key={`${card.rank}${card.suit}`}
                        style={{
                            marginLeft: i === 0 ? 0 : -12,
                            borderRadius: 5,
                            opacity: best && !inCards(best, card) ? 0.45 : 1,
                            boxShadow: best && inCards(best, card) ? `0 0 0 1.5px ${GOLD.top}` : undefined,
                        }}
                    >
                        <CardFace card={card} w={26} h={36} />
                    </div>
                ))
                : [0, 1].map(i => (
                    <div
                        key={i}
                        style={{
                            marginLeft: i === 0 ? 0 : -12,
                            animation: 'hd-deal 280ms cubic-bezier(0.2,0.8,0.3,1) both',
                            animationDelay: `${i * 100}ms`,
                        }}
                    >
                        <CardBack w={26} h={36} />
                    </div>
                ))}
        </div>
    );
}

export function SeatPod({ seat, isButton, isActor, blind, best, onSit, hideCards, isHero }: {
    seat:     HoldemSeat | null;
    isButton: boolean;
    isActor:  boolean;
    blind:    BlindMark;
    best:     Card[] | null;
    onSit:    (() => void) | null;
    hideCards?: boolean;
    isHero?:  boolean;
}) {
    if (!seat || seat.name === null) {
        return (
            <button
                type="button"
                onClick={onSit ?? undefined}
                disabled={!onSit}
                className="flex flex-col items-center justify-center rounded-[14px] active:opacity-70"
                style={{
                    width: POD_W,
                    height: POD_H,
                    marginTop: 28,
                    background: 'rgba(0,0,0,0.18)',
                    border: `1.5px dashed ${onSit ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.14)'}`,
                    color: onSit ? 'rgba(255,255,255,0.7)' : SEAT.dim,
                }}
            >
                {onSit && <Plus className="h-[14px] w-[14px]" strokeWidth={2.6} />}
                <span className="text-[12px] font-bold">{t('holdem.emptySeat', 'Open seat')}</span>
            </button>
        );
    }

    const folded = seat.state === 'folded' || seat.state === 'sitout';
    const ink = folded ? SEAT.dim : '#fff';

    return (
        <div className="flex flex-col items-center" style={{ width: POD_W }}>
            {!hideCards && <HoleCards seat={seat} best={best} dealt={seat.state !== 'sitting' && seat.state !== 'empty'} />}
            <div
                className="relative flex w-full flex-col items-center justify-center rounded-[14px]"
                style={{
                    height: POD_H,
                    background: SEAT.pod,
                    boxShadow: isActor
                        ? `inset 0 1px 0 ${SEAT.podHi}, 0 0 0 1.5px ${SEAT.live}`
                        : isHero
                            ? `inset 0 1px 0 ${SEAT.podHi}, 0 0 0 1.5px ${GOLD.mid}`
                            : `inset 0 1px 0 ${SEAT.podHi}`,
                    animation: isActor ? 'hd-turn 1.6s ease-in-out infinite' : undefined,
                }}
            >
                <span className="w-full truncate px-1.5 text-center text-[12px] font-semibold" style={{ color: ink }}>
                    {seat.name}
                </span>
                <span className="flex items-center gap-1">
                    <span className="text-[15px] font-extrabold tabular-nums" style={{ color: folded ? SEAT.dim : GOLD.top }}>
                        {fmtChips(seat.stack)}
                    </span>
                    <BlindTag mark={blind} />
                </span>
                {seat.state === 'allin' && (
                    <span className="absolute text-[11px] font-black uppercase tracking-wide" style={{ bottom: -8, color: TABLE.win }}>
                        {t('holdem.allIn', 'All in')}
                    </span>
                )}
                {isButton && <DealerChip side="right" />}
            </div>
        </div>
    );
}

export function HeroPanel({ seat, isActor, best, msLeft, clockKey, sb, bb, blind, isButton, handRank }: {
    seat:     HoldemSeat;
    isActor:  boolean;
    best:     Card[] | null;
    msLeft:   number;
    clockKey: string;
    sb:       number;
    bb:       number;
    blind:    BlindMark;
    isButton: boolean;
    handRank: string | null;
}) {
    const cards = seat.hole ?? [];
    return (
        <div className="flex shrink-0 items-center gap-3 px-4 pt-2">
            <div className="flex shrink-0 items-end" style={{ height: 96 }}>
                {cards.length === 0 && (
                    <div
                        className="rounded-[10px]"
                        style={{ width: 118, height: 92, border: '1.5px dashed rgba(255,255,255,0.14)' }}
                    />
                )}
                {cards.map((card, i) => (
                    <div
                        key={`${card.rank}${card.suit}`}
                        style={{
                            marginLeft: i === 0 ? 0 : -14,
                            animation: 'hd-deal 280ms cubic-bezier(0.2,0.8,0.3,1) both',
                            animationDelay: `${i * 120}ms`,
                        }}
                    >
                        <div
                            style={{
                                transform: `rotate(${i === 0 ? -7 : 7}deg)`,
                                borderRadius: 10,
                                opacity: best && !inCards(best, card) ? 0.45 : 1,
                                boxShadow: best && inCards(best, card) ? `0 0 0 2px ${GOLD.top}` : undefined,
                            }}
                        >
                            <CardFace card={card} w={66} h={92} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] font-bold text-white">{seat.name}</span>
                    <span className="flex items-center gap-1">
                        <BlindTag mark={blind} />
                        {isButton && (
                            <span className="text-[11px] font-black uppercase tracking-wide" style={{ color: GOLD.hi }}>
                                {t('holdem.dealer', 'Dealer')}
                            </span>
                        )}
                    </span>
                </div>
                <span className="text-[22px] font-extrabold tabular-nums" style={{ color: GOLD.top }}>{fmtChips(seat.stack)}</span>
                <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {t('holdem.blindsLine', '{sb} / {bb} blinds', { sb: fmtChips(sb), bb: fmtChips(bb) })}
                    </span>
                    {handRank !== null && (
                        <span className="shrink-0 text-[11px] font-extrabold" style={{ color: GOLD.top }}>
                            {handCatLabel(handRank)}
                        </span>
                    )}
                </span>
                <div className="mt-0.5 h-[3px] w-full overflow-hidden rounded-full" style={{ background: SURFACE.sunken }}>
                    {isActor && msLeft > 0 && (
                        <div
                            key={clockKey}
                            className="h-full origin-left rounded-full"
                            style={{
                                background: msLeft < 6000 ? TABLE.lose : SEAT.live,
                                animation: `hd-clock ${msLeft}ms linear forwards`,
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
