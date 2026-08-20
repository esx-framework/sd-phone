import { fetchNui, isFiveM } from '@/core/nui';
import { getGameRender, PORTRAIT_CROP, type GameRender } from '@/render';
import { blobToBase64, pickVideoMime, videoStreamingSupported } from '@/shared/liveMedia';
import { onCameraDemand, type CameraDemand, type CameraEncoder } from './cameraBus';

const FALLBACK_ASPECT = 16 / 9;
const CAPTURE_ZOOM = PORTRAIT_CROP.width;

let targetGen: number | null = null;
let startToken = 0;
let teardown: (() => void) | null = null;
let render: GameRender | null = null;
let surface: HTMLCanvasElement | null = null;
let reported: string | null = null;

function reportState(state: 'ok' | 'unsupported'): void {
    if (reported === state) return;
    reported = state;
    void fetchNui('sd-phone:mdt:cameraState', { unsupported: state === 'unsupported' });
}

function feedAspect(): number {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (!w || !h) return FALLBACK_ASPECT;
    const fraction = Math.min(1, PORTRAIT_CROP.width / CAPTURE_ZOOM);
    const aspect = (fraction * w) / h;
    return aspect > 0 ? aspect : FALLBACK_ASPECT;
}

function ensureSurface(): HTMLCanvasElement {
    if (surface) return surface;
    const canvas = document.createElement('canvas');
    canvas.id = 'mdt-bodycam-surface';
    canvas.style.display = 'none';
    document.body.append(canvas);
    surface = canvas;
    return canvas;
}

function encode(source: HTMLCanvasElement, enc: CameraEncoder, gen: number): (() => void) | null {
    const mime = pickVideoMime();
    const outW = Math.max(120, Math.round(enc.width));
    const outH = Math.max(1, Math.round(outW / feedAspect()));

    const off = document.createElement('canvas');
    off.width = outW;
    off.height = outH;
    const octx = off.getContext('2d');
    if (!octx) return null;

    const pump = setInterval(() => {
        if (source.width && source.height) octx.drawImage(source, 0, 0, outW, outH);
    }, Math.max(1, Math.round(1000 / enc.fps)));

    let stream: MediaStream;
    try {
        stream = off.captureStream(enc.fps);
    } catch {
        clearInterval(pump);
        return null;
    }

    let recorder: MediaRecorder | null = null;
    let stopped = false;

    const spin = () => {
        if (stopped) return;
        let first = true;
        let rec: MediaRecorder;
        try {
            rec = new MediaRecorder(stream, {
                ...(mime ? { mimeType: mime } : {}),
                videoBitsPerSecond: enc.bitrate,
            });
        } catch {
            try { rec = new MediaRecorder(stream); } catch { return; }
        }
        rec.ondataavailable = (event) => {
            if (rec !== recorder || stopped || !event.data || !event.data.size) return;
            const init = first;
            first = false;
            void blobToBase64(event.data).then((chunk) => {
                if (stopped) return;
                void fetchNui('sd-phone:mdt:cameraChunk', {
                    gen,
                    chunk,
                    init,
                    mime: init ? mime : undefined,
                });
            });
        };
        rec.start(enc.timesliceMs);
        recorder = rec;
    };

    spin();

    return () => {
        stopped = true;
        clearInterval(pump);
        if (recorder && recorder.state !== 'inactive') {
            try { recorder.onstop = null; recorder.stop(); } catch { /* already inactive */ }
        }
        recorder = null;
        try { stream.getTracks().forEach(track => track.stop()); } catch { /* tracks gone */ }
    };
}

function stopPublishing(): void {
    if (teardown) {
        try { teardown(); } catch { /* best effort */ }
        teardown = null;
    }
    if (render) {
        try {
            render.stop();
            render.setZoom(1);
            render.setOrientation('portrait');
            render.setSelfie(false);
        } catch { /* renderer gone */ }
        render = null;
    }
}

async function startPublishing(demand: CameraDemand, token: number): Promise<void> {
    const enc = demand.enc;
    const gen = demand.gen ?? 0;
    if (!enc) return;

    if (!videoStreamingSupported()) {
        reportState('unsupported');
        return;
    }

    const feed = await getGameRender();
    if (token !== startToken) return;
    if (!feed) {
        reportState('unsupported');
        return;
    }

    const canvas = ensureSurface();
    feed.setOrientation('portrait');
    feed.setSelfie(false);
    feed.setZoom(CAPTURE_ZOOM);
    feed.renderToTarget(canvas);
    render = feed;

    const stop = encode(canvas, enc, gen);
    if (!stop) {
        stopPublishing();
        reportState('unsupported');
        return;
    }

    teardown = stop;
    reportState('ok');
}

function applyDemand(demand: CameraDemand | undefined): void {
    if (!demand || demand.on !== true || !demand.enc) {
        targetGen = null;
        startToken += 1;
        stopPublishing();
        return;
    }
    const gen = demand.gen ?? 0;
    if (targetGen === gen) return;
    targetGen = gen;
    startToken += 1;
    stopPublishing();
    void startPublishing(demand, startToken);
}

if (isFiveM) {
    onCameraDemand(applyDemand);

    void fetchNui<{ success?: boolean; data?: CameraDemand }>('sd-phone:mdt:cameraSync')
        .then(res => applyDemand(res?.data))
        .catch(() => {});
}
