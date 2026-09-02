import { getLocaleTag } from '@/i18n';
import { readJson, writeJson } from '@/lib/storage';
import { format12h } from '@/lib/time';

const STORAGE_KEY = 'sd-phone:calendar:v1';

export type RsvpStatus = 'pending' | 'accepted' | 'declined';

export interface CalAttendee {
    citizenid: string;
    name:      string;
    status:    RsvpStatus;
    number:    string | null;
}

export interface CalEvent {
    id:            string;
    dayKey:        string;
    title:         string;
    allDay:        boolean;
    start:         string | null;
    end:           string | null;
    location:      string;
    notes:         string;
    color:         string;
    organizer:     string;
    organizerName: string;
    mine:          boolean;
    myStatus:      RsvpStatus | null;
    attendees:     CalAttendee[];
}

export interface CalEventDraft {
    id:       string;
    dayKey:   string;
    title:    string;
    allDay:   boolean;
    start:    string | null;
    end:      string | null;
    location: string;
    notes:    string;
    color:    string;
}

export function loadDayNotes(): Record<string, string> {
    const raw = readJson<{ dayNotes?: unknown }>(STORAGE_KEY);
    const notes = raw?.dayNotes;
    return notes && typeof notes === 'object' ? notes as Record<string, string> : {};
}

export function saveDayNotes(dayNotes: Record<string, string>): void {
    const raw = readJson<Record<string, unknown>>(STORAGE_KEY) ?? {};
    writeJson(STORAGE_KEY, { ...raw, dayNotes });
}

interface LegacyEvent {
    id?:       unknown;
    dayKey?:   unknown;
    title?:    unknown;
    allDay?:   unknown;
    start?:    unknown;
    end?:      unknown;
    location?: unknown;
    notes?:    unknown;
    color?:    unknown;
}

export function readLegacyEvents(): CalEventDraft[] {
    const raw = readJson<{ events?: unknown }>(STORAGE_KEY);
    const list = Array.isArray(raw?.events) ? raw.events as LegacyEvent[] : [];
    return list
        .filter(e => e && typeof e.id === 'string' && typeof e.dayKey === 'string' && typeof e.title === 'string')
        .map(e => ({
            id:       String(e.id),
            dayKey:   String(e.dayKey),
            title:    String(e.title),
            allDay:   e.allDay === true,
            start:    typeof e.start === 'string' ? e.start : null,
            end:      typeof e.end === 'string' ? e.end : null,
            location: typeof e.location === 'string' ? e.location : '',
            notes:    typeof e.notes === 'string' ? e.notes : '',
            color:    typeof e.color === 'string' ? e.color : '',
        }));
}

export function clearLegacyEvents(): void {
    const raw = readJson<Record<string, unknown>>(STORAGE_KEY);
    if (!raw || !('events' in raw)) return;
    const rest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) if (k !== 'events') rest[k] = v;
    writeJson(STORAGE_KEY, rest);
}

export const STATUS_DOT: Record<RsvpStatus, string> = {
    pending:  'bg-ios-gray',
    accepted: 'bg-ios-green',
    declined: 'bg-ios-red',
};

export function isShared(ev: CalEvent): boolean {
    return ev.attendees.length > 0 || !ev.mine;
}

export function sortEvents(events: CalEvent[]): CalEvent[] {
    return [...events].sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (b.allDay && !a.allDay) return 1;
        return (a.start ?? '').localeCompare(b.start ?? '');
    });
}

export function dayKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth()    === b.getMonth()
        && a.getDate()     === b.getDate();
}

export function addMonths(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function localeDateNames(count: number, dateFor: (i: number) => Date, opts: Intl.DateTimeFormatOptions): string[] {
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
        Object.defineProperty(names, i, {
            enumerable: true,
            get: () => dateFor(i).toLocaleDateString(getLocaleTag(), opts),
        });
    }
    return names;
}

export const MONTH_NAMES = localeDateNames(12, i => new Date(2001, i, 1), { month: 'long' });

export const WEEKDAY_SHORT = localeDateNames(7, i => new Date(2001, 6, 1 + i), { weekday: 'narrow' });

export function monthGrid(d: Date): Date[] {
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const startCol = first.getDay();
    const gridStart = new Date(d.getFullYear(), d.getMonth(), 1 - startCol);
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
        out.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
    }
    return out;
}

export { formatLongDate } from '@/lib/time';

export function formatTime(hhmm: string): string {
    const [hStr, mStr] = hhmm.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    return format12h(h, m);
}

export { newId } from '@/lib/format';

export const EVENT_COLORS = [
    '#ff453a',
    '#ff9f0a',
    '#ffd60a',
    '#34c759',
    '#0a84ff',
    '#5e5ce6',
    '#bf5af2',
];
