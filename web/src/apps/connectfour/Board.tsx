import { useState } from 'react';

import { t } from '@/i18n';
import { COLS, ROWS, dropRow, type Board as BoardT, type Player } from './logic';

const CELL = 50;
const GAP = 4;
const PAD = 8;
const BOARD_W = COLS * CELL + (COLS - 1) * GAP + PAD * 2;
const BOARD_H = ROWS * CELL + (ROWS - 1) * GAP + PAD * 2;

const RED = '#E23B3B';
const RED_HI = '#FF6B6B';
const YEL = '#F2C53D';
const YEL_HI = '#FFE07A';
const BOARD_BLUE = '#1E66D0';
const BOARD_BLUE_DK = '#114596';
const HOLE = '#0E2C5E';

export function discColor(p: Player): { base: string; hi: string } {
    return p === 1 ? { base: RED, hi: RED_HI } : { base: YEL, hi: YEL_HI };
}

interface BoardProps {
    board:       BoardT;
    onDrop:      (col: number) => void;
    locked:      boolean;
    winLine:     number[];
    lastDrop:    number | null;
    previewDisc: Player;
}

export function Board({ board, onDrop, locked, winLine, lastDrop, previewDisc }: BoardProps) {
    const [hoverCol, setHoverCol] = useState<number | null>(null);
    const winSet = new Set(winLine);
    const preview = discColor(previewDisc);

    return (
        <div dir="ltr" className="relative" style={{ width: BOARD_W, height: BOARD_H }} onPointerLeave={() => setHoverCol(null)}>
            <div
                className="absolute inset-0 rounded-[22px]"
                style={{
                    background: `linear-gradient(160deg, ${BOARD_BLUE} 0%, ${BOARD_BLUE_DK} 100%)`,
                    boxShadow: '0 12px 30px rgba(0,0,0,0.45), inset 0 2px 4px rgba(255,255,255,0.25), inset 0 -3px 6px rgba(0,0,0,0.35)',
                }}
            />

            <div
                className="absolute"
                style={{ top: PAD, left: PAD, display: 'grid', gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`, gap: GAP }}
            >
                {Array.from({ length: ROWS * COLS }).map((_, i) => {
                    const r = Math.floor(i / COLS);
                    const c = i % COLS;
                    const disc = board[i];
                    const inWin = winSet.has(i);
                    const isLast = i === lastDrop;
                    const col = discColor((disc || 1) as Player);
                    const fallFrom = -(r + 1) * (CELL + GAP);
                    return (
                        <div key={i} className="relative flex items-center justify-center" style={{ width: CELL, height: CELL }}>
                            <div
                                className="absolute inset-[5px] rounded-full"
                                style={{
                                    backgroundColor: disc ? 'transparent' : HOLE,
                                    boxShadow: disc ? undefined : 'inset 0 2px 4px rgba(0,0,0,0.55), inset 0 -1px 2px rgba(255,255,255,0.10)',
                                }}
                            />
                            {!disc && hoverCol === c && !locked && dropRow(board, c) === r && (
                                <div
                                    className="absolute inset-[4px] rounded-full"
                                    style={{ background: `radial-gradient(circle at 32% 28%, ${preview.hi} 0%, ${preview.base} 58%, ${preview.base} 100%)`, opacity: 0.4 }}
                                />
                            )}
                            {disc !== 0 && (
                                <div
                                    className="absolute inset-[4px] rounded-full"
                                    style={{
                                        background: `radial-gradient(circle at 32% 28%, ${col.hi} 0%, ${col.base} 58%, ${col.base} 100%)`,
                                        boxShadow: inWin
                                            ? '0 0 0 3px rgba(255,255,255,0.92), inset 0 -3px 5px rgba(0,0,0,0.30)'
                                            : 'inset 0 -3px 5px rgba(0,0,0,0.32), inset 0 2px 3px rgba(255,255,255,0.40)',
                                        ['--c4-from' as string]: `${fallFrom}px`,
                                        animation: isLast ? 'c4-drop 0.34s cubic-bezier(0.34,0.4,0.5,1)' : undefined,
                                        zIndex: inWin ? 2 : 1,
                                    }}
                                >
                                    <div className="absolute inset-[7px] rounded-full" style={{ boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.10)' }} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="absolute inset-0 flex" style={{ padding: PAD, gap: GAP }}>
                {Array.from({ length: COLS }).map((_, c) => {
                    const full = dropRow(board, c) < 0;
                    return (
                        <button
                            key={c}
                            type="button"
                            disabled={locked || full}
                            onPointerEnter={() => setHoverCol(c)}
                            onClick={() => onDrop(c)}
                            className="h-full outline-none"
                            style={{ width: CELL, cursor: locked || full ? 'default' : 'pointer' }}
                            aria-label={t('connectfour.dropInColumn', 'Drop in column {n}', { n: c + 1 })}
                        />
                    );
                })}
            </div>
        </div>
    );
}
