import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { useDeckActive } from '@/shell/deckActive';
import { LiveVideoPlayer, liveVideoPlaybackSupported, type LiveHealth } from '@/shared/liveMedia';
import {
    FRAME_DELTA,
    FRAME_INIT,
    FRAME_KEY,
    relayAvailable,
    relayJoin,
    type RelayGrant,
    type RelayStreamHandle,
} from '@/shared/mediaSocket';
import type { LiveTransport } from './liveBroadcast';

const ATTACH_GAP_MS = 2500;
const KEEPALIVE_MS = 5000;
const SILENT_MS = 5000;
const SWITCH_IDLE_MS = 1500;
const TIMESLICE_MS = 500;
const DEFAULT_MIME = 'video/webm';

export interface LiveAttach {
    relay?: RelayGrant | null;
    mime?:  string | null;
    mode?:  'video' | 'image' | null;
}

export interface LiveVideoOptions<T extends LiveAttach> {
    liveId:    string;
    video:     RefObject<HTMLVideoElement | null>;
    join:      (relay: boolean) => Promise<T | null>;
    onAttach?: (result: T, first: boolean) => void;
    onGone?:   () => void;
}

export interface LiveVideoState {
    health:     LiveHealth;
    transport:  LiveTransport;
    feedEvent:  (bytes: Uint8Array, init: boolean, mime?: string, gen?: number) => void;
    setOffered: (transport: LiveTransport) => void;
    markEnded:  () => void;
}

type Feeder = (from: LiveTransport, bytes: Uint8Array, init: boolean, hint: string, gen: number) => void;

export function useLiveVideo<T extends LiveAttach>(o: LiveVideoOptions<T>): LiveVideoState {
    const { liveId, video } = o;

    const [health, setHealth] = useState<LiveHealth>('starting');
    const [transport, setTransport] = useState<LiveTransport>('event');

    const deckActive = useDeckActive();
    const deckRef = useRef(deckActive);
    deckRef.current = deckActive;

    const joinRef = useRef(o.join);
    joinRef.current = o.join;
    const attachRef = useRef(o.onAttach);
    attachRef.current = o.onAttach;
    const goneRef = useRef(o.onGone);
    goneRef.current = o.onGone;

    const playerRef = useRef<LiveVideoPlayer | null>(null);
    const feedRef = useRef<Feeder | null>(null);
    const endedRef = useRef<(() => void) | null>(null);
    const offeredRef = useRef<((next: LiveTransport) => void) | null>(null);

    useEffect(() => {
        playerRef.current?.setActive(deckActive);
    }, [deckActive]);

    useEffect(() => {
        let alive = true;
        let mime = '';
        let relayMime = '';
        let handle: RelayStreamHandle | null = null;
        let joining = false;
        let committed: LiveTransport | null = null;
        let offered = true;
        let imageOnly = false;
        let first = true;
        let attachedAt = 0;
        const seen: Record<LiveTransport, number> = { relay: 0, event: 0 };

        setHealth('starting');
        setTransport('event');

        const destroy = () => {
            playerRef.current?.destroy();
            playerRef.current = null;
        };

        const dropRelay = () => {
            const open = handle;
            handle = null;
            if (!open) return;
            try {
                open.close();
            } catch {}
        };

        const wantRelay = () => offered && !handle && relayAvailable();

        const needInit = () => {
            if (!alive) return;
            if (committed === 'relay' && handle) {
                handle.requestKeyframe();
                return;
            }
            void attach(wantRelay());
        };

        const feed: Feeder = (from, bytes, init, hint, gen) => {
            if (!alive || bytes.byteLength === 0) return;
            const element = video.current;
            if (!element) return;

            const now = Date.now();
            if (committed !== from) {
                if (!init) return;
                if (committed !== null && now - seen[committed] < SWITCH_IDLE_MS) return;
                destroy();
                committed = from;
                setTransport(from);
            }
            seen[from] = now;

            if (init) {
                const want = hint || mime || DEFAULT_MIME;
                if (!liveVideoPlaybackSupported(want)) return;
                if (want !== mime) {
                    mime = want;
                    destroy();
                }
            }

            if (!playerRef.current) {
                if (!init) return;
                const player = new LiveVideoPlayer(element, mime || DEFAULT_MIME, {
                    timesliceMs: TIMESLICE_MS,
                    onHealth: next => {
                        if (alive) setHealth(next);
                    },
                    onNeedInit: () => needInit(),
                });
                playerRef.current = player;
                player.start();
                player.setActive(deckRef.current);
            }
            playerRef.current.append(bytes, init, gen);
        };

        const joinRelay = async (grant: RelayGrant) => {
            if (!alive || handle || joining) return;
            joining = true;
            const opened = await relayJoin({
                token: grant.token,
                key:   grant.streamId,
                onFrame: frame => {
                    if (frame.kind !== FRAME_INIT && frame.kind !== FRAME_KEY && frame.kind !== FRAME_DELTA) return;
                    feed('relay', frame.payload, frame.kind === FRAME_INIT, relayMime, frame.gen);
                },
                onDesc: desc => {
                    if (desc.mime) relayMime = desc.mime;
                },
                onState: state => {
                    if (state === 'ended' || state === 'offline' || state === 'expired') dropRelay();
                },
                onError: () => dropRelay(),
            });
            joining = false;
            if (!alive || !opened) {
                opened?.close();
                return;
            }
            handle = opened;
        };

        const attach = async (wantRelay: boolean) => {
            const now = Date.now();
            if (now - attachedAt < ATTACH_GAP_MS) return;
            attachedAt = now;

            const res = await joinRef.current(wantRelay);
            if (!alive) return;
            const wasFirst = first;
            first = false;
            if (!res) {
                if (wasFirst) goneRef.current?.();
                return;
            }
            attachRef.current?.(res, wasFirst);
            if (res.mode === 'image') imageOnly = true;
            else if (res.mode === 'video') imageOnly = false;
            if (res.mime && !mime) mime = res.mime;
            if (res.relay) void joinRelay(res.relay);
        };

        feedRef.current = feed;
        endedRef.current = () => {
            if (!alive) return;
            dropRelay();
            playerRef.current?.markOffAir('offair');
            setHealth('offair');
        };
        offeredRef.current = next => {
            if (!alive) return;
            offered = next === 'relay';
            if (offered) void attach(wantRelay());
            else dropRelay();
        };

        void attach(wantRelay());

        const keepAlive = window.setInterval(() => {
            if (!alive || imageOnly) return;
            if (committed !== null && Date.now() - seen[committed] < SILENT_MS) return;
            void attach(wantRelay());
        }, KEEPALIVE_MS);

        return () => {
            alive = false;
            window.clearInterval(keepAlive);
            feedRef.current = null;
            endedRef.current = null;
            offeredRef.current = null;
            dropRelay();
            destroy();
        };
    }, [liveId, video]);

    const feedEvent = useCallback((bytes: Uint8Array, init: boolean, mime?: string, gen?: number) => {
        feedRef.current?.('event', bytes, init, mime ?? '', gen ?? 0);
    }, []);

    const setOffered = useCallback((next: LiveTransport) => {
        offeredRef.current?.(next);
    }, []);

    const markEnded = useCallback(() => {
        endedRef.current?.();
    }, []);

    return { health, transport, feedEvent, setOffered, markEnded };
}
