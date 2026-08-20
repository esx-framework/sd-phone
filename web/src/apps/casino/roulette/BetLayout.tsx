import type { CSSProperties, ReactNode } from 'react';

import { t } from '@/i18n';
import { GOLD, SURFACE, TABLE, WELL_SHADOW } from '@/apps/casino/theme';
import {
    ROW_COLUMN, ROW_DOZEN, ROW_OUT_A, ROW_OUT_B, ROW_ZERO,
    OUTSIDE_IDS, type BetAnchor, anchorFor, betInfo,
} from './bets';
import { colorOf } from './wheel';
import { CHIP_DENOMS, Chip, chipText } from './Chip';

const CELL_W = 108;
const GAP    = 3;
const GUTTER = 16;

const H_ZERO = 50;
const H_NUM  = 46;
const H_COL  = 42;
const H_DOZ  = 42;
const H_OUT  = 52;
const SEC    = 8;

const Y_ZERO = 0;
const Y_NUM  = H_ZERO + GAP;
const Y_COL  = Y_NUM + 12 * (H_NUM + GAP);
const Y_DOZ  = Y_COL + H_COL + GAP;
const Y_OUTA = Y_DOZ + H_DOZ + SEC;
const Y_OUTB = Y_OUTA + H_OUT + GAP;

const GRID_W = GUTTER + 3 * CELL_W + 2 * GAP;
const GRID_H = Y_OUTB + H_OUT;
const PAD    = 12;

const HOT_Z    = 2;
const CORNER_Z = 3;

const ROW_Y: Record<number, number> = {
    [ROW_ZERO]: Y_ZERO, [ROW_COLUMN]: Y_COL, [ROW_DOZEN]: Y_DOZ, [ROW_OUT_A]: Y_OUTA, [ROW_OUT_B]: Y_OUTB,
};
const ROW_H: Record<number, number> = {
    [ROW_ZERO]: H_ZERO, [ROW_COLUMN]: H_COL, [ROW_DOZEN]: H_DOZ, [ROW_OUT_A]: H_OUT, [ROW_OUT_B]: H_OUT,
};

function rowY(row: number): number { return row >= 0 && row < 12 ? Y_NUM + row * (H_NUM + GAP) : ROW_Y[row]; }
function rowH(row: number): number { return row >= 0 && row < 12 ? H_NUM : ROW_H[row]; }
function colX(col: number): number { return GUTTER + col * (CELL_W + GAP); }

function pointOf(a: BetAnchor): { x: number; y: number } {
    return { x: colX(a.col) + a.ox * CELL_W, y: rowY(a.row) + a.oy * rowH(a.row) };
}

function outName(id: string): string {
    switch (id) {
        case 'red':   return t('roulette.red', 'Red');
        case 'black': return t('roulette.black', 'Black');
        case 'odd':   return t('roulette.odd', 'Odd');
        case 'even':  return t('roulette.even', 'Even');
        case 'low':   return t('roulette.low', '1-18');
        default:      return t('roulette.high', '19-36');
    }
}

function betName(id: string): string {
    const info = betInfo(id);
    if (!info) return id;
    const set = info.pockets.join(', ');
    switch (info.kind) {
        case 'straight': return `${t('roulette.straight', 'Straight')} ${info.pockets[0]}`;
        case 'split':    return `${t('roulette.split', 'Split')} ${set}`;
        case 'street':   return `${t('roulette.street', 'Street')} ${set}`;
        case 'corner':   return `${t('roulette.corner', 'Corner')} ${set}`;
        case 'line':     return `${t('roulette.line', 'Six line')} ${info.pockets[0]}-${info.pockets[5]}`;
        case 'basket':   return t('roulette.basket', 'Basket');
        case 'column':   return `${t('roulette.column', 'Column')} ${id.slice(4)}`;
        case 'dozen':    return `${t('roulette.dozen', 'Dozen')} ${id.slice(3)}`;
        default:         return outName(id);
    }
}

function stackPieces(amount: number): number[] {
    const out: number[] = [];
    let left = amount;
    for (let i = CHIP_DENOMS.length - 1; i >= 0; i--) {
        const denom = CHIP_DENOMS[i];
        while (left >= denom) { out.push(denom); left -= denom; }
    }
    if (!out.length) out.push(CHIP_DENOMS[0]);
    return out;
}

function ChipStack({ amount, won }: { amount: number; won: boolean }) {
    const pieces = stackPieces(amount);
    const shown  = pieces.slice(0, 4);
    return (
        <div
            className="relative"
            style={{
                width: 28, height: 28,
                filter: won
                    ? `drop-shadow(0 0 7px ${GOLD.top}) drop-shadow(0 2px 4px rgba(0,0,0,0.6))`
                    : 'drop-shadow(0 2px 4px rgba(0,0,0,0.55))',
            }}
        >
            {shown.map((denom, i) => (
                <div key={i} className="absolute left-0" style={{ bottom: i * 3, zIndex: i }}>
                    <Chip value={denom} label={i === shown.length - 1 ? chipText(amount) : ''} />
                </div>
            ))}
            {pieces.length > shown.length && (
                <span
                    className="absolute rounded-full px-[3px] text-[9px] font-extrabold leading-[13px] tabular-nums"
                    style={{
                        top: -(shown.length - 1) * 3 - 7, right: -10, zIndex: 6,
                        background: 'rgba(0,0,0,0.8)', color: GOLD.top, border: `1px solid ${GOLD.deep}`,
                    }}
                >
                    ×{pieces.length}
                </span>
            )}
        </div>
    );
}

function Hotspot({ id, name, style, onPlace }: {
    id: string; name: string; style: CSSProperties; onPlace: (id: string) => void;
}) {
    return (
        <button
            type="button"
            aria-label={name}
            onClick={() => onPlace(id)}
            className="absolute rounded-[3px] active:bg-white/25"
            style={style}
        />
    );
}

function Cell({ id, name, x, y, w, h, style, onPlace, children }: {
    id: string; name: string; x: number; y: number; w: number; h: number;
    style: CSSProperties; onPlace: (id: string) => void; children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={name}
            onClick={() => onPlace(id)}
            className="absolute flex items-center justify-center active:brightness-125"
            style={{ left: x, top: y, width: w, height: h, ...style }}
        >
            {children}
        </button>
    );
}

const NUM_ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const NUM_COLS = [0, 1, 2];

const NUM_BORDER = '1px solid rgba(255,255,255,0.14)';
const OUT_STYLE: CSSProperties = { background: SURFACE.panel, border: NUM_BORDER, borderRadius: 5 };

export function BetLayout({ stacks, winning, winners, onPlace }: {
    stacks:  { id: string; amount: number }[];
    winning: number | null;
    winners: string[];
    onPlace: (id: string) => void;
}) {
    const won    = new Set(winners);
    const placed = new Map(stacks.map(s => [s.id, s.amount]));

    function name(id: string): string {
        const amount = placed.get(id);
        return amount ? `${betName(id)}, ${amount}` : betName(id);
    }

    function ringFor(pocket: number): string | undefined {
        return winning === pocket ? 'rl-hit 900ms ease-in-out 2' : undefined;
    }

    return (
        <div
            className="mx-auto"
            style={{
                width: GRID_W + PAD * 2 + GUTTER,
                padding: `${PAD}px ${PAD + GUTTER}px ${PAD}px ${PAD}px`,
                borderRadius: 20,
                background: 'linear-gradient(180deg, #0C5133 0%, #073B25 100%)',
                boxShadow: `${WELL_SHADOW}, inset 0 0 0 1px rgba(255,255,255,0.07)`,
            }}
        >
            <style>{`
                @keyframes rl-chip { 0% { transform: scale(0.5); opacity: 0 } 62% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
                @keyframes rl-hit { 0%, 100% { box-shadow: inset 0 0 0 2px rgba(255,213,90,0.12) } 50% { box-shadow: inset 0 0 0 2px rgba(255,213,90,0.98) } }
            `}</style>

            <div className="relative" style={{ width: GRID_W, height: GRID_H }}>
                <div className="absolute" style={{ left: colX(0), top: Y_ZERO, width: GRID_W - GUTTER, height: H_ZERO }}>
                    <Cell
                        id="s:0" name={name('s:0')} x={0} y={0} w={GRID_W - GUTTER} h={H_ZERO} onPlace={onPlace}
                        style={{ background: TABLE.green, border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, animation: ringFor(0) }}
                    >
                        <span className="text-[19px] font-extrabold text-white">0</span>
                    </Cell>
                    {NUM_COLS.map(c => (
                        <Hotspot
                            key={`zs${c}`} id={`p:0-${c + 1}`} name={name(`p:0-${c + 1}`)} onPlace={onPlace}
                            style={{ left: colX(c) - GUTTER + 8, bottom: -11, width: CELL_W - 16, height: 22, zIndex: HOT_Z }}
                        />
                    ))}
                    <Hotspot id="bk" name={name('bk')} onPlace={onPlace} style={{ left: -11, bottom: -11, width: 24, height: 24, zIndex: CORNER_Z }} />
                </div>

                {NUM_ROWS.map(k => NUM_COLS.map(c => {
                    const n = k * 3 + 1 + c;
                    return (
                        <div key={n} className="absolute" style={{ left: colX(c), top: rowY(k), width: CELL_W, height: H_NUM }}>
                            <Cell
                                id={`s:${n}`} name={name(`s:${n}`)} x={0} y={0} w={CELL_W} h={H_NUM} onPlace={onPlace}
                                style={{
                                    background: colorOf(n) === 'red' ? TABLE.red : TABLE.black,
                                    border: NUM_BORDER, borderRadius: 4, animation: ringFor(n),
                                }}
                            >
                                <span className="text-[15px] font-bold text-white">{n}</span>
                            </Cell>
                            {c < 2 && (
                                <Hotspot id={`p:${n}-${n + 1}`} name={name(`p:${n}-${n + 1}`)} onPlace={onPlace}
                                    style={{ right: -11, top: 7, bottom: 7, width: 22, zIndex: HOT_Z }} />
                            )}
                            {k < 11 && (
                                <Hotspot id={`p:${n}-${n + 3}`} name={name(`p:${n}-${n + 3}`)} onPlace={onPlace}
                                    style={{ bottom: -11, left: 12, right: 12, height: 22, zIndex: HOT_Z }} />
                            )}
                            {c === 0 && (
                                <Hotspot id={`t:${n}`} name={name(`t:${n}`)} onPlace={onPlace}
                                    style={{ left: -12, top: 6, bottom: 6, width: 22, zIndex: HOT_Z }} />
                            )}
                            {c < 2 && k < 11 && (
                                <Hotspot id={`c:${n}`} name={name(`c:${n}`)} onPlace={onPlace}
                                    style={{ right: -11, bottom: -11, width: 24, height: 24, zIndex: CORNER_Z }} />
                            )}
                            {c === 0 && k < 11 && (
                                <Hotspot id={`l:${n}`} name={name(`l:${n}`)} onPlace={onPlace}
                                    style={{ left: -12, bottom: -11, width: 25, height: 24, zIndex: CORNER_Z }} />
                            )}
                        </div>
                    );
                }))}

                {NUM_COLS.map(c => (
                    <Cell
                        key={`col${c}`} id={`col:${c + 1}`} name={name(`col:${c + 1}`)}
                        x={colX(c)} y={Y_COL} w={CELL_W} h={H_COL} onPlace={onPlace} style={OUT_STYLE}
                    >
                        <span className="text-[14px] font-bold text-white/85">{t('roulette.twoToOne', '2:1')}</span>
                    </Cell>
                ))}

                {[t('roulette.first12', '1st 12'), t('roulette.second12', '2nd 12'), t('roulette.third12', '3rd 12')].map((label, c) => (
                    <Cell
                        key={`dz${c}`} id={`dz:${c + 1}`} name={name(`dz:${c + 1}`)}
                        x={colX(c)} y={Y_DOZ} w={CELL_W} h={H_DOZ} onPlace={onPlace} style={OUT_STYLE}
                    >
                        <span className="text-[13px] font-bold uppercase tracking-wide text-white/85">{label}</span>
                    </Cell>
                ))}

                {OUTSIDE_IDS.map((id, i) => {
                    const swatch = id === 'red' ? TABLE.red : id === 'black' ? TABLE.black : null;
                    return (
                        <Cell
                            key={id} id={id} name={name(id)}
                            x={colX(i % 3)} y={rowY(i < 3 ? ROW_OUT_A : ROW_OUT_B)} w={CELL_W} h={H_OUT}
                            onPlace={onPlace}
                            style={{
                                background: swatch ?? SURFACE.panel,
                                border: `1px solid ${swatch ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.14)'}`,
                                borderRadius: 8,
                            }}
                        >
                            <span className="text-[14px] font-bold text-white">{outName(id)}</span>
                        </Cell>
                    );
                })}

                <div className="pointer-events-none absolute inset-0" style={{ zIndex: 5 }}>
                    {stacks.map(({ id, amount }) => {
                        const anchor = anchorFor(id);
                        if (!anchor) return null;
                        const { x, y } = pointOf(anchor);
                        return (
                            <div
                                key={`${id}:${amount}`}
                                className="absolute"
                                style={{ left: x - 14, top: y - 14, animation: 'rl-chip 260ms cubic-bezier(0.2,0.8,0.3,1)' }}
                            >
                                <ChipStack amount={amount} won={won.has(id)} />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
