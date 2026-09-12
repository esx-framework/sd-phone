import { useRef } from 'react';

import { BOARD } from './Board';
import type { Color } from './logic';
import { t } from '@/i18n';
import { useAutoScrollToEnd } from '@/shared/chat/useAutoScrollToEnd';

const GLYPH: Record<string, string> = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
const VALUE: Record<string, number> = { Q: 9, R: 5, B: 3, N: 3, P: 1, K: 0 };

export interface HistItem { san: string; side: Color }

export function CapturedStrip({ name, captured, dark, advantage, active }: {
    name: string;
    captured: string[];
    dark: boolean;
    advantage: number;
    active: boolean;
}) {
    const sorted = [...captured].sort((a, b) => VALUE[b] - VALUE[a]);
    return (
        <div className="flex items-center gap-2.5" style={{ width: BOARD }}>
            <span className="flex shrink-0 items-center gap-2 text-[16px] font-bold text-white">
                {active && <span className="h-2 w-2 rounded-full" style={{ background: '#9CCC65', boxShadow: '0 0 6px #9CCC65' }} />}
                <span dir="auto">{name}</span>
            </span>
            <span className="flex min-w-0 items-center overflow-hidden">
                {sorted.map((k, i) => (
                    <span
                        key={i}
                        className="text-[23px] leading-none"
                        style={{
                            marginInlineStart: i ? -5 : 0,
                            color: dark ? '#161616' : '#F6F6F6',
                            WebkitTextStroke: dark ? '1px rgba(232,232,232,0.92)' : '0.5px rgba(0,0,0,0.45)',
                            textShadow: dark ? '0 1px 2px rgba(0,0,0,0.5)' : '0 1px 1px rgba(0,0,0,0.45)',
                        }}
                    >
                        {GLYPH[k]}
                    </span>
                ))}
            </span>
            {advantage > 0 && <span dir="ltr" className="ms-auto shrink-0 text-[15px] font-bold text-white/70">+{advantage}</span>}
        </div>
    );
}

export function MoveList({ items }: { items: HistItem[] }) {
    const ref = useRef<HTMLDivElement>(null);
    useAutoScrollToEnd(ref, items.length);

    const rows: { n: number; w?: string; b?: string }[] = [];
    for (let i = 0; i < items.length; i += 2) rows.push({ n: i / 2 + 1, w: items[i]?.san, b: items[i + 1]?.san });

    return (
        <div className="flex min-h-0 flex-1 flex-col" style={{ width: BOARD }}>
            <div className="mb-1 flex shrink-0 items-center justify-between px-0.5">
                <span className="text-[15px] font-bold uppercase tracking-wide text-white/60">{t('chess.moves','Moves')}</span>
                <span className="text-[13px] font-semibold text-white/40">{rows.length}</span>
            </div>
            <div ref={ref} className="no-scrollbar min-h-0 flex-1 overflow-y-auto rounded-[10px]" style={{ background: 'rgba(255,255,255,0.05)' }}>
                {rows.length === 0 ? (
                    <div className="px-3 py-2.5 text-[14px] text-white/35">{t('chess.noMovesYet','No moves yet')}</div>
                ) : (
                    rows.map((r, i) => (
                        <div key={r.n} dir="ltr" className="flex items-center gap-2 px-3 py-1.5 text-[15px] text-white/90" style={{ background: i % 2 ? 'rgba(255,255,255,0.035)' : 'transparent' }}>
                            <span className="w-7 shrink-0 text-[13px] font-semibold text-white/35">{r.n}.</span>
                            <span className="flex-1 font-semibold">{r.w}</span>
                            <span className="flex-1 font-semibold">{r.b ?? ''}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
