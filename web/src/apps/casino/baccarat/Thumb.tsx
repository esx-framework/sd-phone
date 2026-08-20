import { FELT, GOLD, TABLE } from '../theme';

const PLAYER_INK = '#3C7DD9';

export function BaccaratThumb() {
    return (
        <svg width="52" height="52" viewBox="0 0 56 56" aria-hidden="true">
            <defs>
                <linearGradient id="csn-bac-shoe" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={GOLD.top} />
                    <stop offset="45%" stopColor={GOLD.mid} />
                    <stop offset="100%" stopColor={GOLD.deep} />
                </linearGradient>
            </defs>

            <path d="M4 40 A 24 16 0 0 0 52 40 Z" fill={FELT.bot} opacity="0.85" />
            <path d="M4 40 A 24 16 0 0 0 52 40" fill="none" stroke="url(#csn-bac-shoe)" strokeWidth="2" />

            <g transform="rotate(-12 18 28)">
                <rect x="7" y="13" width="21" height="30" rx="4" fill="#E9EEEB" stroke="rgba(0,0,0,0.2)" />
                <text x="17.5" y="34" fontSize="15" fontWeight="800" textAnchor="middle" fill={PLAYER_INK}>P</text>
            </g>
            <g transform="rotate(12 38 28)">
                <rect x="28" y="11" width="21" height="30" rx="4" fill="#FFFFFF" stroke="rgba(0,0,0,0.2)" />
                <text x="38.5" y="32" fontSize="15" fontWeight="800" textAnchor="middle" fill={TABLE.red}>B</text>
            </g>

            <circle cx="28" cy="45" r="6" fill="url(#csn-bac-shoe)" />
            <circle cx="28" cy="45" r="3.4" fill="none" stroke={FELT.bot} strokeWidth="1.2" />
        </svg>
    );
}
