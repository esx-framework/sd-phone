import type { CSSProperties } from 'react';

import { EMBER, SURFACE } from '@/apps/casino/theme';

import { AREA_PATH, CURVE_PATH, GRID, HEAD_KEYFRAMES, MAX_MS, VIEW_H, VIEW_W, bustAtMs, headAt } from './curve';

const SWEEP_KEYFRAMES = '@keyframes crash-sweep { from { transform: scaleX(0); } to { transform: scaleX(1); } }';

const ORIGIN: CSSProperties = { transformBox: 'view-box', transformOrigin: '0 0' };

export function CurveChart({ phase, runKey, delayMs, bustX100 }: {
    phase:     'bet' | 'run' | 'bust';
    runKey:    number;
    delayMs:   number;
    bustX100:  number | null;
}) {
    const drawn = phase === 'run' || phase === 'bust';
    const frozenMs = bustAtMs(bustX100 ?? 100);
    const head = headAt(phase === 'bust' ? frozenMs : 0);

    const sweep: CSSProperties = phase === 'run'
        ? { ...ORIGIN, animation: `crash-sweep ${MAX_MS}ms linear -${delayMs}ms forwards` }
        : { ...ORIGIN, transform: `scaleX(${(frozenMs / MAX_MS).toFixed(5)})` };

    const marker: CSSProperties = phase === 'run'
        ? { ...ORIGIN, animation: `crash-head ${MAX_MS}ms linear -${delayMs}ms forwards` }
        : { ...ORIGIN, transform: `translate(${head.x}px, ${head.y}px)` };

    return (
        <div
            className="mx-auto shrink-0 overflow-hidden rounded-[22px]"
            style={{ width: VIEW_W + 10, padding: 5, background: SURFACE.sunken, boxShadow: `inset 0 1px 0 ${SURFACE.hair}` }}
        >
            <style>{`${SWEEP_KEYFRAMES} ${HEAD_KEYFRAMES}`}</style>

            <svg width={VIEW_W} height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true" style={{ display: 'block' }}>
                <defs>
                    <linearGradient id="crash-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={EMBER.mid} stopOpacity="0.34" />
                        <stop offset="70%" stopColor={EMBER.deep} stopOpacity="0.10" />
                        <stop offset="100%" stopColor={EMBER.deep} stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="crash-line" x1="0" y1="1" x2="1" y2="0">
                        <stop offset="0%" stopColor={EMBER.deep} />
                        <stop offset="50%" stopColor={EMBER.mid} />
                        <stop offset="100%" stopColor={EMBER.hot} />
                    </linearGradient>
                    <clipPath id="crash-reveal">
                        <rect key={runKey} x="0" y="0" width={VIEW_W} height={VIEW_H} style={sweep} />
                    </clipPath>
                </defs>

                {GRID.map(line => (
                    <g key={line.x100}>
                        <line
                            x1="0" x2={VIEW_W} y1={line.y} y2={line.y}
                            stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeDasharray="3 6"
                        />
                        <text
                            x={VIEW_W - 4}
                            y={line.y - 4}
                            textAnchor="end"
                            fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.32)"
                        >
                            {line.x100 / 100}x
                        </text>
                    </g>
                ))}

                <line x1="0" x2={VIEW_W} y1={VIEW_H - 0.5} y2={VIEW_H - 0.5} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />

                <path d={CURVE_PATH} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" strokeLinecap="round" />

                {drawn && (
                    <g clipPath="url(#crash-reveal)">
                        <path d={AREA_PATH} fill="url(#crash-area)" />
                        <path d={CURVE_PATH} fill="none" stroke="url(#crash-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                )}

                {drawn && (
                    <g key={runKey} style={marker}>
                        <circle cx="0" cy="0" r="9" fill={EMBER.hot} opacity="0.20" />
                        <circle cx="0" cy="0" r="5" fill={EMBER.hot} opacity="0.45" />
                        <circle cx="0" cy="0" r="3.5" fill={phase === 'bust' ? '#FF8585' : EMBER.hot} />
                        <circle cx="0" cy="0" r="1.4" fill="#FFF6E4" />
                    </g>
                )}
            </svg>
        </div>
    );
}
