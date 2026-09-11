import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { device } from '@device';
import { chassisMetrics } from './chassis';
import { shellFor } from './shells';
import { FOLD_BOOK_MS, FOLD_LEAF_MS, useFoldStore, type FoldSwing } from '@/stores/foldStore';
import { cloneStage, takeOutgoing } from './foldSnapshot';

const LEAF_EASE = 'cubic-bezier(0.2, 0.85, 0.2, 1)';
const BOOK_EASE = 'cubic-bezier(0.22, 0.84, 0.21, 1)';

const BLEED = 20;

export type FoldAnchor = 'left' | 'right' | 'center';

export function spineInset(radius: number): number {
    return Math.round(radius + 10);
}
export const SPINE_OUT = 6;
export const SPINE_W = SPINE_OUT + 1;

export interface FoldGeometry {
    hinge: number;
    drift: number;
    spine: number;
    rest:  number;
}

export function foldGeometry(
    openSX: number, openSW: number, openW: number, closedW: number, anchor: FoldAnchor,
): FoldGeometry {
    const shut = openW - closedW;
    return {
        hinge: openSX + openSW / 2,
        drift: anchor === 'right' ? 0 : anchor === 'center' ? -shut / 2 : -shut,
        spine: shut - SPINE_OUT,
        rest:  anchor === 'right' ? shut : anchor === 'center' ? shut / 2 : 0,
    };
}

interface FoldRigProps {
    swing:  FoldSwing;
    shell:  string | undefined;
    openW:  number;
    anchor: FoldAnchor;
    spine:  string;
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

    const resolved = useMemo(() => shellFor(shell, device.id), [shell]);
    const open   = useMemo(() => chassisMetrics(resolved, openW), [resolved, openW]);
    const closed = useMemo(() => chassisMetrics(resolved), [resolved]);

    const W  = open.W;
    const H  = open.H;
    const CW = closed.W;
    const { hinge, drift, spine: spineX } = foldGeometry(open.SX, open.SW, W, CW, anchor);

    const opening = swing.dir === 'open';

    useLayoutEffect(() => {
        const incoming = cloneStage();
        const outgoing = takeOutgoing(swing.id);
        const inner = opening ? incoming : outgoing;
        const cover = opening ? outgoing : incoming;

        mount(innerLRef.current, inner, BLEED, 0);
        mount(innerRRef.current, inner, -hinge, 0);
        mount(coverRef.current,  cover, 0, 0);
    }, [opening, hinge, swing.id]);

    useLayoutEffect(() => {
        const leaf = leafRef.current;
        const book = bookRef.current;
        if (!leaf || !book) return;

        const from = opening ? 'rotateY(180deg)' : 'rotateY(0deg)';
        const to   = opening ? 'rotateY(0deg)'   : 'rotateY(180deg)';
        const bookFrom = opening ? `translateX(${drift}px)` : 'translateX(0px)';
        const bookTo   = opening ? 'translateX(0px)' : `translateX(${drift}px)`;

        leaf.style.transition = 'none';
        book.style.transition = 'none';
        leaf.style.transform = from;
        book.style.transform = bookFrom;
        void leaf.offsetWidth;
        leaf.style.transition = `transform ${FOLD_LEAF_MS}ms ${LEAF_EASE}`;
        book.style.transition = `transform ${FOLD_BOOK_MS}ms ${BOOK_EASE}`;
        leaf.style.transform = to;
        book.style.transform = bookTo;

        const fixed = fixedRef.current;
        if (fixed) {
            const shut = `${Math.round(open.BR)}px 0 0 ${Math.round(open.BR)}px`;
            const ms = Math.round(FOLD_LEAF_MS * 0.45);
            fixed.style.transition = 'none';
            fixed.style.borderRadius = opening ? shut : '0px';
            void fixed.offsetWidth;
            fixed.style.transition = opening
                ? `border-radius ${ms}ms ${LEAF_EASE}`
                : `border-radius ${ms}ms ${LEAF_EASE} ${FOLD_LEAF_MS - ms}ms`;
            fixed.style.borderRadius = opening ? '0px' : shut;
        }
    }, [opening, drift, open.BR]);

    useEffect(() => {
        const leaf = leafRef.current;
        if (!leaf) return;
        const done = (e: TransitionEvent) => {
            if (e.target === leaf && e.propertyName === 'transform') {
                useFoldStore.getState().endSwing(swing.id);
            }
        };
        leaf.addEventListener('transitionend', done);
        return () => leaf.removeEventListener('transitionend', done);
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
                perspective: 1800,
                zIndex: 400,
            }}
        >
            <div ref={bookRef} className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
                <div
                    style={{
                        position: 'absolute',
                        left: spineX, top: spineInset(open.BR),
                        width: SPINE_W, height: H - spineInset(open.BR) * 2,
                        borderRadius: 4,
                        background: spine,
                        boxShadow: '-1px 0 2px rgba(0,0,0,0.45)',
                        transform: 'translateZ(-12px)',
                    }}
                />

                <div style={{ ...leafBox, left: hinge }}>
                    <div
                        ref={fixedRef}
                        style={{
                            ...hidden,
                            position: 'absolute', left: 0, top: 0,
                            width: hinge + BLEED, height: H,
                            overflow: 'hidden',
                        }}
                    >
                        <div ref={innerRRef} className="absolute inset-0" />
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
                    </div>
                    <div
                        style={{
                            ...hidden,
                            position: 'absolute', left: 0, top: 0, width: CW, height: H,
                            transform: 'rotateY(180deg) translateZ(1px)',
                        }}
                    >
                        <div ref={coverRef} className="absolute inset-0" />
                    </div>
                </div>
            </div>
        </div>
    );
}
