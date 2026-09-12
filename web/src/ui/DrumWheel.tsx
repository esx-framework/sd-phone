import { useEffect, useRef, useState } from 'react';

import { ancestorZoom } from '@/lib/zoom';

const VISIBLE = 3;

function fadeGradient(color: string) {
    return `linear-gradient(to bottom,${color} 0%,transparent 30%,transparent 70%,${color} 100%)`;
}

export function DrumWheel({ values, index, onChange, bandHeight = 60, label, width = 96, fontSize = 56, inactiveFontSize, fontWeight = 300, inactiveFontWeight, showBand = true, forceDark = false }: {
    values:      string[];
    index:       number;
    onChange:    (i: number) => void;
    bandHeight?: number;
    label?:      string;
    width?:      number;
    fontSize?:   number;
    inactiveFontSize?:   number;
    fontWeight?:         number;
    inactiveFontWeight?: number;
    showBand?:   boolean;
    forceDark?:  boolean;
}) {
    const max  = values.length - 1;
    const winH = bandHeight * VISIBLE;

    const [offsetY,  setOffsetY]  = useState(-(index * bandHeight));
    const [snapping, setSnapping] = useState(false);
    const startYRef   = useRef(0);
    const startOffRef = useRef(0);
    const isDragging  = useRef(false);

    useEffect(() => { setOffsetY(-(index * bandHeight)); }, [index, bandHeight]);

    const wheelRef  = useRef<HTMLDivElement>(null);
    const offsetRef = useRef(offsetY);
    offsetRef.current = offsetY;
    const latest    = useRef({ max, onChange, bandHeight, winH });
    latest.current  = { max, onChange, bandHeight, winH };
    const wheelSnap  = useRef<number | null>(null);
    const wheelAccum = useRef(0);

    useEffect(() => {
        const el = wheelRef.current;
        if (!el) return;
        const STEP_PX = 80;
        function onWheel(e: WheelEvent) {
            e.preventDefault();
            const cur = latest.current;
            const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * cur.winH : e.deltaY;
            wheelAccum.current += px;
            if (Math.abs(wheelAccum.current) < STEP_PX) return;
            const dir = wheelAccum.current > 0 ? 1 : -1;
            wheelAccum.current = 0;
            const curIdx  = Math.round(-offsetRef.current / cur.bandHeight);
            const nextIdx = Math.max(0, Math.min(cur.max, curIdx + dir));
            if (nextIdx === curIdx) return;
            offsetRef.current = -(nextIdx * cur.bandHeight);
            setSnapping(true);
            setOffsetY(offsetRef.current);
            cur.onChange(nextIdx);
            if (wheelSnap.current) window.clearTimeout(wheelSnap.current);
            wheelSnap.current = window.setTimeout(() => setSnapping(false), 240);
        }
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', onWheel);
            if (wheelSnap.current) window.clearTimeout(wheelSnap.current);
        };
    }, []);

    function onPointerDown(e: React.PointerEvent) {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        startYRef.current   = e.clientY;
        startOffRef.current = offsetY;
        isDragging.current  = true;
        setSnapping(false);
    }

    function onPointerMove(e: React.PointerEvent) {
        if (!isDragging.current) return;
        const delta = (e.clientY - startYRef.current) / ancestorZoom(wheelRef.current);
        setOffsetY(Math.max(-(max * bandHeight), Math.min(0, startOffRef.current + delta)));
    }

    function onPointerUp() {
        isDragging.current = false;
        const idx = Math.max(0, Math.min(max, Math.round(-offsetY / bandHeight)));
        setSnapping(true);
        setOffsetY(-(idx * bandHeight));
        onChange(idx);
        setTimeout(() => setSnapping(false), 200);
    }

    const translateY = bandHeight + offsetY;
    const centreIdx  = Math.round(-offsetY / bandHeight);

    return (
        <div dir="ltr" className="flex flex-col items-center" style={{ width }}>
            <div
                ref={wheelRef}
                className="relative w-full cursor-ns-resize overflow-hidden"
                style={{ height: winH }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
            >
                {!forceDark && (
                    <div
                        className="pointer-events-none absolute inset-0 z-20 dark:hidden"
                        style={{ background: fadeGradient('#d4d4d4') }}
                    />
                )}
                <div
                    className={'pointer-events-none absolute inset-0 z-20' + (forceDark ? '' : ' hidden dark:block')}
                    style={{ background: fadeGradient('#000') }}
                />
                {showBand && (
                    <div
                        className={'pointer-events-none absolute start-0 end-0 z-10 border-y-[0.5px] ' + (forceDark ? 'border-white/20' : 'border-black/20 dark:border-white/20')}
                        style={{ top: bandHeight, height: bandHeight }}
                    />
                )}
                <div style={{ transform: `translateY(${translateY}px)`, transition: snapping ? 'transform 0.18s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none', willChange: 'transform' }}>
                    {values.map((text, i) => {
                        const active = i === centreIdx;
                        const tone = active
                            ? (forceDark ? 'text-white' : 'text-black dark:text-white')
                            : (forceDark ? 'text-white/25' : 'text-black/25 dark:text-white/25');
                        return (
                            <div key={i} className="flex items-center justify-center" style={{ height: bandHeight }}>
                                <span
                                    className={'select-none tabular-nums ' + tone}
                                    style={{
                                        fontSize:   active ? fontSize : (inactiveFontSize ?? fontSize),
                                        fontWeight: active ? fontWeight : (inactiveFontWeight ?? fontWeight),
                                        transition: snapping && inactiveFontSize !== undefined ? 'font-size 0.18s, font-weight 0.18s' : undefined,
                                    }}
                                >
                                    {text}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
            {label && (
                <span className={'mt-1 text-center text-[14px] ' + (forceDark ? 'text-white/50' : 'text-black/50 dark:text-white/50')}>
                    {label}
                </span>
            )}
        </div>
    );
}
