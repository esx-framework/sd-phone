import { useMemo, useState } from 'react';
import { Cctv, ChevronRight, Radio, X } from 'lucide-react';

import { t } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { Scroller } from '@/ui/Scroller';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useSessionState } from '@/hooks/useSessionState';
import { mdtPanePad, mdtRowMeta, mdtSectionHeader } from './mdtTheme';
import { cctvClose, cctvList, cctvWatch, type CctvCamera } from './mdtApi';

function Group({ label, cameras, activeId, onPick }: {
    label: string;
    cameras: CctvCamera[];
    activeId: string | null;
    onPick: (camera: CctvCamera) => void;
}) {
    return (
        <div className="mb-5">
            <div className={`mb-2 ${mdtSectionHeader}`}>{label}</div>
            <div className="flex flex-col gap-1.5">
                {cameras.map(camera => {
                    const on = camera.id === activeId;
                    return (
                        <button
                            key={camera.id}
                            type="button"
                            onClick={() => onPick(camera)}
                            className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors"
                            style={{
                                background: on ? 'rgba(59,130,246,0.16)' : 'rgba(127,127,127,0.08)',
                                boxShadow: on ? 'inset 0 0 0 1.5px rgba(59,130,246,0.55)' : undefined,
                            }}
                        >
                            <Cctv className="h-[16px] w-[16px] shrink-0 text-ios-gray" strokeWidth={2.1} />
                            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{camera.label}</span>
                            {on ? (
                                <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-blue-500">
                                    <Radio className="h-[12px] w-[12px]" strokeWidth={2.6} />
                                    {t('mdt.cctvViewing', 'Viewing')}
                                </span>
                            ) : (
                                <ChevronRight className="h-[15px] w-[15px] shrink-0 text-ios-gray" strokeWidth={2.2} />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function CctvPane() {
    const [activeId, setActiveId] = useSessionState<string | null>('mdt:cctv:active', null);
    const [busy, setBusy] = useState(false);

    const { data, settled } = useAsyncData(() => cctvList(), []);
    const cameras = useMemo(() => data?.cameras ?? [], [data]);
    const enabled = data?.enabled !== false;

    const groups = useMemo(() => {
        const map = new Map<string, CctvCamera[]>();
        for (const camera of cameras) {
            const key = camera.category || t('mdt.cctvOther', 'Other');
            const list = map.get(key);
            if (list) list.push(camera);
            else map.set(key, [camera]);
        }
        return [...map.entries()];
    }, [cameras]);

    const active = activeId ? cameras.find(c => c.id === activeId) ?? null : null;

    async function pick(camera: CctvCamera) {
        if (busy) return;
        setBusy(true);
        const ok = await cctvWatch(camera.id);
        setBusy(false);
        if (ok) setActiveId(camera.id);
    }

    async function leave() {
        if (busy) return;
        setBusy(true);
        await cctvClose();
        setBusy(false);
        setActiveId(null);
    }

    if (settled && (!enabled || cameras.length === 0)) {
        return (
            <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-6">
                <EmptyState
                    center
                    icon={Cctv}
                    title={t('mdt.noCctv', 'No cameras on file')}
                    subtitle={t('mdt.noCctvSub', 'Fixed cameras are listed in configs/cctv.lua. Each one puts your own view at that location while you watch it.')}
                />
            </div>
        );
    }

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <div className={`shrink-0 ${mdtPanePad}`}>
                <div className="flex items-center gap-2">
                    <Cctv className="h-[17px] w-[17px] text-ios-gray" strokeWidth={2.2} />
                    <h2 className={mdtSectionHeader}>{t('mdt.cctvTitle', 'Fixed cameras')}</h2>
                    <span className="flex-1" />
                    <span className={mdtRowMeta}>
                        {t('mdt.cctvCount', '{count} cameras', { count: cameras.length })}
                    </span>
                </div>
                <p className={`mt-1 ${mdtRowMeta}`}>
                    {t('mdt.cctvHint', 'Watching a camera moves your own view to it and puts it back when you leave. Nobody else is affected.')}
                </p>
            </div>

            {active && (
                <div className={`shrink-0 ${mdtPanePad} pt-0`}>
                    <div
                        className="flex items-center gap-3 rounded-[16px] px-3.5 py-3"
                        style={{ background: 'rgba(59,130,246,0.14)', boxShadow: 'inset 0 0 0 1.5px rgba(59,130,246,0.5)' }}
                    >
                        <Radio className="h-[16px] w-[16px] shrink-0 text-blue-500" strokeWidth={2.5} />
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-bold">{active.label}</div>
                            <div className={mdtRowMeta}>{t('mdt.cctvLive', 'Your view is on this camera')}</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => { void leave(); }}
                            className="flex shrink-0 items-center gap-1 rounded-full bg-black/70 px-3 py-1.5 text-[12px] font-bold text-white active:opacity-70"
                        >
                            <X className="h-[13px] w-[13px]" strokeWidth={2.8} />
                            {t('mdt.cctvExit', 'Exit')}
                        </button>
                    </div>
                </div>
            )}

            <Scroller className="min-h-0 flex-1 px-6 pb-6 pt-2">
                {groups.map(([label, list]) => (
                    <Group
                        key={label}
                        label={label}
                        cameras={list}
                        activeId={activeId}
                        onPick={camera => { void pick(camera); }}
                    />
                ))}
            </Scroller>
        </div>
    );
}
