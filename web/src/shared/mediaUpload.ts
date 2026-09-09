import { apiCall, apiData } from '@/core/api';

export interface DirectUploadActions {
    slot: string;
    done: string;
}

export async function uploadDirect(
    blob: Blob,
    filename: string,
    actions: DirectUploadActions,
    slotPayload?: unknown,
): Promise<string | null> {
    const slot = await apiData<{ url: string }>(actions.slot, slotPayload);
    if (!slot || typeof slot.url !== 'string' || slot.url === '') return null;

    let hosted: string;
    try {
        const form = new FormData();
        form.append('file', blob, filename);
        const res = await fetch(slot.url, { method: 'POST', body: form });
        if (!res.ok) return null;
        const body = await res.json() as { data?: { url?: unknown } } | null;
        const url = body?.data?.url;
        if (typeof url !== 'string' || url === '') return null;
        hosted = url;
    } catch {
        return null;
    }

    const done = await apiCall(actions.done, { url: hosted });
    return done.success ? hosted : null;
}
