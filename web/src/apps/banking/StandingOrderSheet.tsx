import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { UserRound } from 'lucide-react';

import { failText } from '@/core/api';
import { getLocaleTag, t } from '@/i18n';
import { digits } from '@/lib/format';
import { formatPhone, formatPhonePartial } from '@/lib/phone';
import { format12h } from '@/lib/time';
import { ContactPickerSheet } from '@/shared/ContactPickerSheet';
import { AlertDialog } from '@/ui/AlertDialog';
import { DrumWheel } from '@/ui/DrumWheel';
import { GroupCard, ListRow } from '@/ui/ListGroup';
import { Scroller } from '@/ui/Scroller';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';
import { SheetHeader } from '@/ui/SheetHeader';
import { TimeWheel } from '@/ui/TimeWheel';
import {
    createStandingOrder, deleteStandingOrder, updateStandingOrder,
    type StandingInterval, type StandingOrder,
} from './bankingApi';

const LABEL_MAX  = 40;
const WHEEL_BAND = 40;
const DAY_SPAN   = 60;

export function intervalLabel(interval: StandingInterval): string {
    if (interval === 'daily')  return t('banking.standingDaily', 'Daily');
    if (interval === 'weekly') return t('banking.standingWeekly', 'Weekly');
    return t('banking.standingMonthly', 'Monthly');
}

export function whenLabel(seconds: number): string {
    const d = new Date(seconds * 1000);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.toLocaleDateString(getLocaleTag(), { month: 'short', day: 'numeric' })}, ${format12h(d.getHours(), d.getMinutes())}`;
}

function startOfDay(ms: number): Date {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function defaultFirstRun(): number {
    const d = startOfDay(Date.now() + 86_400_000);
    d.setHours(9, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
}

function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}

export function StandingOrderSheet({ order, onClose, onSaved }: {
    order:   StandingOrder | null;
    onClose: () => void;
    onSaved: (orders: StandingOrder[]) => void;
}) {
    const editing = order !== null;

    const [number,   setNumber]   = useState(order?.recipient ?? '');
    const [name,     setName]     = useState<string | undefined>(order?.recipientName ?? undefined);
    const [label,    setLabel]    = useState(order?.label ?? '');
    const [amount,   setAmount]   = useState(order ? String(order.amount) : '');
    const [repeats,  setRepeats]  = useState<StandingInterval>(order?.interval ?? 'monthly');
    const [firstRun, setFirstRun] = useState(() => order?.nextRun ?? defaultFirstRun());
    const [picking,  setPicking]  = useState(false);
    const [timing,   setTiming]   = useState(false);
    const [removing, setRemoving] = useState(false);
    const [busy,     setBusy]     = useState(false);
    const [error,    setError]    = useState<string | null>(null);

    const recipientDigits = digits(number);
    const amountNum       = parseInt(amount || '0', 10);
    const canSave         = label.trim().length > 0 && amountNum > 0 && !busy
                            && (editing || recipientDigits.length >= 3);

    function apply(res: Awaited<ReturnType<typeof createStandingOrder>>, close: () => void) {
        setBusy(false);
        if (res.success) {
            onSaved(res.data?.orders ?? []);
            close();
            return;
        }
        setError(failText(res, t('banking.somethingWentWrong', 'Something went wrong')));
    }

    async function save(close: () => void) {
        if (!canSave) return;
        setBusy(true); setError(null);
        const res = editing
            ? await updateStandingOrder(order.id, { label: label.trim(), amount: amountNum, interval: repeats, active: order.active })
            : await createStandingOrder({ number: recipientDigits, name, label: label.trim(), amount: amountNum, interval: repeats, firstRun });
        apply(res, close);
    }

    async function remove(close: () => void) {
        if (!editing || busy) return;
        setBusy(true); setError(null);
        apply(await deleteStandingOrder(order.id), close);
    }

    return (
        <Sheet
            onClose={onClose}
            fit="full"
            top={26}
            grabber={false}
            className="bg-base font-sf text-black dark:text-white"
        >
            {({ close }) => (
                <>
                    <SheetHeader
                        cancelLabel={t('banking.cancel', 'Cancel')}
                        onCancel={close}
                        title={editing ? t('banking.standingOrder', 'Standing Order') : t('banking.newStandingOrder', 'New Standing Order')}
                        doneLabel={t('common.save', 'Save')}
                        onDone={() => void save(close)}
                        doneDisabled={!canSave}
                    />

                    <Scroller className="min-h-0 flex-1 px-5 pb-10 pt-2">
                        <FieldLabel>{t('banking.recipient', 'Recipient')}</FieldLabel>
                        {editing ? (
                            <GroupCard className="mb-6" radius={14}>
                                <ListRow
                                    label={order.recipientName ?? formatPhone(order.recipient)}
                                    sub={order.recipientName ? formatPhone(order.recipient) : undefined}
                                    chevron={false}
                                />
                            </GroupCard>
                        ) : (
                            <div className="mb-6 flex items-center gap-3">
                                <input
                                    type="tel"
                                    inputMode="tel"
                                    aria-label={t('banking.recipientNumber', 'Recipient number')}
                                    value={number ? formatPhonePartial(number) : ''}
                                    onChange={e => { setNumber(digits(e.target.value).slice(0, 24)); setName(undefined); }}
                                    placeholder={t('banking.phonePlaceholder', '(555) 123-4567')}
                                    className="w-full rounded-[14px] bg-surface px-4 py-4 text-[18px] text-black placeholder-black/50 outline-none dark:text-white dark:placeholder-white/45"
                                />
                                <button
                                    type="button"
                                    onClick={() => setPicking(true)}
                                    aria-label={t('common.selectContact', 'Select Contact')}
                                    className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[14px] bg-surface text-ios-blue shadow-sm active:opacity-70"
                                >
                                    <UserRound className="h-[26px] w-[26px]" strokeWidth={2} />
                                </button>
                            </div>
                        )}

                        <FieldLabel>{t('banking.standingName', 'Name')}</FieldLabel>
                        <input
                            value={label}
                            maxLength={LABEL_MAX}
                            onChange={e => { setLabel(e.target.value); setError(null); }}
                            placeholder={t('banking.standingNamePlaceholder', 'Rent, insurance, allowance')}
                            aria-label={t('banking.standingName', 'Name')}
                            className="mb-6 w-full rounded-[14px] bg-surface px-4 py-4 text-[18px] text-black placeholder-black/50 outline-none dark:text-white dark:placeholder-white/45"
                        />

                        <FieldLabel>{t('banking.amount', 'Amount')}</FieldLabel>
                        <div className="mb-6 flex items-center gap-1.5 rounded-[14px] bg-surface px-4 py-4">
                            <span className="text-[18px] font-medium text-black/45 dark:text-white/45">$</span>
                            <input
                                value={amount ? amountNum.toLocaleString('en-US') : ''}
                                onChange={e => { setAmount(digits(e.target.value).replace(/^0+/, '').slice(0, 9)); setError(null); }}
                                inputMode="numeric"
                                aria-label={t('banking.amount', 'Amount')}
                                placeholder="0"
                                className="w-full bg-transparent text-[18px] tabular-nums text-black placeholder-black/50 outline-none dark:text-white dark:placeholder-white/45"
                            />
                        </div>

                        <FieldLabel>{t('banking.standingRepeats', 'Repeats')}</FieldLabel>
                        <SegmentedControl<StandingInterval>
                            value={repeats}
                            onChange={setRepeats}
                            options={[
                                { value: 'daily',   label: t('banking.standingDaily', 'Daily') },
                                { value: 'weekly',  label: t('banking.standingWeekly', 'Weekly') },
                                { value: 'monthly', label: t('banking.standingMonthly', 'Monthly') },
                            ]}
                            className="mb-6"
                            slide
                        />

                        <FieldLabel>{editing ? t('banking.standingNextPayment', 'Next Payment') : t('banking.standingStarts', 'Starts')}</FieldLabel>
                        <GroupCard className="mb-6" radius={14}>
                            <ListRow
                                label={editing ? whenLabel(order.nextRun) : whenLabel(firstRun)}
                                chevron={!editing}
                                onPress={editing ? undefined : () => setTiming(true)}
                            />
                        </GroupCard>

                        {editing && (
                            <GroupCard className="mb-4" radius={14}>
                                <ListRow
                                    label={t('banking.standingDelete', 'Delete Standing Order')}
                                    destructive
                                    chevron={false}
                                    onPress={() => setRemoving(true)}
                                />
                            </GroupCard>
                        )}

                        {error ? (
                            <p className="px-1 text-[16px] font-medium leading-snug text-ios-red">{error}</p>
                        ) : (
                            <p className="px-1 text-[16px] leading-snug text-ios-gray">
                                {t('banking.standingHint', 'The payment is taken from your bank account each time it falls due, as long as you are online.')}
                            </p>
                        )}
                    </Scroller>

                    {picking && (
                        <ContactPickerSheet
                            zIndex={70}
                            onPick={c => { setNumber(digits(c.phone ?? '')); setName(c.name); setPicking(false); }}
                            onClose={() => setPicking(false)}
                        />
                    )}

                    {timing && (
                        <StartsSheet at={firstRun} onPick={setFirstRun} onClose={() => setTiming(false)} />
                    )}

                    {removing && (
                        <AlertDialog
                            title={t('banking.standingDeleteTitle', 'Delete Standing Order')}
                            message={t('banking.standingDeleteMessage', 'No more payments will be taken for {label}.', { label: label.trim() })}
                            confirmLabel={t('banking.standingDeleteConfirm', 'Delete')}
                            cancelLabel={t('banking.cancel', 'Cancel')}
                            destructive
                            onCancel={() => setRemoving(false)}
                            onConfirm={() => { setRemoving(false); void remove(close); }}
                        />
                    )}
                </>
            )}
        </Sheet>
    );
}

function StartsSheet({ at, onPick, onClose }: {
    at:      number;
    onPick:  (at: number) => void;
    onClose: () => void;
}) {
    const days = useMemo(() => {
        const base = startOfDay(Date.now());
        return Array.from({ length: DAY_SPAN }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
    }, []);
    const labels = useMemo(
        () => days.map((d, i) => (i === 0
            ? t('banking.standingToday', 'Today')
            : i === 1
                ? t('banking.standingTomorrow', 'Tomorrow')
                : d.toLocaleDateString(getLocaleTag(), { weekday: 'short', month: 'short', day: 'numeric' }))),
        [days],
    );

    const [dayIndex, setDayIndex] = useState(() => {
        const target = startOfDay(at * 1000).getTime();
        const found  = days.findIndex(d => d.getTime() === target);
        return found < 0 ? 1 : found;
    });
    const [time, setTime] = useState(() => {
        const d = new Date(at * 1000);
        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    });

    function commit(close: () => void) {
        const day      = days[Math.min(Math.max(dayIndex, 0), days.length - 1)];
        const [hh, mm] = time.split(':');
        const when     = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(hh) || 0, Number(mm) || 0);
        onPick(Math.floor(when.getTime() / 1000));
        close();
    }

    return (
        <Sheet onClose={onClose} fit="content" zIndex={70} className="bg-base font-sf">
            {({ close }) => (
                <>
                    <SheetHeader
                        cancelLabel={t('banking.cancel', 'Cancel')}
                        onCancel={close}
                        title={t('banking.standingStarts', 'Starts')}
                        doneLabel={t('common.done', 'Done')}
                        onDone={() => commit(close)}
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
                                width={264}
                                bandHeight={WHEEL_BAND}
                                fontSize={20}
                                fontWeight={400}
                                showBand={false}
                            />
                        </div>
                    </div>

                    <TimeWheel value={time} onChange={setTime} open />
                </>
            )}
        </Sheet>
    );
}

function FieldLabel({ children }: { children: ReactNode }) {
    return <div className="mb-2.5 text-[20px] font-bold tracking-tight text-black dark:text-white">{children}</div>;
}
