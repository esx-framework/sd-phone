import { useState } from 'react';

import { t } from '@/i18n';
import { Sheet } from '@/ui/Sheet';
import { SheetHeader } from '@/ui/SheetHeader';

const MAX_MESSAGE = 120;

const FIELD =
    'w-full rounded-[10px] bg-surface px-3.5 py-3 text-[16px] text-black outline-none placeholder:text-ios-gray dark:text-white';

export function LostModeSheet({ deviceName, initialMessage, initialContact, needsPasscode, onCancel, onConfirm }: {
    deviceName:     string;
    initialMessage: string;
    initialContact: string;
    needsPasscode:  boolean;
    onCancel:       () => void;
    onConfirm:      (message: string, contact: string, passcode: string | null) => Promise<string | null>;
}) {
    const [message,  setMessage]  = useState(initialMessage);
    const [contact,  setContact]  = useState(initialContact);
    const [passcode, setPasscode] = useState('');
    const [error,    setError]    = useState<string | null>(null);
    const [saving,   setSaving]   = useState(false);

    async function confirm(close: () => void) {
        if (saving) return;
        if (needsPasscode && !/^\d{4,6}$/.test(passcode)) {
            setError(t('settings.findMyLostPasscodeInvalid', 'Enter a 4 to 6 digit passcode.'));
            return;
        }
        setSaving(true);
        const failure = await onConfirm(message.trim(), contact.trim(), needsPasscode ? passcode : null);
        setSaving(false);
        if (failure) { setError(failure); return; }
        close();
    }

    return (
        <Sheet onClose={onCancel} fit="content" grabber={false} zIndex={75}>
            {({ close }) => (
                <div className="flex flex-col bg-base pb-2">
                    <SheetHeader
                        cancelLabel={t('common.cancel', 'Cancel')}
                        onCancel={close}
                        title={t('settings.findMyLostOn', 'Mark As Lost')}
                        doneLabel={t('settings.findMyLostTurnOn', 'Turn On')}
                        onDone={() => { void confirm(close); }}
                        doneDisabled={saving}
                    />

                    <p className="px-5 pb-4 pt-1 text-[14px] leading-snug text-ios-gray">
                        {t('settings.findMyLostBlurb', 'Your {name} locks straight away and shows this message on its lock screen. It cannot place calls or send texts until you turn Lost Mode off.', { name: deviceName })}
                    </p>

                    <div className="flex flex-col gap-4 px-4">
                        <div className="flex flex-col gap-1.5">
                            <span className="px-1 text-[13px] uppercase tracking-wider text-ios-gray">
                                {t('settings.findMyLostMessage', 'Message')}
                            </span>
                            <textarea
                                value={message}
                                maxLength={MAX_MESSAGE}
                                rows={3}
                                onChange={e => { setMessage(e.target.value); setError(null); }}
                                placeholder={t('settings.findMyLostMessagePlaceholder', 'This phone is lost. Please call the number below.')}
                                className={`${FIELD} resize-none`}
                            />
                            <span className="px-1 text-right text-[12px] text-ios-gray">
                                {message.length}/{MAX_MESSAGE}
                            </span>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <span className="px-1 text-[13px] uppercase tracking-wider text-ios-gray">
                                {t('settings.findMyLostContact', 'Contact Number')}
                            </span>
                            <input
                                value={contact}
                                inputMode="numeric"
                                maxLength={24}
                                onChange={e => { setContact(e.target.value.replace(/\D/g, '')); setError(null); }}
                                placeholder={t('settings.findMyLostContactPlaceholder', 'Where you can be reached')}
                                className={FIELD}
                            />
                        </div>

                        {needsPasscode && (
                            <div className="flex flex-col gap-1.5">
                                <span className="px-1 text-[13px] uppercase tracking-wider text-ios-gray">
                                    {t('settings.findMyLostPasscode', 'Passcode')}
                                </span>
                                <input
                                    value={passcode}
                                    inputMode="numeric"
                                    maxLength={6}
                                    onChange={e => { setPasscode(e.target.value.replace(/\D/g, '')); setError(null); }}
                                    placeholder={t('settings.findMyLostPasscodePlaceholder', '4 to 6 digits')}
                                    className={FIELD}
                                />
                                <span className="px-1 text-[12px] leading-snug text-ios-gray">
                                    {t('settings.findMyLostPasscodeHint', 'This device has no passcode. Lost Mode sets this one so you can unlock it again.')}
                                </span>
                            </div>
                        )}
                    </div>

                    {error && (
                        <p className="px-5 pt-4 text-[14px] text-ios-red">{error}</p>
                    )}
                </div>
            )}
        </Sheet>
    );
}
