import { formatDuration } from '@/lib/time';

export function RecordPulse({ seconds, className, barClassName = 'bg-ios-red', textClassName = 'text-ios-red' }: {
    seconds:        number;
    className?:     string;
    barClassName?:  string;
    textClassName?: string;
}) {
    return (
        <div className={`flex items-center justify-center gap-3 ${className ?? ''}`}>
            <span className="flex items-end gap-[3px]" style={{ height: 16 }}>
                {[0, 1, 2, 3, 4].map(i => (
                    <span
                        key={i}
                        className={`w-[3px] rounded-full ${barClassName}`}
                        style={{ height: 16, transformOrigin: 'bottom', animation: `eq-bounce 0.6s ease-in-out ${i * 0.1}s infinite` }}
                    />
                ))}
            </span>
            <span className={`text-[16px] font-semibold tabular-nums ${textClassName}`}>{formatDuration(seconds)}</span>
        </div>
    );
}
