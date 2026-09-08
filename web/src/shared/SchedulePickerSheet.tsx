import { useMemo, useState } from 'react';

import { getLocaleTag, t } from '@/i18n';
import { format12h } from '@/lib/time';
import { DrumWheel } from '@/ui/DrumWheel';
import { Sheet } from '@/ui/Sheet';
import { SheetHeader } from '@/ui/SheetHeader';
import { TimeWheel } from '@/ui/TimeWheel';

const WHEEL_BAND = 48;

function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}

function startOfDay(ms: number): Date {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayLabel(day: Date, today: number): string {
    const diff = Math.round((day.getTime() - today) / 86400000);
    if (diff === 0) return t('schedule.today', 'Today');
    if (diff === 1) return t('schedule.tomorrow', 'Tomorrow');
    return day.toLocaleDateString(getLocaleTag(), { weekday: 'short', month: 'short', day: 'numeric' });
}

export function scheduleLabel(at: number): string {
    const when = new Date(at * 1000);
    const time = format12h(when.getHours(), when.getMinutes());
    const day = dayLabel(startOfDay(when.getTime()), startOfDay(Date.now()).getTime());
    return t('schedule.atLabel', '{day} at {time}', { day, time });
}

export function countdownLabel(at: number, now: number = Date.now()): string {
    const secs = at - Math.floor(now / 1000);
    if (secs <= 0) return t('schedule.countdownNow', 'any moment now');
    if (secs < 60) return t('schedule.countdownUnderMinute', 'under a minute');

    const mins = Math.floor(secs / 60);
    if (mins < 60) {
        return mins === 1
            ? t('schedule.countdownMinute', '1 minute')
            : t('schedule.countdownMinutes', '{n} minutes', { n: mins });
    }

    const hours = Math.floor(mins / 60);
    if (hours < 24) {
        return hours === 1
            ? t('schedule.countdownHour', '1 hour')
            : t('schedule.countdownHours', '{n} hours', { n: hours });
    }

    const days = Math.floor(hours / 24);
    return days === 1
        ? t('schedule.countdownDay', '1 day')
        : t('schedule.countdownDays', '{n} days', { n: days });
}

export function TimePickerSheet({ at, title, daySpan, minAhead, maxAhead, forceDark = false, zIndex, onPick, onClose }: {
    at:         number | null;
    title:      string;
    daySpan:    number;
    minAhead?:  number;
    maxAhead?:  number;
    forceDark?: boolean;
    zIndex?:    number;
    onPick:     (at: number) => void;
    onClose:    () => void;
}) {
    const today = useMemo(() => startOfDay(Date.now()), []);
    const days = useMemo(() => Array.from(
        { length: daySpan },
        (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i),
    ), [today, daySpan]);
    const labels = useMemo(() => days.map(d => dayLabel(d, today.getTime())), [days, today]);

    const seed = useMemo(() => {
        if (at) return new Date(at * 1000);
        const d = new Date(Date.now() + 3600000);
        d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
        return d;
    }, [at]);

    const [dayIndex, setDayIndex] = useState(() => {
        const target = startOfDay(seed.getTime()).getTime();
        const found = days.findIndex(d => d.getTime() === target);
        return found < 0 ? 0 : found;
    });
    const [time, setTime] = useState(() => `${pad2(seed.getHours())}:${pad2(seed.getMinutes())}`);

    const picked = useMemo(() => {
        const day = days[Math.min(Math.max(dayIndex, 0), days.length - 1)];
        const [hh, mm] = time.split(':');
        const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(hh) || 0, Number(mm) || 0);
        return Math.floor(when.getTime() / 1000);
    }, [days, dayIndex, time]);

    const now = Math.floor(Date.now() / 1000);
    const tooSoon = minAhead !== undefined && picked < now + minAhead;
    const tooFar = maxAhead !== undefined && picked > now + maxAhead;
    const valid = !tooSoon && !tooFar;

    const hint = tooSoon
        ? t('schedule.tooSoon', 'Pick a time at least 5 minutes from now.')
        : tooFar
            ? t('schedule.tooFar', 'Pick a time within the next 30 days.')
            : null;

    return (
        <Sheet onClose={onClose} fit="content" forceDark={forceDark} zIndex={zIndex} className="bg-base font-sf">
            {({ close }) => (
                <>
                    <SheetHeader
                        cancelLabel={t('common.cancel', 'Cancel')}
                        onCancel={close}
                        title={title}
                        doneLabel={t('common.done', 'Done')}
                        doneDisabled={!valid}
                        onDone={() => { onPick(picked); close(); }}
                    />

                    <div className="relative px-4 pt-1">
                        <div
                            className="pointer-events-none absolute inset-x-4 rounded-[8px] bg-[rgba(120,120,128,0.16)] dark:bg-[rgba(120,120,128,0.24)]"
                            style={{ top: 4 + WHEEL_BAND, height: WHEEL_BAND }}
                        />
                        <div className="relative flex justify-center">
                            <DrumWheel
                                values={labels}
                                index={dayIndex}
                                onChange={setDayIndex}
                                width={300}
                                bandHeight={WHEEL_BAND}
                                fontSize={25}
                                fontWeight={400}
                                showBand={false}
                                forceDark={forceDark}
                            />
                        </div>
                    </div>

                    <div className="mx-4 my-2 h-[0.5px] bg-hairline/25" />

                    <TimeWheel value={time} onChange={setTime} open itemHeight={44} fontSize={28} columnWidth={74} />

                    {hint && (
                        <p className="px-6 pb-2 pt-1 text-center text-[14px] leading-snug text-ios-red">{hint}</p>
                    )}
                </>
            )}
        </Sheet>
    );
}

const SCHEDULE_DAYS = 31;
const MIN_AHEAD_SECS = 5 * 60;
const MAX_AHEAD_SECS = 30 * 86400;

export function SchedulePickerSheet({ at, forceDark = false, zIndex, onPick, onClose }: {
    at:         number | null;
    forceDark?: boolean;
    zIndex?:    number;
    onPick:     (at: number) => void;
    onClose:    () => void;
}) {
    return (
        <TimePickerSheet
            at={at}
            title={t('schedule.title', 'Schedule')}
            daySpan={SCHEDULE_DAYS}
            minAhead={MIN_AHEAD_SECS}
            maxAhead={MAX_AHEAD_SECS}
            forceDark={forceDark}
            zIndex={zIndex}
            onPick={onPick}
            onClose={onClose}
        />
    );
}
