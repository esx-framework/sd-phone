import { useEffect, useRef, useState } from 'react';

import { t } from '@/i18n';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useIosPush } from '@/hooks/useIosPush';
import { ContactPickerSheet } from '@/shared/ContactPickerSheet';
import { ListGroup, ListRow, ToggleRow } from '@/ui/ListGroup';
import { NavBar } from '@/ui/NavBar';
import { Sheet } from '@/ui/Sheet';
import { SheetHeader } from '@/ui/SheetHeader';
import { Spinner } from '@/ui/Spinner';
import { StatusBarSpacer } from '@/ui/StatusBarSpacer';
import { MedicalIdHeader } from './MedicalIdCard';
import {
    apiMedicalId, apiSaveMedicalId, MEDICAL_LIMITS,
    type MedicalField, type MedicalId, type MedicalPatch,
} from './medicalApi';

const FIELD_LABELS: Record<MedicalField, () => string> = {
    allergies:   () => t('medical.allergies', 'Allergies & Reactions'),
    conditions:  () => t('medical.conditions', 'Medical Conditions'),
    medications: () => t('medical.medications', 'Medications'),
    notes:       () => t('medical.notes', 'Medical Notes'),
};

const FIELD_HINTS: Record<MedicalField, () => string> = {
    allergies:   () => t('medical.allergiesHint', 'Penicillin, shellfish, latex'),
    conditions:  () => t('medical.conditionsHint', 'Asthma, type 1 diabetes'),
    medications: () => t('medical.medicationsHint', 'Insulin, salbutamol inhaler'),
    notes:       () => t('medical.notesHint', 'Anything the crew treating you needs to know'),
};

const FIELD_ORDER: MedicalField[] = ['allergies', 'conditions', 'medications', 'notes'];

function FieldSheet({ field, value, onSave, onClose }: {
    field:   MedicalField;
    value:   string;
    onSave:  (next: string) => void;
    onClose: () => void;
}) {
    const [draft, setDraft] = useState(value);
    const area = useRef<HTMLTextAreaElement>(null);
    const commit = useRef<string | null>(null);

    useEffect(() => {
        area.current?.focus();
    }, []);

    return (
        <Sheet
            fit="content"
            className="bg-base"
            onClose={() => {
                if (commit.current !== null) onSave(commit.current);
                onClose();
            }}
        >
            {({ close }) => (
                <>
                    <SheetHeader
                        cancelLabel={t('common.cancel', 'Cancel')}
                        onCancel={close}
                        title={FIELD_LABELS[field]()}
                        doneLabel={t('common.done', 'Done')}
                        onDone={() => { commit.current = draft.trim(); close(); }}
                    />
                    <div className="px-4 pb-2 pt-1">
                        <textarea
                            ref={area}
                            value={draft}
                            rows={field === 'notes' ? 6 : 4}
                            maxLength={MEDICAL_LIMITS[field]}
                            placeholder={FIELD_HINTS[field]()}
                            onChange={e => setDraft(e.target.value)}
                            className="w-full resize-none rounded-[12px] bg-surface px-3.5 py-3 text-[17px] leading-snug text-black outline-none placeholder:text-ios-gray dark:text-white"
                        />
                        <p className="px-1 pt-1.5 text-right text-[13px] tabular-nums text-ios-gray">
                            {MEDICAL_LIMITS[field] - draft.length}
                        </p>
                    </div>
                </>
            )}
        </Sheet>
    );
}

export function MedicalIdPage({ onBack }: { onBack: () => void }) {
    const { goBack, pageStyle } = useIosPush(onBack);
    const { data, settled } = useAsyncData(apiMedicalId, []);
    const [saved, setSaved]     = useState<MedicalId | null>(null);
    const [editing, setEditing] = useState<MedicalField | null>(null);
    const [picking, setPicking] = useState(false);

    const record = saved ?? data;

    function patch(next: MedicalPatch) {
        if (record) setSaved({ ...record, ...next });
        void apiSaveMedicalId(next).then(fresh => { if (fresh) setSaved(fresh); });
    }

    return (
        <div className="absolute inset-0 z-20 flex flex-col bg-base font-sf" style={pageStyle}>
            <StatusBarSpacer />
            <NavBar
                backLabel={t('health.title', 'Health')}
                onBack={goBack}
                title={t('medical.title', 'Medical ID')}
            />

            {!record ? (
                <div className="flex flex-1 items-center justify-center">
                    {settled
                        ? <p className="px-8 text-center text-[15px] text-ios-gray">{t('medical.unavailable', 'Your Medical ID is unavailable right now.')}</p>
                        : <Spinner />}
                </div>
            ) : (
                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-8 pt-1">
                    <div className="px-4">
                        <MedicalIdHeader record={record} />
                    </div>

                    <p className="px-7 pb-1 pt-3 text-[14px] leading-snug text-ios-gray">
                        {t('medical.intro', 'A medic can read this from your lock screen without unlocking your phone.')}
                    </p>

                    <div className="mt-2 flex flex-col gap-6">
                        <ListGroup header={t('medical.medicalDetails', 'Medical Details')}>
                            {FIELD_ORDER.map((field, i) => (
                                <ListRow
                                    key={field}
                                    label={FIELD_LABELS[field]()}
                                    sub={record[field] || t('medical.notSet', 'Not Set')}
                                    chevron
                                    divider={i < FIELD_ORDER.length - 1}
                                    onPress={() => setEditing(field)}
                                />
                            ))}
                        </ListGroup>

                        <ListGroup footer={t('medical.organDonorFooter', 'Shown to responders on your Medical ID.')}>
                            <ToggleRow
                                label={t('medical.organDonor', 'Organ Donor')}
                                on={record.organDonor}
                                onToggle={() => patch({ organDonor: !record.organDonor })}
                            />
                        </ListGroup>

                        <ListGroup header={t('medical.emergencyContact', 'Emergency Contact')}>
                            <ListRow
                                label={record.contactName || t('medical.addContact', 'Add Emergency Contact')}
                                sub={record.contactName ? record.contactNumber : undefined}
                                chevron
                                divider={record.contactName !== ''}
                                onPress={() => setPicking(true)}
                            />
                            {record.contactName !== '' && (
                                <ListRow
                                    label={t('medical.removeContact', 'Remove Emergency Contact')}
                                    destructive
                                    chevron={false}
                                    onPress={() => patch({ contactName: '', contactNumber: '' })}
                                />
                            )}
                        </ListGroup>

                        <ListGroup footer={t('medical.showOnLockFooter', 'Adds a Medical ID button to the passcode screen. Anyone holding your phone can read the card.')}>
                            <ToggleRow
                                label={t('medical.showWhenLocked', 'Show When Locked')}
                                on={record.showOnLock}
                                onToggle={() => patch({ showOnLock: !record.showOnLock })}
                            />
                        </ListGroup>
                    </div>
                </div>
            )}

            {editing && record && (
                <FieldSheet
                    field={editing}
                    value={record[editing]}
                    onSave={next => patch({ [editing]: next })}
                    onClose={() => setEditing(null)}
                />
            )}

            {picking && (
                <ContactPickerSheet
                    onPick={c => { patch({ contactName: c.name, contactNumber: c.phone }); setPicking(false); }}
                    onClose={() => setPicking(false)}
                />
            )}
        </div>
    );
}
