import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { device } from '@device';
import { chassisMetrics } from './chassis';
import { shellFor } from './shells';
import { FOLD_LEAF_MS, useFoldStore, type FoldSwing } from '@/stores/foldStore';
import { cloneStage, takeOutgoing } from './foldSnapshot';
import { FOLD_LEAF_ANIM, foldFrames, springTimeAt } from './foldMotion';

const HINGE_SHADOW = 'linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.45) 35%, rgba(0,0,0,0) 100%)';

const BLEED = 20;
const HINGE_UNDERLAP = 2;

export type FoldAnchor = 'left' | 'right' | 'center';

export function spineInset(radius: number): number {
    return Math.round(radius + 10);
}
export const SPINE_OUT = 6;
export const SPINE_W = SPINE_OUT + 1;

const PERSPECTIVE = 4000;
const SPINE_DEPTH = 12;

export function spineDepth(
    bodyW: number, bodyH: number, drift: number, spineX: number, top: number,
): { perspective: number; depth: number; scale: number; originX: number; originY: number } {
    return {
        perspective: PERSPECTIVE,
        depth:       SPINE_DEPTH,
        scale:       (PERSPECTIVE + SPINE_DEPTH) / PERSPECTIVE,
        originX:     bodyW / 2 - drift - spineX,
        originY:     bodyH / 2 - top,
    };
}

export interface FoldGeometry {
    hinge: number;
    drift: number;
    spine: number;
    rest:  number;
    fixedClip:    number;
    fixedContent: number;
}

export function foldGeometry(
    openSX: number, openSW: number, openW: number, closedW: number, anchor: FoldAnchor,
): FoldGeometry {
    const shut = openW - closedW;
    const hinge = openSX + openSW / 2;
    return {
        hinge,
        drift: anchor === 'right' ? 0 : anchor === 'center' ? -shut / 2 : -shut,
        spine: shut - SPINE_OUT,
        rest:  anchor === 'right' ? shut : anchor === 'center' ? shut / 2 : 0,
        fixedClip:    -HINGE_UNDERLAP,
        fixedContent: HINGE_UNDERLAP - hinge,
    };
}

interface FoldRigProps {
    swing:  FoldSwing;
    shell:  string | undefined;
    openW:  number;
    anchor: FoldAnchor;
    spine:  string;
}

export function leafMsAt(progress: number): number {
    if (progress <= 0) return 0;
    if (progress >= 1) return FOLD_LEAF_MS;
    return Math.round(springTimeAt(progress) * FOLD_LEAF_MS);
}

const EDGE_ON = 0.5;
const COVER_SETTLED = 5 / 6;

export function cornerWindow(opening: boolean): { delay: number; duration: number } {
    const from = leafMsAt(opening ? 1 - COVER_SETTLED : EDGE_ON);
    const to   = leafMsAt(opening ? EDGE_ON : COVER_SETTLED);
    return { delay: from, duration: Math.max(1, to - from) };
}

const LANDING_POLL_MS = 16;

interface LeafAnimation {
    id?: string;
    playState: string;
    currentTime: CSSNumberish | null;
    effect: { getComputedTiming: () => { endTime?: CSSNumberish } } | null;
}

function leafAnimation(leaf: HTMLElement): LeafAnimation | undefined {
    const running = leaf.getAnimations() as unknown as LeafAnimation[];
    return running.find(a => a.id === FOLD_LEAF_ANIM);
}

function hasLanded(anim: LeafAnimation): boolean {
    if (anim.playState === 'finished') return true;
    const end = Number(anim.effect?.getComputedTiming().endTime ?? FOLD_LEAF_MS);
    return anim.currentTime !== null && Number(anim.currentTime) >= end;
}

export function watchLanding(leaf: HTMLElement, onLanded: () => void): () => void {
    let done = false;
    let anim = leafAnimation(leaf);
    const poll = anim ? setInterval(() => {
        if (done) return;
        if (anim && anim.playState === 'idle') anim = leafAnimation(leaf) ?? anim;
        if (anim && hasLanded(anim)) {
            done = true;
            stop();
            onLanded();
        }
    }, LANDING_POLL_MS) : null;

    function stop() {
        if (poll !== null) clearInterval(poll);
    }
    return () => { done = true; stop(); };
}

function mount(host: HTMLElement | null, node: HTMLElement | null, left: number, top: number): void {
    if (!host) return;
    host.textContent = '';
    if (!node) return;
    const copy = node.cloneNode(true) as HTMLElement;
    copy.style.position = 'absolute';
    copy.style.left = `${left}px`;
    copy.style.top  = `${top}px`;
    host.appendChild(copy);
}

export function FoldRig({ swing, shell, openW, anchor, spine }: FoldRigProps) {
    const bookRef   = useRef<HTMLDivElement>(null);
    const leafRef   = useRef<HTMLDivElement>(null);
    const innerLRef = useRef<HTMLDivElement>(null);
    const innerRRef = useRef<HTMLDivElement>(null);
    const fixedRef  = useRef<HTMLDivElement>(null);
    const coverRef  = useRef<HTMLDivElement>(null);
    const innerShadeRef = useRef<HTMLDivElement>(null);
    const coverShadeRef = useRef<HTMLDivElement>(null);
    const hingeShadeRef = useRef<HTMLDivElement>(null);

    const resolved = useMemo(() => shellFor(shell, device.id), [shell]);
    const open   = useMemo(() => chassisMetrics(resolved, openW), [resolved, openW]);
    const closed = useMemo(() => chassisMetrics(resolved), [resolved]);

    const W  = open.W;
    const H  = open.H;
    const CW = closed.W;
    const { hinge, drift, spine: spineX, fixedClip, fixedContent } = foldGeometry(open.SX, open.SW, W, CW, anchor);
    const spineTop = spineInset(open.BR);
    const barrel = spineDepth(W, H, drift, spineX, spineTop);

    const opening = swing.dir === 'open';

    useLayoutEffect(() => {
        const incoming = cloneStage();
        const outgoing = takeOutgoing(swing.id);
        const inner = opening ? incoming : outgoing;
        const cover = opening ? outgoing : incoming;

        mount(innerLRef.current, inner, BLEED, 0);
        mount(innerRRef.current, inner, fixedContent, 0);
        mount(coverRef.current,  cover, 0, 0);
    }, [opening, fixedContent, swing.id]);

    useLayoutEffect(() => {
        const leaf = leafRef.current;
        const book = bookRef.current;
        if (!leaf || !book) return;

        const frames = foldFrames(opening, drift);
        leaf.style.transform = frames.leaf[frames.leaf.length - 1].transform as string;
        book.style.transform = frames.book[frames.book.length - 1].transform as string;

        const timing: KeyframeAnimationOptions = { duration: FOLD_LEAF_MS, easing: 'linear', fill: 'both' };
        const running: Animation[] = [
            leaf.animate(frames.leaf, { ...timing, id: FOLD_LEAF_ANIM }),
            book.animate(frames.book, timing),
        ];
        for (const [el, keys] of [
            [innerShadeRef.current, frames.inner],
            [coverShadeRef.current, frames.cover],
            [hingeShadeRef.current, frames.hinge],
        ] as const) {
            if (el) running.push(el.animate(keys, timing));
        }

        const fixed = fixedRef.current;
        if (fixed) {
            const shut = `${Math.round(open.BR)}px 0 0 ${Math.round(open.BR)}px`;
            const corner = cornerWindow(opening);
            fixed.style.transition = 'none';
            fixed.style.borderRadius = opening ? shut : '0px';
            void fixed.offsetWidth;
            fixed.style.transition = `border-radius ${corner.duration}ms linear ${corner.delay}ms`;
            fixed.style.borderRadius = opening ? '0px' : shut;
        }

        return () => { for (const a of running) a.cancel(); };
    }, [opening, drift, open.BR]);

    useEffect(() => {
        const leaf = leafRef.current;
        if (!leaf) return;
        return watchLanding(leaf, () => useFoldStore.getState().endSwing(swing.id));
    }, [swing.id]);

    const leafBox: React.CSSProperties = {
        position: 'absolute', top: 0, width: hinge, height: H,
        transformStyle: 'preserve-3d',
    };
    const hidden: React.CSSProperties = {
        backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    };

    return (
        <div
            className="sd-fold-rig pointer-events-none absolute"
            style={{
                width: W, height: H, top: 0,
                left:  anchor === 'right' ? undefined : anchor === 'center' ? '50%' : 0,
                right: anchor === 'right' ? 0 : undefined,
                transform: anchor === 'center' ? 'translateX(-50%)' : undefined,
                perspective: barrel.perspective,
                zIndex: 400,
            }}
        >
            <div ref={bookRef} className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
                <div
                    style={{
                        position: 'absolute',
                        left: spineX, top: spineTop,
                        width: SPINE_W, height: H - spineTop * 2,
                        borderRadius: 4,
                        background: spine,
                        boxShadow: '-1px 0 2px rgba(0,0,0,0.45)',
                        transform: `translateZ(-${barrel.depth}px) scale(${barrel.scale})`,
                        transformOrigin: `${barrel.originX}px ${barrel.originY}px`,
                    }}
                />

                <div style={{ ...leafBox, left: hinge }}>
                    <div
                        ref={fixedRef}
                        style={{
                            ...hidden,
                            position: 'absolute', left: fixedClip, top: 0,
                            width: hinge + BLEED - fixedClip, height: H,
                            overflow: 'hidden',
                        }}
                    >
                        <div ref={innerRRef} className="absolute inset-0" />
                        <div
                            ref={hingeShadeRef}
                            style={{
                                position: 'absolute', left: 0, top: 0,
                                width: Math.round(hinge * 0.5), height: H,
                                background: HINGE_SHADOW, opacity: 0,
                            }}
                        />
                    </div>
                </div>

                <div
                    ref={leafRef}
                    style={{ ...leafBox, left: 0, transformOrigin: 'right center', willChange: 'transform' }}
                >
                    <div
                        style={{
                            ...hidden,
                            position: 'absolute', left: -BLEED, top: 0,
                            width: hinge + BLEED, height: H,
                            overflow: 'hidden',
                        }}
                    >
                        <div ref={innerLRef} className="absolute inset-0" />
                        <div
                            ref={innerShadeRef}
                            style={{
                                position: 'absolute', left: BLEED, top: 0,
                                width: hinge, height: H,
                                background: '#000', opacity: 0,
                                borderRadius: `${Math.round(open.BR)}px 0 0 ${Math.round(open.BR)}px`,
                            }}
                        />
                    </div>
                    <div
                        style={{
                            ...hidden,
                            position: 'absolute', left: 0, top: 0, width: CW, height: H,
                            transform: 'rotateY(180deg) translateZ(1px)',
                        }}
                    >
                        <div ref={coverRef} className="absolute inset-0" />
                        <div
                            ref={coverShadeRef}
                            className="absolute inset-0"
                            style={{ background: '#000', opacity: 0, borderRadius: Math.round(closed.BR) }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
