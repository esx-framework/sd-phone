import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';

import { trackFraction } from '@/lib/zoom';
import { formatDuration } from '@/lib/time';

export function AudioTransport({ src, armed, active, duration = 0, actions }: {
    src:       string;
    armed:     boolean;
    active:    boolean;
    duration?: number;
    actions?:  ReactNode;
}) {
    const audioRef    = useRef<HTMLAudioElement>(null);
    const trackRef    = useRef<HTMLDivElement>(null);
    const scrubbing   = useRef(false);
    const pendingSeek = useRef<number | null>(null);

    const [playing, setPlaying] = useState(false);
    const [at, setAt]           = useState(0);
    const [total, setTotal]     = useState(duration);

    useEffect(() => { if (!active) audioRef.current?.pause(); }, [active]);

    const seekTo = (clientX: number) => {
        const track = trackRef.current;
        const el    = audioRef.current;
        if (!track || !el || !total) return;
        const f = trackFraction(track, clientX);
        if (f === null) return;
        const next = f * total;
        setAt(next);
        if (el.readyState > 0) el.currentTime = next;
        else pendingSeek.current = next;
    };

    const endScrub = () => { scrubbing.current = false; };
    const pct = total ? Math.min(100, (at / total) * 100) : 0;

    return (
        <div className="flex items-center gap-3">
            {armed && (
                <audio
                    ref={audioRef}
                    src={src}
                    preload="metadata"
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => { setPlaying(false); setAt(0); }}
                    onTimeUpdate={e => {
                        if (scrubbing.current || e.currentTarget.seeking) return;
                        setAt(e.currentTarget.currentTime);
                    }}
                    onLoadedMetadata={e => {
                        const el = e.currentTarget;
                        const d  = el.duration;
                        if (Number.isFinite(d) && d > 0) setTotal(d);
                        if (pendingSeek.current !== null) {
                            el.currentTime = pendingSeek.current;
                            pendingSeek.current = null;
                        }
                    }}
                />
            )}

            <button
                type="button"
                onClick={() => {
                    const el = audioRef.current;
                    if (!el) return;
                    if (el.paused) void el.play(); else el.pause();
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ios-blue text-white active:opacity-70"
            >
                {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-[2px] h-4 w-4 fill-current" />}
            </button>

            <div
                ref={trackRef}
                onPointerDown={e => {
                    if (!total) return;
                    scrubbing.current = true;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    seekTo(e.clientX);
                }}
                onPointerMove={e => { if (scrubbing.current) seekTo(e.clientX); }}
                onPointerUp={endScrub}
                onPointerCancel={endScrub}
                className="relative -my-2 min-w-0 flex-1 cursor-pointer touch-none py-2"
            >
                <div className="relative h-5">
                    <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-black/15 dark:bg-white/20" />
                    <div className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-black/45 dark:bg-white/55" style={{ width: `${pct}%` }} />
                    <div className="absolute top-1/2 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black shadow-sm dark:bg-white" style={{ left: `${pct}%` }} />
                </div>
            </div>

            <span className="shrink-0 text-[13px] tabular-nums text-black/50 dark:text-white/50">
                {formatDuration(at)} / {formatDuration(total)}
            </span>

            {actions}
        </div>
    );
}
