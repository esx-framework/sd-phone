import { useEffect, useRef, useState } from 'react';
import { Columns2, X } from 'lucide-react';

import { device } from '@device';
import { AppIconSVG } from './AppIconSVG';
import { AppBadge } from './AppBadge';
import { registerCardStage } from './appDeckBridge';
import { useBadges } from '@/stores/badgeStore';
import { useScreenW } from '@/stores/foldStore';
import type { AppDef } from '@/core/types';
import { t, appLabel } from '@/i18n';
import { dirSign } from '@/stores/directionStore';

const SH         = device.screen.h;
const SR         = 49;   // card corner, drawn scaled - deliberately rounder than the screen's own radius

// The card is a fraction of the screen, not a fixed width: hold the phone's 362/440. Everything
// derived from the WIDTH has to come from the live screen instead of device.screen.w, because
// unfolding doubles it. Reading the closed width here is what left the whole carousel centred on
// the left half while unfolded, and had each card previewing an 880-wide app in a 440-wide frame.
const CARD_FRAC  = 362 / 440;
// Height and scale survive as constants: both are ratios of the width, so they come out the same
// folded or open. SWITCHER_SCALE below is the one index.css reads, so it must not start moving.
const CARD_H     = Math.round(SH * CARD_FRAC);
const SCALE      = CARD_FRAC;
const HEADER_H   = 42;
const HEADER_TOP = 46;
const CARD_TOP   = HEADER_TOP + HEADER_H + 8;

// index.css's ios-app-expand grows an opened app from exactly the card scale it was tapped at,
// but that keyframe runs on AppDeck's host - not a descendant of this component, which unmounts
// as the animation starts. PhoneShell publishes this on the screen instead: an ancestor of the
// host that outlives the switcher.
export const SWITCHER_SCALE = SCALE;

const ICON_NATIVE = 60;
const ICON_DISP   = 36;
const ICON_SCALE  = ICON_DISP / ICON_NATIVE;

interface Props {
    apps:        AppDef[];
    recents:     string[];
    closing:     boolean;
    onDone:      () => void;
    onReady:     () => void;
    onOpen:      (id: string, origin: { x: number; y: number }) => void;
    onRemove:    (id: string) => void;
    onRemoveAll: () => void;
    onDismiss:   () => void;
    onSplit?:      (id: string) => void;
    splitExclude?: string | null;
}

// The live app view inside each card is NOT rendered here - a card renders only its
// chrome (label, close button, rounded frame) plus an empty <CardStage/> whose DOM
// node the AppDeck re-parents the single live app instance into. Non-preview apps
// (and any card the deck chooses not to fill) keep showing the icon fallback beneath.
function CardStage({ appId }: { appId: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const sw  = useScreenW();
    useEffect(() => {
        registerCardStage(appId, ref.current);
        return () => registerCardStage(appId, null);
    }, [appId]);
    return (
        <div
            ref={ref}
            className="pointer-events-none absolute start-0 top-0"
            style={{ width: sw, height: SH, transform: `scale(${SCALE})`, transformOrigin: 'top var(--dir-start, left)' }}
        />
    );
}

export function AppSwitcher({
    apps, recents, closing, onDone, onReady, onOpen, onRemove, onRemoveAll, onDismiss,
    onSplit, splitExclude,
}: Props) {
    const badges = useBadges();
    // Live, not device.screen.w: unfolding doubles the screen under the switcher.
    const sw        = useScreenW();
    const cardW     = Math.round(sw * CARD_FRAC);
    const cardStep  = Math.round(cardW * 0.74);   // overlap so the focused card sits forward
    const center    = (sw - cardW) / 2;
    const [focusedIdx, setFocusedIdx] = useState(0);
    const [swipeUpY,   setSwipeUpY]   = useState(0);
    const [dragX,      setDragX]      = useState(0);
    const [ejectingId, setEjectingId] = useState<string | null>(null);

    const isDraggingRef   = useRef(false);
    const startXRef       = useRef(0);
    const startYRef       = useRef(0);
    const capturedRef     = useRef(false);
    const axisRef         = useRef<'h' | 'v' | null>(null);
    const suppressClick   = useRef(false);
    const lastWheelRef    = useRef(0);
    const swipeUpYRef     = useRef(0);
    const dragXRef        = useRef(0);
    const lastMoveRef     = useRef({ x: 0, t: 0, vx: 0 });
    const swipeDragIdx    = useRef(-1);
    const suppressMount  = useRef(true);
    const focusedRef     = useRef(focusedIdx);
    focusedRef.current   = focusedIdx;

    useEffect(() => {
        const t = setTimeout(() => { suppressMount.current = false; }, 200);
        return () => clearTimeout(t);
    }, []);

    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        function onWheel(e: WheelEvent) {
            e.preventDefault();
            const now = Date.now();
            if (now - lastWheelRef.current < 280) return;
            lastWheelRef.current = now;

            const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY;
            if (delta > 0) {
                setFocusedIdx(f => Math.min(f + 1, recents.length - 1));
            } else if (delta < 0) {
                setFocusedIdx(f => Math.max(f - 1, 0));
            }
        }
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [recents.length]);

    function onPointerDown(e: React.PointerEvent) {
        startXRef.current     = e.clientX;
        startYRef.current     = e.clientY;
        isDraggingRef.current = true;
        capturedRef.current   = false;
        axisRef.current       = null;
        swipeDragIdx.current  = focusedRef.current;
        lastMoveRef.current   = { x: e.clientX, t: performance.now(), vx: 0 };
    }

    function onPointerMove(e: React.PointerEvent) {
        if (!isDraggingRef.current) return;
        const dx = (e.clientX - startXRef.current) * dirSign();
        const dy = e.clientY - startYRef.current;

        if (!axisRef.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
            axisRef.current = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
        }
        if (!axisRef.current) return;

        if (!capturedRef.current) {
            capturedRef.current = true;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }

        if (axisRef.current === 'h') {
            const now = performance.now();
            const last = lastMoveRef.current;
            const dt = Math.max(1, now - last.t);
            lastMoveRef.current = { x: e.clientX, t: now, vx: ((e.clientX - last.x) * dirSign()) / dt };
            const atStart = focusedRef.current === 0 && dx > 0;
            const atEnd   = focusedRef.current === recents.length - 1 && dx < 0;
            const eased = atStart || atEnd ? dx * 0.35 : dx;
            dragXRef.current = eased;
            setDragX(eased);
            return;
        }

        const newY = Math.min(0, dy);
        swipeUpYRef.current = newY;
        setSwipeUpY(newY);
    }

    function onPointerUp() {
        if (axisRef.current) {
            suppressClick.current = true;
            setTimeout(() => { suppressClick.current = false; }, 80);
        }

        if (axisRef.current === 'h') {
            const dx = dragXRef.current;
            const vx = lastMoveRef.current.vx;
            let steps = Math.round(-dx / cardStep);
            if (steps === 0 && Math.abs(dx) > 30) steps = dx < 0 ? 1 : -1;
            if (Math.abs(vx) > 0.6) steps = vx < 0 ? Math.max(steps, 1) : Math.min(steps, -1);
            setFocusedIdx(f => Math.max(0, Math.min(recents.length - 1, f + steps)));
            dragXRef.current = 0;
            setDragX(0);
        }

        if (axisRef.current === 'v') {
            const draggedId = recents[swipeDragIdx.current];
            if (swipeUpYRef.current < -80 && draggedId) {
                setSwipeUpY(0);
                swipeUpYRef.current = 0;
                setEjectingId(draggedId);
                setTimeout(() => {
                    onRemove(draggedId);
                    setEjectingId(null);
                }, 260);
            } else {
                setSwipeUpY(0);
                swipeUpYRef.current = 0;
            }
        }
        isDraggingRef.current = false;
        axisRef.current       = null;
        capturedRef.current   = false;
    }

    const animStyle = closing
        ? 'switcher-out 0.22s ease-in forwards'
        : 'switcher-in 0.30s cubic-bezier(0.22,1,0.36,1) forwards';

    return (
        <div
            ref={rootRef}
            data-switcher-ignore="1"
            className="absolute inset-0 z-30"
            style={{
                animation:              animStyle,
                backdropFilter:         'blur(16px) saturate(0.85) brightness(0.72)',
                WebkitBackdropFilter:   'blur(16px) saturate(0.85) brightness(0.72)',
                backgroundColor:        'rgba(0,0,0,0.18)',
            }}
            onAnimationEnd={e => {
                if (e.target !== e.currentTarget) return;
                if (closing) onDone();
                else onReady();
            }}
            onClick={e => {
                if (!suppressMount.current && !suppressClick.current) onDismiss();
                e.stopPropagation();
            }}
        >
            <div
                className="absolute inset-x-0"
                style={{ top: HEADER_TOP, height: HEADER_H + 8 + CARD_H }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
            >
                {recents.map((appId, idx) => {
                    const appDef    = apps.find(a => a.id === appId);
                    const tx        = center + (idx - focusedIdx) * cardStep + dragX;
                    const snapping  = !isDraggingRef.current;
                    const isEjecting = ejectingId === appId;
                    const isSwiping  = idx === swipeDragIdx.current;
                    const ty = isEjecting ? -(SH + 80) : (isSwiping ? swipeUpY : 0);
                    const cardOpacity = isEjecting
                        ? 0
                        : isSwiping && swipeUpY < 0
                            ? Math.max(0.15, 1 + swipeUpY / 160)
                            : 1;

                    // Focused card sits forward: larger, full brightness, on top; neighbours are
                    // smaller and dimmed - the "highlighted centre card" look. `d` is the
                    // signed distance from centre. Scaling from the top keeps every card's
                    // name/icon row on the same line.
                    const d       = idx - focusedIdx;
                    const ad      = Math.abs(d);
                    const cScale  = Math.max(0.78, 1 - Math.min(ad, 1) * 0.15 - Math.max(0, ad - 1) * 0.04);
                    const cBright = Math.max(0.6, 1 - Math.min(ad, 1) * 0.34);
                    const cz      = Math.round(120 - Math.min(ad, 4) * 25);
                    // Only the centred card shows its icon / name / close chrome. The cards
                    // overlap heavily, so leaving the neighbours' header rows visible smudges
                    // the focused card's top - fade them out fast as they leave centre.
                    const headerOpacity = Math.max(0, 1 - ad * 1.3);
                    const headerFocused = ad < 0.5;

                    return (
                        <div
                            key={appId}
                            className="absolute"
                            style={{
                                insetInlineStart: 0,
                                top:             0,
                                width:           cardW,
                                zIndex:          cz,
                                transform:       `translateX(calc(var(--dir-x, 1) * ${tx}px)) translateY(${ty}px) scale(${cScale})`,
                                transformOrigin: '50% 0%',
                                opacity:         cardOpacity,
                                transition: isEjecting
                                    ? 'transform 0.26s ease-in, opacity 0.26s ease-in'
                                    : snapping
                                        ? 'transform 0.42s cubic-bezier(0.22,1,0.36,1)'
                                        : 'none',
                                willChange: 'transform, opacity',
                            }}
                        >
                            <div
                                className="mb-2 flex items-center gap-2.5 ps-3 pe-1"
                                style={{
                                    opacity:       headerOpacity,
                                    pointerEvents: headerFocused ? 'auto' : 'none',
                                    transition:    snapping ? 'opacity 0.38s ease' : 'none',
                                }}
                            >
                                <div className="relative shrink-0">
                                    <div
                                        className="overflow-hidden"
                                        style={{ width: ICON_DISP, height: ICON_DISP, borderRadius: '27.6%' }}
                                    >
                                        <div style={{
                                            width:           ICON_NATIVE,
                                            height:          ICON_NATIVE,
                                            transform:       `scale(${ICON_SCALE})`,
                                            transformOrigin: 'top var(--dir-start, left)',
                                        }}>
                                            <AppIconSVG icon={appDef?.icon ?? ''} />
                                        </div>
                                    </div>
                                    <AppBadge count={badges[appId]} small />
                                </div>

                                <span
                                    className="flex-1 truncate text-[16px] font-semibold text-white"
                                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
                                >
                                    {appDef ? appLabel(appDef) : appId}
                                </span>

                                {onSplit && appId !== splitExclude && (
                                    <button
                                        type="button"
                                        aria-label={t('shell.splitBeside', 'Open {label} beside this one', { label: appDef ? appLabel(appDef) : appId })}
                                        onClick={e => { e.stopPropagation(); onSplit(appId); }}
                                        className="shrink-0 flex h-[30px] w-[30px] items-center justify-center rounded-full text-white transition-colors duration-200 active:bg-white/30"
                                        style={{
                                            background: 'rgba(255,255,255,0.18)',
                                            boxShadow:  'inset 0 0 0 0.5px rgba(255,255,255,0.28)',
                                        }}
                                    >
                                        <Columns2 className="h-[15px] w-[15px]" strokeWidth={2.25} />
                                    </button>
                                )}

                                {/* Close: to the RIGHT of the name, a larger
                                    circular glass button. Translucent over the switcher's own blur
                                    (no per-button backdrop-filter - it nests under the switcher blur
                                    and flickers in CEF). */}
                                <button
                                    type="button"
                                    aria-label={t('shell.closeApp', 'Close {label}', { label: appDef ? appLabel(appDef) : appId })}
                                    onClick={e => { e.stopPropagation(); onRemove(appId); }}
                                    className="shrink-0 flex h-[30px] w-[30px] items-center justify-center rounded-full text-white transition-colors duration-200 active:bg-white/30"
                                    style={{
                                        background: 'rgba(255,255,255,0.18)',
                                        boxShadow:  'inset 0 0 0 0.5px rgba(255,255,255,0.28)',
                                    }}
                                >
                                    <X className="h-[15px] w-[15px]" strokeWidth={2.25} />
                                </button>
                            </div>

                            <div
                                className="relative overflow-hidden"
                                style={{
                                    width:        cardW,
                                    height:       CARD_H,
                                    borderRadius: Math.round(SR * SCALE),
                                    boxShadow:    '0 14px 44px rgba(0,0,0,0.7), 0 2px 10px rgba(0,0,0,0.45)',
                                }}
                            >
                                {/* Icon fallback: shown until (or unless) the deck parents a
                                    live app host over it. Non-preview apps stay on this. */}
                                <div className="absolute inset-0 flex items-center justify-center bg-[#1c1c1e]">
                                    <div className="overflow-hidden" style={{ width: 76, height: 76, borderRadius: '22%' }}>
                                        <div style={{ width: 60, height: 60, transform: 'scale(1.2667)', transformOrigin: 'top var(--dir-start, left)' }}>
                                            <AppIconSVG icon={appDef?.icon ?? ''} />
                                        </div>
                                    </div>
                                </div>

                                <CardStage appId={appId} />

                                <div
                                    className="pointer-events-none absolute inset-0 z-[1] bg-black"
                                    style={{ opacity: 1 - cBright, transition: snapping ? 'opacity 0.4s ease' : 'none' }}
                                />

                                {/* Transparent tap target sits ABOVE the live view (which is
                                    inert / pointer-events:none while parented into the card). */}
                                <button
                                    type="button"
                                    aria-label={appDef ? appLabel(appDef) : appId}
                                    className="absolute inset-0 z-[2]"
                                    onClick={e => {
                                        e.stopPropagation();
                                        if (suppressClick.current) return;
                                        const cx = (tx + cardW / 2) / sw;
                                        const cy = (CARD_TOP + CARD_H / 2) / SH;
                                        onOpen(appId, {
                                            x: Math.max(0, Math.min(1, cx)),
                                            y: Math.max(0, Math.min(1, cy)),
                                        });
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="absolute bottom-7 start-0 end-0 flex justify-center">
                <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onRemoveAll(); }}
                    className="rounded-full bg-white/20 px-6 py-2 text-[15px] font-semibold text-white backdrop-blur-md active:opacity-70"
                    style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}
                >
                    {t('shell.closeAll','Close All')}
                </button>
            </div>
        </div>
    );
}
