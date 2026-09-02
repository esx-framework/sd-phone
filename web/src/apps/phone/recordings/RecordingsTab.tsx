import { useCallback, useEffect, useState } from 'react';
import { AudioLines, Pencil, PhoneIncoming, PhoneOutgoing, Trash2, TriangleAlert } from 'lucide-react';
import clsx from 'clsx';

import { AlertDialog } from '@/ui/AlertDialog';
import { PromptDialog } from '@/ui/PromptDialog';
import { EmptyState } from '@/ui/EmptyState';
import { AudioTransport } from '@/shared/audio/AudioTransport';
import { useNuiEvent } from '@/hooks/useNuiEvent';
import { formatPhone } from '@/lib/phone';
import { getLocaleTag, t } from '@/i18n';
import { deleteRecording, fetchRecordings, renameRecording, type CallRecording } from '../callrecApi';

const EXPAND_MS = 260;

function clock(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function when(iso: string) {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return '';
    const sameDay = at.toDateString() === new Date().toDateString();
    return sameDay
        ? at.toLocaleTimeString(getLocaleTag(), { hour: 'numeric', minute: '2-digit' })
        : at.toLocaleDateString(getLocaleTag(), { day: 'numeric', month: 'short' });
}

function titleOf(rec: CallRecording) {
    return rec.label?.trim() || rec.peerName?.trim() || formatPhone(rec.peerNumber);
}

export function RecordingsTab() {
    const [items, setItems] = useState<CallRecording[]>([]);
    const [openId, setOpenId] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<CallRecording | null>(null);
    const [renaming, setRenaming] = useState<CallRecording | null>(null);

    const load = useCallback(() => { void fetchRecordings().then(setItems); }, []);
    useEffect(() => { load(); }, [load]);

    useNuiEvent('sd-phone:callrec:added', useCallback((rec: CallRecording) => {
        setItems(prev => [rec, ...prev.filter(r => r.id !== rec.id)]);
    }, []));

    const confirmDelete = async () => {
        const rec = pendingDelete;
        setPendingDelete(null);
        if (!rec) return;
        if (!await deleteRecording(rec.id)) return;
        setItems(prev => prev.filter(r => r.id !== rec.id));
        setOpenId(prev => (prev === rec.id ? null : prev));
    };

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-5 pb-1 pt-1">
                <h1 className="text-[34px] font-bold tracking-tight text-black dark:text-white">
                    {t('phone.recordings', 'Recordings')}
                </h1>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden">
                <div className="absolute inset-0 overflow-y-auto no-scrollbar px-4 pb-6 pt-2">
                    {items.length === 0 ? (
                        <EmptyState
                            icon={<AudioLines className="h-12 w-12" strokeWidth={1.5} />}
                            title={t('phone.noRecordings', 'No recordings')}
                            subtitle={t('phone.noRecordingsBody', 'Recordings you make during a call are kept here.')}
                        />
                    ) : (
                        <div className="overflow-hidden rounded-[10px] bg-surface">
                            {items.map((rec, i) => (
                                <div key={rec.id}>
                                    {i > 0 && (
                                        <div className="pointer-events-none bg-hairline/10" style={{ height: '0.5px' }} />
                                    )}
                                    <Row
                                        rec={rec}
                                        open={openId === rec.id}
                                        onToggle={() => setOpenId(prev => (prev === rec.id ? null : rec.id))}
                                        onRequestRename={() => setRenaming(rec)}
                                        onRequestDelete={() => setPendingDelete(rec)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {renaming && (
                <PromptDialog
                    title={t('phone.renameRecording', 'Rename')}
                    message={t('phone.renameRecordingBody', 'Enter a name for this recording.')}
                    placeholder={t('phone.namePlaceholder', 'Name')}
                    confirmLabel={t('phone.save', 'Save')}
                    maxLength={120}
                    initialValue={renaming.label ?? ''}
                    onCancel={() => setRenaming(null)}
                    onConfirm={name => {
                        const rec = renaming;
                        setRenaming(null);
                        const next = name.trim();
                        void renameRecording(rec.id, next).then(okDone => {
                            if (!okDone) return;
                            setItems(prev => prev.map(r => (r.id === rec.id ? { ...r, label: next || null } : r)));
                        });
                    }}
                />
            )}

            {pendingDelete && (
                <AlertDialog
                    title={t('phone.deleteRecordingTitle', 'Delete recording?')}
                    message={t('phone.deleteRecordingBody', 'The recording with {name} is removed for good.', {
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

function Row({ rec, open, onToggle, onRequestRename, onRequestDelete }: {
    rec: CallRecording;
    open: boolean;
    onToggle: () => void;
    onRequestRename: () => void;
    onRequestDelete: () => void;
}) {
    const [armed, setArmed] = useState(open);

    useEffect(() => {
        if (!open || armed) return;
        const id = window.setTimeout(() => setArmed(true), EXPAND_MS);
        return () => window.clearTimeout(id);
    }, [open, armed]);

    const Icon = rec.direction === 'incoming' ? PhoneIncoming : PhoneOutgoing;

    return (
        <div>
            <button type="button" onClick={onToggle} className="flex w-full items-center gap-3.5 px-3.5 py-3.5 text-left active:opacity-60">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ios-blue/15 text-ios-blue">
                    <AudioLines className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                        <span className="truncate text-[17px] text-black dark:text-white">{titleOf(rec)}</span>
                        {rec.oneSided && <TriangleAlert className="h-[13px] w-[13px] shrink-0 text-ios-orange" />}
                    </span>
                    <span className="flex items-center gap-1.5 text-[15px] text-black/50 dark:text-white/50">
                        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                        {clock(rec.duration)}
                    </span>
                </span>
                <span className="shrink-0 text-[15px] text-black/50 dark:text-white/50">{when(rec.date)}</span>
            </button>

            <div
                className={clsx(
                    'grid transition-[grid-template-rows] duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
                    open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                )}
            >
                <div className="overflow-hidden">
                    <div className="px-4 pb-4">
                        {rec.oneSided && (
                            <div className="mb-2 text-[13px] text-ios-orange">
                                {t('phone.oneSidedRecording', 'Only your side was captured.')}
                            </div>
                        )}

                        <AudioTransport
                            src={rec.url}
                            armed={armed}
                            active={open}
                            duration={rec.duration}
                            actions={
                                <>
                                    <button
                                        type="button"
                                        onClick={onRequestRename}
                                        className="shrink-0 p-1 text-ios-blue active:opacity-60"
                                        title={t('phone.renameRecording', 'Rename')}
                                    >
                                        <Pencil className="h-[17px] w-[17px]" strokeWidth={2} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={onRequestDelete}
                                        className="shrink-0 p-1 text-ios-red active:opacity-60"
                                        title={t('phone.deleteRecording', 'Delete recording')}
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
