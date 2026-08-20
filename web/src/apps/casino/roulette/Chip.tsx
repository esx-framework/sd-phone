export const CHIP_DENOMS = [5, 25, 100, 500, 1000];

const TONES: Record<number, { base: string; face: string; ink: string }> = {
    5:    { base: '#B4232A', face: '#D8474A', ink: '#FFF1F0' },
    25:   { base: '#136B3C', face: '#22945A', ink: '#EAFBF0' },
    100:  { base: '#16181C', face: '#33363E', ink: '#F4F6F8' },
    500:  { base: '#5A3488', face: '#7C51B4', ink: '#F5EEFF' },
    1000: { base: '#A97F31', face: '#E4C275', ink: '#3B2A08' },
};

function toneFor(value: number) {
    let pick = CHIP_DENOMS[0];
    for (const d of CHIP_DENOMS) if (value >= d) pick = d;
    return TONES[pick];
}

export function chipText(value: number): string {
    if (value >= 1000) {
        const k = value / 1000;
        return `${k >= 10 || Number.isInteger(k) ? Math.round(k) : k.toFixed(1)}k`;
    }
    return String(value);
}

export function Chip({ value, size = 28, label, dim = false }: {
    value:  number;
    size?:  number;
    label?: string;
    dim?:   boolean;
}) {
    const tone = toneFor(value);
    const text = label ?? chipText(value);
    const font = text.length > 4 ? 8.5 : text.length > 3 ? 9.5 : 11;

    return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ display: 'block', opacity: dim ? 0.55 : 1 }}>
            <circle cx="16" cy="16" r="15" fill={tone.base} />
            <circle
                cx="16" cy="16" r="13.3" fill="none" stroke="#F3F6F4" strokeWidth="5"
                strokeDasharray="6.4 7.53" strokeDashoffset="3.2"
            />
            <circle cx="16" cy="16" r="15" fill="none" stroke="rgba(0,0,0,0.42)" strokeWidth="1.6" />
            <circle cx="16" cy="16" r="10.6" fill={tone.base} />
            <circle cx="16" cy="16" r="10.6" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="1" />
            <circle cx="16" cy="16" r="8.4" fill={tone.face} />
            <text
                x="16" y="16" textAnchor="middle" dominantBaseline="central"
                fontSize={font} fontWeight="800" fill={tone.ink} letterSpacing="-0.3"
            >
                {text}
            </text>
        </svg>
    );
}
