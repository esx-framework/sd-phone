import { memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

import { getAppEntry, isPreviewApp, type AppId } from './appRegistry';
import { getCardStage, getFullscreenStage, getSplitStage, registerFullscreenStage, registerSplitStage, subscribeCardStages } from './appDeckBridge';
import { DeckActiveProvider } from './deckActive';
import { CustomAppFrame } from './CustomAppFrame';
import { getCustomApp } from '@/stores/customAppsStore';
import { useFoldOpen } from '@/stores/foldStore';
import { SPLIT_EXIT_MS, useSplitClosing, useSplitId, useSplitSide, useSplitStore } from '@/stores/splitStore';
import type { AppDef } from '@/core/types';
import { ArrowLeftRight } from 'lucide-react';
import { t } from '@/i18n';

// The retained keep-alive deck. It is the ONE and ONLY place any app component is
// instantiated, and it is mounted at the very top of the tree so it OUTLIVES the phone
// shell - holstering / locking tears the shell down (setView(null)) but the deck (and
// every app's live React state) survives, which is what makes the switcher previews
// come back exactly where you left them after the phone is put away and taken out.
// Each live id gets a stable host <div> (created imperatively so React never fights our
// re-parenting); the app is portaled into that host. A layout effect moves each host
// between four slots by plain DOM appendChild:
//   - the fullscreen stage (active app, phone open) -> visible, interactive. This node
//     lives INSIDE the phone screen and is registered via the bridge, so the deck can
//     re-parent into it without living inside the shell that unmounts on holster.
//   - the split stage (second app while unfolded and split) -> visible, interactive
//   - a switcher card stage (retained preview app, switcher open) -> visible, inert
//   - the hidden pool (backgrounded/retained/holstered but not shown) -> mounted,
//     effects live but suspended to ~0 CPU via deckActive
// Because it is the same DOM node re-parented, all React state / scroll / already-
// fetched data survive with zero remount and zero rasterization (no html2canvas).
//
// Birth/death (ios-app-open / ios-app-close) is a SEPARATE motion channel that lives
// on an inner node inside each host and only ever runs while fullscreen, so it never
// contends with the card scale (which is supplied by the stage's own transform).

export interface DeckAppCtx {
    onClose:           () => void;
    allApps:           AppDef[];
    installedApps:     Set<string>;
    onInstall:         (id: string) => void;
    onOpenApp:         (id: string) => void;
    onLandscapeChange: (v: boolean) => void;
}

interface AppDeckProps {
    deckIds:        AppId[];
    activeId:       AppId | null;
    splitId:        AppId | null;
    switcherOpen:   boolean;
    switcherReady:  boolean;
    closing:        boolean;
    foregroundKeys: Record<string, number>;
    launchOrigin:   { x: number; y: number } | null;
    launchExpand:   boolean;
    ctx:            DeckAppCtx;
    onCloseDone:    () => void;
}

function buildAppNode(id: AppId, ctx: DeckAppCtx): ReactNode {
    if (getCustomApp(id)) return <CustomAppFrame appId={id} onClose={ctx.onClose} />;
    const entry = getAppEntry(id);
    if (entry?.render) {
        return entry.render({
            onClose:           ctx.onClose,
            allApps:           ctx.allApps,
            installedApps:     ctx.installedApps,
            onInstall:         ctx.onInstall,
            onOpenApp:         ctx.onOpenApp,
            onLandscapeChange: ctx.onLandscapeChange,
        });
    }
    if (entry) return <AppMount id={id} onClose={ctx.onClose} />;
    return null;
}

function AppMount({ id, onClose }: { id: AppId; onClose: () => void }) {
    const [Comp] = useState(() => {
        const e = getAppEntry(id);
        return e.Resolved ?? e.Component ?? null;
    });
    if (!Comp) return null;
    return <Comp onClose={onClose} />;
}

interface AppHostProps {
    id:          AppId;
    ctx:         DeckAppCtx;
    active:      boolean;
    openKey:     number;
    origin:      { x: number; y: number } | null;
    expandOpen:  boolean;
    closing:     boolean;
    onCloseDone: () => void;
}

const AppHost = memo(function AppHost({ id, ctx, active, openKey, origin, expandOpen, closing, onCloseDone }: AppHostProps) {
    const node = useMemo(() => buildAppNode(id, ctx), [id, ctx]);
    // Starts 'open' on mount (an app only ever mounts while it is being foregrounded
    // fullscreen), replays 'open' on each subsequent foreground (openKey bump), and
    // plays 'close' when the active app is collapsing to home.
    const [phase, setPhase] = useState<'open' | 'close' | 'rest'>('open');
    const firstRef = useRef(true);

    // LAYOUT effects, not passive ones. A retained app re-renders at phase 'rest' (no animation)
    // and is re-parented into the fullscreen slot by the layout effect below. If the phase flip
    // is passive it lands AFTER that paint, so the app appears instantly at full size and only
    // then does the animation start, snapping back to its `from` keyframe and replaying. That is
    // the "instant open, then it flicks and animates" report, and it is a race: the heavier the
    // app's commit, the wider the gap between paint and effect, which is why it showed up most on
    // the apps with big lists and only occasionally on light ones. A layout effect is flushed
    // before paint, so the animation is in place on the first painted frame - which is why the
    // FIRST open was always correct: useState('open') has it there from the initial commit.
    useLayoutEffect(() => {
        if (firstRef.current) { firstRef.current = false; return; }
        setPhase('open');
    }, [openKey]);

    useLayoutEffect(() => { if (closing) setPhase('close'); }, [closing]);


    const ox = origin ? `${(origin.x * 100).toFixed(1)}%` : '50%';
    const oy = origin ? `${(origin.y * 100).toFixed(1)}%` : '80%';

    const animation = phase === 'open'
        ? (expandOpen
            ? 'ios-app-expand 0.32s cubic-bezier(0.22,1,0.36,1) forwards'
            : 'ios-app-open 0.38s cubic-bezier(0.22,1,0.36,1) forwards')
        : phase === 'close'
            ? 'ios-app-close 0.28s cubic-bezier(0.25,0.46,0.45,0.94) forwards'
            : undefined;

    return (
        <div
            data-app-screen="1"
            className={phase === 'rest' ? 'absolute inset-0' : 'absolute inset-0 app-anim-flatten'}
            style={{ transformOrigin: `${ox} ${oy}`, animation, willChange: 'transform' }}
            onAnimationEnd={e => {
                if (e.target !== e.currentTarget) return;
                if (phase === 'close') onCloseDone();
                setPhase('rest');
            }}
        >
            <DeckActiveProvider value={active}>
                <Suspense fallback={<div className="absolute inset-0 bg-base" />}>{node}</Suspense>
            </DeckActiveProvider>
        </div>
    );
});

export function AppDeck({
    deckIds, activeId, splitId, switcherOpen, switcherReady, closing, foregroundKeys, launchOrigin, launchExpand, ctx, onCloseDone,
}: AppDeckProps) {
    const hostsRef = useRef<Map<AppId, HTMLDivElement>>(new Map());
    const poolRef  = useRef<HTMLDivElement>(null);

    // Re-run re-parenting when the switcher (re)registers its card stages.
    const [stageVersion, setStageVersion] = useState(0);
    useEffect(() => subscribeCardStages(() => setStageVersion(v => v + 1)), []);

    function ensureHost(id: AppId): HTMLDivElement {
        let el = hostsRef.current.get(id);
        if (!el) {
            el = document.createElement('div');
            el.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;';
            el.setAttribute('data-deck-host', id);
            hostsRef.current.set(id, el);
        }
        return el;
    }

    // Drop hosts for ids that left the deck (their portal already unmounted).
    useEffect(() => {
        for (const [id, host] of hostsRef.current) {
            if (!deckIds.includes(id)) {
                host.remove();
                hostsRef.current.delete(id);
            }
        }
    }, [deckIds]);

    useLayoutEffect(() => {
        // Reveal every retained preview card at once the moment the switcher opens.
        // The apps are already-painted live views, so re-parenting them into the card
        // stages is cheap - no per-card stagger and no waiting for the entrance
        // animation, which is what made the cards look like they "loaded in" one by one.
        for (const id of deckIds) {
            const host = hostsRef.current.get(id);
            if (!host) continue;
            const previewable = isPreviewApp(id);

            // The fullscreen stage lives inside the open phone screen (bridge-registered).
            // When the phone is holstered/locked it is absent, so the active-app branches
            // fall back to the hidden pool -> the app suspends but stays mounted.
            const fullscreen = getFullscreenStage();

            let slot: HTMLElement | null;
            let interactive = false;
            if (switcherOpen) {
                if (previewable) {
                    slot = getCardStage(id) ?? poolRef.current;
                } else if (id === activeId && !previewable) {
                    // Heavy/WebGL active app: keep it mounted fullscreen behind the
                    // switcher blur (never re-parent a live GL canvas); its card shows
                    // the icon fallback rendered by the switcher.
                    slot = fullscreen ?? poolRef.current;
                } else {
                    slot = poolRef.current;
                }
            } else if (id === activeId && fullscreen) {
                slot = fullscreen;
                interactive = true;
            } else if (splitId && id === splitId && getSplitStage()) {
                // Split view: the right pane is an ordinary stage, so the second app is live and
                // interactive on exactly the same terms as the first. Both stay deckActive, since
                // an app the player can see and touch must not be frozen.
                slot = getSplitStage();
                interactive = true;
            } else {
                slot = poolRef.current;
            }

            if (slot && host.parentElement !== slot) slot.appendChild(host);
            host.style.pointerEvents = interactive ? 'auto' : 'none';
            if (interactive) host.removeAttribute('inert');
            else host.setAttribute('inert', '');
        }
    }, [deckIds, activeId, splitId, switcherOpen, switcherReady, stageVersion]);

    return (
        <>
            <div
                ref={poolRef}
                aria-hidden
                style={{ position: 'absolute', inset: 0, visibility: 'hidden', pointerEvents: 'none', overflow: 'hidden' }}
            />
            {deckIds.map(id => createPortal(
                <AppHost
                    id={id}
                    ctx={ctx}
                    active={!switcherOpen && (id === activeId || id === splitId)}
                    openKey={foregroundKeys[id] ?? 0}
                    origin={id === activeId ? launchOrigin : null}
                    expandOpen={id === activeId && launchExpand}
                    closing={id === activeId && closing}
                    onCloseDone={onCloseDone}
                />,
                ensureHost(id),
                id,
            ))}
        </>
    );
}

// Rendered inside the open phone screen where the active app should appear. It only
// registers a DOM node; the top-level AppDeck re-parents the live active app into it.
// Because the deck lives above the shell, this node coming and going (phone open/close)
// simply swaps the active app between "fullscreen in the phone" and "suspended in the
// pool" without ever unmounting it.
export function FullscreenStage({ mainAnim }: {
    /** Reveal animation for the main half only, so it never runs over a resting split pane. */
    mainAnim?:   string;
}) {
    const ref      = useRef<HTMLDivElement>(null);
    const splitRef = useRef<HTMLDivElement>(null);
    const unfolded = useFoldOpen();
    const splitApp = useSplitId();
    const side     = useSplitSide();
    const closing  = useSplitClosing();
    const split    = unfolded ? splitApp : null;

    // Which half each stage occupies. The split app takes the side it was opened on and the main
    // phone takes the other, so swapping sides is a straight swap of the two boxes.
    const splitLeft = side === 'left';
    const mainBox  = splitLeft ? { left: '50%', right: 0 } : { left: 0, right: '50%' };
    const paneBox  = splitLeft ? { left: 0, right: '50%' } : { left: '50%', right: 0 };

    useLayoutEffect(() => {
        registerFullscreenStage(ref.current);
        return () => registerFullscreenStage(null);
    }, []);

    // Registered only while a pane is actually shown, so the deck's split branch cannot claim an
    // app into a stage the player cannot see - folding shut hands the second app straight back to
    // the pool rather than stranding it live off-screen.
    useLayoutEffect(() => {
        registerSplitStage(split ? splitRef.current : null);
        return () => registerSplitStage(null);
    }, [split]);

    // The seam eases rather than jumps: the main half grows back into the space as the pane slides
    // out of it, so closing reads as the two halves rejoining.
    const SEAM = `left ${SPLIT_EXIT_MS}ms cubic-bezier(0.32,0.72,0,1), right ${SPLIT_EXIT_MS}ms cubic-bezier(0.32,0.72,0,1)`;
    const held = split && !closing;

    return (
        <>
            <div
                ref={ref}
                className="absolute inset-y-0 z-10 overflow-hidden"
                style={{
                    left:  held ? mainBox.left  : 0,
                    right: held ? mainBox.right : 0,
                    transition: SEAM,
                    animation: mainAnim,
                    pointerEvents: 'none',
                }}
            />
            {split && (
                <>
                    <div
                        ref={splitRef}
                        className="absolute inset-y-0 z-10 overflow-hidden"
                        style={{
                            ...paneBox,
                            pointerEvents: 'none',
                            opacity: closing ? 0 : 1,
                            transform: closing ? `translateX(${splitLeft ? -14 : 14}px) scale(0.97)` : 'none',
                            transformOrigin: splitLeft ? 'right center' : 'left center',
                            // The seam easing rides on this one too. Without it the main half slid
                            // across on a swap while the pane jumped, so the two halves visibly
                            // came apart instead of trading places.
                            transition: `${SEAM}, opacity ${SPLIT_EXIT_MS}ms ease, transform ${SPLIT_EXIT_MS}ms cubic-bezier(0.32,0.72,0,1)`,
                        }}
                    />
                    <div
                        className="absolute inset-y-0 z-20"
                        style={{
                            left: '50%', width: 1, marginLeft: -0.5,
                            background: 'rgba(0,0,0,0.35)',
                            opacity: closing ? 0 : 1,
                            transition: `opacity ${SPLIT_EXIT_MS}ms ease`,
                            pointerEvents: 'none',
                        }}
                    />

                    {/* A grip on the seam, because an invisible hit target is a secret rather than
                        an affordance. It carries the swap arrows rather than a drag handle: a
                        handle promises resizing, and the halves are always 50/50.

                        The button's own states are paint-only - background and colour, never a
                        filter. A layer-promoting hover sitting exactly on the boundary re-snaps
                        the two app stages either side of it under the screen's CSS zoom. The one
                        transform is on the icon alone, which is small and has no neighbour to
                        disturb: it turns a half circle on every swap, so the arrows travel the way
                        the panes do. */}
                    <button
                        type="button"
                        aria-label={t('shell.splitSwap', 'Swap the two sides')}
                        onClick={() => useSplitStore.getState().swap()}
                        className="absolute z-30 flex items-center justify-center rounded-full bg-[rgba(28,28,30,0.78)] text-white/80 transition-colors duration-200 hover:text-white active:bg-[rgba(28,28,30,0.96)] active:text-white/60"
                        style={{
                            left: '50%', top: '50%',
                            width: 30, height: 62, marginLeft: -15, marginTop: -31,
                            boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.16), 0 1px 6px rgba(0,0,0,0.45)',
                            opacity: closing ? 0 : 1,
                            transition: `opacity ${SPLIT_EXIT_MS}ms ease, color 200ms ease, background-color 200ms ease`,
                            pointerEvents: closing ? 'none' : 'auto',
                        }}
                    >
                        <span
                            className="flex items-center justify-center"
                            style={{
                                transform: `rotate(${splitLeft ? 180 : 0}deg)`,
                                transition: `transform ${SPLIT_EXIT_MS}ms cubic-bezier(0.32,0.72,0,1)`,
                            }}
                        >
                            <ArrowLeftRight className="h-[14px] w-[14px]" strokeWidth={2.4} />
                        </span>
                    </button>
                </>
            )}
        </>
    );
}
