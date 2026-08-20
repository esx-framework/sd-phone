import type { TransitionEvent } from 'react';

import { GOLD, TABLE } from '@/apps/casino/theme';
import { POCKET_ANGLE, WHEEL_ORDER, colorOf } from './wheel';

const VIEW = 248;

export const WHEEL_SIZE = 330;

const S = WHEEL_SIZE / VIEW;

export const BALL_TRACK_R = 108 * S;
export const BALL_REST_R  = 78 * S;
export const WHEEL_TRANS  = 'transform 4200ms cubic-bezier(0.17, 0.67, 0.12, 1)';
export const BALL_TRANS   = 'transform 1600ms cubic-bezier(0.4, 0, 0.2, 1) 2600ms';

const C = VIEW / 2;
const R_RIM      = 120;
const R_TRACK    = 115;
const R_TRACK_IN = 110;
const R_OUT      = 100;
const R_IN       = 62;
const R_TEXT     = 82;
const R_HUB      = 54;
const R_HUB_IN   = 30;

const FRET = '#8E7038';

function round(n: number): number { return Math.round(n * 100) / 100; }

function polar(r: number, deg: number): [number, number] {
    const a = (deg - 90) * Math.PI / 180;
    return [round(C + r * Math.cos(a)), round(C + r * Math.sin(a))];
}

const POCKET_FILL: Record<string, string> = { red: TABLE.red, black: '#191919', green: TABLE.green };

const WEDGES = WHEEL_ORDER.map((pocket, k) => {
    const a0 = k * POCKET_ANGLE - POCKET_ANGLE / 2;
    const a1 = a0 + POCKET_ANGLE;
    const [ox0, oy0] = polar(R_OUT, a0);
    const [ox1, oy1] = polar(R_OUT, a1);
    const [ix1, iy1] = polar(R_IN, a1);
    const [ix0, iy0] = polar(R_IN, a0);
    return {
        pocket,
        angle: round(k * POCKET_ANGLE),
        fill:  POCKET_FILL[colorOf(pocket)],
        d: `M${ox0} ${oy0}A${R_OUT} ${R_OUT} 0 0 1 ${ox1} ${oy1}L${ix1} ${iy1}A${R_IN} ${R_IN} 0 0 0 ${ix0} ${iy0}Z`,
        fret: { x1: ix0, y1: iy0, x2: ox0, y2: oy0 },
    };
});

export function Wheel({ wheelDeg, ballDeg, ballR, ballSnap, onSettled }: {
    wheelDeg:   number;
    ballDeg:    number;
    ballR:      number;
    ballSnap:   boolean;
    onSettled:  () => void;
}) {
    function handleEnd(e: TransitionEvent<HTMLDivElement>) {
        if (e.target !== e.currentTarget || e.propertyName !== 'transform') return;
        onSettled();
    }

    return (
        <div className="relative" style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}>
            <div className="absolute inset-0" style={{ transform: `rotate(${wheelDeg}deg)`, transition: WHEEL_TRANS, willChange: 'transform' }}>
                <svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox={`0 0 ${VIEW} ${VIEW}`} style={{ display: 'block' }} aria-hidden="true">
                    <defs>
                        <linearGradient id="rl-gold" x1="0" y1="0" x2="0.55" y2="1">
                            <stop offset="0%" stopColor={GOLD.hi} />
                            <stop offset="30%" stopColor={GOLD.top} />
                            <stop offset="62%" stopColor={GOLD.mid} />
                            <stop offset="100%" stopColor={GOLD.deep} />
                        </linearGradient>
                        <linearGradient id="rl-hub" x1="0.2" y1="0" x2="0.8" y2="1">
                            <stop offset="0%" stopColor={GOLD.mid} />
                            <stop offset="52%" stopColor={GOLD.deep} />
                            <stop offset="100%" stopColor="#6E5220" />
                        </linearGradient>
                        <radialGradient id="rl-felt" cx="0.4" cy="0.32" r="0.8">
                            <stop offset="0%" stopColor="#126B43" />
                            <stop offset="100%" stopColor="#053721" />
                        </radialGradient>
                    </defs>

                    <circle cx={C} cy={C} r={R_RIM} fill="none" stroke="url(#rl-gold)" strokeWidth="10" />
                    <circle cx={C} cy={C} r={R_RIM + 5} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="1.5" />
                    <circle cx={C} cy={C} r={R_TRACK} fill="#1A1A1A" />
                    <circle cx={C} cy={C} r={R_TRACK_IN} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="4" />

                    {WEDGES.map(w => <path key={`w${w.pocket}`} d={w.d} fill={w.fill} />)}
                    {WEDGES.map(w => (
                        <line key={`f${w.pocket}`} x1={w.fret.x1} y1={w.fret.y1} x2={w.fret.x2} y2={w.fret.y2} stroke={FRET} strokeWidth="1" />
                    ))}
                    <circle cx={C} cy={C} r={R_OUT} fill="none" stroke={FRET} strokeWidth="1.2" />
                    <circle cx={C} cy={C} r={R_IN} fill="none" stroke={FRET} strokeWidth="1.2" />

                    {WEDGES.map(w => (
                        <text
                            key={`n${w.pocket}`}
                            x={C} y={C - R_TEXT}
                            transform={`rotate(${w.angle} ${C} ${C})`}
                            textAnchor="middle" dominantBaseline="central"
                            fontSize="10" fontWeight="700" fill="#FFFFFF" letterSpacing="-0.2"
                        >
                            {w.pocket}
                        </text>
                    ))}

                    <circle cx={C} cy={C} r={R_HUB} fill="url(#rl-hub)" />
                    <circle cx={C} cy={C} r={R_HUB} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
                    <g transform={`rotate(45 ${C} ${C})`}>
                        <rect x={C - 3} y={C - 46} width="6" height="92" rx="3" fill="url(#rl-gold)" />
                        <rect x={C - 46} y={C - 3} width="92" height="6" rx="3" fill="url(#rl-gold)" />
                    </g>
                    <circle cx={C} cy={C} r={R_HUB_IN} fill="url(#rl-felt)" />
                    <circle cx={C} cy={C} r={R_HUB_IN} fill="none" stroke={GOLD.deep} strokeWidth="2" />
                    <circle cx={C} cy={C} r="7" fill="url(#rl-gold)" />
                </svg>
            </div>

            <div
                className="absolute inset-0"
                style={{ transform: `rotate(${ballDeg}deg)`, transition: WHEEL_TRANS, willChange: 'transform' }}
                onTransitionEnd={handleEnd}
            >
                <div
                    className="absolute left-1/2 top-1/2 rounded-full"
                    style={{
                        width: 11 * S, height: 11 * S,
                        background: 'radial-gradient(circle at 32% 28%, #FFFDF3 0%, #F4E3B0 42%, #C9A24A 100%)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.55)',
                        transform: `translate(-50%, -50%) translateY(${-ballR}px)`,
                        transition: ballSnap ? 'none' : BALL_TRANS,
                        willChange: 'transform',
                    }}
                />
            </div>

            <div
                className="absolute left-1/2 top-0"
                style={{
                    width: 15, height: 15, marginLeft: -7.5, marginTop: -3,
                    transform: 'rotate(45deg)',
                    borderRadius: 3,
                    background: `linear-gradient(160deg, ${GOLD.top} 0%, ${GOLD.mid} 45%, ${GOLD.deep} 100%)`,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                }}
            />
        </div>
    );
}
