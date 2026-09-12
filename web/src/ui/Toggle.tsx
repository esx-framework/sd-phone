import { useState } from 'react';
import { clsx } from 'clsx';
import type { MouseEvent } from 'react';

const THUMB_SHADOW = '0 2px 8px rgba(0,0,0,0.26), 0 0.5px 1.5px rgba(0,0,0,0.18)';

export function Toggle({ defaultOn = false, on, onChange, disabled = false, activeColor, scale = 1, ariaLabel }: {
    defaultOn?:   boolean;
    on?:          boolean;
    onChange?:    (v: boolean) => void;
    disabled?:    boolean;
    activeColor?: string;
    scale?:       number;
    ariaLabel?:   string;
}) {
    const [internal, setInternal] = useState(defaultOn);
    const controlled = on !== undefined;
    const value = controlled ? on : internal;

    function toggle(e: MouseEvent) {
        e.stopPropagation();
        if (disabled) return;
        const next = !value;
        if (!controlled) setInternal(next);
        onChange?.(next);
    }

    const W = 51 * scale, H = 31 * scale, K = 27 * scale, pad = 2 * scale, tx = 20 * scale;
    return (
        <button
            type="button"
            role="switch"
            aria-checked={value}
            aria-disabled={disabled}
            aria-label={ariaLabel}
            onClick={toggle}
            className={clsx(
                'relative shrink-0 rounded-full transition-colors duration-[280ms]',
                value ? (activeColor ? undefined : 'bg-ios-green') : 'bg-ios-gray5 dark:bg-control',
                disabled && 'cursor-not-allowed opacity-40',
            )}
            style={{
                width:  W,
                height: H,
                background: value && activeColor ? activeColor : undefined,
                boxShadow: value
                    ? 'inset 0 0 0 0.5px rgba(0,0,0,0.06)'
                    : 'inset 0 0 0 0.5px rgba(0,0,0,0.10)',
            }}
        >
            <span
                className="absolute rounded-full bg-white transition-transform duration-[280ms]"
                style={{
                    top:  pad,
                    insetInlineStart: pad,
                    width:  K,
                    height: K,
                    transform:                value ? `translateX(calc(var(--dir-x, 1) * ${tx}px))` : 'translateX(0)',
                    boxShadow:                THUMB_SHADOW,
                    transitionTimingFunction: 'cubic-bezier(0.25, 1, 0.5, 1)',
                }}
            />
        </button>
    );
}
