import { isFiveM } from '@/core/nui';
import { apiCall, apiData, type Envelope } from '@/core/api';

export interface Voicemail {
    id:       string;
    number:   string;
    name:     string | null;
    url:      string;
    duration: number;
    listened: boolean;
    date:     string;
}

export const VOICEMAIL_MAX_SECONDS = 60;

const SAMPLE = 'https://download.samplelib.com/mp3/sample-9s.mp3';

const devVoicemails: Voicemail[] = [
    {
        id: 'dev-vm-1', number: '3105550123', name: 'Carl Jensen', url: SAMPLE,
        duration: 22, listened: false, date: new Date(Date.now() - 42 * 60_000).toISOString(),
    },
    {
        id: 'dev-vm-2', number: '4155550188', name: null, url: SAMPLE,
        duration: 9, listened: true, date: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    },
];

function normalise(vm: Voicemail): Voicemail {
    return { ...vm, name: vm.name ?? null, number: vm.number ?? '' };
}

let enabledCache: Promise<boolean> | null = null;

export function voicemailEnabled(): Promise<boolean> {
    if (!isFiveM) return Promise.resolve(true);
    enabledCache ??= apiData<{ enabled: boolean }>('sd-phone:voicemail:enabled')
        .then(res => res?.enabled === true)
        .catch(() => false);
    return enabledCache;
}

export async function fetchVoicemails(): Promise<Voicemail[]> {
    if (!isFiveM) return devVoicemails.map(normalise);
    const res = await apiData<{ voicemails: Voicemail[] }>('sd-phone:voicemail:list');
    return (res?.voicemails ?? []).map(normalise);
}

export async function markVoicemailsSeen(): Promise<void> {
    if (!isFiveM) {
        for (const vm of devVoicemails) vm.listened = true;
        return;
    }
    await apiCall<{ changed: number }>('sd-phone:voicemail:seen');
}

export async function deleteVoicemail(id: string): Promise<boolean> {
    if (!isFiveM) {
        const at = devVoicemails.findIndex(vm => vm.id === id);
        if (at >= 0) devVoicemails.splice(at, 1);
        return true;
    }
    return (await apiCall<unknown>('sd-phone:voicemail:delete', { id })).success;
}

export async function uploadVoicemail(audio: string): Promise<Envelope<{ url: string }>> {
    if (!isFiveM) return { success: true, data: { url: SAMPLE } };
    return await apiCall<{ url: string }>('sd-phone:voicemail:upload', { audio });
}

export async function leaveVoicemail(number: string, url: string, duration: number): Promise<Envelope<{ delivered: boolean }>> {
    if (!isFiveM) {
        devVoicemails.unshift({
            id: `dev-vm-${Date.now()}`, number, name: null, url,
            duration, listened: false, date: new Date().toISOString(),
        });
        return { success: true, data: { delivered: true } };
    }
    return await apiCall<{ delivered: boolean }>('sd-phone:voicemail:leave', { number, url, duration });
}
