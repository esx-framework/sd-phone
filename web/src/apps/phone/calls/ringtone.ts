import { context } from '@/media/sfx';

type RingKind = 'ringback' | 'ringtone';

const CADENCE: Record<RingKind, { on: number; off: number; gain: number }> = {
    ringback: { on: 2.0, off: 4.0, gain: 0.14 },
    ringtone: { on: 1.2, off: 1.6, gain: 0.22 },
};

const RING_FREQS = [440, 480];

const FADE_OUT = 0.03;

type Burst = { gain: GainNode; oscs: OscillatorNode[] };

function burst(ac: AudioContext, gainPeak: number, duration: number): Burst {
    const now = ac.currentTime;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.05);
    gain.gain.setValueAtTime(gainPeak, now + duration - 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    gain.connect(ac.destination);

    const oscs: OscillatorNode[] = [];
    for (const freq of RING_FREQS) {
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
        oscs.push(osc);
    }
    return { gain, oscs };
}

function silence(ac: AudioContext, live: Burst): void {
    const now = ac.currentTime;
    try {
        live.gain.gain.cancelScheduledValues(now);
        live.gain.gain.setValueAtTime(Math.max(live.gain.gain.value, 0.0001), now);
        live.gain.gain.exponentialRampToValueAtTime(0.0001, now + FADE_OUT);
    } catch {}
    for (const osc of live.oscs) {
        try { osc.stop(now + FADE_OUT); } catch {}
    }
}

export function startRing(kind: RingKind): () => void {
    const ac = context();
    if (!ac) return () => {};
    if (ac.state === 'suspended') void ac.resume();

    const { on, off, gain } = CADENCE[kind];
    let live: Burst | null = burst(ac, gain, on);
    const interval = window.setInterval(() => { live = burst(ac, gain, on); }, (on + off) * 1000);

    return () => {
        window.clearInterval(interval);
        if (!live) return;
        silence(ac, live);
        live = null;
    };
}
