import { useEffect, useRef, useState } from 'react';
import { VideoOff } from 'lucide-react';

import { t } from '@/i18n';
import { LiveVideoPlayer, base64ToBytes, liveVideoPlaybackSupported } from '@/shared/liveMedia';
import { mdtCameraUnwatch, mdtCameraWatch } from './mdtApi';
import { onCameraChunk, onCameraOff, type CameraChunkPush } from './cameraBus';
import type { CameraQuality, CameraTile } from './data';

const KEEPALIVE_MS = 5000;
const MAX_REPRIMES = 6;

export function feedNotice(camera: CameraTile, active: boolean, previews: boolean): string | null {
    if (camera.self) return t('mdt.cameraSelf', 'Your own camera');
    if (camera.status === 'unsupported') return t('mdt.cameraUnsupported', 'This unit cannot publish video');
    if (camera.status === 'busy') return t('mdt.cameraBusy', 'The unit is using its camera');
    if (!active) {
        return previews
            ? t('mdt.cameraIdle', 'Open to connect')
            : t('mdt.cameraPreviewsOff', 'Live thumbnails are off');
    }
    return null;
}

export function CameraFeed({ camera, quality, active, notice }: {
    camera:  CameraTile;
    quality: CameraQuality;
    active:  boolean;
    notice:  string | null;
}) {
    const videoRef  = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<LiveVideoPlayer | null>(null);
    const genRef    = useRef<number | null>(null);
    const mimeRef   = useRef<string>('');

    const [playing, setPlaying] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const playingRef = useRef(false);
    playingRef.current = playing;
    const failureRef = useRef<string | null>(null);
    failureRef.current = failure;
    const reprimes = useRef(0);

    useEffect(() => () => {
        playerRef.current?.destroy();
        playerRef.current = null;
    }, []);

    useEffect(() => {
        if (!active || notice) return;

        let alive = true;
        reprimes.current = 0;
        setFailure(null);

        const drop = () => {
            playerRef.current?.destroy();
            playerRef.current = null;
            genRef.current = null;
            setPlaying(false);
        };

        const ingest = (push: CameraChunkPush) => {
            if (!alive || !push.chunk) return;
            const video = videoRef.current;
            if (!video) return;

            const gen = push.gen ?? 0;
            if (genRef.current !== null && genRef.current !== gen) drop();
            genRef.current = gen;

            if (push.init) {
                if (!playerRef.current) {
                    const mime = push.mime || mimeRef.current || 'video/webm';
                    if (!liveVideoPlaybackSupported(mime)) {
                        setFailure(t('mdt.cameraNoDecoder', 'This terminal cannot play that stream'));
                        return;
                    }
                    mimeRef.current = mime;
                    const player = new LiveVideoPlayer(video, mime);
                    player.start();
                    playerRef.current = player;
                }
                playerRef.current.append(base64ToBytes(push.chunk));
                return;
            }
            playerRef.current?.append(base64ToBytes(push.chunk));
        };

        const offChunk = onCameraChunk(camera.citizenid, ingest);
        const offEnded = onCameraOff(camera.citizenid, () => {
            if (!alive) return;
            drop();
            setFailure(t('mdt.cameraOffAir', 'That unit is no longer on the air'));
        });

        const attach = (reprime: boolean) => {
            void mdtCameraWatch(camera.id, quality, reprime).then(res => {
                if (!alive) return;
                if (typeof res === 'string') {
                    setFailure(res || t('mdt.cameraNoFeed', 'No feed from that unit'));
                    return;
                }
                setFailure(null);
                if (res.mime) mimeRef.current = res.mime;
            });
        };

        attach(false);
        const keepAlive = window.setInterval(() => {
            const stalled = !playingRef.current && failureRef.current === null && reprimes.current < MAX_REPRIMES;
            if (stalled) reprimes.current += 1;
            attach(stalled);
        }, KEEPALIVE_MS);

        return () => {
            alive = false;
            window.clearInterval(keepAlive);
            offChunk();
            offEnded();
            drop();
            void mdtCameraUnwatch(camera.id);
        };
    }, [camera.id, camera.citizenid, quality, active, notice]);

    const message = notice ?? failure;

    return (
        <div className="absolute inset-0 overflow-hidden bg-black">
            <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                onPlaying={() => { reprimes.current = 0; setPlaying(true); }}
                onCanPlay={() => { void videoRef.current?.play?.().catch(() => {}); }}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ display: playing && !message ? 'block' : 'none' }}
            />

            {(!playing || message) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center">
                    {message ? (
                        <>
                            <VideoOff className="h-6 w-6 text-white/35" strokeWidth={1.8} />
                            <span className="text-[12.5px] font-medium leading-snug text-white/55">{message}</span>
                        </>
                    ) : (
                        <>
                            <span className="h-6 w-6 animate-pulse rounded-full bg-white/15" />
                            <span className="text-[12.5px] font-medium text-white/45">
                                {t('mdt.cameraConnecting', 'Connecting')}
                            </span>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
