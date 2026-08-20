import { SUIT_GLYPH, isRed, type Card } from './cards';

const FACE_RED = '#D4213B';
const FACE_BLACK = '#1A1A22';

function radiusFor(h: number): number {
    return Math.max(4, Math.min(12, Math.round(h * 0.107)));
}

export function CardFace({ card, w = 80, h = 112 }: { card: Card; w?: number; h?: number }) {
    const color = isRed(card.suit) ? FACE_RED : FACE_BLACK;
    const glyph = SUIT_GLYPH[card.suit];
    const corner = { color, fontSize: h * 0.19 };
    const pip = { color, fontSize: h * 0.134 };
    return (
        <div
            className="relative flex shrink-0 flex-col justify-between bg-white"
            style={{
                width: w,
                height: h,
                borderRadius: radiusFor(h),
                boxShadow: '0 2px 6px rgba(0,0,0,0.32), inset 0 0 0 1px rgba(0,0,0,0.06)',
                padding: h * 0.0625,
            }}
        >
            <div className="flex flex-col items-center leading-none">
                <span className="font-extrabold leading-none" style={corner}>{card.rank}</span>
                <span className="leading-none" style={pip}>{glyph}</span>
            </div>
            <span
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 leading-none"
                style={{ color, fontSize: h * 0.36 }}
            >
                {glyph}
            </span>
            <div className="flex flex-col items-center self-end leading-none" style={{ transform: 'rotate(180deg)' }}>
                <span className="font-extrabold leading-none" style={corner}>{card.rank}</span>
                <span className="leading-none" style={pip}>{glyph}</span>
            </div>
        </div>
    );
}

export function CardBack({ w = 80, h = 112 }: { w?: number; h?: number }) {
    const border = Math.max(1.5, h * 0.0357);
    const inset = h * 0.0625;
    return (
        <div
            className="relative shrink-0 overflow-hidden"
            style={{
                width: w,
                height: h,
                borderRadius: radiusFor(h),
                background: 'repeating-linear-gradient(45deg, #B11E33 0 6px, #8E1527 6px 12px)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.32)',
                border: `${border}px solid #fff`,
            }}
        >
            <div
                className="absolute"
                style={{
                    inset,
                    borderRadius: Math.max(3, radiusFor(h) - 5),
                    border: '1.5px solid rgba(255,255,255,0.55)',
                }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
                <span
                    className="font-black leading-none"
                    style={{ color: 'rgba(255,255,255,0.85)', fontSize: h * 0.232, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                >
                    ♠
                </span>
            </div>
        </div>
    );
}
