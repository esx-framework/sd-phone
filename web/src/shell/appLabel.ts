import type { CSSProperties } from 'react';

import type { DeviceGrid } from '@/device/types';

export const APP_LABEL_CLASS =
    'truncate text-center font-sf font-bold tracking-[0.01em] text-white';

const APP_LABEL_SHADOW = '0 0 1px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,0.75), 0 1px 3px rgba(0,0,0,0.55)';

const LABEL_MIN_GAP = 6;
const LABEL_MAX_OVERHANG = 22;

function appLabelSize(icon: number): number {
    return Math.min(15, Math.max(10.5, Math.round((icon / 6) * 2) / 2));
}

function appLabelOverhang(g: DeviceGrid): number {
    const gap = g.colStride - g.icon;
    return Math.max(0, Math.min(LABEL_MAX_OVERHANG, Math.round(gap - LABEL_MIN_GAP)));
}

export function appLabelStyle(g: DeviceGrid): CSSProperties {
    const overhang = appLabelOverhang(g);
    return {
        width:        g.icon + overhang,
        marginInline: -overhang / 2,
        fontSize:     appLabelSize(g.icon),
        textShadow:   APP_LABEL_SHADOW,
    };
}
