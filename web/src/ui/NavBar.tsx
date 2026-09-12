import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function NavBar({ backLabel, onBack, title, right, hairline = false, className = '' }: {
    backLabel?: string;
    onBack?:    () => void;
    title?:     string;
    right?:     ReactNode;
    hairline?:  boolean;
    className?: string;
}) {
    return (
        <div className={`relative flex h-11 shrink-0 items-center px-2 ${className}`}>
            {onBack && (
                <button
                    type="button"
                    onClick={onBack}
                    className="relative z-10 flex items-center gap-0.5 text-[17px] text-ios-blue active:opacity-60"
                >
                    <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.5} />
                    {backLabel && <span>{backLabel}</span>}
                </button>
            )}
            {title && (
                <div className="pointer-events-none absolute inset-x-0 flex justify-center">
                    <span className="max-w-[60%] truncate text-[17px] font-semibold text-black dark:text-white">{title}</span>
                </div>
            )}
            {right && <div className="ms-auto flex items-center pe-2 text-ios-blue">{right}</div>}
            {hairline && <div className="absolute inset-x-0 bottom-0 h-[0.5px] bg-control" />}
        </div>
    );
}
