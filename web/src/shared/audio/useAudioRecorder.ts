import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderError = 'unavailable' | 'blocked' | 'unsupported';

export interface AudioRecording {
    blob:     Blob;
    dataUrl:  string;
    duration: number;
}

function pickMime(): string | undefined {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    const MR = window.MediaRecorder;
    return MR ? candidates.find(c => MR.isTypeSupported?.(c)) : undefined;
}

function blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload  = () => resolve(fr.result as string);
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(blob);
    });
}

export function useAudioRecorder({ maxSeconds, onComplete }: {
    maxSeconds?: number;
    onComplete:  (rec: AudioRecording) => void;
}) {
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds]     = useState(0);
    const [error, setError]         = useState<RecorderError | null>(null);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const streamRef   = useRef<MediaStream | null>(null);
    const chunksRef   = useRef<Blob[]>([]);
    const startedRef  = useRef(0);
    const timerRef    = useRef<number | null>(null);
    const discardRef  = useRef(false);
    const completeRef = useRef(onComplete);
    completeRef.current = onComplete;

    const clearTimer = useCallback(() => {
        if (timerRef.current === null) return;
        window.clearInterval(timerRef.current);
        timerRef.current = null;
    }, []);

    const releaseStream = useCallback(() => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }, []);

    const stop = useCallback(() => {
        recorderRef.current?.stop();
        releaseStream();
        clearTimer();
        setRecording(false);
    }, [clearTimer, releaseStream]);

    const cancel = useCallback(() => {
        discardRef.current = true;
        stop();
    }, [stop]);

    const stopRef = useRef(stop);
    stopRef.current = stop;

    useEffect(() => () => {
        clearTimer();
        streamRef.current?.getTracks().forEach(track => track.stop());
    }, [clearTimer]);

    const start = useCallback(async () => {
        setError(null);
        if (!navigator.mediaDevices?.getUserMedia) { setError('unavailable'); return false; }

        let stream: MediaStream;
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
        catch { setError('blocked'); return false; }
        streamRef.current = stream;

        const mime = pickMime();
        let rec: MediaRecorder;
        try { rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
        catch {
            stream.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            setError('unsupported');
            return false;
        }

        chunksRef.current = [];
        discardRef.current = false;
        rec.ondataavailable = e => { if (e.data?.size) chunksRef.current.push(e.data); };
        rec.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
            chunksRef.current = [];
            if (discardRef.current || !blob.size) return;
            const elapsed = Math.max(1, Math.round((Date.now() - startedRef.current) / 1000));
            const duration = maxSeconds ? Math.min(maxSeconds, elapsed) : elapsed;
            void blobToDataURL(blob).then(dataUrl => completeRef.current({ blob, dataUrl, duration }));
        };
        recorderRef.current = rec;

        rec.start();
        startedRef.current = Date.now();
        setRecording(true);
        setSeconds(0);
        timerRef.current = window.setInterval(() => {
            const elapsed = Math.floor((Date.now() - startedRef.current) / 1000);
            setSeconds(maxSeconds ? Math.min(maxSeconds, elapsed) : elapsed);
            if (maxSeconds && elapsed >= maxSeconds) stopRef.current();
        }, 250);
        return true;
    }, [maxSeconds]);

    return { recording, seconds, error, setError, start, stop, cancel };
}
