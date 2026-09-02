import { useEffect, useRef, useState } from 'react';
import { MapPin, Radar } from 'lucide-react';

import { device } from '@device';
import { t } from '@/i18n';
import { failText } from '@/core/api';
import { formatPhone } from '@/lib/phone';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useDeckActive } from '@/shell/deckActive';
import { requestOpenMaps } from '@/shell/deeplink';
import { AlertDialog } from '@/ui/AlertDialog';
import { EmptyState } from '@/ui/EmptyState';
import { ListGroup, ListRow } from '@/ui/ListGroup';
import { Spinner } from '@/ui/Spinner';
import { LocationMapPreview } from '@/shared/map/LocationMapPreview';
import { SubPage } from '../SettingsSubPage';
import { LostModeSheet } from './LostModeSheet';
import {
    clearDeviceLost, eraseDevice, loadFindMy, playDeviceSound, setDeviceLost,
    type FindMyDevice,
} from './findMyApi';

const PREVIEW_H = 132;
const PREVIEW_W = device.screen.w - 32;

function kindLabel(kind: string): string {
    return kind === 'tablet' ? t('settings.findMyTablet', 'Tablet') : t('settings.findMyPhone', 'Phone');
}

function deviceLabel(d: FindMyDevice): string {
    return d.isThis
        ? t('settings.findMyThisDevice', '{kind} (This Device)', { kind: kindLabel(d.kind) })
        : kindLabel(d.kind);
}

function timeAgo(epochSec: number): string {
    if (!epochSec) return t('settings.findMyNeverSeen', 'Never');
    const s = Math.max(0, Math.floor(Date.now() / 1000) - epochSec);
    if (s < 60) return t('settings.findMyJustNow', 'Just now');
    if (s < 3600) return t('settings.findMyMinsAgo', '{n}m ago', { n: Math.floor(s / 60) });
    if (s < 86400) return t('settings.findMyHoursAgo', '{n}h ago', { n: Math.floor(s / 3600) });
    return t('settings.findMyDaysAgo', '{n}d ago', { n: Math.floor(s / 86400) });
}

export function FindMyPage({ onBack }: { onBack: () => void }) {
    const { data, settled, refetch } = useAsyncData(loadFindMy, []);

    const [busy,        setBusy]        = useState(false);
    const [notice,      setNotice]      = useState<string | null>(null);
    const [lostTarget,  setLostTarget]  = useState<FindMyDevice | null>(null);
    const [eraseTarget, setEraseTarget] = useState<FindMyDevice | null>(null);

    const devices = data?.devices ?? [];

    const deckActive = useDeckActive();
    const wasActive  = useRef(deckActive);
    useEffect(() => {
        const rising = deckActive && !wasActive.current;
        wasActive.current = deckActive;
        if (!rising) return;
        const id = window.setTimeout(refetch, 420);
        return () => window.clearTimeout(id);
    }, [deckActive, refetch]);

    function showOnMap(d: FindMyDevice) {
        requestOpenMaps({ label: deviceLabel(d), x: d.x, y: d.y, icon: 'MapPin', color: '#0a84ff' });
    }

    async function playSound(d: FindMyDevice) {
        if (busy) return;
        setBusy(true);
        const res = await playDeviceSound(d.key);
        setBusy(false);
        setNotice(res.success
            ? t('settings.findMySoundPlaying', 'Playing a sound on your {kind}.', { kind: kindLabel(d.kind) })
            : failText(res, t('settings.findMySoundFailed', 'Could not play a sound on that device.')));
        refetch();
    }

    async function markLost(message: string, contact: string, passcode: string | null): Promise<string | null> {
        const target = lostTarget;
        if (!target) return null;
        const res = await setDeviceLost(target.key, message, contact, passcode);
        if (!res.success) return failText(res, t('settings.findMyLostFailed', 'Could not turn on Lost Mode.'));
        setLostTarget(null);
        refetch();
        return null;
    }

    async function turnOffLost(d: FindMyDevice) {
        if (busy) return;
        setBusy(true);
        const res = await clearDeviceLost(d.key);
        setBusy(false);
        if (!res.success) setNotice(failText(res, t('settings.findMyLostOffFailed', 'Could not turn off Lost Mode.')));
        refetch();
    }

    async function erase(d: FindMyDevice) {
        setEraseTarget(null);
        if (busy) return;
        setBusy(true);
        const res = await eraseDevice(d.key);
        setBusy(false);
        setNotice(res.success
            ? t('settings.findMyErased', 'That device has been erased.')
            : failText(res, t('settings.findMyEraseFailed', 'Could not erase that device.')));
        refetch();
    }

    return (
        <>
            <SubPage
                title={t('settings.findMy', 'Find My')}
                backLabel={t('settings.settings', 'Settings')}
                onBack={onBack}
            >
                {!settled && devices.length === 0 && (
                    <div className="flex justify-center pt-16"><Spinner /></div>
                )}

                {settled && devices.length === 0 && (
                    <EmptyState
                        icon={Radar}
                        title={t('settings.findMyEmpty', 'No Devices Yet')}
                        subtitle={t('settings.findMyEmptySub', 'Your devices show up here once they have been switched on at least once.')}
                    />
                )}

                {devices.map(d => (
                    <ListGroup
                        key={d.key}
                        header={deviceLabel(d)}
                        footer={d.lost && d.lostMessage
                            ? t('settings.findMyLostShowing', 'Its lock screen is showing: {message}', { message: d.lostMessage })
                            : undefined}
                    >
                        <button
                            type="button"
                            onClick={() => showOnMap(d)}
                            aria-label={t('settings.findMyShowOnMap', 'Show on Map')}
                            className="relative block w-full overflow-hidden text-left active:opacity-80"
                            style={{ height: PREVIEW_H, background: 'linear-gradient(145deg,#3a4a52,#2c3a42)' }}
                        >
                            <LocationMapPreview x={d.x} y={d.y} width={PREVIEW_W} height={PREVIEW_H} />
                            <span
                                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full"
                                style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.45))' }}
                            >
                                <MapPin className="h-7 w-7" strokeWidth={2.4} fill="#0a84ff" color="#ffffff" />
                            </span>
                            <span className="pointer-events-none absolute bottom-2 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[13px] font-medium text-white">
                                {t('settings.findMyShowOnMap', 'Show on Map')}
                            </span>
                        </button>

                        <ListRow
                            label={t('settings.findMyLastSeen', 'Last Seen')}
                            value={timeAgo(d.seenAt)}
                            sub={d.online
                                ? t('settings.findMyOnline', 'Switched on right now')
                                : t('settings.findMyOffline', 'Not switched on')}
                            chevron={false}
                            divider
                        />
                        <ListRow
                            label={t('settings.findMyPlaySound', 'Play Sound')}
                            disabled={busy || !d.online}
                            chevron={false}
                            onPress={() => { void playSound(d); }}
                            divider
                        />
                        {d.lost ? (
                            <ListRow
                                label={t('settings.findMyLostOff', 'Turn Off Lost Mode')}
                                sub={d.lostContact ? formatPhone(d.lostContact) : undefined}
                                disabled={busy}
                                chevron={false}
                                onPress={() => { void turnOffLost(d); }}
                                divider
                            />
                        ) : (
                            <ListRow
                                label={t('settings.findMyLostOn', 'Mark As Lost')}
                                disabled={busy}
                                onPress={() => setLostTarget(d)}
                                divider
                            />
                        )}
                        <ListRow
                            label={t('settings.findMyErase', 'Erase This Device')}
                            destructive
                            disabled={busy}
                            chevron={false}
                            onPress={() => setEraseTarget(d)}
                        />
                    </ListGroup>
                ))}
            </SubPage>

            {lostTarget && (
                <LostModeSheet
                    deviceName={deviceLabel(lostTarget)}
                    initialMessage={lostTarget.lostMessage ?? ''}
                    initialContact={lostTarget.lostContact ?? ''}
                    needsPasscode={!lostTarget.hasPasscode}
                    onCancel={() => setLostTarget(null)}
                    onConfirm={markLost}
                />
            )}

            {eraseTarget && (
                <AlertDialog
                    title={t('settings.findMyEraseTitle', 'Erase This Device?')}
                    message={t('settings.findMyEraseBody', 'Everything on your {kind} goes back to factory settings, including its apps and its lock. This cannot be undone.', { kind: kindLabel(eraseTarget.kind) })}
                    confirmLabel={t('settings.findMyEraseConfirm', 'Erase')}
                    destructive
                    onCancel={() => setEraseTarget(null)}
                    onConfirm={() => { const target = eraseTarget; void erase(target); }}
                />
            )}

            {notice && (
                <AlertDialog
                    title={t('settings.findMy', 'Find My')}
                    message={notice}
                    hideCancel
                    onCancel={() => setNotice(null)}
                    onConfirm={() => setNotice(null)}
                />
            )}
        </>
    );
}
