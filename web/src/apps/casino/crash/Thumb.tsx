import { EMBER, FELT, GOLD } from '@/apps/casino/theme';

export function CrashThumb() {
    return (
        <svg width="52" height="52" viewBox="0 0 56 56" aria-hidden="true">
            <defs>
                <linearGradient id="csn-lobby-crash-line" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0%" stopColor={EMBER.deep} />
                    <stop offset="55%" stopColor={EMBER.mid} />
                    <stop offset="100%" stopColor={EMBER.hot} />
                </linearGradient>
                <linearGradient id="csn-lobby-crash-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={EMBER.mid} stopOpacity="0.45" />
                    <stop offset="100%" stopColor={EMBER.deep} stopOpacity="0" />
                </linearGradient>
            </defs>

            <rect x="3" y="6" width="50" height="44" rx="11" fill={FELT.bot} />
            <rect x="3.75" y="6.75" width="48.5" height="42.5" rx="10.25" fill="none" stroke={GOLD.deep} strokeWidth="1.5" opacity="0.55" />

            <line x1="9" y1="22" x2="47" y2="22" stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeDasharray="2 4" />
            <line x1="9" y1="32" x2="47" y2="32" stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeDasharray="2 4" />

            <path
                d="M 9 43 C 22 43, 31 39, 37 28 C 41 21, 43 16, 44 12 L 44 43 Z"
                fill="url(#csn-lobby-crash-fill)"
            />
            <path
                d="M 9 43 C 22 43, 31 39, 37 28 C 41 21, 43 16, 44 12"
                fill="none"
                stroke="url(#csn-lobby-crash-line)"
                strokeWidth="3"
                strokeLinecap="round"
            />

            <circle cx="44" cy="12" r="6.5" fill={EMBER.hot} opacity="0.22" />
            <circle cx="44" cy="12" r="3.6" fill={EMBER.hot} />
            <circle cx="44" cy="12" r="1.4" fill="#FFF6E4" />
        </svg>
    );
}
