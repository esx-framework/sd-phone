import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Eye, Heart, X } from 'lucide-react';

import { t } from '@/i18n';
import { formatDuration } from '@/lib/time';
import { useNuiEvent } from '@/hooks/useNuiEvent';
import { useStatusBarLight } from '@/shell/useStatusBarLight';
import { base64ToBytes } from '@/shared/liveMedia';
import { useLiveVideo } from '@/shared/live/useLiveVideo';
import { GRAD_FROM, GRAD_TO, HEART, type VUser } from '../data';
import { apiLiveJoin, apiLiveLeave, apiLiveComment, apiLiveHeart, type LiveJoin } from '../vibezApi';
import { LiveCommentRow, type LiveComment } from './LiveComment';

interface FloatHeart { id: number; drift: number; left: number; }

export function LiveViewer({ liveId, host, onClose }: { liveId: string; host: VUser; onClose: () => void }) {
    const [frame,    setFrame]    = useState<string | null>(null);
    const [viewers,  setViewers]  = useState(1);
    const [elapsed,  setElapsed]  = useState(0);
    const [comments, setComments] = useState<LiveComment[]>([]);
    const [hearts,   setHearts]   = useState<FloatHeart[]>([]);
    const [ended,    setEnded]    = useState(false);
    const [draft,    setDraft]    = useState('');
    const seq = useRef(0);
    const startedRef = useRef<number>(0);
    const videoRef   = useRef<HTMLVideoElement>(null);

    useStatusBarLight(true);

    const { health, transport, feedEvent, setOffered, markEnded } = useLiveVideo<LiveJoin>({
        liveId,
        video: videoRef,
        join:  relay => apiLiveJoin(liveId, relay),
        onAttach: (res, first) => {
            if (!first) return;
            if (res.frame) setFrame(res.frame);
            setViewers(res.viewers);
            startedRef.current = res.startedAt;
        },
        onGone: () => setEnded(true),
    });

    useEffect(() => () => { void apiLiveLeave(liveId); }, [liveId]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            if (startedRef.current) setElapsed(Math.max(0, Math.floor((Date.now() - startedRef.current) / 1000)));
        }, 1000);
        return () => window.clearInterval(timer);
    }, []);

    const forUs = (id?: string) => !id || id === liveId;

    useNuiEvent('sd-phone:vibez:liveFrame', (data: { liveId?: string; frame?: string } | undefined) => {
        if (!forUs(data?.liveId) || !data?.frame) return;
        setFrame(data.frame);
    });
    useNuiEvent('sd-phone:vibez:liveChunk', (data: { liveId?: string; chunk?: string; init?: boolean; mime?: string; gen?: number } | undefined) => {
        if (!forUs(data?.liveId) || !data?.chunk) return;
        feedEvent(base64ToBytes(data.chunk), data.init === true, data.mime, data.gen);
    });
    useNuiEvent('sd-phone:vibez:liveTransport', (data: { liveId?: string; transport?: string } | undefined) => {
        if (!forUs(data?.liveId)) return;
        setOffered(data?.transport === 'relay' ? 'relay' : 'event');
    });
    useNuiEvent('sd-phone:vibez:liveComment', (data: { liveId?: string; comment?: LiveComment } | undefined) => {
        if (!forUs(data?.liveId) || !data?.comment) return;
        setComments(prev => [...prev.slice(-5), data.comment as LiveComment]);
    });
    useNuiEvent('sd-phone:vibez:liveHeart', (data: { liveId?: string } | undefined) => {
        if (forUs(data?.liveId)) spawnHearts(1);
    });
    useNuiEvent('sd-phone:vibez:liveViewers', (data: { liveId?: string; viewers?: number } | undefined) => {
        if (forUs(data?.liveId) && typeof data?.viewers === 'number') setViewers(data.viewers);
    });
    useNuiEvent('sd-phone:vibez:liveEnded', (data: { liveId?: string } | undefined) => {
        if (!forUs(data?.liveId)) return;
        markEnded();
        setEnded(true);
    });

    function spawnHearts(n: number) {
        setHearts(prev => {
            const add: FloatHeart[] = [];
            for (let i = 0; i < n; i++) {
                seq.current += 1;
                add.push({ id: seq.current, drift: Math.round((Math.random() - 0.5) * 60), left: Math.round(Math.random() * 18) });
            }
            return [...prev.slice(-20), ...add];
        });
    }

    function sendHeart() {
        spawnHearts(2);
        void apiLiveHeart(liveId);
    }

    function sendComment() {
        const text = draft.trim();
        if (!text) return;
        setDraft('');
        void apiLiveComment(liveId, text);
    }

    const showVideo = health === 'live' || health === 'recovering';

    return (
        <div className="absolute inset-0 z-[60] flex flex-col overflow-hidden bg-black font-sf text-white">
            <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                onCanPlay={() => { void videoRef.current?.play?.().catch(() => {}); }}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ display: showVideo ? 'block' : 'none' }}
            />
            {!showVideo && (frame
                ? <img src={frame} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
                : <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <img src={host.avatar} alt="" draggable={false} className="h-[88px] w-[88px] rounded-full object-cover opacity-90" />
                    <div className="text-[15px] text-white/70">
                        {health === 'failed'
                            ? t('live.noPicture', 'No picture from this live')
                            : t('vibez.connectingToLive', "Connecting to {handle}'s LIVE…", { handle: host.handle })}
                    </div>
                  </div>)}

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/60" />

            <div className="relative z-20 flex shrink-0 items-start justify-between px-4 pt-[62px]">
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-full bg-black/45 py-[3px] pl-[3px] pr-2.5 backdrop-blur-sm">
                        <img src={host.avatar} alt="" draggable={false} className="h-[26px] w-[26px] rounded-full object-cover" />
                        <span className="inline-flex items-center gap-1 text-[14px] font-semibold">
                            {host.handle}
                            {host.verified && (
                                <BadgeCheck className="h-[13px] w-[13px]" style={{ color: GRAD_FROM, fill: GRAD_FROM }} stroke="#000" strokeWidth={1.6} />
                            )}
                        </span>
                    </span>
                    <span
                        className="rounded-[7px] px-2 py-[3px] text-[12px] font-bold uppercase tracking-wide"
                        style={{ background: `linear-gradient(135deg, ${GRAD_FROM}, ${GRAD_TO})` }}
                    >
                        {t('vibez.live', 'LIVE')}
                    </span>
                    <span className="flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-[5px] text-[13px] font-semibold tabular-nums backdrop-blur-sm">
                        <Eye className="h-[14px] w-[14px]" strokeWidth={2.4} />
                        {viewers.toLocaleString()}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => onClose()}
                    aria-label={t('vibez.leaveLive', 'Leave live')}
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-black/45 backdrop-blur-sm active:scale-90"
                >
                    <X className="h-[20px] w-[20px]" strokeWidth={2.4} />
                </button>
            </div>

            <div className="relative z-20 flex items-center gap-1.5 px-4 pt-1.5">
                <span className="rounded-full bg-black/40 px-2 py-[3px] text-[12px] font-medium tabular-nums text-white/85 backdrop-blur-sm">
                    {formatDuration(elapsed)}
                </span>
                {showVideo && (
                    <span className="rounded-full bg-black/40 px-2 py-[3px] text-[10.5px] font-bold uppercase tracking-wide text-white/60 backdrop-blur-sm">
                        {transport === 'relay'
                            ? t('live.transportRelay', 'Relay')
                            : t('live.transportEvent', 'Server')}
                    </span>
                )}
                {health === 'recovering' && (
                    <span className="rounded-full bg-black/40 px-2 py-[3px] text-[10.5px] font-semibold text-white/60 backdrop-blur-sm">
                        {t('live.reconnecting', 'Reconnecting')}
                    </span>
                )}
            </div>

            <div className="min-h-0 flex-1" />

            <div className="relative z-20 flex shrink-0 items-end justify-between gap-3 px-4 pb-2">
                <div className="flex min-w-0 flex-1 flex-col justify-end gap-2">
                    {comments.map(c => <LiveCommentRow key={c.id} comment={c} />)}
                </div>
                <div className="pointer-events-none relative h-[180px] w-[60px] shrink-0">
                    {hearts.map(h => (
                        <Heart
                            key={h.id}
                            onAnimationEnd={() => setHearts(prev => prev.filter(x => x.id !== h.id))}
                            className="absolute bottom-0 h-[26px] w-[26px]"
                            fill="currentColor"
                            style={{ color: HEART, left: `${30 + h.left}%`, ['--drift' as string]: `${h.drift}px`, animation: 'live-heart-rise 1.8s ease-out forwards' }}
                        />
                    ))}
                </div>
            </div>

            <div className="relative z-20 flex shrink-0 items-center gap-2 px-4 pb-9">
                <input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); sendComment(); } }}
                    placeholder={t('vibez.addComment', 'Add a comment…')}
                    spellCheck={false}
                    className="h-[44px] min-w-0 flex-1 rounded-full border border-white/30 bg-black/35 px-4 text-[15px] text-white outline-none backdrop-blur-sm placeholder:text-white/55"
                />
                <button
                    type="button"
                    aria-label={t('vibez.sendHeart', 'Send heart')}
                    onClick={sendHeart}
                    className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm active:scale-90"
                    style={{ color: HEART }}
                >
                    <Heart className="h-[24px] w-[24px]" fill="currentColor" strokeWidth={2} />
                </button>
            </div>

            {ended && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/75 backdrop-blur-sm">
                    <img src={host.avatar} alt="" draggable={false} className="h-[84px] w-[84px] rounded-full object-cover" />
                    <div className="text-center">
                        <div className="text-[20px] font-semibold">{t('vibez.liveHasEnded', 'LIVE has ended')}</div>
                        <div className="mt-1 text-[15px] text-white/65">{t('vibez.liveOver', "{handle}'s live is over.", { handle: host.handle })}</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onClose()}
                        className="mt-1 rounded-full bg-white px-6 py-2.5 text-[16px] font-semibold text-black active:opacity-80"
                    >
                        {t('vibez.done', 'Done')}
                    </button>
                </div>
            )}
        </div>
    );
}
