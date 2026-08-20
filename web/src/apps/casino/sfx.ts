import { context, noiseBuffer, playChime } from '@/media/sfx';
import { playSample } from './samples';
import { useCasinoMute } from './muteStore';

type Ac = AudioContext;

function ready(): Ac | null {
    if (useCasinoMute.getState().muted) return null;
    const ac = context();
    if (!ac) return null;
    if (ac.state === 'suspended') void ac.resume();
    return ac;
}

interface NoiseOpts {
    at: number;
    dur: number;
    peak: number;
    from: number;
    to: number;
    type?: BiquadFilterType;
    q?: number;
    attack?: number;
}

function burst(ac: Ac, o: NoiseOpts): void {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac);
    src.loop = true;

    const filter = ac.createBiquadFilter();
    filter.type = o.type ?? 'lowpass';
    if (o.q !== undefined) filter.Q.value = o.q;
    filter.frequency.setValueAtTime(o.from, o.at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, o.to), o.at + o.dur);

    const g = ac.createGain();
    const rise = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, o.at);
    g.gain.exponentialRampToValueAtTime(o.peak, o.at + rise);
    g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);

    src.connect(filter); filter.connect(g); g.connect(ac.destination);
    src.start(o.at); src.stop(o.at + o.dur + 0.02);
}

interface ToneOpts {
    at: number;
    dur: number;
    peak: number;
    from: number;
    to?: number;
    type?: OscillatorType;
    attack?: number;
}

function tone(ac: Ac, o: ToneOpts): void {
    const osc = ac.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.from, o.at);
    if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), o.at + o.dur);

    const g = ac.createGain();
    const rise = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, o.at);
    g.gain.exponentialRampToValueAtTime(o.peak, o.at + rise);
    g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);

    osc.connect(g); g.connect(ac.destination);
    osc.start(o.at); osc.stop(o.at + o.dur + 0.02);
}

const vary = (base: number, spread: number) => base * (1 + (Math.random() * 2 - 1) * spread);

export function playChipPlace(): void {
    if (playSample('chipLay', 0.9)) return;
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    burst(ac, { at: now, dur: 0.045, peak: 0.30, from: vary(5200, 0.12), to: 1800, type: 'bandpass', q: 1.1, attack: 0.001 });
    tone(ac, { at: now, dur: 0.06, peak: 0.16, from: vary(320, 0.08), to: 150, type: 'triangle', attack: 0.002 });
}

export function playChipStack(): void {
    if (playSample('chipStack', 0.85)) return;
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    for (let i = 0; i < 3; i++) {
        const at = now + i * vary(0.028, 0.3);
        burst(ac, { at, dur: 0.038, peak: 0.20 - i * 0.04, from: vary(4600, 0.14), to: 1500, type: 'bandpass', q: 1.2, attack: 0.001 });
    }
    tone(ac, { at: now, dur: 0.09, peak: 0.13, from: 240, to: 110, type: 'triangle', attack: 0.003 });
}

export function playCardDeal(): void {
    if (playSample('cardSlide', 0.9)) return;
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    burst(ac, { at: now, dur: 0.11, peak: 0.17, from: vary(3400, 0.1), to: 700, type: 'bandpass', q: 0.7, attack: 0.012 });
}

export function playCardFlip(): void {
    if (playSample('cardPlace', 0.95)) return;
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    burst(ac, { at: now, dur: 0.07, peak: 0.22, from: vary(6000, 0.1), to: 1200, type: 'bandpass', q: 1.4, attack: 0.002 });
    tone(ac, { at: now + 0.01, dur: 0.05, peak: 0.07, from: 420, to: 260, type: 'triangle' });
}

export function playReelSpin(): void {
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    burst(ac, { at: now, dur: 0.42, peak: 0.13, from: 900, to: 2600, type: 'bandpass', q: 0.9, attack: 0.05 });
    tone(ac, { at: now, dur: 0.4, peak: 0.06, from: 90, to: 190, type: 'sawtooth', attack: 0.06 });
}

export interface ReelLoop {
    stop: () => void;
    reelLanded: (remaining: number) => void;
}

const TICK_LEAD = 0.35;
const TICK_MIN = 0.032;
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

export function startReelLoop(): ReelLoop | null {
    const ac = ready();
    if (!ac) return null;

    const out = ac.createGain();
    out.gain.value = 1;
    out.connect(ac.destination);

    let stopped = false;
    let scheduled = ac.currentTime;
    let gap = TICK_MIN;
    let timer: ReturnType<typeof setInterval> | null = null;
    let step = 0;
    let transpose = 1;

    const click = (at: number, level: number) => {
        const src = ac.createBufferSource();
        src.buffer = noiseBuffer(ac);
        const bp = ac.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1900 + Math.random() * 900;
        bp.Q.value = 2.2;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(level * 0.55, at + 0.0012);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.026);
        src.connect(bp); bp.connect(g); g.connect(out);
        src.start(at); src.stop(at + 0.032);

        const note = PENTATONIC[step % PENTATONIC.length] * transpose;
        step += 1;

        const bell = ac.createOscillator();
        bell.type = 'triangle';
        bell.frequency.value = note;
        const bellGain = ac.createGain();
        bellGain.gain.setValueAtTime(0.0001, at);
        bellGain.gain.exponentialRampToValueAtTime(level * 0.85, at + 0.0016);
        bellGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.075);
        bell.connect(bellGain); bellGain.connect(out);
        bell.start(at); bell.stop(at + 0.08);

        const shimmer = ac.createOscillator();
        shimmer.type = 'sine';
        shimmer.frequency.value = note * 3.02;
        const shimmerGain = ac.createGain();
        shimmerGain.gain.setValueAtTime(0.0001, at);
        shimmerGain.gain.exponentialRampToValueAtTime(level * 0.3, at + 0.0014);
        shimmerGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
        shimmer.connect(shimmerGain); shimmerGain.connect(out);
        shimmer.start(at); shimmer.stop(at + 0.05);
    };

    const fill = () => {
        if (stopped) return;
        const until = ac.currentTime + TICK_LEAD;
        while (scheduled < until) {
            click(scheduled, 0.34 + Math.random() * 0.09);
            scheduled += gap;
        }
    };

    fill();
    timer = setInterval(fill, 120);

    const stop = () => {
        if (stopped) return;
        stopped = true;
        if (timer !== null) { clearInterval(timer); timer = null; }
        const t = ac.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    };

    const reelLanded = (remaining: number) => {
        if (stopped) return;
        if (remaining <= 0) { stop(); return; }
        gap = TICK_MIN * (1 + (3 - remaining) * 0.55);
        transpose = remaining === 1 ? 1.5 : 1.25;
        const t = ac.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
        out.gain.linearRampToValueAtTime(remaining === 1 ? 1 : 0.8, t + 0.07);
    };

    return { stop, reelLanded };
}

export function playReelStop(index: number): void {
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    const pitch = 260 - index * 24;
    burst(ac, { at: now, dur: 0.06, peak: 0.26, from: 3000, to: 700, type: 'lowpass', attack: 0.001 });
    tone(ac, { at: now, dur: 0.13, peak: 0.24, from: pitch, to: pitch * 0.42, type: 'triangle', attack: 0.002 });
    tone(ac, { at: now + 0.004, dur: 0.08, peak: 0.05, from: pitch * 4.2, to: pitch * 2.4, type: 'square', attack: 0.002 });
}

export interface CrashLoop {
    tick: (multiplier: number) => void;
    stop: () => void;
}

const CLIMB_BASE = 330;
const CLIMB_SPAN = 2.4;

export function startCrashLoop(): CrashLoop | null {
    const ac = ready();
    if (!ac) return null;

    const out = ac.createGain();
    out.gain.value = 0.42;
    out.connect(ac.destination);

    let stopped = false;
    let scheduled = ac.currentTime + 0.05;
    let mult = 1;
    let step = 0;

    const voice = (at: number, freq: number, level: number, decay: number) => {
        if (level < 0.004) return;
        const osc = ac.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(level, at + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
        osc.connect(g); g.connect(out);
        osc.start(at); osc.stop(at + decay + 0.02);
    };

    const blip = (at: number, position: number, level: number) => {
        const frac = position - Math.floor(position);
        const low = CLIMB_BASE * Math.pow(2, frac);
        voice(at, low, level * Math.cos(frac * Math.PI / 2), 0.16);
        voice(at, low * 2, level * Math.sin(frac * Math.PI / 2), 0.14);
        voice(at, low * 4, level * 0.16 * Math.sin(frac * Math.PI / 2), 0.08);
    };

    const fill = () => {
        if (stopped) return;
        const until = ac.currentTime + 0.3;
        while (scheduled < until) {
            const climb = Math.log2(Math.max(1, mult)) / CLIMB_SPAN;
            blip(scheduled, climb + step * 0.06, 0.22 + Math.min(0.16, (mult - 1) * 0.03));
            step += 1;
            const gap = Math.max(0.07, 0.34 / (1 + (mult - 1) * 0.55));
            scheduled += gap;
        }
    };

    fill();
    const timer = setInterval(fill, 110);

    return {
        tick: (multiplier: number) => { if (!stopped) mult = Math.max(1, multiplier); },
        stop: () => {
            if (stopped) return;
            stopped = true;
            clearInterval(timer);
            const t = ac.currentTime;
            out.gain.cancelScheduledValues(t);
            out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
            out.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        },
    };
}

export interface SpinLoop {
    stop: () => void;
}

export function startWheelSpin(durationMs: number): SpinLoop | null {
    const ac = ready();
    if (!ac) return null;
    const now = ac.currentTime;
    const dur = durationMs / 1000;

    const out = ac.createGain();
    out.gain.setValueAtTime(0.75, now);
    out.gain.setValueAtTime(0.75, now + dur * 0.6);
    out.gain.linearRampToValueAtTime(0.4, now + dur);
    out.connect(ac.destination);

    let at = now + 0.15;
    let gap = 0.036;
    const end = now + dur;
    while (at < end) {
        const src = ac.createBufferSource();
        src.buffer = noiseBuffer(ac);
        const bp = ac.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 4200 + Math.random() * 1800;
        bp.Q.value = 3.4;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.20 + Math.random() * 0.06, at + 0.0012);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.02);
        src.connect(bp); bp.connect(g); g.connect(out);
        src.start(at); src.stop(at + 0.026);

        at += gap;
        gap *= 1.035;
    }

    let stopped = false;
    return {
        stop: () => {
            if (stopped) return;
            stopped = true;
            const t = ac.currentTime;
            out.gain.cancelScheduledValues(t);
            out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
            out.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        },
    };
}

export function playBallDrop(): void {
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    for (let i = 0; i < 4; i++) {
        const at = now + i * (0.045 + i * 0.02);
        burst(ac, { at, dur: 0.03, peak: 0.20 - i * 0.035, from: vary(5200, 0.15), to: 1800, type: 'bandpass', q: 2, attack: 0.001 });
    }
    tone(ac, { at: now + 0.22, dur: 0.12, peak: 0.14, from: 200, to: 90, type: 'triangle', attack: 0.003 });
}

function playCoins(count = 10): void {
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    const steps = Math.max(4, Math.min(18, count));
    for (let i = 0; i < steps; i++) {
        const at = now + i * vary(0.045, 0.35);
        const f = vary(1500 + Math.random() * 900, 0.05);
        tone(ac, { at, dur: 0.16, peak: 0.075, from: f, type: 'triangle', attack: 0.003 });
        tone(ac, { at, dur: 0.1, peak: 0.03, from: f * 1.5, type: 'sine', attack: 0.003 });
    }
}

export function playWin(): void {
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    playChime(ac, [
        { f: 659, at: now,        dur: 0.16 },
        { f: 880, at: now + 0.09, dur: 0.18 },
        { f: 1319, at: now + 0.19, dur: 0.42 },
    ], 0.13, 0.006);
}

export function playBigWin(): void {
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    playChime(ac, [
        { f: 523,  at: now,        dur: 0.16 },
        { f: 659,  at: now + 0.08, dur: 0.16 },
        { f: 784,  at: now + 0.16, dur: 0.18 },
        { f: 1047, at: now + 0.25, dur: 0.24 },
        { f: 1319, at: now + 0.36, dur: 0.55 },
        { f: 1568, at: now + 0.46, dur: 0.7 },
    ], 0.14, 0.005);
    playCoins(14);
}

export function playLose(): void {
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    tone(ac, { at: now, dur: 0.22, peak: 0.11, from: 300, to: 170, type: 'triangle', attack: 0.01 });
    tone(ac, { at: now + 0.1, dur: 0.3, peak: 0.09, from: 220, to: 118, type: 'triangle', attack: 0.012 });
}

export function playPush(): void {
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    playChime(ac, [
        { f: 494, at: now,        dur: 0.16 },
        { f: 494, at: now + 0.13, dur: 0.24 },
    ], 0.09, 0.008);
}

export function playCashout(): void {
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    playChime(ac, [
        { f: 988,  at: now,        dur: 0.14 },
        { f: 1319, at: now + 0.07, dur: 0.36 },
    ], 0.14, 0.005);
    playCoins(8);
}

export function playBust(): void {
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    burst(ac, { at: now, dur: 0.5, peak: 0.30, from: 1800, to: 90, type: 'lowpass', attack: 0.003 });
    tone(ac, { at: now, dur: 0.44, peak: 0.22, from: 210, to: 42, type: 'sawtooth', attack: 0.004 });
}

export function playCheckRap(): void {
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    for (let i = 0; i < 2; i++) {
        const at = now + i * 0.11;
        burst(ac, { at, dur: 0.05, peak: 0.24, from: 1400, to: 320, type: 'lowpass', attack: 0.001 });
        tone(ac, { at, dur: 0.07, peak: 0.14, from: 170, to: 80, type: 'triangle', attack: 0.002 });
    }
}

export function playFoldSlide(): void {
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    burst(ac, { at: now, dur: 0.2, peak: 0.13, from: 2400, to: 420, type: 'bandpass', q: 0.6, attack: 0.03 });
}

export function playPotPush(): void {
    if (playSample('chipHandle', 0.95)) { playSample('chipCollide', 0.6); return; }
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    for (let i = 0; i < 7; i++) {
        const at = now + i * vary(0.035, 0.4);
        burst(ac, { at, dur: 0.05, peak: 0.16, from: vary(4400, 0.2), to: 1400, type: 'bandpass', q: 1.3, attack: 0.001 });
    }
    tone(ac, { at: now, dur: 0.22, peak: 0.1, from: 190, to: 90, type: 'triangle', attack: 0.02 });
}

export function playDealFlop(): void {
    if (playSample('cardSlide', 0.9)) {
        window.setTimeout(() => playSample('cardSlide', 0.85), 95);
        window.setTimeout(() => playSample('cardSlide', 0.85), 190);
        return;
    }
    const ac = ready();
    if (!ac) return;
    const now = ac.currentTime;
    for (let i = 0; i < 3; i++) {
        burst(ac, { at: now + i * 0.09, dur: 0.1, peak: 0.16, from: vary(3400, 0.1), to: 700, type: 'bandpass', q: 0.7, attack: 0.012 });
    }
}
