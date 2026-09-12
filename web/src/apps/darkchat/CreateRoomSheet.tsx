import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { t } from '@/i18n';
import { useCopied } from '@/hooks/useCopied';
import { Sheet } from '@/ui/Sheet';
import { SheetAction, SheetField, SheetHeader } from './SheetForm';
import { genCode } from './data';

export function CreateRoomSheet({ onClose, onCreate }: {
    onClose:  () => void;
    onCreate: (name: string, code: string) => void;
}) {
    const [name, setName] = useState('');
    const [code, setCode] = useState<string | null>(null);
    const [copied, copy]  = useCopied();
    const canMake = name.trim().length > 0;

    function make() { if (canMake) setCode(genCode()); }
    function enter() { if (code) onCreate(name.trim(), code); }

    return (
        <Sheet onClose={onClose} fit="content" forceDark durationMs={240} className="bg-[#1c1c1e] text-white">
            {({ close }) => (
                <>
                    <SheetHeader
                        title={t('darkchat.newPrivateRoom', 'New private room')}
                        onCancel={close}
                        right={code === null
                            ? <SheetAction label={t('darkchat.create', 'Create')} onClick={make} disabled={!canMake} />
                            : <SheetAction label={t('darkchat.enter', 'Enter')} onClick={enter} />}
                    />

                    {code === null ? (
                        <SheetField
                            label={t('darkchat.roomName', 'Room name')}
                            hint={t('darkchat.privateRoomHint', 'A private room only people with the code can join.')}
                            dir="auto"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') make(); }}
                            placeholder={t('darkchat.nameYourRoom', 'Name your room…')}
                            maxLength={30}
                        />
                    ) : (
                        <div className="px-4 pt-2">
                            <p className="text-center text-[14px] text-white/50">{t('darkchat.shareCodeHint', 'Share this code so others can join')}</p>
                            <button type="button" onClick={() => copy(code)} className="mx-auto mt-3 flex items-center gap-3 rounded-[14px] bg-[#2c2c2e] px-6 py-4 active:opacity-80">
                                <span dir="ltr" className="text-[30px] font-bold tracking-[0.3em] text-white">{code}</span>
                                {copied
                                    ? <Check className="h-5 w-5 text-[#34c759]" strokeWidth={2.6} />
                                    : <Copy  className="h-5 w-5 text-ios-blue"   strokeWidth={2.2} />}
                            </button>
                            <p className="mt-3 text-center text-[13px] text-white/40">{copied ? t('darkchat.copiedToClipboard', 'Copied to clipboard') : t('darkchat.tapToCopy', 'Tap to copy')}</p>
                        </div>
                    )}
                </>
            )}
        </Sheet>
    );
}
