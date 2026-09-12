import type { CSSProperties, ReactNode } from 'react';

import type { WidgetAlign, WidgetTheme } from '@/apps/appstore/appsApi';

export interface Palette {
    bg:    string;
    fg:    string;
    body:  string;
    sub:   string;
    faint: string;
    rule:  string;
    chip:  string;
}

export function palette(theme: WidgetTheme = 'dark'): Palette {
    if (theme === 'glass') {
        return {
            bg:    'linear-gradient(158deg, rgba(255,255,255,0.20) 0%, rgba(12,14,18,0.26) 46%, rgba(8,10,14,0.40) 100%)',
            fg:    '#ffffff',
            body:  'rgba(255,255,255,0.88)',
            sub:   'rgba(255,255,255,0.74)',
            faint: 'rgba(255,255,255,0.55)',
            rule:  'rgba(255,255,255,0.22)',
            chip:  'rgba(255,255,255,0.20)',
        };
    }
    return theme === 'light'
        ? {
            bg:    'linear-gradient(168deg, #ffffff 0%, #f2f2f5 58%, #e9e9ee 100%)',
            fg:    '#0b0b0d',
            body:  'rgba(11,11,13,0.78)',
            sub:   'rgba(11,11,13,0.58)',
            faint: 'rgba(11,11,13,0.38)',
            rule:  'rgba(11,11,13,0.10)',
            chip:  'rgba(11,11,13,0.06)',
        }
        : {
            bg:    'linear-gradient(168deg, #232327 0%, #141416 56%, #0b0b0d 100%)',
            fg:    '#ffffff',
            body:  'rgba(255,255,255,0.80)',
            sub:   'rgba(255,255,255,0.58)',
            faint: 'rgba(255,255,255,0.38)',
            rule:  'rgba(255,255,255,0.10)',
            chip:  'rgba(255,255,255,0.08)',
        };
}

export function alignClasses(align: WidgetAlign = 'left'): string {
    if (align === 'center') return 'items-center text-center';
    if (align === 'right')  return 'items-end text-end';
    return 'items-start text-start';
}

export function WidgetTile({
    children, width, height, radius = 22, style, tint, bleed, hairline = true, glass = false,
}: {
    children: ReactNode;
    width: number;
    height: number;
    radius?: number;
    style?: CSSProperties;
    tint?: string;
    bleed?: ReactNode;
    hairline?: boolean;
    glass?: boolean;
}) {
    const frosted = !glass && !tint && !bleed;
    return (
        <div
            className={`relative overflow-hidden${frosted ? ' sd-frosted' : ''}`}
            style={{
                width,
                height,
                borderRadius: radius,
                background: glass ? 'transparent' : (tint ?? (bleed ? '#000' : 'rgba(28,28,30,0.62)')),
                backdropFilter: frosted ? 'blur(22px) saturate(160%)' : undefined,
                WebkitBackdropFilter: frosted ? 'blur(22px) saturate(160%)' : undefined,
                boxShadow: glass
                    ? '0 10px 30px rgba(0,0,0,0.26), inset 0 0 0 0.5px rgba(255,255,255,0.30), inset 0 1px 0 rgba(255,255,255,0.42)'
                    : `0 8px 22px rgba(0,0,0,0.32)${hairline ? ', inset 0 0.5px 0 rgba(255,255,255,0.14)' : ''}`,
                ...style,
            }}
        >
            {glass && (
                <>
                    <div
                        aria-hidden
                        className="pointer-events-none absolute"
                        style={{
                            left:   'var(--glass-x, 0px)',
                            top:    'var(--glass-y, 0px)',
                            width:  'var(--glass-w, 100%)',
                            height: 'var(--glass-h, 100%)',
                            backgroundImage: 'var(--glass-img, none)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: 'blur(18px) saturate(150%)',
                        }}
                    />
                    <div className="pointer-events-none absolute inset-0" style={{ background: tint }} />
                </>
            )}
            {bleed && <div className="pointer-events-none absolute inset-0">{bleed}</div>}
            <div className="relative h-full w-full">{children}</div>
        </div>
    );
}
