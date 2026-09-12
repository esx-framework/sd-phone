import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { t } from '@/i18n';
import { AppIconSVG } from '@/shell/AppIconSVG';
import { Toggle } from '@/ui/Toggle';
import { useIosPush } from '@/hooks/useIosPush';
import { NavBar } from '@/ui/NavBar';
import { useTheme } from '@/stores/themeStore';
import { useNotifPref, useNotifPrefsStore } from '@/stores/notifPrefsStore';
import { NOTIFICATION_TONES, resolveTone } from '../tones';
import { stopPreview } from '../tonePlayer';
import { TonePickerPage } from '../sound/TonePickerPage';
import { PushLayer } from '../SettingsSubPage';

export interface AppEntry { id: string; label: string }

const FOLLOW_GLOBAL = '';

export function AppNotificationsPage({
    app, onBack,
}: {
    app: AppEntry;
    onBack: () => void;
}) {
    const { goBack, pageStyle } = useIosPush(onBack);
    const pref  = useNotifPref(app.id);
    const patch = useNotifPrefsStore(s => s.patch);
    const {
        notificationTone, ringtoneVol, customNotificationTones, addCustomTone, removeCustomTone,
    } = useTheme('notificationTone', 'ringtoneVol', 'customNotificationTones', 'addCustomTone', 'removeCustomTone');

    const [showTonePicker, setShowTonePicker] = useState(false);

    const globalName = resolveTone('notification', notificationTone, customNotificationTones).name;
    const toneName = pref.tone
        ? resolveTone('notification', pref.tone, customNotificationTones).name
        : t('settings.defaultTone', 'Default ({tone})', { tone: globalName });

    const subNode = showTonePicker ? (
        <TonePickerPage
            title={t('settings.textTone', 'Text Tone')}
            backLabel={app.label}
            tones={[{ id: FOLLOW_GLOBAL, name: t('settings.defaultTone', 'Default ({tone})', { tone: globalName }), url: resolveTone('notification', notificationTone, customNotificationTones).url }, ...NOTIFICATION_TONES]}
            selected={pref.tone ?? FOLLOW_GLOBAL}
            previewVol={ringtoneVol / 100}
            onSelect={id => patch(app.id, { tone: id === FOLLOW_GLOBAL ? undefined : id })}
            onBack={() => { stopPreview(); setShowTonePicker(false); }}
            custom={{
                noun:      t('settings.notificationTone', 'Notification Tone'),
                myTones:   t('settings.myNotificationTones', 'My Notification Tones'),
                addTone:   t('settings.addNotificationTone', 'Add Notification Tone'),
                pasteHint: t('settings.pasteYoutubeNotification', 'Paste any YouTube link to use it as a notification tone.'),
                addToneMessage: t('settings.saveYoutubeNotification', 'Save any YouTube link as a notification tone.'),
                items:    customNotificationTones,
                onAdd:    (name, url) => patch(app.id, { tone: addCustomTone('notification', name, url) }),
                onRemove: id => {
                    removeCustomTone('notification', id);
                    if (pref.tone === id) patch(app.id, { tone: undefined });
                },
            }}
        />
    ) : null;

    return (
        <PushLayer pageStyle={pageStyle} className="z-30" sub={subNode}>
            <div className="h-11 shrink-0" aria-hidden />

            <NavBar backLabel={t('settings.notifications', 'Notifications')} onBack={goBack} title={app.label} hairline />

            <div className="flex-1 overflow-y-auto no-scrollbar">
                <div className="mt-6 flex flex-col gap-6 px-4 pb-10">

                    <div className="flex flex-col items-center gap-3 py-2">
                        <AppTile iconId={app.id} />
                        <span className="text-[20px] font-semibold text-black dark:text-white">
                            {app.label}
                        </span>
                    </div>

                    <div className="overflow-hidden rounded-[10px] bg-surface">
                        <ToggleRow
                            label={t('settings.allowNotifications', 'Allow Notifications')}
                            on={pref.enabled}
                            onChange={v => patch(app.id, { enabled: v })}
                        />
                    </div>

                    {pref.enabled && (
                        <div className="overflow-hidden rounded-[10px] bg-surface">
                            <ToggleRow
                                label={t('settings.sounds', 'Sounds')}
                                on={pref.sounds}
                                onChange={v => patch(app.id, { sounds: v })}
                                divider
                            />

                            <button
                                type="button"
                                onClick={() => setShowTonePicker(true)}
                                disabled={!pref.sounds}
                                className="relative flex w-full items-center px-4 py-3 text-start active:bg-black/5 disabled:opacity-40 dark:active:bg-white/5"
                            >
                                <span className="flex-1 text-[17px] font-normal text-black dark:text-white">
                                    {t('settings.textTone', 'Text Tone')}
                                </span>
                                <span className="me-1.5 min-w-0 truncate text-[15px] text-ios-gray">
                                    {toneName}
                                </span>
                                <ChevronRight className="h-[17px] w-[17px] shrink-0 text-ios-gray3" strokeWidth={2.5} />
                            </button>
                        </div>
                    )}

                    {!pref.enabled && (
                        <p className="px-1 text-[13px] text-ios-gray">
                            {t('settings.appNotifsOff', 'Notifications for {app} are turned off. Turn on Allow Notifications to receive alerts.', { app: app.label })}
                        </p>
                    )}
                </div>
            </div>
        </PushLayer>
    );
}


function AppTile({ iconId }: { iconId: string }) {
    const SIZE = 64, SVG_SIZE = 60, scale = SIZE / SVG_SIZE;
    return (
        <div style={{
            width: SIZE, height: SIZE,
            borderRadius: '27.6%',
            overflow: 'hidden',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            position: 'relative',
        }}>
            <div style={{
                position: 'absolute', top: 0, left: 0,
                width: SVG_SIZE, height: SVG_SIZE,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
            }}>
                <AppIconSVG icon={iconId} />
            </div>
        </div>
    );
}

function ToggleRow({
    label, on, onChange, divider,
}: {
    label: string; on: boolean; onChange: (v: boolean) => void; divider?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!on)}
            className="relative flex w-full items-center px-4 py-3 text-start active:bg-black/5 dark:active:bg-white/5"
        >
            <span className="flex-1 text-[17px] font-normal text-black dark:text-white">{label}</span>
            <div className="pointer-events-none">
                <Toggle on={on} />
            </div>
            {divider && (
                <div
                    className="pointer-events-none absolute bottom-0 end-0 bg-ios-gray4 dark:bg-control"
                    style={{ insetInlineStart: 0, height: '0.5px' }}
                />
            )}
        </button>
    );
}
