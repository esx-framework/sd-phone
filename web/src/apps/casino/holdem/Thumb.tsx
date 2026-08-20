import { FELT, GOLD, TABLE } from '../theme';

export function HoldemThumb() {
    return (
        <svg width="52" height="52" viewBox="0 0 56 56" aria-hidden="true">
            <defs>
                <linearGradient id="csn-lobby-holdem" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={GOLD.top} />
                    <stop offset="45%" stopColor={GOLD.mid} />
                    <stop offset="100%" stopColor={GOLD.deep} />
                </linearGradient>
            </defs>

            <ellipse cx="28" cy="30" rx="25" ry="19" fill={FELT.mid} stroke="url(#csn-lobby-holdem)" strokeWidth="2.5" />
            <ellipse cx="28" cy="30" rx="19" ry="13" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />

            <g transform="rotate(-13 17 22)">
                <rect x="9" y="9" width="17" height="24" rx="3" fill="#F3F6F4" stroke="rgba(0,0,0,0.2)" />
                <text x="12" y="19" fontSize="9" fontWeight="800" fill={TABLE.black}>A</text>
                <text x="16" y="30" fontSize="11" fill={TABLE.black}>&#9824;</text>
            </g>
            <g transform="rotate(11 37 22)">
                <rect x="30" y="8" width="17" height="24" rx="3" fill="#FFFFFF" stroke="rgba(0,0,0,0.2)" />
                <text x="33" y="18" fontSize="9" fontWeight="800" fill={TABLE.red}>K</text>
                <text x="37" y="29" fontSize="11" fill={TABLE.red}>&#9829;</text>
            </g>

            <g>
                <ellipse cx="28" cy="42" rx="9" ry="3.4" fill="rgba(0,0,0,0.35)" />
                <rect x="19" y="36.5" width="18" height="4.4" rx="2.2" fill="#5A3488" />
                <rect x="19" y="33" width="18" height="4.4" rx="2.2" fill="#7C51B4" />
                <rect x="19" y="29.5" width="18" height="4.4" rx="2.2" fill="url(#csn-lobby-holdem)" />
            </g>
        </svg>
    );
}
