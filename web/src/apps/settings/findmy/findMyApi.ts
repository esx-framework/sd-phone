import { apiCall, apiData, type Envelope } from '@/core/api';
import { isFiveM } from '@/core/nui';
import { device } from '@device';

export type FindMyKind = 'phone' | 'tablet';

export interface FindMyDevice {
    key:         string;
    kind:        FindMyKind;
    x:           number;
    y:           number;
    z:           number;
    seenAt:      number;
    lost:        boolean;
    lostMessage: string | null;
    lostContact: string | null;
    lostAt:      number | null;
    isThis:      boolean;
    online:      boolean;
    hasPasscode: boolean;
}

export interface FindMySnapshot {
    devices: FindMyDevice[];
    thisKey: string | null;
}

interface RawDevice extends Partial<Omit<FindMyDevice, 'kind'>> { kind?: string }

function normalise(raw: RawDevice): FindMyDevice {
    return {
        key:         raw.key ?? '',
        kind:        raw.kind === 'tablet' ? 'tablet' : 'phone',
        x:           raw.x ?? 0,
        y:           raw.y ?? 0,
        z:           raw.z ?? 0,
        seenAt:      raw.seenAt ?? 0,
        lost:        raw.lost === true,
        lostMessage: raw.lostMessage ?? null,
        lostContact: raw.lostContact ?? null,
        lostAt:      raw.lostAt ?? null,
        isThis:      raw.isThis === true,
        online:      raw.online === true,
        hasPasscode: raw.hasPasscode === true,
    };
}

const nowSec = () => Math.floor(Date.now() / 1000);

const DEV_DEVICES: FindMyDevice[] = [
    {
        key: 'dev:seed:phone', kind: 'phone', x: -1037, y: -2738, z: 20,
        seenAt: nowSec() - 240, lost: false, lostMessage: null, lostContact: null, lostAt: null,
        isThis: device.id === 'phone', online: true, hasPasscode: true,
    },
    {
        key: 'dev:seed:tablet', kind: 'tablet', x: 195, y: -934, z: 30,
        seenAt: nowSec() - 7400, lost: true,
        lostMessage: 'Lost near Legion Square. Reward for its return.',
        lostContact: '2075550149', lostAt: nowSec() - 7200,
        isThis: device.id === 'tablet', online: false, hasPasscode: true,
    },
];

function devSnapshot(): FindMySnapshot {
    return {
        devices: DEV_DEVICES.map(d => ({ ...d })),
        thisKey: DEV_DEVICES.find(d => d.isThis)?.key ?? null,
    };
}

function devPatch(key: string, patch: Partial<FindMyDevice>): void {
    const at = DEV_DEVICES.findIndex(d => d.key === key);
    if (at >= 0) DEV_DEVICES[at] = { ...DEV_DEVICES[at], ...patch };
}

export async function loadFindMy(): Promise<FindMySnapshot | null> {
    if (!isFiveM) return devSnapshot();
    const res = await apiData<{ devices?: RawDevice[]; thisKey?: string }>('sd-phone:findmy:list');
    if (!res) return null;
    return {
        devices: (res.devices ?? []).map(normalise),
        thisKey: res.thisKey ?? null,
    };
}

export async function playDeviceSound(key: string): Promise<Envelope> {
    if (!isFiveM) return { success: true };
    return apiCall('sd-phone:findmy:playSound', { key });
}

export async function setDeviceLost(key: string, message: string, contact: string, passcode: string | null): Promise<Envelope> {
    if (!isFiveM) {
        devPatch(key, { lost: true, lostMessage: message || null, lostContact: contact || null, lostAt: nowSec(), hasPasscode: true });
        return { success: true };
    }
    return apiCall('sd-phone:findmy:setLost', { key, message, contact, passcode: passcode ?? undefined });
}

export async function clearDeviceLost(key: string): Promise<Envelope> {
    if (!isFiveM) {
        devPatch(key, { lost: false, lostMessage: null, lostContact: null, lostAt: null });
        return { success: true };
    }
    return apiCall('sd-phone:findmy:clearLost', { key });
}

export async function eraseDevice(key: string): Promise<Envelope> {
    if (!isFiveM) {
        const at = DEV_DEVICES.findIndex(d => d.key === key);
        if (at >= 0) DEV_DEVICES.splice(at, 1);
        return { success: true };
    }
    return apiCall('sd-phone:findmy:erase', { key });
}

export async function verifyLostPin(pin: string): Promise<boolean> {
    if (!isFiveM) return pin === '1234';
    const res = await apiData<{ ok?: boolean }>('sd-phone:findmy:unlock', { pin });
    return res?.ok === true;
}
