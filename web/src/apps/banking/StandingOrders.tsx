import { useState } from 'react';
import { ChevronRight, Plus, Repeat } from 'lucide-react';

import { useAsyncData } from '@/hooks/useAsyncData';
import { useIosPush } from '@/hooks/useIosPush';
import { t } from '@/i18n';
import { formatPhone } from '@/lib/phone';
import { EmptyState } from '@/ui/EmptyState';
import { GroupCard, ToggleRow } from '@/ui/ListGroup';
import { NavBar } from '@/ui/NavBar';
import { Pill, type PillTone } from '@/ui/Pill';
import { Scroller } from '@/ui/Scroller';
import { StatusBarSpacer } from '@/ui/StatusBarSpacer';
import { formatMoney, getCategories } from './data';
import { intervalLabel, whenLabel, StandingOrderSheet } from './StandingOrderSheet';
import { fetchStandingOrders, updateStandingOrder, type StandingOrder, type StandingStatus } from './bankingApi';

const STATUS: Record<StandingStatus, { tone: PillTone; label: () => string }> = {
    ok:           { tone: 'green', label: () => t('banking.standingStatusPaid', 'Paid') },
    insufficient: { tone: 'red',   label: () => t('banking.standingStatusShort', 'Short') },
    failed:       { tone: 'red',   label: () => t('banking.standingStatusFailed', 'Failed') },
};

function untilLabel(seconds: number): string {
    const left = Math.floor(seconds - Date.now() / 1000);
    if (left <= 0) return t('banking.standingDueNow', 'due now');
    const days  = Math.floor(left / 86400);
    const hours = Math.floor((left % 86400) / 3600);
    const mins  = Math.floor((left % 3600) / 60);
    const parts = days > 0
        ? [t('time.daysShort', '{n}d', { n: days }), hours > 0 ? t('time.hoursShort', '{n}h', { n: hours }) : '']
        : hours > 0
            ? [t('time.hoursShort', '{n}h', { n: hours }), mins > 0 ? t('time.minutesShort', '{n}m', { n: mins }) : '']
            : [t('time.minutesShort', '{n}m', { n: Math.max(mins, 1) })];
    return t('banking.standingIn', 'in {span}', { span: parts.filter(Boolean).join(' ') });
}

function OrderRow({ order, onPress }: { order: StandingOrder; onPress: () => void }) {
    const { color } = getCategories().standing;
    const status = order.lastStatus ? STATUS[order.lastStatus] : null;
    const schedule = order.active
        ? `${intervalLabel(order.interval)} · ${whenLabel(order.nextRun)}`
        : `${intervalLabel(order.interval)} · ${t('banking.standingPausedRow', 'Paused')}`;

    return (
        <button
            type="button"
            onClick={onPress}
            className="flex w-full items-center gap-3.5 px-4 py-[16px] text-start transition-colors active:bg-black/[0.06] dark:active:bg-white/[0.08]"
        >
            <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full" style={{ background: `${color}22`, color }}>
                <Repeat className="h-[22px] w-[22px]" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
                <div dir="auto" className="truncate text-[18.5px] font-semibold leading-tight">{order.label}</div>
                <div dir="auto" className="mt-1 truncate text-[16px]">{order.recipientName ?? formatPhone(order.recipient)}</div>
                <div className="mt-0.5 text-[15px] leading-snug text-ios-gray">{schedule}</div>
                {order.active && <div className="mt-0.5 truncate text-[15px] text-ios-gray">{untilLabel(order.nextRun)}</div>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span dir="ltr" className="text-[19px] font-semibold tabular-nums tracking-tight">{formatMoney(order.amount, { whole: true })}</span>
                {status && <Pill tone={status.tone}>{status.label()}</Pill>}
            </div>
            <ChevronRight className="h-[20px] w-[20px] shrink-0 text-ios-gray/60" strokeWidth={2.2} />
        </button>
    );
}

export function StandingOrders({ onBack, onChanged }: { onBack: () => void; onChanged: () => void }) {
    const { goBack, pageStyle } = useIosPush(onBack);

    const [orders, setOrders] = useState<StandingOrder[]>([]);
    const { settled } = useAsyncData(fetchStandingOrders, [], { onData: setOrders });

    const [editing, setEditing] = useState<StandingOrder | null>(null);
    const [adding,  setAdding]  = useState(false);

    function applyOrders(next: StandingOrder[]) {
        setOrders(next);
        onChanged();
    }

    async function togglePause(order: StandingOrder) {
        setOrders(list => list.map(o => (o.id === order.id ? { ...o, active: !o.active } : o)));
        const res = await updateStandingOrder(order.id, {
            label: order.label, amount: order.amount, interval: order.interval, active: !order.active,
        });
        if (res.success) applyOrders(res.data?.orders ?? []);
        else setOrders(list => list.map(o => (o.id === order.id ? { ...o, active: order.active } : o)));
    }

    return (
        <div className="absolute inset-0 z-20 flex flex-col bg-base text-black dark:text-white" style={pageStyle}>
            <StatusBarSpacer />

            <NavBar
                backLabel={t('banking.wallet', 'Wallet')}
                onBack={goBack}
                right={
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        aria-label={t('banking.newStandingOrder', 'New Standing Order')}
                        className="px-2 py-1 active:opacity-60"
                    >
                        <Plus className="h-[24px] w-[24px]" strokeWidth={2.4} />
                    </button>
                }
            />

            <div className="px-5 pb-3 pt-0.5 text-[34px] font-bold tracking-tight">
                {t('banking.standingOrders', 'Standing Orders')}
            </div>

            <Scroller className="min-h-0 flex-1 px-4 pb-10">
                {orders.length === 0 ? (
                    settled && (
                        <EmptyState
                            icon={Repeat}
                            title={t('banking.standingEmptyTitle', 'No Standing Orders')}
                            subtitle={t('banking.standingEmptyBody', 'Set up a repeating payment and your bank sends it on schedule, without you lifting a finger.')}
                            action={
                                <button
                                    type="button"
                                    onClick={() => setAdding(true)}
                                    className="rounded-full bg-black px-6 py-2.5 text-[16px] font-semibold text-white active:opacity-70 dark:bg-white dark:text-black"
                                >
                                    {t('banking.standingCreate', 'Set One Up')}
                                </button>
                            }
                        />
                    )
                ) : (
                    orders.map(order => (
                        <GroupCard key={order.id} className="mb-4" radius={16}>
                            <OrderRow order={order} onPress={() => setEditing(order)} />
                            <div className="h-[0.5px] bg-hairline/20" />
                            <ToggleRow
                                label={t('banking.standingActiveRow', 'Active')}
                                on={order.active}
                                onToggle={() => void togglePause(order)}
                            />
                        </GroupCard>
                    ))
                )}
            </Scroller>

            {(adding || editing) && (
                <StandingOrderSheet
                    key={editing?.id ?? 'new'}
                    order={editing}
                    onClose={() => { setAdding(false); setEditing(null); }}
                    onSaved={applyOrders}
                />
            )}
        </div>
    );
}
