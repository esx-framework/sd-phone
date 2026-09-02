import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Phone, Trash2, Voicemail as VoicemailIcon } from 'lucide-react';
import clsx from 'clsx';

import { AlertDialog } from '@/ui/AlertDialog';
import { EmptyState } from '@/ui/EmptyState';
import { AudioTransport } from '@/shared/audio/AudioTransport';
import { useNuiEvent } from '@/hooks/useNuiEvent';
import { useDeckActive } from '@/shell/deckActive';
import { useMaskedPhone } from '@/stores/themeStore';
import { getLocaleTag, t } from '@/i18n';
import { formatDuration } from '@/lib/time';
import { digits } from '@/lib/format';
import { deleteVoicemail, fetchVoicemails, markVoicemailsSeen, type Voicemail } from '../voicemailApi';
import type { Contact } from '../data';

const EXPAND_MS = 260;

function when(iso: string): string {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return '';
    const sameDay = at.toDateString() === new Date().toDateString();
    return sameDay
        ? at.toLocaleTimeString(getLocaleTag(), { hour: 'numeric', minute: '2-digit' })
        : at.toLocaleDateString(getLocaleTag(), { day: 'numeric', month: 'short' });
}

export function VoicemailTab({ contacts, onRequestCall }: {
    contacts:      Contact[];
    onRequestCall: (target: { number: string; name?: string }) => void;
}) {
    const [items, setItems]   = useState<Voicemail[]>([]);
    const [openId, setOpenId] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<Voicemail | null>(null);
    const phone = useMaskedPhone();

    const load = useCallback(() => {
        void fetchVoicemails().then(next => {
            setItems(next);
            if (next.some(vm => !vm.listened)) void markVoicemailsSeen();
        });
    }, []);

    useEffect(() => { load(); }, [load]);

    const deckActive = useDeckActive();
    const wasActive  = useRef(deckActive);
    useEffect(() => {
        const rising = deckActive && !wasActive.current;
        wasActive.current = deckActive;
        if (!rising) return;
        const id = window.setTimeout(load, 420);
        return () => window.clearTimeout(id);
    }, [deckActive, load]);

    useNuiEvent('sd-phone:voicemail:new', useCallback((vm) => {
        const next: Voicemail = { ...vm, name: vm.name ?? null, number: vm.number ?? '' };
        setItems(prev => [next, ...prev.filter(x => x.id !== next.id)]);
        void markVoicemailsSeen();
    }, []));

    const byNumber = useMemo(() => {
        const map = new Map<string, Contact>();
        for (const c of contacts) {
            const key = digits(c.phone);
            if (key && !map.has(key)) map.set(key, c);
        }
        return map;
    }, [contacts]);

    const titleOf = (vm: Voicemail): string => {
        if (!vm.number) return t('phone.noCallerId', 'No Caller ID');
        return byNumber.get(digits(vm.number))?.name ?? vm.name ?? phone(vm.number);
    };

    const confirmDelete = async () => {
        const vm = pendingDelete;
        setPendingDelete(null);
        if (!vm) return;
        if (!await deleteVoicemail(vm.id)) return;
        setItems(prev => prev.filter(x => x.id !== vm.id));
        setOpenId(prev => (prev === vm.id ? null : prev));
    };

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <h1 className="px-5 pb-1 pt-1 text-[34px] font-bold tracking-tight text-black dark:text-white">
                {t('phone.voicemail', 'Voicemail')}
            </h1>

            <div className="relative min-h-0 flex-1 overflow-hidden">
                <div className="absolute inset-0 overflow-y-auto no-scrollbar px-4 pb-6 pt-2">
                    {items.length === 0 ? (
                        <EmptyState
                            icon={<VoicemailIcon className="h-12 w-12 text-ios-gray" strokeWidth={1.5} />}
                            title={t('phone.noVoicemail', 'No Voicemail')}
                            subtitle={t('phone.noVoicemailBody', 'Messages left when you miss a call are kept here.')}
                        />
                    ) : (
                        <div className="overflow-hidden rounded-[10px] bg-surface">
                            {items.map((vm, i) => (
                                <div key={vm.id}>
                                    {i > 0 && (
                                        <div className="pointer-events-none bg-hairline/10" style={{ height: '0.5px' }} />
                                    )}
                                    <Row
                                        vm={vm}
                                        title={titleOf(vm)}
                                        open={openId === vm.id}
                                        onToggle={() => setOpenId(prev => (prev === vm.id ? null : vm.id))}
                                        onCallBack={() => onRequestCall({ number: vm.number, name: byNumber.get(digits(vm.number))?.name ?? vm.name ?? undefined })}
                                        onRequestDelete={() => setPendingDelete(vm)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {pendingDelete && (
                <AlertDialog
                    title={t('phone.deleteVoicemailTitle', 'Delete voicemail?')}
                    message={t('phone.deleteVoicemailBody', 'The message from {name} is removed for good.', {
                        name: titleOf(pendingDelete),
                    })}
                    confirmLabel={t('phone.delete', 'Delete')}
                    destructive
                    onCancel={() => setPendingDelete(null)}
                    onConfirm={() => void confirmDelete()}
                />
            )}
        </div>
    );
}

function Row({ vm, title, open, onToggle, onCallBack, onRequestDelete }: {
    vm:              Voicemail;
    title:           string;
    open:            boolean;
    onToggle:        () => void;
    onCallBack:      () => void;
    onRequestDelete: () => void;
}) {
    const [armed, setArmed] = useState(open);

    useEffect(() => {
        if (!open || armed) return;
        const id = window.setTimeout(() => setArmed(true), EXPAND_MS);
        return () => window.clearTimeout(id);
    }, [open, armed]);

    return (
        <div>
            <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-3.5 py-3.5 text-left active:opacity-60">
                <span className="flex h-[10px] w-[10px] shrink-0 items-center justify-center">
                    {!vm.listened && <span className="h-[10px] w-[10px] rounded-full bg-ios-blue" />}
                </span>
                <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[17px] text-black dark:text-white ${vm.listened ? '' : 'font-semibold'}`}>
                        {title}
                    </span>
                    <span className="block text-[15px] text-black/50 dark:text-white/50">
                        {formatDuration(vm.duration)}
                    </span>
                </span>
                <span className="shrink-0 text-[15px] text-black/50 dark:text-white/50">{when(vm.date)}</span>
            </button>

            <div
                className={clsx(
                    'grid transition-[grid-template-rows] duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
                    open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                )}
            >
                <div className="overflow-hidden">
                    <div className="px-4 pb-4">
                        <AudioTransport
                            src={vm.url}
                            armed={armed}
                            active={open}
                            duration={vm.duration}
                            actions={
                                <>
                                    <button
                                        type="button"
                                        onClick={onCallBack}
                                        disabled={!vm.number}
                                        aria-label={t('phone.callBack', 'Call Back')}
                                        className="shrink-0 p-1 text-ios-blue active:opacity-60 disabled:opacity-35"
                                    >
                                        <Phone className="h-[17px] w-[17px]" strokeWidth={2} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onRequestDelete}
                                        aria-label={t('phone.deleteVoicemail', 'Delete voicemail')}
                                        className="shrink-0 p-1 text-ios-red active:opacity-60"
                                    >
                                        <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
                                    </button>
                                </>
                            }
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
