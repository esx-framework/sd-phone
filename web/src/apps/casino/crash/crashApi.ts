import { apiCall } from '@/core/api';
import type { Envelope } from '@/core/api';
import { fetchNui, isFiveM } from '@/core/nui';
import { writeJson } from '@/lib/storage';

import type { CrashCashout, CrashPhase, CrashPlayerBet, CrashRound, CrashSnapshot, CrashTick } from './data';
import { MAX_MS, MAX_X100, MIN_X100, bustFromHash, multAt, payoutAt } from './curve';

export const MIN_BET = 25;
export const MAX_BET = 50000;
export const BETTING_MS = 12000;
export const BUST_HOLD_MS = 5000;
export const MIN_AUTO = 101;
export const MAX_AUTO = MAX_X100 - 1;

export const COMMIT_SUFFIX = ':commit';

export type VerifyResult = 'ok' | 'mismatch' | 'unavailable';

export interface CrashBetReply { ok: boolean; data?: { stake: number; auto: number | null; chips: number }; message?: string }
export interface CrashCashReply { ok: boolean; data?: { mx: number; payout: number; chips: number }; message?: string }

export function cleanAuto(value: number | null): number | null {
    if (value === null) return null;
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < MIN_AUTO || n > MAX_AUTO) return null;
    return n;
}

export async function sha256Hex(text: string): Promise<string | null> {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    try {
        const bytes = new TextEncoder().encode(text);
        const digest = await subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
        return null;
    }
}

export async function verifyRound(seed: string | null, commit: string | null, bust: number, ceiling = MAX_X100): Promise<VerifyResult> {
    if (!seed || !commit) return 'unavailable';
    const commitHash = await sha256Hex(seed + COMMIT_SUFFIX);
    const bustHash = await sha256Hex(seed);
    if (commitHash === null || bustHash === null) return 'unavailable';
    return commitHash === commit.toLowerCase() && bustFromHash(bustHash, ceiling) === bust ? 'ok' : 'mismatch';
}

const CHIP_KEY = 'sd-phone:casino-chips:v1';
const DEV_BOT_NAMES = ['Marcus', 'Lena', 'Ovi', 'Dre', 'Kiko', 'Sasha', 'Bex', 'Tomo'];
const DEV_STEP_MS = 100;
const DEV_HISTORY = 20;

interface DevSeat { n: string; s: number; auto: number | null; settled: boolean; mx: number | null; payout: number; mine: boolean }
interface DevPlan { n: string; at: number; s: number; auto: number; placed: boolean }

let devWatchers = 0;
let devTimer: number | null = null;
let devStarting = false;
let devPhase: CrashPhase = 'idle';
let devId = '';
let devSeed = '';
let devCommit: string | null = null;
let devBustAt = MIN_X100;
let devRunAt = 0;
let devPhaseAt = 0;
let devLastTick = 0;
let devFirstTick = true;
let devSeats: DevSeat[] = [];
let devCash: CrashCashout[] = [];
let devPendBet: CrashPlayerBet[] = [];
let devPendCash: CrashCashout[] = [];
let devPlans: DevPlan[] = [];
let devHistory: CrashRound[] = [];

function devChips(): number { return Math.max(0, Number(localStorage.getItem(CHIP_KEY) ?? '2000') || 0); }
function setDevChips(n: number) { writeJson(CHIP_KEY, Math.max(0, Math.floor(n))); }

function post(action: string, data: unknown) {
    window.postMessage({ action, data }, '*');
}

function randomHex(bytes: number): string {
    const buf = new Uint8Array(bytes);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(buf);
    else for (let i = 0; i < bytes; i++) buf[i] = Math.floor(Math.random() * 256);
    return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

function devSettle(seat: DevSeat, mx: number) {
    seat.settled = true;
    seat.mx = mx;
    seat.payout = payoutAt(seat.s, mx);
    const row: CrashCashout = { n: seat.n, m: mx, w: seat.payout };
    devCash.push(row);
    devPendCash.push(row);
    if (!seat.mine) return;
    const chips = devChips() + seat.payout;
    setDevChips(chips);
    post('sd-phone:crash:settled', { id: devId, stake: seat.s, payout: seat.payout, mx, chips });
}

function devEmitTick(now: number) {
    devLastTick = now;
    const running = devPhase === 'run';
    const tick: CrashTick = {
        id:  devId,
        ph:  running ? 'run' : 'bet',
        ms:  running ? now - devRunAt : Math.max(0, devRunAt - now),
        now,
    };
    if (running) tick.mx = multAt(now - devRunAt);
    if (!running && devFirstTick) { tick.commit = devCommit; devFirstTick = false; }
    if (devPendBet.length > 0) { tick.bet = devPendBet; devPendBet = []; }
    if (devPendCash.length > 0) { tick.cash = devPendCash; devPendCash = []; }
    post('sd-phone:crash:tick', tick);
}

async function devStartBetting() {
    if (devStarting) return;
    devStarting = true;
    const seed = randomHex(32);
    const commit = await sha256Hex(seed + COMMIT_SUFFIX);
    const bustHash = await sha256Hex(seed);
    devSeed = seed;
    devCommit = commit;
    devBustAt = bustHash === null ? MIN_X100 + Math.floor(Math.random() * 400) : bustFromHash(bustHash);
    devId = randomHex(6);
    devPhase = 'bet';
    devPhaseAt = Date.now();
    devRunAt = devPhaseAt + BETTING_MS;
    devSeats = [];
    devCash = [];
    devPendBet = [];
    devPendCash = [];
    devFirstTick = true;
    devLastTick = 0;
    const count = 1 + Math.floor(Math.random() * 4);
    const pool = [...DEV_BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, count);
    devPlans = pool.map(n => ({
        n,
        at:     devPhaseAt + 400 + Math.floor(Math.random() * (BETTING_MS - 1600)),
        s:      MIN_BET * (1 + Math.floor(Math.random() * 40)),
        auto:   110 + Math.floor(Math.random() * 500),
        placed: false,
    }));
    devStarting = false;
}

function devEndRound() {
    devPhase = 'bust';
    devPhaseAt = Date.now();
    for (const seat of devSeats) {
        if (seat.settled) continue;
        seat.settled = true;
        seat.mx = null;
        seat.payout = 0;
        if (seat.mine) post('sd-phone:crash:settled', { id: devId, stake: seat.s, payout: 0, mx: null, chips: devChips() });
    }
    devHistory = [{ id: devId, bust: devBustAt, seed: devSeed, commit: devCommit }, ...devHistory].slice(0, DEV_HISTORY);
    post('sd-phone:crash:bust', { id: devId, bust: devBustAt, seed: devSeed, commit: devCommit });
}

function devStep() {
    const now = Date.now();

    if (devPhase === 'idle') {
        if (devWatchers > 0) void devStartBetting();
        return;
    }

    if (devPhase === 'bet') {
        for (const plan of devPlans) {
            if (plan.placed || now < plan.at) continue;
            plan.placed = true;
            devSeats.push({ n: plan.n, s: plan.s, auto: plan.auto, settled: false, mx: null, payout: 0, mine: false });
            devPendBet.push({ n: plan.n, s: plan.s });
        }
        if (now >= devRunAt) {
            devPhase = 'run';
            devPhaseAt = now;
            devRunAt = now;
            devLastTick = 0;
            devEmitTick(now);
            return;
        }
        if (now - devLastTick >= 1000) devEmitTick(now);
        return;
    }

    if (devPhase === 'run') {
        const elapsed = now - devRunAt;
        const mx = multAt(elapsed);
        for (const seat of devSeats) {
            if (seat.settled || seat.auto === null) continue;
            if (seat.auto <= mx && seat.auto < devBustAt) devSettle(seat, seat.auto);
        }
        if (mx >= devBustAt || elapsed >= MAX_MS) { devEndRound(); return; }
        if (now - devLastTick >= 250) devEmitTick(now);
        return;
    }

    if (now - devPhaseAt >= BUST_HOLD_MS) {
        if (devWatchers > 0) void devStartBetting();
        else devPhase = 'idle';
    }
}

function devSnapshot(): CrashSnapshot {
    const now = Date.now();
    const mine = devSeats.find(s => s.mine) ?? null;
    return {
        ph:        devPhase,
        id:        devId,
        commit:    devCommit,
        max:       MAX_X100,
        now,
        startedAt: devRunAt,
        msLeft:    devPhase === 'bet' ? Math.max(0, devRunAt - now) : 0,
        mx:        devPhase === 'run' ? multAt(now - devRunAt) : MIN_X100,
        bets:      devSeats.map(s => ({ n: s.n, s: s.s })),
        cash:      [...devCash],
        mine:      mine === null ? null : { stake: mine.s, auto: mine.auto, settled: mine.settled, mx: mine.mx, payout: mine.payout },
        history:   [...devHistory],
    };
}

function devWatch(on: boolean): CrashSnapshot | null {
    if (on) {
        devWatchers += 1;
        if (devTimer === null) devTimer = window.setInterval(devStep, DEV_STEP_MS);
        return devSnapshot();
    }
    devWatchers = Math.max(0, devWatchers - 1);
    if (devWatchers === 0 && devTimer !== null) {
        window.clearInterval(devTimer);
        devTimer = null;
        devPhase = 'idle';
    }
    return null;
}

function devBet(amount: number, auto: number | null): CrashBetReply {
    if (devPhase !== 'bet') return { ok: false, message: 'Bets are closed' };
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < MIN_BET) return { ok: false, message: 'Enter a valid amount' };
    if (devSeats.some(s => s.mine)) return { ok: false, message: 'No live bet' };
    const stake = Math.min(n, MAX_BET);
    const held = devChips();
    if (held < stake) return { ok: false, message: 'Not enough chips' };
    setDevChips(held - stake);
    const seat: DevSeat = { n: 'You', s: stake, auto: cleanAuto(auto), settled: false, mx: null, payout: 0, mine: true };
    devSeats.push(seat);
    devPendBet.push({ n: seat.n, s: seat.s });
    return { ok: true, data: { stake, auto: seat.auto, chips: held - stake } };
}

function devCashout(id: string): CrashCashReply {
    if (devPhase !== 'run' || id !== devId) return { ok: false, message: 'Round is over' };
    const seat = devSeats.find(s => s.mine);
    if (!seat || seat.settled) return { ok: false, message: 'No live bet' };
    const mx = multAt(Date.now() - devRunAt);
    if (mx >= devBustAt) return { ok: false, message: 'Round is over' };
    devSettle(seat, mx);
    return { ok: true, data: { mx, payout: seat.payout, chips: devChips() } };
}

export async function watchCrash(on: boolean): Promise<CrashSnapshot | null> {
    if (!isFiveM) return devWatch(on);
    const res = await fetchNui<Envelope<CrashSnapshot>>('sd-phone:crash:watch', { on }).catch(() => null);
    if (!on || !res || !res.success) return null;
    return res.data ?? null;
}

export async function placeCrashBet(amount: number, auto: number | null): Promise<CrashBetReply> {
    if (!isFiveM) return devBet(amount, auto);
    const r = await apiCall<{ stake: number; auto: number | null; chips: number }>('sd-phone:games:crashBet', { amount, auto: cleanAuto(auto) });
    return r.success && r.data ? { ok: true, data: r.data } : { ok: false, message: r.message };
}

export async function cashOutCrash(id: string): Promise<CrashCashReply> {
    if (!isFiveM) return devCashout(id);
    const r = await apiCall<{ mx: number; payout: number; chips: number }>('sd-phone:games:crashCashout', { id });
    return r.success && r.data ? { ok: true, data: r.data } : { ok: false, message: r.message };
}
