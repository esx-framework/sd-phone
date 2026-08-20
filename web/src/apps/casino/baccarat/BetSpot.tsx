import { useCallback, useEffect, useRef } from 'react';

import { CHIP_DENOMS, Chip } from '../roulette/Chip';
import { SURFACE, WELL_SHADOW, fmtChips } from '../theme';

const HOLD_MS = 400;
const STACK_MAX = 4;
const STACK_STEP = 5;

function stackOf(amount: number): number[] {
    const out: number[] = [];
    let left = amount;
    for (let i = CHIP_DENOMS.length - 1; i >= 0 && out.length < STACK_MAX; i--) {
        const denom = CHIP_DENOMS[i];
        while (left >= denom && out.length < STACK_MAX) {
            out.push(denom);
            left -= denom;
        }
    }
    if (out.length === 0 && amount > 0) out.push(CHIP_DENOMS[0]);
    return out;
}

export function BetSpot({ label, odds, amount, color, grow, compact, locked, won, onAdd, onClear }: {
    label:   string;
    odds:    string;
    amount:  number;
    color:   string;
    grow:    number;
    compact?: boolean;
    locked:  boolean;
    won:     boolean;
    onAdd:   () => void;
    onClear: () => void;
}) {
    const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const held = useRef(false);

    useEffect(() => () => { if (holdTimer.current) clearTimeout(holdTimer.current); }, []);

    const cancelHold = useCallback(() => {
        if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    }, []);

    const startHold = useCallback(() => {
        if (locked || amount <= 0) return;
        held.current = false;
        cancelHold();
        holdTimer.current = setTimeout(() => { held.current = true; onClear(); }, HOLD_MS);
    }, [amount, cancelHold, locked, onClear]);

    const chips = stackOf(amount);
    const chipSize = compact ? 22 : 26;

    return (
        <button
            type="button"
            disabled={locked}
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            onClick={() => { if (held.current) { held.current = false; return; } onAdd(); }}
            className="relative flex min-w-0 flex-col items-center justify-center rounded-[18px] active:opacity-85"
            style={{
                flex: `${grow} 1 0%`,
                paddingTop: compact ? 8 : 12,
                paddingBottom: compact ? 8 : 12,
                background: SURFACE.sunken,
                boxShadow: won ? `${WELL_SHADOW}, 0 0 0 2px ${color}` : WELL_SHADOW,
                border: `1.5px solid ${color}59`,
                opacity: locked ? 0.55 : 1,
                transition: 'box-shadow 160ms ease, opacity 160ms ease',
            }}
        >
            <span
                className="truncate text-[12px] font-extrabold uppercase tracking-[0.14em]"
                style={{ color, maxWidth: '100%' }}
            >
                {label}
            </span>
            <span className="mt-[1px] text-[10px] font-bold tabular-nums text-white/40">{odds}</span>

            <span
                className="relative mt-1.5 flex items-end justify-center"
                style={{ height: chipSize + (STACK_MAX - 1) * STACK_STEP }}
            >
                {chips.length === 0 ? (
                    <span
                        className="block rounded-full"
                        style={{ width: chipSize, height: chipSize, border: `1.5px dashed ${color}4D` }}
                    />
                ) : chips.map((value, i) => (
                    <span
                        key={`${value}-${i}`}
                        className="absolute left-1/2"
                        style={{ bottom: i * STACK_STEP, transform: 'translateX(-50%)', zIndex: i }}
                    >
                        <Chip value={value} size={chipSize} />
                    </span>
                ))}
            </span>

            <span
                className="mt-1 text-[13px] font-extrabold tabular-nums"
                style={{ color: amount > 0 ? '#fff' : 'rgba(255,255,255,0.28)' }}
            >
                {amount > 0 ? fmtChips(amount) : '0'}
            </span>
        </button>
    );
}
