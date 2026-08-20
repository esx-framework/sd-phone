import { useState } from 'react';
import { Check, Copy, ShieldCheck, ShieldQuestion, TriangleAlert } from 'lucide-react';

import { t } from '@/i18n';
import { Sheet } from '@/ui/Sheet';
import { useCopied } from '@/hooks/useCopied';
import { EMBER, GOLD, SURFACE, TABLE } from '@/apps/casino/theme';

import { fmtMult } from './curve';
import { type VerifyResult, verifyRound } from './crashApi';

const STEPS = [
    'commit   = sha256(seed .. ":commit")',
    'h        = sha256(seed)',
    'H        = int(h[1..13], 16)',
    'X        = H / 2^52',
    'bustX100 = floor(97 / (1 - X))',
];

export interface FairRound { id: string; bust: number; seed: string | null; commit: string | null }

export function FairnessSheet({ commit, previous, ceiling, onClose }: {
    commit:   string | null;
    previous: FairRound | null;
    ceiling:  number;
    onClose:  () => void;
}) {
    const [state, setState] = useState<VerifyResult | 'idle' | 'busy'>('idle');

    async function check() {
        if (!previous) return;
        setState('busy');
        setState(await verifyRound(previous.seed, previous.commit, previous.bust, ceiling));
    }

    return (
        <Sheet onClose={onClose} fit="content" forceDark className="bg-[#0A472C] text-white">
            {api => (
                <div className="flex flex-col px-5 pb-2 pt-1">
                    <h2 className="flex items-center justify-center gap-2 text-center text-[20px] font-extrabold tracking-tight text-white">
                        <ShieldCheck className="h-[19px] w-[19px]" strokeWidth={2.4} style={{ color: GOLD.top }} />
                        {t('crash.provablyFair', 'Provably fair')}
                    </h2>

                    {commit === null && previous === null ? (
                        <p className="pb-2 pt-4 text-center text-[14px] font-semibold text-white/60">
                            {t('crash.fairUnavailable', 'Fairness verification is off on this server')}
                        </p>
                    ) : (
                        <>
                            <HashBlock label={t('crash.commitLabel', 'Round hash')} value={commit} tint={GOLD.top} />
                            <HashBlock label={t('crash.seedLabel', 'Revealed seed')} value={previous?.seed ?? null} tint={EMBER.hot} />

                            {previous !== null && (
                                <div
                                    className="mt-2 flex items-center justify-between rounded-[14px] px-3.5 py-2.5"
                                    style={{ background: SURFACE.soft, boxShadow: `inset 0 1px 0 ${SURFACE.hair}` }}
                                >
                                    <span className="text-[13px] font-bold uppercase tracking-wide text-white/45">
                                        {t('crash.busted', 'Busted')}
                                    </span>
                                    <span className="text-[17px] font-extrabold tabular-nums" style={{ color: TABLE.lose }}>
                                        {fmtMult(previous.bust)}x
                                    </span>
                                </div>
                            )}

                            <div
                                className="mt-3 overflow-x-auto rounded-[14px] px-3.5 py-3"
                                style={{ background: 'rgba(0,0,0,0.34)', boxShadow: `inset 0 1px 0 ${SURFACE.hair}` }}
                            >
                                {STEPS.map(line => (
                                    <div key={line} className="whitespace-pre font-mono text-[11.5px] leading-[18px] text-white/75">{line}</div>
                                ))}
                            </div>

                            <p className="px-1 pt-2.5 text-[13px] font-semibold leading-[18px] text-white/55">
                                {t('crash.verifyHow', 'The seed with ":commit" on the end hashes to the round hash you saw before betting. The seed on its own decides where the round busts.')}
                            </p>

                            <button
                                type="button"
                                onClick={() => { void check(); }}
                                disabled={previous === null || state === 'busy'}
                                className="mt-3 flex w-full items-center justify-center gap-2 rounded-[16px] py-3 text-[16px] font-extrabold active:opacity-80"
                                style={{
                                    background: SURFACE.panel,
                                    color: '#fff',
                                    boxShadow: `inset 0 1px 0 ${SURFACE.hair}`,
                                    opacity: previous === null ? 0.4 : 1,
                                }}
                            >
                                <ShieldQuestion className="h-[17px] w-[17px]" strokeWidth={2.4} />
                                {t('crash.verify', 'Verify')}
                            </button>

                            {state !== 'idle' && state !== 'busy' && <VerifyBanner state={state} />}
                        </>
                    )}

                    <button
                        type="button"
                        onClick={api.close}
                        className="mt-4 w-full rounded-[16px] py-3.5 text-[17px] font-bold text-white active:opacity-80"
                        style={{ background: 'rgba(255,255,255,0.12)' }}
                    >
                        {t('casino.done', 'Done')}
                    </button>
                </div>
            )}
        </Sheet>
    );
}

function VerifyBanner({ state }: { state: VerifyResult }) {
    const ok = state === 'ok';
    const tint = ok ? '#9CCC65' : state === 'mismatch' ? TABLE.lose : 'rgba(255,255,255,0.55)';
    const label = ok
        ? t('crash.verifyPass', 'The seed matches the round hash and the bust it produced')
        : state === 'mismatch'
            ? t('crash.verifyFail', 'The seed does not match this round')
            : t('crash.fairUnavailable', 'Fairness verification is off on this server');

    return (
        <div className="mt-2 flex items-center justify-center gap-2 text-[13px] font-bold" style={{ color: tint }}>
            {ok ? <Check className="h-[15px] w-[15px]" strokeWidth={3} /> : <TriangleAlert className="h-[15px] w-[15px]" strokeWidth={2.6} />}
            {label}
        </div>
    );
}

function HashBlock({ label, value, tint }: { label: string; value: string | null; tint: string }) {
    const [copied, copy] = useCopied();

    return (
        <div className="mt-3">
            <div className="flex items-center justify-between pb-1">
                <span className="text-[12px] font-bold uppercase tracking-wide text-white/45">{label}</span>
                {value !== null && (
                    <button
                        type="button"
                        onClick={() => copy(value)}
                        className="flex items-center gap-1 text-[12px] font-bold active:opacity-60"
                        style={{ color: copied ? '#9CCC65' : 'rgba(255,255,255,0.55)' }}
                    >
                        {copied ? <Check className="h-[13px] w-[13px]" strokeWidth={3} /> : <Copy className="h-[13px] w-[13px]" strokeWidth={2.4} />}
                        {copied ? t('common.copied', 'Copied') : t('crash.copyHash', 'Copy')}
                    </button>
                )}
            </div>
            <div
                className="break-all rounded-[14px] px-3.5 py-2.5 font-mono text-[11px] leading-[16px]"
                style={{ background: 'rgba(0,0,0,0.34)', color: value === null ? 'rgba(255,255,255,0.35)' : tint, boxShadow: `inset 0 1px 0 ${SURFACE.hair}` }}
            >
                {value ?? t('crash.waiting', 'Waiting for the next round')}
            </div>
        </div>
    );
}
