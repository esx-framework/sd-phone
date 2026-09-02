import { isFiveM } from '@/core/nui';
import { apiCall, failText } from '@/core/api';
import { t } from '@/i18n';
import { newId } from '@/lib/format';
import { readJson, writeJson } from '@/lib/storage';
import type { CalAttendee, CalEvent, CalEventDraft, RsvpStatus } from './data';

const DEV_KEY = 'sd-phone:calendar:devEvents:v1';
const DEV_ME  = 'DEV00001';

export interface CalendarResult {
    event: CalEvent | null;
    error: string | null;
}

interface RawAttendee {
    citizenid?: string;
    name?:      string;
    status?:    string;
    number?:    string;
}

interface RawEvent {
    id?:            string;
    dayKey?:        string;
    title?:         string;
    allDay?:        boolean;
    start?:         string;
    end?:           string;
    location?:      string;
    notes?:         string;
    color?:         string;
    organizer?:     string;
    organizerName?: string;
    mine?:          boolean;
    myStatus?:      string;
    attendees?:     RawAttendee[];
}

function toStatus(v: string | undefined): RsvpStatus | null {
    return v === 'pending' || v === 'accepted' || v === 'declined' ? v : null;
}

function toAttendee(raw: RawAttendee): CalAttendee {
    return {
        citizenid: raw.citizenid ?? '',
        name:      raw.name ?? '',
        status:    toStatus(raw.status) ?? 'pending',
        number:    raw.number ?? null,
    };
}

function toEvent(raw: RawEvent): CalEvent {
    return {
        id:            raw.id ?? '',
        dayKey:        raw.dayKey ?? '',
        title:         raw.title ?? '',
        allDay:        raw.allDay === true,
        start:         raw.start ?? null,
        end:           raw.end ?? null,
        location:      raw.location ?? '',
        notes:         raw.notes ?? '',
        color:         raw.color ?? '#ff453a',
        organizer:     raw.organizer ?? '',
        organizerName: raw.organizerName ?? '',
        mine:          raw.mine === true,
        myStatus:      toStatus(raw.myStatus),
        attendees:     (raw.attendees ?? []).map(toAttendee),
    };
}

function offsetDayKey(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

function seedEvents(): CalEvent[] {
    return [
        {
            id:            'devev1',
            dayKey:        offsetDayKey(0),
            title:         'Warehouse pickup',
            allDay:        false,
            start:         '18:00',
            end:           '19:30',
            location:      'Elysian Island',
            notes:         'Bring the van.',
            color:         '#0a84ff',
            organizer:     DEV_ME,
            organizerName: 'You',
            mine:          true,
            myStatus:      null,
            attendees: [
                { citizenid: 'DEV00002', name: 'Carl Jensen', status: 'accepted', number: '(310) 555-0123' },
                { citizenid: 'DEV00003', name: 'Bree Larsen', status: 'pending',  number: '(213) 555-0192' },
            ],
        },
        {
            id:            'devev2',
            dayKey:        offsetDayKey(2),
            title:         'Poker night',
            allDay:        false,
            start:         '21:00',
            end:           '23:00',
            location:      'Vinewood Hills',
            notes:         'Buy-in is $500.',
            color:         '#bf5af2',
            organizer:     'DEV00004',
            organizerName: 'Jenny Voss',
            mine:          false,
            myStatus:      'pending',
            attendees: [
                { citizenid: DEV_ME, name: 'You', status: 'pending', number: null },
            ],
        },
    ];
}

function devLoad(): CalEvent[] {
    const raw = readJson<CalEvent[]>(DEV_KEY);
    if (Array.isArray(raw)) return raw;
    const seeded = seedEvents();
    writeJson(DEV_KEY, seeded);
    return seeded;
}

function devSave(events: CalEvent[]): CalEvent[] {
    writeJson(DEV_KEY, events);
    return events;
}

function devFind(id: string): CalEvent | null {
    return devLoad().find(e => e.id === id) ?? null;
}

export async function calendarList(): Promise<CalEvent[] | null> {
    if (!isFiveM) return devLoad().filter(e => e.mine || e.myStatus !== 'declined');
    const res = await apiCall<{ events?: RawEvent[] }>('sd-phone:calendar:list');
    if (!res.success) return null;
    return (res.data?.events ?? []).map(toEvent);
}

export async function calendarSave(draft: CalEventDraft): Promise<CalendarResult> {
    if (!isFiveM) {
        const events = devLoad();
        const idx    = events.findIndex(e => e.id === draft.id);
        const merged: CalEvent = idx === -1
            ? { ...draft, organizer: DEV_ME, organizerName: 'You', mine: true, myStatus: null, attendees: [] }
            : { ...events[idx], ...draft };
        devSave(idx === -1 ? [...events, merged] : events.map(e => e.id === draft.id ? merged : e));
        return { event: merged, error: null };
    }
    const res = await apiCall<{ event?: RawEvent }>('sd-phone:calendar:save', draft);
    if (!res.success || !res.data?.event) {
        return { event: null, error: failText(res, t('calendar.couldNotSaveEvent', 'Could not save the event')) };
    }
    return { event: toEvent(res.data.event), error: null };
}

export async function calendarDelete(id: string): Promise<boolean> {
    if (!isFiveM) {
        devSave(devLoad().filter(e => e.id !== id));
        return true;
    }
    const res = await apiCall<{ id?: string }>('sd-phone:calendar:delete', { id });
    return res.success;
}

export async function calendarInvite(eventId: string, number: string, name: string): Promise<CalendarResult> {
    if (!isFiveM) {
        const events = devLoad();
        const target = events.find(e => e.id === eventId);
        if (!target) return { event: null, error: t('calendar.eventNotFound', 'Event not found') };
        if (target.attendees.some(a => a.number === number)) {
            return { event: null, error: t('calendar.alreadyInvited', 'They are already invited') };
        }
        const guest: CalAttendee = { citizenid: newId(), name, status: 'pending', number };
        const next = { ...target, attendees: [...target.attendees, guest] };
        devSave(events.map(e => e.id === eventId ? next : e));
        return { event: next, error: null };
    }
    const res = await apiCall<{ event?: RawEvent }>('sd-phone:calendar:invite', { eventId, number, name });
    if (!res.success || !res.data?.event) {
        return { event: null, error: failText(res, t('calendar.couldNotInvite', 'Could not send that invite')) };
    }
    return { event: toEvent(res.data.event), error: null };
}

export async function calendarRespond(eventId: string, status: 'accepted' | 'declined'): Promise<CalendarResult> {
    if (!isFiveM) {
        const events = devLoad();
        const target = devFind(eventId);
        if (!target) return { event: null, error: t('calendar.eventNotFound', 'Event not found') };
        const next: CalEvent = {
            ...target,
            myStatus:  status,
            attendees: target.attendees.map(a => a.citizenid === DEV_ME ? { ...a, status } : a),
        };
        devSave(events.map(e => e.id === eventId ? next : e));
        return { event: next, error: null };
    }
    const res = await apiCall<{ event?: RawEvent }>('sd-phone:calendar:respond', { eventId, status });
    if (!res.success || !res.data?.event) {
        return { event: null, error: failText(res, t('calendar.couldNotRespond', 'Could not send your answer')) };
    }
    return { event: toEvent(res.data.event), error: null };
}

export async function calendarUninvite(eventId: string, citizenid: string): Promise<CalendarResult> {
    if (!isFiveM) {
        const events = devLoad();
        const target = devFind(eventId);
        if (!target) return { event: null, error: t('calendar.eventNotFound', 'Event not found') };
        const next = { ...target, attendees: target.attendees.filter(a => a.citizenid !== citizenid) };
        devSave(events.map(e => e.id === eventId ? next : e));
        return { event: next, error: null };
    }
    const res = await apiCall<{ event?: RawEvent }>('sd-phone:calendar:uninvite', { eventId, citizenid });
    if (!res.success || !res.data?.event) {
        return { event: null, error: failText(res, t('calendar.couldNotRemoveGuest', 'Could not remove that guest')) };
    }
    return { event: toEvent(res.data.event), error: null };
}
