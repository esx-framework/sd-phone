import { useEffect, useMemo, useState } from 'react';

import { colorOf, findKing, legalMovesFrom, type Color, type GameState, type Move, type Piece, type Status } from './logic';
import { t } from '@/i18n';

const CELL = 50;
export const BOARD = CELL * 8;

const GLYPH: Record<string, string> = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
const LIGHT = '#EBECD0';
const DARK  = '#769656';
const SEL   = 'rgba(255, 213, 79, 0.55)';
const LAST  = 'rgba(255, 213, 79, 0.32)';
const CHECK = 'rgba(229, 57, 53, 0.6)';

interface BoardProps {
    game:       GameState;
    humanColor: Color;
    locked:     boolean;
    lastMove:   { from: number; to: number } | null;
    status:     Status;
    flipped:    boolean;
    onMove:     (move: Move) => void;
}

export function Board({ game, humanColor, locked, lastMove, status, flipped, onMove }: BoardProps) {
    const [selected, setSelected] = useState<number | null>(null);
    const [promo,    setPromo]    = useState<{ from: number; to: number } | null>(null);

    const interactive = !locked && !promo && game.turn === humanColor;

    const destMap = useMemo(() => {
        const m = new Map<number, Move>();
        if (selected !== null) for (const mv of legalMovesFrom(game, selected)) m.set(mv.to, mv);
        return m;
    }, [game, selected]);

    const checkSq = useMemo(() => (status === 'check' || status === 'checkmate' ? findKing(game.board, game.turn) : -1), [status, game]);

    function tap(sq: number) {
        if (!interactive) return;
        const piece = game.board[sq];
        if (selected === null) {
            if (piece && colorOf(piece) === humanColor) setSelected(sq);
            return;
        }
        if (sq === selected) { setSelected(null); return; }
        const mv = destMap.get(sq);
        if (mv) {
            if (mv.promo) setPromo({ from: selected, to: sq });
            else { onMove(mv); setSelected(null); }
            return;
        }
        if (piece && colorOf(piece) === humanColor) setSelected(sq);
        else setSelected(null);
    }

    function choosePromo(p: 'Q' | 'R' | 'B' | 'N') {
        if (!promo) return;
        onMove({ from: promo.from, to: promo.to, promo: p });
        setPromo(null);
        setSelected(null);
    }

    useEffect(() => { if (locked || game.turn !== humanColor) setSelected(null); }, [game.turn, humanColor, locked]);

    return (
        <div
            dir="ltr"
            className="relative overflow-hidden rounded-[10px]"
            style={{ width: BOARD, height: BOARD, boxShadow: '0 14px 34px rgba(0,0,0,0.5), inset 0 0 0 3px rgba(0,0,0,0.25)' }}
        >
            {Array.from({ length: 64 }).map((_, ds) => {
                const dr = ds >> 3, dc = ds & 7;
                const sq = flipped ? 63 - ds : ds;
                const dark = ((sq >> 3) + (sq & 7)) % 2 === 1;
                const piece = game.board[sq];
                const isDest = destMap.has(sq);
                const isCapture = isDest && piece !== null;
                let overlay: string | undefined;
                if (sq === selected) overlay = SEL;
                else if (lastMove && (sq === lastMove.from || sq === lastMove.to)) overlay = LAST;

                const rankLabel = flipped ? dr + 1 : 8 - dr;
                const fileLabel = (flipped ? 'hgfedcba' : 'abcdefgh')[dc];

                return (
                    <button
                        key={ds}
                        type="button"
                        onClick={() => tap(sq)}
                        className="absolute flex items-center justify-center p-0"
                        style={{ left: dc * CELL, top: dr * CELL, width: CELL, height: CELL, background: dark ? DARK : LIGHT, cursor: interactive ? 'pointer' : 'default' }}
                    >
                        {sq === checkSq && <span className="absolute inset-0" style={{ background: CHECK, boxShadow: 'inset 0 0 0 3px rgba(229,57,53,0.95)', animation: 'chess-check-pulse 1.05s ease-in-out infinite' }} />}
                        {overlay && <span className="absolute inset-0" style={{ background: overlay }} />}
                        {isDest && !isCapture && <span className="absolute rounded-full" style={{ width: CELL * 0.3, height: CELL * 0.3, background: 'rgba(20,20,20,0.32)' }} />}
                        {isCapture && <span className="absolute rounded-full" style={{ inset: 3, border: '3px solid rgba(20,20,20,0.32)' }} />}
                        {dc === 0 && <span className="absolute start-[2px] top-[1px] text-[9px] font-bold" style={{ color: dark ? LIGHT : DARK }}>{rankLabel}</span>}
                        {dr === 7 && <span className="absolute bottom-[0px] end-[2px] text-[9px] font-bold" style={{ color: dark ? LIGHT : DARK }}>{fileLabel}</span>}
                        {piece && <PieceGlyph piece={piece} />}
                    </button>
                );
            })}

            {promo && (
                <>
                    <div className="absolute inset-0 z-20" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setPromo(null)} />
                    <div className="absolute inset-x-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-3 px-4">
                        <span className="text-[15px] font-semibold text-white">{t('chess.promoteTo','Promote to')}</span>
                        <div className="flex gap-2.5">
                            {(['Q', 'R', 'B', 'N'] as const).map(p => (
                                <button key={p} type="button" onClick={() => choosePromo(p)} className="flex h-14 w-14 items-center justify-center rounded-[12px] active:opacity-70" style={{ background: LIGHT }}>
                                    <span style={glyphStyle(humanColor === 'w' ? (p as Piece) : p.toLowerCase() as Piece, 36)}>{GLYPH[p]}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function glyphStyle(piece: Piece, size: number) {
    const white = colorOf(piece) === 'w';
    return {
        fontSize: size, lineHeight: 1,
        color: white ? '#FAFAFA' : '#1F1F1F',
        textShadow: white ? '0 1px 2px rgba(0,0,0,0.55)' : '0 1px 1px rgba(255,255,255,0.18)',
        WebkitTextStroke: white ? '1.1px #2E2E2E' : '0.6px rgba(0,0,0,0.35)',
    } as const;
}

function PieceGlyph({ piece }: { piece: Piece }) {
    return (
        <span className="relative" style={{ ...glyphStyle(piece, CELL * 0.85), animation: 'chess-pop 0.16s ease-out' }}>
            {GLYPH[piece.toUpperCase()]}
        </span>
    );
}
