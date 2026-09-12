import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';

import { t } from '@/i18n';
import { formatDuration } from '@/lib/time';
import { Scrubber } from '@/ui/Scrubber';

// iOS Photos-style video player: first frame with a big play button, a slim
// bottom scrubber with elapsed / remaining times, and a mute toggle. Native
// <video controls> is deliberately avoided - it renders CEF's default control
// bar, which looks nothing like iOS.
//
// The chrome stays up while the clip is paused or while the cursor is over the
// video, and slides away once you move the cursor off a playing clip. The viewer
// swipes between photos via pointer events on an ancestor, so the interactive
// controls stop pointerdown from bubbling (otherwise a scrub or a button press
// would also start a photo swipe); the full-bleed tap layer instead lets pointers
// through, so a drag there still swipes and only its click plays / pauses.
//
// Progress is driven off the video's own timeupdate event (not rAF, which CEF
// starves), and the centre button is a solid translucent circle rather than a
// backdrop-filter, which flickers under CEF when opacity-faded.

export function VideoView({ src, active }: { src: string; active: boolean }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const forcing  = useRef(false);

    const [playing,  setPlaying]  = useState(false);
    const [current,  setCurrent]  = useState(0);
    const [duration, setDuration] = useState(0);
    const [muted,    setMuted]    = useState(false);
    const [hovering, setHovering] = useState(false);

    // Controls stay up while paused or while the cursor is over the video.
    const chrome = !playing || hovering;

    // Pause whenever this slide isn't the visible one, so a video never keeps
    // playing after you swipe past it.
    useEffect(() => {
        if (active) return;
        const v = videoRef.current;
        if (v && !v.paused) v.pause();
    }, [active]);

    function togglePlay() {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) {
            if (v.ended || (duration > 0 && v.currentTime >= duration - 0.05)) v.currentTime = 0;
            void v.play();
        } else {
            v.pause();
        }
    }

    const remaining = Math.max(0, duration - current);

    return (
        <div
            className="relative flex h-full w-full items-center justify-center"
            onMouseMove={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
        >
            <video
                ref={videoRef}
                src={src}
                playsInline
                muted={muted}
                preload="metadata"
                className="h-full w-full object-cover"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                onTimeUpdate={e => { if (!forcing.current) setCurrent(e.currentTarget.currentTime); }}
                onLoadedMetadata={e => {
                    const v = e.currentTarget;
                    if (Number.isFinite(v.duration) && v.duration > 0) { setDuration(v.duration); return; }
                    // MediaRecorder webm clips report duration = Infinity until
                    // scanned; seeking to the end forces the browser to compute it.
                    forcing.current = true;
                    try { v.currentTime = 1e101; } catch { /* not seekable yet */ }
                }}
                onDurationChange={e => {
                    const v = e.currentTarget;
                    if (!Number.isFinite(v.duration) || v.duration <= 0) return;
                    setDuration(v.duration);
                    if (forcing.current) { forcing.current = false; v.currentTime = 0; }
                }}
            />

            {/* Tap layer: pointers pass through so a drag still swipes photos; a
                plain click plays / pauses. */}
            <button
                type="button"
                aria-label={playing ? t('photos.pause', 'Pause') : t('photos.play', 'Play')}
                onClick={togglePlay}
                className="absolute inset-0 cursor-default"
            />

            {/* Centre play / pause. */}
            <button
                type="button"
                aria-label={playing ? t('photos.pause', 'Pause') : t('photos.play', 'Play')}
                onPointerDown={e => e.stopPropagation()}
                onClick={togglePlay}
                className={`absolute flex h-[84px] w-[84px] items-center justify-center rounded-full bg-black/40 text-white transition-opacity duration-300 ${
                    chrome ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
            >
                {playing
                    ? <Pause className="h-11 w-11 fill-white" strokeWidth={0} />
                    : <Play className="h-11 w-11 translate-x-[3px] fill-white" strokeWidth={0} />}
            </button>

            {/* Bottom scrubber: elapsed | track | remaining | mute. */}
            <div
                dir="ltr"
                onPointerDown={e => e.stopPropagation()}
                className={`absolute inset-x-0 bottom-0 flex items-center gap-3 px-5 pb-4 transition-opacity duration-300 ${
                    chrome ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
            >
                <span className="w-[42px] shrink-0 text-end text-[13px] tabular-nums text-white/85">{formatDuration(current)}</span>
                <div className="flex-1">
                    <Scrubber thick value={current} max={duration} onSeek={sec => {
                        const v = videoRef.current;
                        if (v) { v.currentTime = sec; setCurrent(sec); }
                    }} />
                </div>
                <span className="w-[46px] shrink-0 text-[13px] tabular-nums text-white/85">-{formatDuration(remaining)}</span>
                <button
                    type="button"
                    aria-label={muted ? t('photos.unmute', 'Unmute') : t('photos.mute', 'Mute')}
                    onClick={() => setMuted(m => !m)}
                    className="shrink-0 text-white/85 active:opacity-60"
                >
                    {muted ? <VolumeX className="h-[22px] w-[22px]" /> : <Volume2 className="h-[22px] w-[22px]" />}
                </button>
            </div>
        </div>
    );
}
