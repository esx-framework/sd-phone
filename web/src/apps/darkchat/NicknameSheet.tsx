import { useState } from 'react';

import { t } from '@/i18n';
import { Sheet } from '@/ui/Sheet';
import { SheetAction, SheetField, SheetHeader } from './SheetForm';

export function NicknameSheet({ initial, onClose, onPick }: {
    initial: string;
    onClose: () => void;
    onPick:  (name: string) => void;
}) {
    const [name, setName] = useState(initial);
    const canGo = name.trim().length > 0;
    function go() { if (canGo) onPick(name.trim()); }

    return (
        <Sheet onClose={onClose} fit="content" forceDark durationMs={240} className="bg-[#1c1c1e] text-white">
            {({ close }) => (
                <>
                    <SheetHeader
                        title={t('darkchat.chooseANickname', 'Choose a nickname')}
                        onCancel={close}
                        right={<SheetAction label={t('darkchat.enter', 'Enter')} onClick={go} disabled={!canGo} />}
                    />
                    <SheetField
                        label={t('darkchat.displayedInRoom', 'Displayed in the room')}
                        hint={t('darkchat.anonymousHint', 'Stay anonymous — pick anything you like.')}
                        dir="auto"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') go(); }}
                        placeholder={t('darkchat.nicknamePlaceholder', 'e.g. Ghost')}
                        maxLength={20}
                    />
                </>
            )}
        </Sheet>
    );
}
