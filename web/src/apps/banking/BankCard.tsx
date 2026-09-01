import { t } from '@/i18n';
import { bankBrand, cardColor, cardPattern, resolveStyle, type CardStyle } from './bankBrands';

function Chip({ gradientId }: { gradientId: string }) {
    return (
        <svg width="44" height="34" viewBox="0 0 44 34" aria-hidden className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#F6E7B0" />
                    <stop offset="0.45" stopColor="#DDBC63" />
                    <stop offset="1" stopColor="#B28A24" />
                </linearGradient>
            </defs>
            <rect x="0.75" y="0.75" width="42.5" height="32.5" rx="6" fill={`url(#${gradientId})`} stroke="rgba(90,66,12,0.5)" strokeWidth="0.75" />
            <g stroke="rgba(96,70,14,0.55)" strokeWidth="1.1" fill="none">
                <path d="M0 12 H13 M31 12 H44 M0 22 H13 M31 22 H44 M14 0 V11 M14 23 V34 M30 0 V11 M30 23 V34" />
                <rect x="14" y="11.5" width="16" height="11" rx="1.5" />
                <line x1="22" y1="11.5" x2="22" y2="22.5" />
            </g>
        </svg>
    );
}

function Contactless({ size = 22 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            <path d="M8 8.5a6 6 0 0 1 0 7" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M11.5 6a10 10 0 0 1 0 12" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M15 3.5a14 14 0 0 1 0 17" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
    );
}

export function BankCard({ holder, last4, expiry, style }: {
    holder: string;
    last4:  string;
    expiry: string;
    style:  Partial<CardStyle> | null | undefined;
}) {
    const resolved = resolveStyle(style);
    const bank     = bankBrand(resolved.bank);
    const color    = cardColor(resolved.color);
    const tile     = cardPattern(resolved.pattern);

    const key    = `${resolved.bank}-${resolved.color}-${resolved.pattern}`;
    const chipId = `chip-${key}`;
    const waveId = `wave-${key}`;
    const glowId = `glow-${key}`;

    return (
        <div
            className="relative mx-auto w-full max-w-[420px] select-none overflow-hidden rounded-[20px] font-sf text-white"
            style={{
                aspectRatio: '1.586',
                background: color.background,
                boxShadow: color.shadow,
                contain: 'paint',
            }}
        >
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 320 202" preserveAspectRatio="none" aria-hidden>
                <defs>
                    <pattern id={waveId} width={tile.w} height={tile.h} patternUnits="userSpaceOnUse">
                        <path d={tile.d} fill="none" stroke={color.stroke} strokeWidth={tile.strokeWidth} />
                    </pattern>
                    <radialGradient id={glowId} cx="0.82" cy="0.3" r="0.5">
                        <stop offset="0" stopColor={color.glow} stopOpacity="0.0" />
                        <stop offset="0.7" stopColor={color.glow} stopOpacity="0.10" />
                        <stop offset="1" stopColor={color.glow} stopOpacity="0" />
                    </radialGradient>
                </defs>
                <rect width="320" height="202" fill={`url(#${waveId})`} opacity={tile.opacity} />
                <rect width="320" height="202" fill={`url(#${glowId})`} />
            </svg>

            <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(150deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 38%), linear-gradient(0deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 32%)' }} />

            <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-[14px]">
                <span className="truncate pr-2 text-[24px] font-extrabold leading-none tracking-[-0.02em]" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{bank.wordmark}</span>
                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                    <span className="text-white/65"><Contactless size={20} /></span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/55">{t('banking.debit', 'Debit')}</span>
                </div>
            </div>

            <div className="absolute left-4 top-[40%] -translate-y-1/2"><Chip gradientId={chipId} /></div>

            <div className="absolute inset-x-4 bottom-[34px]">
                <div className="flex items-center gap-[14px]" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                    {[0, 1, 2].map(group => (
                        <span key={group} className="flex gap-[5px]">
                            {[0, 1, 2, 3].map(i => <span key={i} className="h-[6px] w-[6px] rounded-full bg-white/80" />)}
                        </span>
                    ))}
                    <span className="text-[18px] font-semibold tracking-[0.16em] tabular-nums">{last4}</span>
                </div>
            </div>

            <div className="absolute inset-x-4 bottom-3 flex items-end justify-between">
                <span className="min-w-0 flex-1 truncate pr-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/85">{holder}</span>
                <div className="shrink-0 text-right leading-none">
                    <div className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-white/50">{t('banking.validThru', 'Valid thru')}</div>
                    <div className="mt-1 text-[15px] font-semibold tabular-nums tracking-wide text-white/90">{expiry}</div>
                </div>
            </div>
        </div>
    );
}
