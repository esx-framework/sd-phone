import { t } from '@/i18n';

const GOLD  = '#FF9F0A';
const EMPTY = 'rgba(120,120,128,0.30)';

function StarShape({ size, color }: { size: number; color: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
            <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.65 1.13 6.57L12 17.55l-5.9 3.11 1.13-6.57L3.46 9.44l6.6-.96z" />
        </svg>
    );
}

export function Stars({ value, size, onChange, color = GOLD }: {
    value:     number;
    size?:     number;
    onChange?: (v: number) => void;
    color?:    string;
}) {
    if (onChange) {
        const px = size ?? 36;
        return (
            <div className="inline-flex" style={{ gap: px * 0.28 }}>
                {[1, 2, 3, 4, 5].map(s => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => onChange(s)}
                        className="transition-transform active:scale-90"
                        aria-label={s === 1 ? t('common.starCount', '{s} star', { s }) : t('common.starsCount', '{s} stars', { s })}
                    >
                        <StarShape size={px} color={value >= s ? color : EMPTY} />
                    </button>
                ))}
            </div>
        );
    }

    const px = size ?? 14;
    return (
        <div className="inline-flex" style={{ gap: px * 0.11 }}>
            {[0, 1, 2, 3, 4].map(i => {
                const frac = Math.max(0, Math.min(1, value - i));
                return (
                    <span key={i} className="relative inline-block" style={{ width: px, height: px }}>
                        <StarShape size={px} color={EMPTY} />
                        {frac > 0 && (
                            <span className="absolute start-0 top-0 overflow-hidden" style={{ width: `${frac * 100}%`, height: px }}>
                                <StarShape size={px} color={color} />
                            </span>
                        )}
                    </span>
                );
            })}
        </div>
    );
}
