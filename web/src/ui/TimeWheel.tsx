import { useEffect, useRef, useState } from 'react';

import { t } from '@/i18n';
import { ancestorZoom } from '@/lib/zoom';
import { useTheme } from '@/stores/themeStore';

const ITEM_H     = 34;
const VISIBLE    = 5;
const ITEM_ANGLE = 18;
const COL_W      = 54;
const FONT_SIZE  = 23;
const STEP_PX    = 80;

function pad2(n: number) {
    return String(n).padStart(2, '0');
}

interface ColumnProps {
    items:    string[];
    index:    number;
    onChange: (i: number) => void;
    width:    number;
    itemH:    number;
    fontSize: number;
    align?:   'center' | 'right' | 'left';
    isDark:   boolean;
}

function WheelColumn({ items, index, onChange, width, itemH, fontSize, align = 'center', isDark }: ColumnProps) {
    const last   = items.length - 1;
    const winH   = itemH * VISIBLE;
    const radius = itemH / 2 / Math.tan((ITEM_ANGLE * Math.PI) / 180 / 2);

    const [scroll,    setScroll]    = useState(index);
    const [animating, setAnimating] = useState(false);
    const rootRef    = useRef<HTMLDivElement>(null);
    const scrollRef  = useRef(index);
    const dragging   = useRef(false);
    const startY     = useRef(0);
    const startScrl  = useRef(0);
    const lastY      = useRef(0);
    const lastT      = useRef(0);
    const vel        = useRef(0);
    const zoom       = useRef(1);
    const wheelAccum = useRef(0);
    const wheelSnap  = useRef<number | null>(null);
    const latest     = useRef({ index, last, onChange, itemH, winH });
    latest.current   = { index, last, onChange, itemH, winH };

    const set = (v: number) => { scrollRef.current = v; setScroll(v); };

    useEffect(() => {
        if (!dragging.current) set(index);
    }, [index]);

    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        function onWheel(e: WheelEvent) {
            e.preventDefault();
            const cur = latest.current;
            const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * cur.winH : e.deltaY;
            wheelAccum.current += px;
            if (Math.abs(wheelAccum.current) < STEP_PX) return;
            const dir = wheelAccum.current > 0 ? 1 : -1;
            wheelAccum.current = 0;
            const curIdx  = Math.round(scrollRef.current);
            const nextIdx = Math.max(0, Math.min(cur.last, curIdx + dir));
            if (nextIdx === curIdx) return;
            setAnimating(true);
            set(nextIdx);
            cur.onChange(nextIdx);
            if (wheelSnap.current) window.clearTimeout(wheelSnap.current);
            wheelSnap.current = window.setTimeout(() => setAnimating(false), 240);
        }
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', onWheel);
            if (wheelSnap.current) window.clearTimeout(wheelSnap.current);
        };
    }, []);

    function down(e: React.PointerEvent) {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragging.current = true;
        zoom.current     = ancestorZoom(e.currentTarget as HTMLElement);
        startY.current   = e.clientY;
        startScrl.current = scrollRef.current;
        lastY.current    = e.clientY;
        lastT.current    = e.timeStamp;
        vel.current      = 0;
        setAnimating(false);
    }

    function move(e: React.PointerEvent) {
        if (!dragging.current) return;
        const step = itemH * zoom.current;
        const deltaItems = (startY.current - e.clientY) / step;
        let next = startScrl.current + deltaItems;
        if (next < 0)         next = next * 0.35;
        else if (next > last) next = last + (next - last) * 0.35;
        set(next);

        const dt = e.timeStamp - lastT.current;
        if (dt > 0) vel.current = ((lastY.current - e.clientY) / step / dt) * 1000;
        lastY.current = e.clientY;
        lastT.current = e.timeStamp;
    }

    function up() {
        if (!dragging.current) return;
        dragging.current = false;
        const projected = scrollRef.current + vel.current * 0.1;
        const target    = Math.max(0, Math.min(last, Math.round(projected)));
        setAnimating(true);
        set(target);
        if (target !== index) onChange(target);
    }

    const justify = align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center';

    return (
        <div
            ref={rootRef}
            dir="ltr"
            className="relative select-none"
            style={{ width, height: winH, perspective: 1000, touchAction: 'none' }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
        >
            <div
                className="absolute inset-0"
                style={{
                    transformStyle:   'preserve-3d',
                    WebkitMaskImage:  'linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)',
                    maskImage:        'linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)',
                }}
            >
                {items.map((it, i) => {
                    const angle = (i - scroll) * ITEM_ANGLE;
                    if (Math.abs(angle) > 91) return null;
                    const opacity = Math.max(0, Math.cos((angle * Math.PI) / 180));
                    return (
                        <div
                            key={i}
                            className="absolute start-0 end-0 flex items-center px-3"
                            style={{
                                top:              '50%',
                                height:           itemH,
                                marginTop:        -itemH / 2,
                                justifyContent:   justify,
                                transform:        `rotateX(${angle}deg) translateZ(${radius}px)`,
                                transition:       animating ? 'transform 0.2s ease-out, opacity 0.2s ease-out' : 'none',
                                opacity,
                                backfaceVisibility: 'hidden',
                                color:            isDark ? '#fff' : '#000',
                                fontSize,
                                fontWeight:       400,
                            }}
                        >
                            <span className="tabular-nums">{it}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function TimeWheel({ value, onChange, open, itemHeight = ITEM_H, fontSize = FONT_SIZE, columnWidth = COL_W }: {
    value:        string;
    onChange:     (hhmm: string) => void;
    open:         boolean;
    itemHeight?:  number;
    fontSize?:    number;
    columnWidth?: number;
}) {
    const { theme } = useTheme('theme');
    const isDark = theme === 'dark';
    const winH   = itemHeight * VISIBLE;

    const [hStr, mStr] = value.split(':');
    const h24    = Number(hStr) || 0;
    const m      = Number(mStr) || 0;
    const period = h24 >= 12 ? 1 : 0;
    const h12    = h24 % 12 === 0 ? 12 : h24 % 12;

    const hours   = Array.from({ length: 12 }, (_, i) => String(i + 1));
    const minutes = Array.from({ length: 60 }, (_, i) => pad2(i));
    const periods = [t('time.am', 'AM'), t('time.pm', 'PM')];

    function emit(nh12: number, nm: number, nperiod: number) {
        let nh24 = nh12 % 12;
        if (nperiod === 1) nh24 += 12;
        onChange(`${pad2(nh24)}:${pad2(nm)}`);
    }

    const col = { width: columnWidth, itemH: itemHeight, fontSize, isDark };

    return (
        <div
            style={{
                overflow:   'hidden',
                maxHeight:  open ? winH + 8 : 0,
                opacity:    open ? 1 : 0,
                transition: 'max-height 0.3s cubic-bezier(0.32,0.72,0,1), opacity 0.24s ease-out',
            }}
        >
            <div data-testid="timewheel" className="relative flex items-center justify-center px-4 pb-1" style={{ height: winH }}>
                <div
                    className="pointer-events-none absolute start-4 end-4 rounded-[8px]"
                    style={{
                        top:       '50%',
                        height:    itemHeight,
                        transform: 'translateY(-50%)',
                        background: isDark ? 'rgba(120,120,128,0.24)' : 'rgba(120,120,128,0.16)',
                    }}
                />
                <div className="relative z-10 flex items-center gap-2">
                    <WheelColumn {...col} items={hours}   index={h12 - 1} align="right"  onChange={i => emit(i + 1, m, period)} />
                    <WheelColumn {...col} items={minutes} index={m}        align="left"   onChange={i => emit(h12, i, period)} />
                    <WheelColumn {...col} items={periods} index={period}   align="center" onChange={i => emit(h12, m, i)} />
                </div>
            </div>
        </div>
    );
}
