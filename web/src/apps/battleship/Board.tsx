import { GRID, colOf, rowOf, type Ship } from './logic';
import { t } from '@/i18n';

export type CellView = 'water' | 'ship' | 'hit' | 'miss' | 'sunk';

const NAVY     = '#0B2A45';
const NAVY_DK  = '#082138';
const SHIP     = '#5E6B7A';
const SUNK     = '#7E2222';
const HIT_PEG  = '#E23B3B';
const MISS_PEG = '#A7BBD0';

interface GridProps {
    cells:  CellView[];
    cell:   number;
    accent: string;
    onTap?: (i: number) => void;
    locked?: boolean;
    ships?: Ship[];
}

export function Grid({ cells, cell, accent, onTap, locked, ships }: GridProps) {
    const gap = Math.max(2, Math.round(cell * 0.08));
    const pad = Math.max(4, Math.round(cell * 0.16));
    const W = GRID * cell + (GRID - 1) * gap + pad * 2;
    return (
        <div
            dir="ltr"
            className="relative rounded-[14px]"
            style={{ width: W, padding: pad, background: `linear-gradient(160deg, ${accent}2e 0%, ${NAVY_DK} 100%)`, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 8px 22px rgba(0,0,0,0.40)' }}
        >
            {ships && (
                <div className="pointer-events-none absolute" style={{ top: pad, left: pad, zIndex: 0 }}>
                    {ships.map(s => <Boat key={s.id} ship={s} cell={cell} gap={gap} cells={cells} />)}
                </div>
            )}
            <div className="relative" style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID}, ${cell}px)`, gap, zIndex: 1 }}>
                {cells.map((v, i) => {
                    const tappable = !!onTap && !locked && v === 'water';
                    const shipCell = v === 'ship' || v === 'hit' || v === 'sunk';
                    const bg = ships && shipCell ? 'transparent' : v === 'ship' || v === 'hit' ? SHIP : v === 'sunk' ? SUNK : NAVY;
                    return (
                        <button
                            key={i}
                            type="button"
                            disabled={!tappable}
                            onClick={tappable ? () => onTap!(i) : undefined}
                            aria-label={t('battleship.cellLabel', 'cell {i}', { i })}
                            className="relative rounded-[5px] outline-none"
                            style={{ width: cell, height: cell, background: bg, boxShadow: ships && shipCell ? 'none' : 'inset 0 1px 2px rgba(0,0,0,0.45)', cursor: tappable ? 'pointer' : 'default' }}
                        >
                            {(v === 'hit' || v === 'sunk') && (
                                <span className="absolute inset-0 m-auto rounded-full" style={{ width: cell * 0.4, height: cell * 0.4, background: HIT_PEG, boxShadow: '0 0 6px rgba(226,59,59,0.9)' }} />
                            )}
                            {v === 'miss' && (
                                <span className="absolute inset-0 m-auto rounded-full" style={{ width: cell * 0.24, height: cell * 0.24, background: MISS_PEG, opacity: 0.85 }} />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function Boat({ ship, cell, gap, cells }: { ship: Ship; cell: number; gap: number; cells: CellView[] }) {
    const rs = ship.cells.map(rowOf), cs = ship.cells.map(colOf);
    const r0 = Math.min(...rs), c0 = Math.min(...cs);
    const r1 = Math.max(...rs), c1 = Math.max(...cs);
    const horiz = r0 === r1;
    const left = c0 * (cell + gap);
    const top  = r0 * (cell + gap);
    const w = (c1 - c0 + 1) * cell + (c1 - c0) * gap;
    const h = (r1 - r0 + 1) * cell + (r1 - r0) * gap;
    const sunk = ship.cells.every(i => cells[i] === 'sunk');
    const inset = Math.round(cell * 0.13);
    const peg = Math.max(3, Math.round(cell * 0.12));
    const dir = horiz ? '180deg' : '90deg';
    const hull = sunk
        ? `linear-gradient(${dir}, #AC5252 0%, #7E2F2F 55%, #4C1B1B 100%)`
        : `linear-gradient(${dir}, #B6BFCB 0%, #7C8794 52%, #4D5660 100%)`;
    return (
        <div className="absolute" style={{ left: left + inset, top: top + inset, width: w - inset * 2, height: h - inset * 2 }}>
            <div className="absolute inset-0" style={{ borderRadius: 9999, background: hull, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22), inset 0 1px 2px rgba(255,255,255,0.30), 0 2px 5px rgba(0,0,0,0.40)' }}>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[2px]" style={{ width: horiz ? '24%' : '50%', height: horiz ? '50%' : '24%', background: sunk ? '#5A2222' : '#3D444E', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.18)' }} />
                <span className="absolute rounded-full" style={{ width: peg, height: peg, background: 'rgba(0,0,0,0.35)', left: horiz ? '18%' : '50%', top: horiz ? '50%' : '18%', transform: 'translate(-50%,-50%)' }} />
                <span className="absolute rounded-full" style={{ width: peg, height: peg, background: 'rgba(0,0,0,0.35)', left: horiz ? '82%' : '50%', top: horiz ? '50%' : '82%', transform: 'translate(-50%,-50%)' }} />
            </div>
        </div>
    );
}
