import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Check, Clock, Flag, Map, Star, Trash2, X } from 'lucide-react';
import clsx from 'clsx';

import {
    racingAdminApproveTrack,
    racingAdminDelete,
    racingAdminPendingTracks,
    racingAdminRejectTrack,
    racingAdminSetFlag,
    racingAdminTracks,
    racingTrackRoute,
} from '@/apps/racing/racingApi';
import type { AdminTrackRow, PendingTrackRow, TrackFlag } from '@/apps/racing/data';
import { RouteMapView } from '@/apps/racing/RouteMapView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { Badge, Btn, Card, CenterNote, ConfirmModal, Input, Modal, PromptModal, Spinner } from '../ui';

const PAGE_SIZE = 25;

type Tab = 'published' | 'pending';

interface MapTarget {
    id:   number;
    name: string;
}

function TrackMapModal({ track, onClose }: { track: MapTarget; onClose: () => void }) {
    const { data, settled } = useAsyncData(() => racingTrackRoute(track.id), [track.id]);
    const route = data ?? [];

    return (
        <Modal title={track.name} onClose={onClose} width="w-[720px]">
            <div className="dark relative h-[420px] overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/10">
                {!settled && <div className="flex h-full items-center justify-center"><Spinner /></div>}
                {settled && route.length === 0 && (
                    <div className="flex h-full items-center justify-center px-8 text-center text-[13px] text-zinc-500">
                        This track has no usable gates, so there is no route to draw.
                    </div>
                )}
                {settled && route.length > 0 && <RouteMapView points={route} />}
            </div>
        </Modal>
    );
}

function modeLabel(mode: string): string {
    return mode === 'sprint' ? 'Sprint' : 'Circuit';
}

function relTime(atSeconds: number): string {
    const diff = Math.max(0, Math.floor(Date.now() / 1000) - atSeconds);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function FlagBtn({ on, label, icon, busy, onToggle }: {
    on:       boolean;
    label:    string;
    icon:     React.ReactNode;
    busy:     boolean;
    onToggle: () => void;
}) {
    return (
        <Btn
            variant={on ? 'primary' : 'ghost'}
            disabled={busy}
            onClick={onToggle}
            title={on ? `Remove ${label.toLowerCase()}` : `Mark ${label.toLowerCase()}`}
            className="min-w-[104px]"
        >
            {icon}
            {label}
        </Btn>
    );
}

function PublishedTab({ onToast }: { onToast: (text: string, error?: boolean) => void }) {
    const [query, setQuery]     = useState('');
    const [term, setTerm]       = useState('');
    const [page, setPage]       = useState(1);
    const [rows, setRows]       = useState<AdminTrackRow[]>([]);
    const [total, setTotal]     = useState(0);
    const [loading, setLoading] = useState(true);
    const [settled, setSettled] = useState(false);
    const [busy, setBusy]       = useState<number | null>(null);
    const [confirm, setConfirm] = useState<AdminTrackRow | null>(null);
    const [mapTrack, setMapTrack] = useState<MapTarget | null>(null);

    useEffect(() => {
        const id = window.setTimeout(() => { setTerm(query.trim()); setPage(1); }, 250);
        return () => window.clearTimeout(id);
    }, [query]);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await racingAdminTracks({ query: term, page });
        setRows(res.rows);
        setTotal(res.total);
        setLoading(false);
        setSettled(true);
    }, [term, page]);

    useEffect(() => { void load(); }, [load]);

    const toggleFlag = useCallback(async (row: AdminTrackRow, flag: TrackFlag, value: boolean) => {
        setBusy(row.id);
        const res = await racingAdminSetFlag(row.id, flag, value);
        setBusy(null);
        if (!res.success) {
            onToast(res.message ?? 'That change was refused.', true);
            return;
        }
        onToast(`${row.name} ${value ? 'marked' : 'unmarked'} ${flag}.`);
        void load();
    }, [load, onToast]);

    const remove = useCallback(async (row: AdminTrackRow) => {
        setBusy(row.id);
        const res = await racingAdminDelete(row.id);
        setBusy(null);
        setConfirm(null);
        if (!res.success) {
            onToast(res.message ?? 'That track could not be deleted.', true);
            return;
        }
        onToast(`${row.name} deleted.`);
        void load();
    }, [load, onToast]);

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Input
                    value={query}
                    onChange={setQuery}
                    placeholder="Filter tracks by name or author"
                />
                <span className="shrink-0 text-[12px] text-zinc-500">{total} tracks</span>
            </div>

            {loading && !settled && <CenterNote><Spinner /></CenterNote>}

            {settled && rows.length === 0 && (
                <CenterNote>
                    <Flag size={15} className="mr-1.5 inline" />
                    {term
                        ? 'No track matches that search.'
                        : 'No tracks recorded yet. They are drawn in the world with the gate creator.'}
                </CenterNote>
            )}

            {rows.length > 0 && (
                <Card>
                    {rows.map(row => (
                        <div key={row.id} className="border-t border-white/[0.05] px-4 py-3.5 first:border-t-0">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                                <span className="flex min-w-0 flex-1 flex-col gap-1">
                                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                                        <span className="truncate text-[14px] font-semibold text-zinc-100">{row.name}</span>
                                        {row.verified && <Badge tone="green">Verified</Badge>}
                                        {row.featured && <Badge tone="amber">Featured</Badge>}
                                        {!row.published && <Badge tone="red">Unpublished</Badge>}
                                    </span>
                                    <span className="truncate text-[12px] text-zinc-500">
                                        {[
                                            modeLabel(row.mode),
                                            `${row.gates} checkpoints`,
                                            `${row.plays} plays`,
                                            row.author,
                                        ].filter(Boolean).join('  ·  ')}
                                    </span>
                                </span>

                                <span className="flex shrink-0 items-center justify-center gap-2">
                                    <Btn
                                        onClick={() => setMapTrack({ id: row.id, name: row.name })}
                                        title="View this track on the map"
                                        className="min-w-[104px]"
                                    >
                                        <Map size={13} />
                                        View on map
                                    </Btn>
                                    <FlagBtn
                                        on={row.verified}
                                        label="Verified"
                                        icon={<BadgeCheck size={13} />}
                                        busy={busy === row.id}
                                        onToggle={() => void toggleFlag(row, 'verified', !row.verified)}
                                    />
                                    <FlagBtn
                                        on={row.featured}
                                        label="Featured"
                                        icon={<Star size={13} />}
                                        busy={busy === row.id}
                                        onToggle={() => void toggleFlag(row, 'featured', !row.featured)}
                                    />
                                    <Btn
                                        variant="danger"
                                        disabled={busy === row.id}
                                        onClick={() => setConfirm(row)}
                                        title="Delete this track"
                                        className="min-w-[92px]"
                                    >
                                        <Trash2 size={13} />
                                        Delete
                                    </Btn>
                                </span>
                            </div>
                        </div>
                    ))}
                </Card>
            )}

            {pages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-1">
                    <Btn disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Btn>
                    <span className={clsx('text-[12px] tabular-nums text-zinc-500')}>{page} of {pages}</span>
                    <Btn disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>Next</Btn>
                </div>
            )}

            {confirm && (
                <ConfirmModal
                    title={`Delete ${confirm.name}?`}
                    body="The track is removed from the board and can no longer be raced or hosted. Times already set on it are kept."
                    confirmLabel="Delete track"
                    danger
                    onConfirm={() => void remove(confirm)}
                    onClose={() => setConfirm(null)}
                />
            )}

            {mapTrack && <TrackMapModal track={mapTrack} onClose={() => setMapTrack(null)} />}
        </div>
    );
}

function PendingTab({ onToast, onCountChange }: {
    onToast:       (text: string, error?: boolean) => void;
    onCountChange: (count: number) => void;
}) {
    const [page, setPage]       = useState(1);
    const [rows, setRows]       = useState<PendingTrackRow[]>([]);
    const [total, setTotal]     = useState(0);
    const [loading, setLoading] = useState(true);
    const [settled, setSettled] = useState(false);
    const [busy, setBusy]       = useState<number | null>(null);
    const [rejecting, setRejecting] = useState<PendingTrackRow | null>(null);
    const [mapTrack, setMapTrack]   = useState<MapTarget | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await racingAdminPendingTracks({ page });
        setRows(res.rows);
        setTotal(res.total);
        onCountChange(res.total);
        setLoading(false);
        setSettled(true);
    }, [page, onCountChange]);

    useEffect(() => { void load(); }, [load]);

    const approve = useCallback(async (row: PendingTrackRow) => {
        setBusy(row.id);
        const res = await racingAdminApproveTrack(row.id);
        setBusy(null);
        if (!res.success) {
            onToast(res.message ?? 'That track could not be approved.', true);
            return;
        }
        onToast(`${row.name} approved and published.`);
        void load();
    }, [load, onToast]);

    const reject = useCallback(async (row: PendingTrackRow, reason: string) => {
        setBusy(row.id);
        const res = await racingAdminRejectTrack(row.id, reason);
        setBusy(null);
        setRejecting(null);
        if (!res.success) {
            onToast(res.message ?? 'That track could not be rejected.', true);
            return;
        }
        onToast(`${row.name} rejected.`);
        void load();
    }, [load, onToast]);

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <span className="text-[12px] text-zinc-500">Tracks waiting on review before players can race them.</span>
                <span className="ml-auto shrink-0 text-[12px] text-zinc-500">{total} pending</span>
            </div>

            {loading && !settled && <CenterNote><Spinner /></CenterNote>}

            {settled && rows.length === 0 && (
                <CenterNote>
                    <Clock size={15} className="mr-1.5 inline" />
                    Nothing waiting on review right now.
                </CenterNote>
            )}

            {rows.length > 0 && (
                <Card>
                    {rows.map(row => (
                        <div key={row.id} className="border-t border-white/[0.05] px-4 py-3.5 first:border-t-0">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                                <span className="flex min-w-0 flex-1 flex-col gap-1">
                                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                                        <span className="truncate text-[14px] font-semibold text-zinc-100">{row.name}</span>
                                        <Badge tone="amber">Pending</Badge>
                                    </span>
                                    <span className="truncate text-[12px] text-zinc-500">
                                        {[
                                            modeLabel(row.mode),
                                            `${row.gates} checkpoints`,
                                            row.author,
                                            relTime(row.createdAt),
                                        ].filter(Boolean).join('  ·  ')}
                                    </span>
                                </span>

                                <span className="flex shrink-0 items-center justify-center gap-2">
                                    <Btn
                                        onClick={() => setMapTrack({ id: row.id, name: row.name })}
                                        title="View this track on the map"
                                        className="min-w-[104px]"
                                    >
                                        <Map size={13} />
                                        View on map
                                    </Btn>
                                    <Btn
                                        variant="primary"
                                        disabled={busy === row.id}
                                        onClick={() => void approve(row)}
                                        title="Approve and publish this track"
                                        className="min-w-[104px]"
                                    >
                                        <Check size={13} />
                                        Approve
                                    </Btn>
                                    <Btn
                                        variant="danger"
                                        disabled={busy === row.id}
                                        onClick={() => setRejecting(row)}
                                        title="Reject this track"
                                        className="min-w-[92px]"
                                    >
                                        <X size={13} />
                                        Reject
                                    </Btn>
                                </span>
                            </div>
                        </div>
                    ))}
                </Card>
            )}

            {pages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-1">
                    <Btn disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Btn>
                    <span className={clsx('text-[12px] tabular-nums text-zinc-500')}>{page} of {pages}</span>
                    <Btn disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>Next</Btn>
                </div>
            )}

            {rejecting && (
                <PromptModal
                    title={`Reject ${rejecting.name}?`}
                    body="This reason is stored on the track and can be shown to its creator."
                    placeholder="Reason for rejection"
                    submitLabel="Reject track"
                    validate={v => (v.trim().length === 0 ? 'A reason is required.' : null)}
                    onSubmit={reason => reject(rejecting, reason)}
                    onClose={() => setRejecting(null)}
                />
            )}

            {mapTrack && <TrackMapModal track={mapTrack} onClose={() => setMapTrack(null)} />}
        </div>
    );
}

export function RacingPage({ onToast }: { onToast: (text: string, error?: boolean) => void }) {
    const [tab, setTab] = useState<Tab>('published');
    const [pendingCount, setPendingCount] = useState(0);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Btn
                    variant={tab === 'published' ? 'primary' : 'ghost'}
                    onClick={() => setTab('published')}
                >
                    <Flag size={13} />
                    Published
                </Btn>
                <Btn
                    variant={tab === 'pending' ? 'primary' : 'ghost'}
                    onClick={() => setTab('pending')}
                >
                    <Clock size={13} />
                    Pending approval
                    {pendingCount > 0 && <Badge tone="amber" className="ml-1">{pendingCount}</Badge>}
                </Btn>
            </div>

            {tab === 'published'
                ? <PublishedTab onToast={onToast} />
                : <PendingTab onToast={onToast} onCountChange={setPendingCount} />}
        </div>
    );
}
