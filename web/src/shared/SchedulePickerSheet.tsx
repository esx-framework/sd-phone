import { useMemo, useState } from 'react';

import { getLocaleTag, t } from '@/i18n';
import { format12h } from '@/lib/time';
import { DrumWheel } from '@/ui/DrumWheel';
import { Sheet } from '@/ui/Sheet';
import { TimeWheel } from '@/ui/TimeWheel';

const BAND = 34;
const DAYS_AHEAD = 30;
const MIN_AHEAD_SECS = 5 * 60;
const MAX_AHEAD_SECS = DAYS_AHEAD * 86400;

function pad2(n: number): string {
    return String(n).padStart(2, '0');
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

export function SchedulePickerSheet({ at, accent, forceDark = false, onPick, onClose }: {
    at:         number | null;
    accent?:    string;
    forceDark?: boolean;
    onPick:     (at: number) => void;
    onClose:    () => void;
}) {
    const today = useMemo(() => startOfDay(Date.now()), []);
    const days = useMemo(() => {
        const out: Date[] = [];
        for (let i = 0; i <= DAYS_AHEAD; i += 1) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            out.push(d);
        }
        return out;
    }, [today]);
    const labels = useMemo(() => days.map(d => dayLabel(d, today.getTime())), [days, today]);

    const seed = useMemo(() => {
        if (at) return new Date(at * 1000);
        const d = new Date(Date.now() + 3600000);
        d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
        return d;
    }, [at]);

    const [dayIndex, setDayIndex] = useState(() => {
        const found = days.findIndex(d => d.getTime() === startOfDay(seed.getTime()).getTime());
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
    const tooSoon = picked < now + MIN_AHEAD_SECS;
    const tooFar = picked > now + MAX_AHEAD_SECS;
    const valid = !tooSoon && !tooFar;

    const hint = tooSoon
        ? t('schedule.tooSoon', 'Pick a time at least 5 minutes from now.')
        : tooFar
            ? t('schedule.tooFar', 'Pick a time within the next 30 days.')
            : t('schedule.goesLive', 'Goes live {when}.', { when: scheduleLabel(picked) });

    return (
        <Sheet
            onClose={onClose}
            fit="content"
            forceDark={forceDark}
            title={t('schedule.title', 'Schedule')}
            className="bg-base font-sf"
        >
            {({ close }) => (
                <>
                    <div className="relative px-4 pt-1">
                        <div
                            className="pointer-events-none absolute inset-x-4 rounded-[8px] bg-[rgba(120,120,128,0.16)] dark:bg-[rgba(120,120,128,0.24)]"
                            style={{ top: 4 + BAND, height: BAND }}
                        />
                        <div className="relative flex justify-center">
                            <DrumWheel
                                values={labels}
                                index={dayIndex}
                                onChange={setDayIndex}
                                width={264}
                                bandHeight={BAND}
                                fontSize={20}
                                fontWeight={400}
                                showBand={false}
                                forceDark={forceDark}
                            />
                        </div>
                    </div>

                    <TimeWheel value={time} onChange={setTime} open />

                    <p className={`px-6 pt-1 text-center text-[14px] leading-snug ${valid ? 'text-ios-gray' : 'text-ios-red'}`}>
                        {hint}
                    </p>

                    <div className="flex items-center gap-3 px-5 pb-1 pt-4">
                        <button
                            type="button"
                            onClick={close}
                            className="flex-1 rounded-[12px] bg-black/[0.06] py-3 text-[17px] font-medium text-black active:opacity-60 dark:bg-white/[0.12] dark:text-white"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            type="button"
                            disabled={!valid}
                            onClick={() => { onPick(picked); close(); }}
                            className={`flex-1 rounded-[12px] py-3 text-[17px] font-semibold text-white active:opacity-80 disabled:opacity-40 ${accent ? '' : 'bg-ios-blue'}`}
                            style={accent ? { background: accent } : undefined}
                        >
                            {t('schedule.set', 'Set time')}
                        </button>
                    </div>
                </>
            )}
        </Sheet>
    );
}
