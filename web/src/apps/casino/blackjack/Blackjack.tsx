import { useCallback, useEffect, useRef, useState } from 'react';
import { Coins, Layers, Minus, Plus, Wallet } from 'lucide-react';

import { t } from '@/i18n';

import { AlertDialog } from '@/ui/AlertDialog';
import {
    type Card, type Outcome,
    SUIT_GLYPH,
    fmtChips, handValue, isBlackjack, isBust, isRed, openingBet, statResultFor,
} from './logic';
import { type BjResult, bjDeal, bjDouble, bjHit, bjStand } from './blackjackApi';
import { isFiveM } from '@/core/nui';
import { GameHeader } from '@/apps/_games/GameHeader';
import { recordResultApi } from '@/apps/_games/statsApi';
import { readJson, writeJson } from '@/lib/storage';
import type { CasinoGameProps } from '../casinoApi';
import { PAD_B } from '../theme';
import { MuteButton } from '../MuteButton';
import { playBigWin, playCardDeal, playCardFlip, playLose, playPush, playWin } from '../sfx';

const GAME = 'blackjack';

const HOLE_CARD: Card = { rank: 'A', suit: 'S' };

const BET_KEY = 'sd-phone:blackjack:lastbet';
const initialBet = () => { const n = readJson<number>(BET_KEY) ?? 25; return Number.isFinite(n) && n > 0 ? Math.floor(n) : 25; };

const FELT = {
    bgTop:    '#1B7A4B',
    bgMid:    '#11663E',
    bgBot:    '#0B4A2D',
    gold:     '#E8C463',
    goldDeep: '#C99B2E',
    rail:     '#0A3D26',
    chipText: '#0B3A24',
    win:      '#FFD55A',
    lose:     '#FF8585',
    push:     '#CFE9D8',
};

type Phase = 'betting' | 'playing' | 'dealer' | 'result';

const CHIP_STEPS = [5, 25, 100, 1000];

export function Blackjack({ chips, onChips, onBack, onCashier }: CasinoGameProps) {
    const chipsRef = useRef(chips); chipsRef.current = chips;
    const [lastBet, setLastBet] = useState(() => initialBet());
    useEffect(() => { writeJson(BET_KEY, lastBet); }, [lastBet]);

    const [phase,   setPhase]   = useState<Phase>('betting');
    const [bet,     setBet]     = useState<number>(() => openingBet(initialBet(), chips));
    const [player,  setPlayer]  = useState<Card[]>([]);
    const [dealer,  setDealer]  = useState<Card[]>([]);
    const [holeUp,  setHoleUp]  = useState(false);
    const [doubled, setDoubled] = useState(false);
    const [outcome, setOutcome] = useState<Outcome | null>(null);
    const [payout,  setPayout]  = useState(0);
    const [confirmLeave, setConfirmLeave] = useState(false);

    const acting = useRef(false);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const after = useCallback((ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); }, []);
    useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

    function adjustBet(delta: number) { setBet(b => Math.max(0, Math.min(chipsRef.current, b + delta))); }
    function setBetMax() { setBet(chipsRef.current); }
    function setBetTo(n: number) { setBet(Math.max(0, Math.min(chipsRef.current, Math.floor(n) || 0))); }

    function finishResult(res: BjResult) {
        setOutcome(res.outcome ?? null);
        setPayout(res.net ?? 0);
        if (res.chips !== undefined) onChips(res.chips);
        setPhase('result');
        const net = res.net ?? 0;
        if (res.outcome === 'blackjack') playBigWin();
        else if (net > 0) playWin();
        else if (net < 0) playLose();
        else playPush();
        if (!isFiveM && res.outcome) void recordResultApi(GAME, 'cpu', statResultFor(res.outcome), res.net ?? 0);
    }

    function revealResolution(res: BjResult) {
        setPlayer(res.player);
        const full = res.dealer;
        const busted = isBust(res.player);
        if (!busted) setPhase('dealer');
        setDealer(full.slice(0, 2));
        if (busted || full.length <= 2) {
            after(busted ? 460 : 520, () => { setHoleUp(true); after(busted ? 420 : 460, () => finishResult(res)); });
            return;
        }
        after(520, () => {
            setHoleUp(true);
            const revealFrom = (i: number) => {
                if (i >= full.length) { after(300, () => finishResult(res)); return; }
                after(560, () => { setDealer(full.slice(0, i + 1)); revealFrom(i + 1); });
            };
            revealFrom(2);
        });
    }

    async function deal() {
        playCardDeal();
        if (acting.current) return;
        const wager = Math.min(bet, chipsRef.current); if (wager <= 0) return;
        acting.current = true;
        const res = await bjDeal(wager);
        acting.current = false;
        if (!res) return;
        setLastBet(wager); setBet(res.bet ?? wager);
        if (res.chips !== undefined) onChips(res.chips);
        setPlayer(res.player); setHoleUp(false); setDoubled(false); setOutcome(null); setPayout(0);
        setDealer([res.dealer[0], HOLE_CARD]); setPhase('playing');
        if (res.phase === 'result') after(320, () => revealResolution(res));
    }
    async function hit() {
        playCardFlip();
        if (acting.current || phase !== 'playing') return;
        acting.current = true;
        const res = await bjHit();
        acting.current = false;
        if (!res) return;
        setPlayer(res.player);
        if (res.chips !== undefined) onChips(res.chips);
        if (res.phase === 'result') after(320, () => revealResolution(res));
    }
    async function stand() {
        if (acting.current || phase !== 'playing') return;
        acting.current = true;
        const res = await bjStand();
        acting.current = false;
        if (res) revealResolution(res);
    }
    async function doubleDown() {
        if (acting.current || !(phase === 'playing' && player.length === 2 && !doubled && chipsRef.current >= bet)) return;
        acting.current = true;
        const res = await bjDouble();
        acting.current = false;
        if (!res) return;
        setDoubled(true);
        if (res.bet !== undefined) setBet(res.bet);
        if (res.chips !== undefined) onChips(res.chips);
        setPlayer(res.player);
        after(440, () => revealResolution(res));
    }
    function soloNewHand() {
        setPhase('betting'); setPlayer([]); setDealer([]); setHoleUp(false); setDoubled(false); setOutcome(null);
        setBet(openingBet(lastBet, chipsRef.current));
    }

    function leave() {
        timers.current.forEach(clearTimeout); timers.current = [];
        onBack();
    }

    const inPlay = phase === 'playing' || phase === 'dealer';

    function guardedBack() {
        if (inPlay) { setConfirmLeave(true); return; }
        leave();
    }

    return (
        <>
            <style>{`
                @keyframes bj-deal { 0% { transform: translateY(-120px) translateX(40px) rotate(-12deg) scale(0.9); opacity: 0; } 100% { transform: translateY(0) translateX(0) rotate(0deg) scale(1); opacity: 1; } }
                @keyframes bj-badge-in { 0% { transform: translateY(8px) scale(0.92); opacity: 0; } 60% { transform: translateY(0) scale(1.04); } 100% { transform: translateY(0) scale(1); opacity: 1; } }
                @keyframes bj-chip-pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
                @keyframes bj-net { 0% { transform: translateY(0); opacity: 0; } 25% { transform: translateY(-6px); opacity: 1; } 100% { transform: translateY(-26px); opacity: 0; } }
            `}</style>

            <GameHeader title={t('blackjack.title', 'Blackjack')} accent={FELT.gold} onBack={guardedBack} right={<MuteButton accent={FELT.gold} />} />

            <button type="button" onClick={onCashier} className="flex shrink-0 items-center justify-center gap-1.5 pb-0.5 active:opacity-70">
                <Coins className="h-[17px] w-[17px]" strokeWidth={2.5} style={{ color: FELT.gold }} />
                <span className="text-[18px] font-extrabold tabular-nums" style={{ color: FELT.gold }}>{fmtChips(chips)}</span>
                <span className="ml-0.5 text-[12px] font-semibold text-white/55">{t('blackjack.chips', 'chips')}</span>
            </button>

            <SoloTable
                phase={phase} bet={bet} chips={chips} player={player} dealer={dealer} holeUp={holeUp} outcome={outcome} payout={payout}
                canDouble={phase === 'playing' && player.length === 2 && !doubled && chips >= bet}
                doubleBlocked={phase === 'playing' && player.length === 2 && !doubled && chips < bet ? 'chips' : null}
                onAdjust={adjustBet} onMax={setBetMax} onSet={setBetTo} onDeal={deal}
                onHit={hit} onStand={stand} onDouble={doubleDown} onNewHand={soloNewHand} onCashier={onCashier}
            />

            {confirmLeave && (
                <AlertDialog
                    forceDark
                    title={t('blackjack.leaveTitle', 'Leave Table?')}
                    message={t('blackjack.leaveMessage', 'You will forfeit your current bet for this hand.')}
                    confirmLabel={t('blackjack.leave', 'Leave')} cancelLabel={t('blackjack.stay', 'Stay')} destructive
                    onCancel={() => setConfirmLeave(false)}
                    onConfirm={() => { setConfirmLeave(false); leave(); }}
                />
            )}
        </>
    );
}

function SoloTable({ phase, bet, chips, player, dealer, holeUp, outcome, payout, canDouble, doubleBlocked, onAdjust, onMax, onSet, onDeal, onHit, onStand, onDouble, onNewHand, onCashier }: {
    phase: Phase; bet: number; chips: number; player: Card[]; dealer: Card[]; holeUp: boolean; outcome: Outcome | null; payout: number; canDouble: boolean; doubleBlocked: 'chips' | null;
    onAdjust: (d: number) => void; onMax: () => void; onSet: (n: number) => void; onDeal: () => void;
    onHit: () => void; onStand: () => void; onDouble: () => void; onNewHand: () => void; onCashier: () => void;
}) {
    const pVal = handValue(player).total;
    const dVal = handValue(dealer).total;
    const dShown = holeUp ? dVal : (dealer.length ? handValue(dealer.slice(0, 1)).total : 0);
    return (
        <>
            <div className="relative flex min-h-0 flex-1 flex-col px-4 pt-2" style={{ paddingBottom: 24 }}>
                <div className="flex min-h-0 flex-1 flex-col rounded-[26px] px-3 py-3" style={{ background: `radial-gradient(120% 70% at 50% 0%, ${FELT.bgTop} 0%, ${FELT.bgMid} 55%, ${FELT.bgBot} 100%)`, boxShadow: `inset 0 0 0 6px ${FELT.rail}, inset 0 0 36px rgba(0,0,0,0.32), 0 8px 24px rgba(0,0,0,0.30)` }}>
                    <HandRow label={t('blackjack.dealer', 'Dealer')} cards={dealer} hideHole={!holeUp} total={dShown} showTotal={dealer.length > 0 && (holeUp || phase !== 'betting')} soft={holeUp && handValue(dealer).soft} emptyHint={phase === 'betting' ? t('blackjack.dealerWaiting', 'Dealer waiting') : undefined} />
                    <div className="relative my-1 flex flex-1 items-center justify-center">
                        {phase === 'betting' && player.length === 0 ? (
                            <div className="flex flex-col items-center" style={{ color: 'rgba(255,255,255,0.55)' }}>
                                <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ border: `2.5px dashed ${FELT.gold}`, opacity: 0.55 }}>
                                    <span className="text-[26px] font-black" style={{ color: FELT.gold }}>21</span>
                                </div>
                                <div className="mt-2 text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: FELT.gold, opacity: 0.85 }}>{t('blackjack.blackjackPays', 'Blackjack pays 1.5× in profit')}</div>
                            </div>
                        ) : <ResultBadge phase={phase} outcome={outcome} payout={payout} />}
                    </div>
                    <HandRow label={t('blackjack.you', 'You')} cards={player} hideHole={false} total={pVal} showTotal={player.length > 0} soft={handValue(player).soft} emphasize={isBlackjack(player)} />
                </div>
            </div>
            <div className="shrink-0 px-4" style={{ paddingBottom: PAD_B }}>
                {phase === 'betting'
                    ? <BetControls bet={bet} chips={chips} onAdjust={onAdjust} onMax={onMax} onSet={onSet} onDeal={onDeal} onCashier={onCashier} />
                    : phase === 'playing'
                        ? <PlayControls onHit={onHit} onStand={onStand} onDouble={onDouble} canDouble={canDouble} doubleBlocked={doubleBlocked} />
                        : phase === 'dealer'
                            ? <WaitNote text={t('blackjack.dealerPlaying', 'Dealer is playing…')} />
                            : <ResultControls onNewHand={onNewHand} canPlay={chips > 0} onCashier={onCashier} />}
            </div>
        </>
    );
}

function HandRow({ label, cards, hideHole, total, showTotal, soft, emptyHint, emphasize }: {
    label: string; cards: Card[]; hideHole: boolean; total: number; showTotal: boolean; soft: boolean;
    emptyHint?: string; emphasize?: boolean;
}) {
    const bust = showTotal && total > 21;
    return (
        <div className="flex shrink-0 flex-col items-center">
            <div className="mb-1 flex items-center gap-2">
                <span className="max-w-[140px] truncate text-[13px] font-bold uppercase tracking-[0.28em]" style={{ color: 'rgba(255,255,255,0.78)' }}>{label}</span>
                {showTotal && (
                    <span className="rounded-full px-2 py-[1px] text-[14px] font-extrabold tabular-nums" style={{ background: bust ? 'rgba(255,90,90,0.22)' : 'rgba(0,0,0,0.28)', color: bust ? FELT.lose : (emphasize ? FELT.gold : '#fff'), border: `1px solid ${bust ? 'rgba(255,90,90,0.5)' : 'rgba(255,255,255,0.18)'}` }}>
                        {emphasize ? t('blackjack.bj', 'BJ') : total}{soft && !emphasize ? t('blackjack.softSuffix', ' (soft)') : ''}
                    </span>
                )}
            </div>
            <div className="flex min-h-[120px] items-center justify-center gap-[6px]">
                {cards.length === 0 && emptyHint && <span className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{emptyHint}</span>}
                {cards.map((card, i) => {
                    const isHole = hideHole && i === 1;
                    return (
                        <div key={`${card.rank}${card.suit}-${i}`} style={{ animation: `bj-deal 0.42s cubic-bezier(0.2,0.8,0.3,1) ${i * 0.13}s both`, marginLeft: i > 0 ? -13 : 0, zIndex: i }}>
                            {isHole ? <CardBack /> : <CardFace card={card} />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function CardFace({ card }: { card: Card }) {
    const w = 80; const h = 112;
    const color = isRed(card.suit) ? '#D4213B' : '#1A1A22';
    const glyph = SUIT_GLYPH[card.suit];
    return (
        <div className="relative flex flex-col justify-between rounded-[12px] bg-white" style={{ width: w, height: h, boxShadow: '0 2px 6px rgba(0,0,0,0.32), inset 0 0 0 1px rgba(0,0,0,0.06)', padding: 7 }}>
            <div className="flex flex-col items-center leading-none" style={{ color }}>
                <span className="text-[21px] font-extrabold">{card.rank}</span>
                <span className="text-[15px] leading-none">{glyph}</span>
            </div>
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 leading-none" style={{ color, fontSize: 40 }}>{glyph}</span>
            <div className="flex flex-col items-center self-end leading-none" style={{ color, transform: 'rotate(180deg)' }}>
                <span className="text-[21px] font-extrabold">{card.rank}</span>
                <span className="text-[15px] leading-none">{glyph}</span>
            </div>
        </div>
    );
}

function CardBack() {
    const w = 80; const h = 112;
    return (
        <div className="relative overflow-hidden rounded-[12px]" style={{ width: w, height: h, background: `repeating-linear-gradient(45deg, #B11E33 0 6px, #8E1527 6px 12px)`, boxShadow: '0 2px 6px rgba(0,0,0,0.32)', border: '4px solid #fff' }}>
            <div className="absolute inset-[7px] rounded-[7px]" style={{ border: '1.5px solid rgba(255,255,255,0.55)' }} />
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[26px] font-black" style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>♠</span>
            </div>
        </div>
    );
}

function ResultBadge({ phase, outcome, payout }: { phase: Phase; outcome: Outcome | null; payout: number }) {
    if (phase !== 'result' || !outcome) return <div className="h-[1px] w-[60%]" style={{ background: 'rgba(255,255,255,0.12)' }} />;
    const label = outcome === 'blackjack' ? t('blackjack.resultBlackjack', 'Blackjack!') : outcome === 'win' ? t('blackjack.resultWin', 'You Win') : outcome === 'push' ? t('blackjack.resultPush', 'Push') : t('blackjack.resultDealerWins', 'Dealer Wins');
    const color = outcome === 'lose' ? FELT.lose : outcome === 'push' ? FELT.push : FELT.win;
    return (
        <div className="flex flex-col items-center" style={{ animation: 'bj-badge-in 0.34s ease-out' }}>
            <div className="rounded-2xl px-5 py-2 text-[22px] font-black tracking-tight" style={{ color, background: 'rgba(0,0,0,0.32)', border: `1.5px solid ${color}`, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{label}</div>
            {payout !== 0 && <div className="mt-1.5 text-[15px] font-extrabold tabular-nums" style={{ color, animation: 'bj-net 1.1s ease-out forwards' }}>{payout > 0 ? `+${fmtChips(payout)}` : fmtChips(payout)}</div>}
        </div>
    );
}

function BetControls({ bet, chips, onAdjust, onMax, onSet, onDeal, onCashier }: {
    bet: number; chips: number; onAdjust: (d: number) => void; onMax: () => void; onSet: (n: number) => void; onDeal: () => void; onCashier: () => void;
}) {
    if (chips <= 0) {
        return (
            <div className="flex flex-col items-center gap-2.5">
                <div className="text-[14px] font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>{t('blackjack.outOfChips', "You're out of chips.")}</div>
                <button type="button" onClick={onCashier} className="flex items-center gap-2 rounded-2xl px-7 py-3.5 text-[16px] font-extrabold active:scale-[0.97]" style={{ background: `linear-gradient(160deg, ${FELT.gold}, ${FELT.goldDeep})`, color: FELT.chipText }}>
                    <Wallet className="h-[17px] w-[17px]" strokeWidth={2.6} />{t('blackjack.visitCashier', 'Visit the Cashier')}
                </button>
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-center gap-2">
                {CHIP_STEPS.map(step => {
                    const can = bet + step <= chips;
                    return (
                        <button key={step} type="button" disabled={!can} onClick={() => onAdjust(step)} className="active:scale-90" style={{ opacity: can ? 1 : 0.35, transition: 'transform 0.08s' }} aria-label={t('blackjack.addChips', 'Add {step} chips', { step })}>
                            <Chip value={step} />
                        </button>
                    );
                })}
                <button type="button" onClick={onMax} className="rounded-full px-3 py-2 text-[12px] font-extrabold active:scale-95" style={{ background: 'rgba(0,0,0,0.3)', color: FELT.gold, border: `1px solid ${FELT.goldDeep}` }}>{t('blackjack.max', 'MAX')}</button>
            </div>
            <div className="flex items-center justify-center gap-3">
                <button type="button" onClick={() => onAdjust(-5)} disabled={bet <= 0} className="flex h-9 w-9 items-center justify-center rounded-full active:scale-90" style={{ background: 'rgba(0,0,0,0.3)', opacity: bet <= 0 ? 0.35 : 1 }} aria-label={t('blackjack.remove5', 'Remove 5 chips')}>
                    <Minus className="h-[18px] w-[18px]" strokeWidth={3} />
                </button>
                <div className="flex flex-col items-center rounded-2xl px-5 py-1.5" style={{ background: 'rgba(0,0,0,0.26)', border: '1px solid rgba(255,255,255,0.14)', minWidth: 130 }}>
                    <span className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: 'rgba(255,255,255,0.6)' }}>{t('blackjack.bet', 'Bet')}</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={bet ? String(bet) : ''}
                        placeholder="0"
                        onChange={e => onSet(Math.floor(Number(e.target.value.replace(/[^0-9]/g, '')) || 0))}
                        className="w-full bg-transparent text-center text-[24px] font-black tabular-nums outline-none placeholder:text-white/30"
                        style={{ color: FELT.gold }}
                        aria-label={t('blackjack.betAmount', 'Bet amount')}
                    />
                </div>
                <button type="button" onClick={() => onAdjust(5)} disabled={bet >= chips} className="flex h-9 w-9 items-center justify-center rounded-full active:scale-90" style={{ background: 'rgba(0,0,0,0.3)', opacity: bet >= chips ? 0.35 : 1 }} aria-label={t('blackjack.add5', 'Add 5 chips')}>
                    <Plus className="h-[18px] w-[18px]" strokeWidth={3} />
                </button>
            </div>
            <button type="button" onClick={onDeal} disabled={bet <= 0} className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[17px] font-extrabold active:scale-[0.98]" style={{ background: bet > 0 ? `linear-gradient(160deg, ${FELT.gold}, ${FELT.goldDeep})` : 'rgba(0,0,0,0.3)', color: bet > 0 ? FELT.chipText : 'rgba(255,255,255,0.4)', transition: 'transform 0.08s' }}>
                <Layers className="h-[18px] w-[18px]" strokeWidth={2.6} />{t('blackjack.deal', 'Deal')}
            </button>
        </div>
    );
}

function PlayControls({ onHit, onStand, onDouble, canDouble, doubleBlocked }: {
    onHit: () => void; onStand: () => void; onDouble: () => void; canDouble: boolean;
    doubleBlocked: 'chips' | null;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-stretch gap-2.5">
                <ActionButton label={t('blackjack.hit', 'Hit')} onClick={onHit} tone="light" />
                <ActionButton label={t('blackjack.stand', 'Stand')} onClick={onStand} tone="gold" />
                <ActionButton label={t('blackjack.double', 'Double')} onClick={onDouble} tone="dark" disabled={!canDouble} />
            </div>
            {doubleBlocked === 'chips' && (
                <div className="text-center text-[12px] text-ios-gray">
                    {t('blackjack.doubleNeedsChips', 'Not enough chips left to double')}
                </div>
            )}
        </div>
    );
}

function ActionButton({ label, onClick, tone, disabled }: { label: string; onClick: () => void; tone: 'light' | 'gold' | 'dark'; disabled?: boolean }) {
    const styles = tone === 'gold'
        ? { background: `linear-gradient(160deg, ${FELT.gold}, ${FELT.goldDeep})`, color: FELT.chipText }
        : tone === 'light'
            ? { background: 'rgba(255,255,255,0.92)', color: '#0B3A24' }
            : { background: 'rgba(0,0,0,0.32)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' };
    return (
        <button type="button" onClick={onClick} disabled={disabled} className="flex-1 rounded-2xl py-3.5 text-[16px] font-extrabold active:scale-[0.97]" style={{ ...styles, opacity: disabled ? 0.4 : 1, transition: 'transform 0.08s' }}>{label}</button>
    );
}

function ResultControls({ onNewHand, canPlay, onCashier }: { onNewHand: () => void; canPlay: boolean; onCashier: () => void }) {
    if (!canPlay) {
        return (
            <button type="button" onClick={onCashier} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[16px] font-extrabold active:scale-[0.98]" style={{ background: `linear-gradient(160deg, ${FELT.gold}, ${FELT.goldDeep})`, color: FELT.chipText }}>
                <Wallet className="h-[17px] w-[17px]" strokeWidth={2.6} />{t('blackjack.visitCashier', 'Visit the Cashier')}
            </button>
        );
    }
    return (
        <button type="button" onClick={onNewHand} className="w-full rounded-2xl py-3.5 text-[17px] font-extrabold active:scale-[0.98]" style={{ background: `linear-gradient(160deg, ${FELT.gold}, ${FELT.goldDeep})`, color: FELT.chipText, transition: 'transform 0.08s' }}>{t('blackjack.newHand', 'New Hand')}</button>
    );
}

function WaitNote({ text }: { text: string }) {
    return <div className="flex h-[52px] items-center justify-center text-[14px] font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>{text}</div>;
}

const CHIP_COLORS: Record<number, { ring: string; body: string }> = {
    5:    { ring: '#E23B4E', body: '#B11E33' },
    25:   { ring: '#2FA45C', body: '#15723C' },
    100:  { ring: '#2B2F3A', body: '#10131C' },
    1000: { ring: '#8E63D6', body: '#5B3AA6' },
};

function Chip({ value }: { value: number }) {
    const c = CHIP_COLORS[value] ?? CHIP_COLORS[5];
    return (
        <div className="relative flex items-center justify-center rounded-full" style={{ width: 50, height: 50, background: `radial-gradient(circle at 50% 38%, ${c.ring} 0%, ${c.body} 70%)`, boxShadow: '0 2px 5px rgba(0,0,0,0.4), inset 0 0 0 4px rgba(255,255,255,0.16)', animation: 'bj-chip-pop 0.3s ease-out' }}>
            <div className="absolute inset-[7px] rounded-full" style={{ border: '2px dashed rgba(255,255,255,0.55)' }} />
            <span className={`relative font-black text-white ${value >= 1000 ? 'text-[12px]' : 'text-[14px]'}`} style={{ textShadow: '0 1px 1px rgba(0,0,0,0.4)' }}>{value}</span>
        </div>
    );
}
