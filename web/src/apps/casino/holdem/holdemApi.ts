import { apiCall } from '@/core/api';
import { isFiveM } from '@/core/nui';

import type { HoldemAction, HoldemStatePush, HoldemTableInfo } from './data';
import { devHoldem } from './devTable';

export interface HoldemReply<T> { ok: boolean; message?: string; data?: T }

export async function tablesApi(): Promise<HoldemTableInfo[]> {
    if (!isFiveM) return devHoldem.tables();
    const res = await apiCall<{ tables: HoldemTableInfo[] }>('sd-phone:games:holdemTables');
    return res.success && res.data ? res.data.tables : [];
}

export async function syncApi(tableId: string): Promise<HoldemStatePush | null> {
    if (!isFiveM) return devHoldem.sync(tableId);
    const res = await apiCall<HoldemStatePush>('sd-phone:games:holdemSync', { tableId });
    return res.success && res.data ? res.data : null;
}

export async function sitApi(tableId: string, seat: number, buyIn: number): Promise<HoldemReply<HoldemStatePush>> {
    if (!isFiveM) return devHoldem.sit(tableId, seat, buyIn);
    const res = await apiCall<HoldemStatePush>('sd-phone:games:holdemSit', { tableId, seat, buyIn });
    return { ok: res.success, message: res.message, data: res.data };
}

export async function leaveApi(): Promise<HoldemReply<{ chips: number }>> {
    if (!isFiveM) {
        const out = devHoldem.leave();
        return { ok: out.ok, data: { chips: out.chips } };
    }
    const res = await apiCall<{ chips: number }>('sd-phone:games:holdemLeave');
    return { ok: res.success, message: res.message, data: res.data };
}

export async function actApi(tableId: string, handId: number, action: HoldemAction, to: number): Promise<HoldemReply<void>> {
    if (!isFiveM) return devHoldem.act(tableId, handId, action, to);
    const res = await apiCall<void>('sd-phone:games:holdemAct', { tableId, handId, action, to });
    return { ok: res.success, message: res.message };
}
