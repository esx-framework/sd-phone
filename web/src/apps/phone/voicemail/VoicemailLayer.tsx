import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Voicemail as VoicemailIcon, X } from 'lucide-react';

import { CircularProgress } from '@/ui/CircularProgress';
import { Spinner } from '@/ui/Spinner';
import { RecordPulse } from '@/shared/audio/RecordPulse';
import { useAudioRecorder, type AudioRecording, type RecorderError } from '@/shared/audio/useAudioRecorder';
import { resolveWallpaper } from '@/shell/wallpapers';
import { useCallStore } from '@/stores/callStore';
import { useMaskedPhone } from '@/stores/themeStore';
import { failText } from '@/core/api';
import { t } from '@/i18n';
import { leaveVoicemail, uploadVoicemail, voicemailEnabled, VOICEMAIL_MAX_SECONDS } from '../voicemailApi';

const OFFER_MS = 5000;

type Stage = 'offer' | 'record' | 'sending' | 'sent' | 'error';

function recorderMessage(code: RecorderError): string {
    if (code === 'unavailable') return t('phone.micUnavailable', 'Microphone unavailable on this server.');
    if (code === 'blocked')     return t('phone.micBlocked', 'Microphone access was blocked.');
    return t('phone.recordingUnsupported', 'Recording is not supported here.');
}

export function VoicemailLayer({ wallpaper }: { wallpaper?: string }) {
    const offer   = useCallStore(s => s.vmOffer);
    const phase   = useCallStore(s => s.phase);
    const phone   = useMaskedPhone();
    const [stage, setStage]     = useState<Stage>('offer');
    const [left, setLeft]       = useState(OFFER_MS);
    const [failure, setFailure] = useState<string | null>(null);
    const [allowed, setAllowed] = useState<boolean | null>(null);

    const close = useCallback(() => useCallStore.getState().clearVoicemailOffer(), []);

    useEffect(() => { void voicemailEnabled().then(setAllowed); }, []);

    useEffect(() => {
        if (!offer) return;
        setStage('offer');
        setLeft(OFFER_MS);
        setFailure(null);
    }, [offer]);

    useEffect(() => {
        if (!offer || stage !== 'offer' || allowed === null) return;
        if (allowed === false) { close(); return; }
        const started = Date.now();
        const id = window.setInterval(() => {
            const remaining = OFFER_MS - (Date.now() - started);
            setLeft(remaining);
            if (remaining <= 0) close();
        }, 100);
        return () => window.clearInterval(id);
    }, [offer, stage, allowed, close]);

    useEffect(() => {
        if (stage !== 'sent') return;
        const id = window.setTimeout(close, 1500);
        return () => window.clearTimeout(id);
    }, [stage, close]);

    const send = useCallback(async (rec: AudioRecording, number: string) => {
        setStage('sending');
        const hosted = await uploadVoicemail(rec.dataUrl);
        if (!hosted.success || !hosted.data?.url) {
            setFailure(failText(hosted, t('phone.voicemailUploadFailed', 'Could not send that message.')));
            setStage('error');
            return;
        }
        const sent = await leaveVoicemail(number, hosted.data.url, rec.duration);
        if (!sent.success) {
            setFailure(failText(sent, t('phone.voicemailSendFailed', 'Could not send that message.')));
            setStage('error');
            return;
        }
        setStage('sent');
    }, []);

    const target = useRef(offer);
    if (offer) target.current = offer;

    const recorder = useAudioRecorder({
        maxSeconds: VOICEMAIL_MAX_SECONDS,
        onComplete: useCallback((rec: AudioRecording) => {
            const number = target.current?.number;
            if (!number) return;
            void send(rec, number);
        }, [send]),
    });
    const { recording, seconds, error, start, stop, cancel } = recorder;

    useEffect(() => {
        if (error) { setFailure(recorderMessage(error)); setStage('error'); }
    }, [error]);

    if (!offer || phase !== null) return null;

    const title     = offer.name || phone(offer.number) || t('phone.unknown', 'Unknown');
    const remaining = Math.max(0, VOICEMAIL_MAX_SECONDS - seconds);

    return (
        <div className="absolute inset-0 z-[60] overflow-hidden font-sf">
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage:    wallpaper ? `url(${resolveWallpaper(wallpaper)})` : undefined,
                    backgroundSize:     'cover',
                    backgroundPosition: 'center',
                    filter:             'blur(28px) brightness(0.5)',
                    transform:          'scale(1.15)',
                }}
            />
            <div className="absolute inset-0 bg-black/45" />

            <div className="relative z-10 flex h-full flex-col items-center">
                <div className="flex shrink-0 flex-col items-center px-8 pt-[120px] text-center">
                    <div className="mb-3 flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5">
                        <VoicemailIcon className="h-[16px] w-[16px] text-white" strokeWidth={2.2} />
                        <span className="text-[13px] font-semibold tracking-wide text-white">
                            {t('phone.voicemail', 'Voicemail')}
                        </span>
                    </div>
                    <div className="text-[34px] font-semibold leading-tight text-white">{title}</div>
                    <div className="mt-1 text-[18px] font-light text-white/60">
                        {stage === 'record'
                            ? (recording
                                ? t('phone.recordingMessage', 'Recording your message')
                                : t('phone.tapToRecord', 'Tap to start recording'))
                            : stage === 'sending'
                                ? t('phone.sendingVoicemail', 'Sending…')
                                : stage === 'sent'
                                    ? t('phone.voicemailSent', 'Message sent')
                                    : stage === 'error'
                                        ? t('phone.voicemailProblem', 'Something went wrong')
                                        : t('phone.notAvailableRightNow', 'Not available right now')}
                    </div>
                </div>

                <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8">
                    {stage === 'offer' && (
                        <button
                            type="button"
                            onClick={() => setStage('record')}
                            className="flex items-center gap-3 rounded-full bg-white px-7 py-3.5 text-[17px] font-semibold text-black active:opacity-80"
                        >
                            <CircularProgress progress={Math.max(0, left) / OFFER_MS} size={20} stroke={2.5} className="text-black/45" />
                            {t('phone.leaveAVoicemail', 'Leave a Voicemail')}
                        </button>
                    )}

                    {stage === 'record' && (
                        <>
                            <button
                                type="button"
                                aria-label={recording ? t('phone.stopRecording', 'Stop recording') : t('phone.record', 'Record')}
                                onClick={() => { if (recording) stop(); else void start(); }}
                                className="flex h-[92px] w-[92px] items-center justify-center rounded-full bg-white/15 ring-[3px] ring-white/25 active:opacity-80"
                            >
                                <span
                                    className="bg-ios-red transition-all duration-200"
                                    style={recording
                                        ? { width: 34, height: 34, borderRadius: 8 }
                                        : { width: 72, height: 72, borderRadius: 36 }}
                                />
                            </button>
                            <div className="h-[22px]">
                                {recording
                                    ? <RecordPulse seconds={seconds} barClassName="bg-white" textClassName="text-white" />
                                    : (
                                        <span className="text-[15px] tabular-nums text-white/55">
                                            {t('phone.upToSeconds', 'Up to {n} seconds', { n: VOICEMAIL_MAX_SECONDS })}
                                        </span>
                                    )}
                            </div>
                            {recording && (
                                <span className="text-[13px] tabular-nums text-white/45">
                                    {t('phone.secondsLeft', '{n}s left', { n: remaining })}
                                </span>
                            )}
                        </>
                    )}

                    {stage === 'sending' && <Spinner />}

                    {stage === 'sent' && (
                        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-ios-green">
                            <Check className="h-[36px] w-[36px] text-white" strokeWidth={3} />
                        </span>
                    )}

                    {stage === 'error' && failure && (
                        <p className="max-w-[280px] text-center text-[16px] leading-snug text-white/85">{failure}</p>
                    )}
                </div>

                <div className="flex w-full shrink-0 justify-center pb-[120px]">
                    {stage !== 'sent' && stage !== 'sending' && (
                        <button
                            type="button"
                            aria-label={t('phone.dismiss', 'Dismiss')}
                            onClick={() => { cancel(); close(); }}
                            className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-white/15 active:opacity-70"
                        >
                            <X className="h-[28px] w-[28px] text-white" strokeWidth={2.4} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
