import { useEffect, useRef, useState } from 'react';
import { Check, Trash2, UserPlus, X } from 'lucide-react';

import { useTheme } from '@/stores/themeStore';
import { AlertDialog } from '@/ui/AlertDialog';
import { GroupCard, ListRow } from '@/ui/ListGroup';
import { Spinner } from '@/ui/Spinner';
import { TimeWheel } from '@/ui/TimeWheel';
import { Toggle } from '@/ui/Toggle';
import { ContactPickerSheet } from '@/shared/ContactPickerSheet';
import type { Contact } from '@/apps/phone/data';
import { calendarInvite, calendarRespond, calendarUninvite } from './calendarApi';
import type { CalendarResult } from './calendarApi';
import { EVENT_COLORS, formatLongDate, formatTime, newId, STATUS_DOT } from './data';
import type { CalAttendee, CalEvent, CalEventDraft } from './data';
import { t } from '@/i18n';

interface Props {
    dayKey:        string;
    dayDate:       Date;
    existing?:     CalEvent;
    onSave:        (draft: CalEventDraft) => Promise<CalendarResult>;
    onDelete?:     () => void;
    onEventChange: (ev: CalEvent) => void;
    onClose:       () => void;
}

export function EventEditor({ dayKey, dayDate, existing, onSave, onDelete, onEventChange, onClose }: Props) {
    const { theme } = useTheme('theme');
    const isDark = theme === 'dark';

    const readOnly = existing !== undefined && !existing.mine;

    const [title,    setTitle]    = useState(existing?.title    ?? '');
    const [location, setLocation] = useState(existing?.location ?? '');
    const [notes,    setNotes]    = useState(existing?.notes    ?? '');
    const [allDay,   setAllDay]   = useState(existing?.allDay   ?? false);
    const [start,    setStart]    = useState(existing?.start    ?? '09:00');
    const [end,      setEnd]      = useState(existing?.end      ?? '10:00');
    const [color,    setColor]    = useState(existing?.color    ?? EVENT_COLORS[0]);

    const [attendees, setAttendees] = useState<CalAttendee[]>(existing?.attendees ?? []);
    const [drafted,   setDrafted]   = useState<Contact[]>([]);
    const [myStatus,  setMyStatus]  = useState(existing?.myStatus ?? null);

    const [activeTime, setActiveTime] = useState<'start' | 'end' | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [busy,       setBusy]       = useState(false);
    const [error,      setError]      = useState<string | null>(null);

    const [shown, setShown] = useState(false);
    const exit = useRef<() => void>(() => {});
    useEffect(() => {
        const id = requestAnimationFrame(() => setShown(true));
        return () => cancelAnimationFrame(id);
    }, []);

    useEffect(() => { if (allDay) setActiveTime(null); }, [allDay]);

    const groupBg = 'rgb(var(--surface))';
    const pageBg  = 'rgb(var(--base))';
    const divider = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    function dismiss(after: () => void) {
        exit.current = after;
        setShown(false);
    }

    function applyEvent(ev: CalEvent) {
        setAttendees(ev.attendees);
        setMyStatus(ev.myStatus);
        onEventChange(ev);
    }

    async function addGuest(contact: Contact) {
        setPickerOpen(false);
        if (!existing) {
            if (drafted.some(c => c.phone === contact.phone)) return;
            setDrafted(d => [...d, contact]);
            return;
        }
        setBusy(true);
        const res = await calendarInvite(existing.id, contact.phone, contact.name);
        setBusy(false);
        if (res.event) applyEvent(res.event);
        else setError(res.error);
    }

    async function removeGuest(guest: CalAttendee) {
        if (!existing) return;
        setBusy(true);
        const res = await calendarUninvite(existing.id, guest.citizenid);
        setBusy(false);
        if (res.event) applyEvent(res.event);
        else setError(res.error);
    }

    async function answer(status: 'accepted' | 'declined') {
        if (!existing) return;
        setBusy(true);
        const res = await calendarRespond(existing.id, status);
        setBusy(false);
        if (!res.event) { setError(res.error); return; }
        onEventChange(res.event);
        dismiss(onClose);
    }

    async function commit() {
        const trimmed = title.trim();
        if (!trimmed) { dismiss(onClose); return; }

        setBusy(true);
        const saved = await onSave({
            id:       existing?.id ?? newId(),
            dayKey,
            title:    trimmed,
            location: location.trim(),
            notes,
            allDay,
            start:    allDay ? null : start,
            end:      allDay ? null : end,
            color,
        });
        if (!saved.event) { setBusy(false); setError(saved.error); return; }

        if (drafted.length > 0) {
            let latest = saved.event;
            let refused: string | null = null;
            for (const contact of drafted) {
                const res = await calendarInvite(latest.id, contact.phone, contact.name);
                if (res.event) latest = res.event;
                else refused = res.error;
            }
            setAttendees(latest.attendees);
            setDrafted([]);
            onEventChange(latest);
            if (refused) { setBusy(false); setError(refused); return; }
        }

        setBusy(false);
        dismiss(onClose);
    }

    const guestChips = (
        <div className="flex flex-wrap gap-2 px-4 pb-3.5 pt-1">
            {attendees.map(a => (
                <GuestChip
                    key={a.citizenid}
                    name={a.name}
                    dot={STATUS_DOT[a.status]}
                    onRemove={readOnly || busy ? undefined : () => void removeGuest(a)}
                />
            ))}
            {drafted.map(c => (
                <GuestChip
                    key={c.id}
                    name={c.name}
                    dot={STATUS_DOT.pending}
                    onRemove={busy ? undefined : () => setDrafted(d => d.filter(x => x.id !== c.id))}
                />
            ))}
        </div>
    );

    const guestCount = attendees.length + drafted.length;

    return (
        <div
            className="absolute inset-0 z-30 flex flex-col font-sf"
            style={{
                background:  pageBg,
                color:       isDark ? '#fff' : '#000',
                transform:   shown ? 'translateY(0)' : 'translateY(100%)',
                transition:  'transform 0.34s cubic-bezier(0.32,0.72,0,1)',
            }}
            onTransitionEnd={() => { if (!shown) exit.current(); }}
        >
            <div className="shrink-0" style={{ height: 54 }} />

            <div className="relative flex h-11 shrink-0 items-center px-4">
                <button type="button" aria-label={t('calendar.cancel', 'Cancel')} onClick={() => dismiss(onClose)} className="flex items-center text-ios-red active:opacity-60">
                    <X className="h-[22px] w-[22px]" strokeWidth={2.5} />
                </button>
                <div className="pointer-events-none absolute inset-x-0 flex justify-center">
                    <span className="text-[17px] font-semibold">
                        {readOnly
                            ? t('calendar.eventDetails', 'Event')
                            : existing ? t('calendar.editEvent', 'Edit Event') : t('calendar.newEventTitle', 'New Event')}
                    </span>
                </div>
                {readOnly ? (
                    <span className="ml-auto flex h-[22px] w-[22px] items-center justify-center">
                        {busy && <Spinner size={18} />}
                    </span>
                ) : (
                    <button
                        type="button"
                        aria-label={t('calendar.saveEvent', 'Save event')}
                        onClick={() => void commit()}
                        disabled={!title.trim() || busy}
                        className="ml-auto flex items-center text-ios-red active:opacity-60 disabled:opacity-30"
                    >
                        {busy ? <Spinner size={18} /> : <Check className="h-[22px] w-[22px]" strokeWidth={2.75} />}
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
                <div className="px-4 pb-2 pt-3 text-[22px] font-bold tracking-tight">
                    {formatLongDate(dayDate)}
                </div>

                {readOnly ? (
                    <>
                        <div className="mx-4 mt-2 overflow-hidden rounded-[10px]" style={{ background: groupBg }}>
                            <div className="px-4 py-3.5 text-[18px] font-semibold">{title}</div>
                            {location && (
                                <>
                                    <div style={{ height: 0.5, background: divider }} />
                                    <div className="px-4 py-3.5 text-[18px] text-ios-gray">{location}</div>
                                </>
                            )}
                        </div>

                        <div className="mx-4 mt-6">
                            <GroupCard>
                                <ListRow
                                    label={t('calendar.organizer', 'Organizer')}
                                    value={existing?.organizerName ?? ''}
                                    chevron={false}
                                    divider
                                />
                                <ListRow
                                    label={t('calendar.when', 'When')}
                                    value={allDay
                                        ? t('calendar.allDay', 'All-day')
                                        : `${formatTime(start)} - ${formatTime(end)}`}
                                    chevron={false}
                                />
                            </GroupCard>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="mx-4 mt-2 overflow-hidden rounded-[10px]" style={{ background: groupBg }}>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder={t('calendar.title', 'Title')}
                                className="w-full bg-transparent px-4 py-3.5 text-[18px] outline-none placeholder:text-ios-gray"
                            />
                            <div style={{ height: 0.5, background: divider }} />
                            <input
                                type="text"
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                                placeholder={t('calendar.location', 'Location')}
                                className="w-full bg-transparent px-4 py-3.5 text-[18px] outline-none placeholder:text-ios-gray"
                            />
                        </div>

                        <div className="mx-4 mt-6 overflow-hidden rounded-[10px]" style={{ background: groupBg }}>
                            <div className="flex items-center px-4 py-3.5">
                                <span className="flex-1 text-[18px]">{t('calendar.allDay', 'All-day')}</span>
                                <Toggle on={allDay} onChange={setAllDay} />
                            </div>
                            <div style={{ height: 0.5, background: divider }} />
                            <TimeRow
                                label={t('calendar.starts', 'Starts')} value={start} isDark={isDark} disabled={allDay}
                                active={activeTime === 'start'}
                                onToggle={() => setActiveTime(a => (a === 'start' ? null : 'start'))}
                            />
                            <TimeWheel value={start} onChange={setStart} open={!allDay && activeTime === 'start'} />
                            <div style={{ height: 0.5, background: divider }} />
                            <TimeRow
                                label={t('calendar.ends', 'Ends')} value={end} isDark={isDark} disabled={allDay}
                                active={activeTime === 'end'}
                                onToggle={() => setActiveTime(a => (a === 'end' ? null : 'end'))}
                            />
                            <TimeWheel value={end} onChange={setEnd} open={!allDay && activeTime === 'end'} />
                        </div>

                        <div className="mx-4 mt-6 overflow-hidden rounded-[10px]" style={{ background: groupBg }}>
                            <div className="flex items-center px-4 py-3.5">
                                <span className="flex-1 text-[18px]">{t('calendar.color', 'Color')}</span>
                                <div className="flex items-center gap-[10px]">
                                    {EVENT_COLORS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setColor(c)}
                                            className="rounded-full active:scale-95"
                                            style={{
                                                width: 22, height: 22, background: c,
                                                boxShadow: color === c ? `0 0 0 2px ${groupBg}, 0 0 0 4px ${c}` : undefined,
                                                transition: 'transform 0.12s',
                                            }}
                                            aria-label={t('calendar.setColor', 'Set color {color}', { color: c })}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <div className="mx-4 mt-6">
                    <GroupCard>
                        {readOnly ? (
                            <ListRow
                                label={t('calendar.invitees', 'Invitees')}
                                value={String(guestCount)}
                                chevron={false}
                                divider={guestCount > 0}
                            />
                        ) : (
                            <ListRow
                                label={t('calendar.invitees', 'Invitees')}
                                value={String(guestCount)}
                                left={<UserPlus className="h-[19px] w-[19px] text-ios-blue" strokeWidth={2.2} />}
                                chevron
                                divider={guestCount > 0}
                                disabled={busy}
                                onPress={() => setPickerOpen(true)}
                            />
                        )}
                        {guestCount > 0 && guestChips}
                    </GroupCard>
                    {!readOnly && guestCount === 0 && (
                        <div className="px-3 pt-2 text-[14px] text-ios-gray">
                            {t('calendar.inviteesHint', 'Invited people see this event in their own calendar once they accept.')}
                        </div>
                    )}
                </div>

                {readOnly ? (
                    notes.trim().length > 0 && (
                        <div className="mx-4 mt-6 overflow-hidden rounded-[10px] px-4 py-3.5 text-[18px] leading-relaxed" style={{ background: groupBg }}>
                            {notes}
                        </div>
                    )
                ) : (
                    <div className="mx-4 mt-6 overflow-hidden rounded-[10px]" style={{ background: groupBg }}>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder={t('calendar.notes', 'Notes')}
                            rows={6}
                            className="w-full bg-transparent px-4 py-3.5 text-[19px] leading-relaxed outline-none placeholder:text-ios-gray resize-none"
                        />
                    </div>
                )}

                {readOnly && (
                    <div className="mx-4 mt-6 overflow-hidden rounded-[10px]" style={{ background: groupBg }}>
                        {myStatus === 'accepted' ? (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => void answer('declined')}
                                className="flex w-full items-center justify-center px-4 py-3.5 text-[18px] text-ios-red active:bg-black/5 disabled:opacity-40 dark:active:bg-white/5"
                            >
                                {t('calendar.leaveEvent', 'Leave Event')}
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void answer('accepted')}
                                    className="flex w-full items-center justify-center px-4 py-3.5 text-[18px] font-medium text-ios-green active:bg-black/5 disabled:opacity-40 dark:active:bg-white/5"
                                >
                                    {t('calendar.accept', 'Accept')}
                                </button>
                                <div style={{ height: 0.5, background: divider }} />
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void answer('declined')}
                                    className="flex w-full items-center justify-center px-4 py-3.5 text-[18px] text-ios-red active:bg-black/5 disabled:opacity-40 dark:active:bg-white/5"
                                >
                                    {t('calendar.decline', 'Decline')}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {existing && !readOnly && onDelete && (
                    <div className="mx-4 mt-6 overflow-hidden rounded-[10px]" style={{ background: groupBg }}>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => dismiss(() => { onDelete(); onClose(); })}
                            className="flex w-full items-center justify-center gap-2 px-4 py-3.5 text-ios-red active:bg-black/5 disabled:opacity-40 dark:active:bg-white/5"
                        >
                            <Trash2 className="h-[18px] w-[18px]" />
                            <span className="text-[18px]">{t('calendar.deleteEvent', 'Delete Event')}</span>
                        </button>
                    </div>
                )}
            </div>

            {pickerOpen && (
                <ContactPickerSheet
                    zIndex={80}
                    onPick={c => void addGuest(c)}
                    onClose={() => setPickerOpen(false)}
                />
            )}

            {error !== null && (
                <AlertDialog
                    title={t('calendar.appName', 'Calendar')}
                    message={error}
                    hideCancel
                    onCancel={() => setError(null)}
                    onConfirm={() => setError(null)}
                />
            )}
        </div>
    );
}


function GuestChip({ name, dot, onRemove }: { name: string; dot: string; onRemove?: () => void }) {
    return (
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-black/[0.06] py-1.5 pl-2.5 pr-2.5 text-[15px] dark:bg-white/10">
            <span className={`h-[8px] w-[8px] shrink-0 rounded-full ${dot}`} />
            <span className="max-w-[140px] truncate">{name}</span>
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label={t('calendar.removeGuest', 'Remove {name}', { name })}
                    className="-mr-1 flex h-[18px] w-[18px] items-center justify-center rounded-full text-ios-gray active:opacity-60"
                >
                    <X className="h-[13px] w-[13px]" strokeWidth={3} />
                </button>
            )}
        </span>
    );
}


function TimeRow({ label, value, active, disabled, onToggle, isDark }: {
    label:    string;
    value:    string;
    active:   boolean;
    disabled: boolean;
    onToggle: () => void;
    isDark:   boolean;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onToggle}
            className={`flex w-full items-center px-4 py-3.5 transition-opacity duration-200 ${disabled ? 'opacity-40' : 'active:bg-black/5 dark:active:bg-white/5'}`}
        >
            <span className="flex-1 text-left text-[18px]">{label}</span>
            <span
                className="rounded-[7px] px-2.5 py-1 text-[17px] tabular-nums transition-colors"
                style={active
                    ? { background: 'rgba(255,69,58,0.16)', color: '#ff453a' }
                    : { background: isDark ? 'rgba(118,118,128,0.24)' : 'rgba(118,118,128,0.12)', color: isDark ? '#fff' : '#000' }
                }
            >
                {formatTime(value)}
            </span>
        </button>
    );
}
