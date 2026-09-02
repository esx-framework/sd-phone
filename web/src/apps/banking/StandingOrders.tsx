import { useState } from 'react';
import { AlertCircle, Plus, Repeat } from 'lucide-react';

import { useAsyncData } from '@/hooks/useAsyncData';
import { useIosPush } from '@/hooks/useIosPush';
import { t } from '@/i18n';
import { formatPhone } from '@/lib/phone';
import { EmptyState } from '@/ui/EmptyState';
import { GroupCard, ListRow, ToggleRow } from '@/ui/ListGroup';
import { NavBar } from '@/ui/NavBar';
import { Scroller } from '@/ui/Scroller';
import { StatusBarSpacer } from '@/ui/StatusBarSpacer';
import { formatMoney } from './data';
import { intervalLabel, whenLabel, StandingOrderSheet } from './StandingOrderSheet';
import { fetchStandingOrders, updateStandingOrder, type StandingOrder } from './bankingApi';

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
                        <GroupCard key={order.id} className="mb-4" radius={14}>
                            <ListRow
                                label={order.label}
                                sub={`${order.recipientName ?? formatPhone(order.recipient)} · ${intervalLabel(order.interval)}${order.active ? ` · ${whenLabel(order.nextRun)}` : ''}`}
                                value={formatMoney(order.amount, { whole: true })}
                                right={order.lastStatus && order.lastStatus !== 'ok'
                                    ? <AlertCircle className="h-[18px] w-[18px] text-ios-red" strokeWidth={2.4} />
                                    : undefined}
                                chevron
                                divider
                                onPress={() => setEditing(order)}
                            />
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
