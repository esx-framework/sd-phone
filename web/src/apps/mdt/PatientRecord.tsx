import { useState } from 'react';
import { FileText, HeartPulse } from 'lucide-react';

import { t } from '@/i18n';
import { colorFor } from '@/lib/format';
import { formatMediumDate } from '@/lib/time';
import { InitialsAvatar } from '@/shared/ContactAvatar';
import { EmptyState } from '@/ui/EmptyState';
import { Pill } from '@/ui/Pill';
import { Scroller } from '@/ui/Scroller';
import { useAsyncData } from '@/hooks/useAsyncData';

import { apiMedicalLookup, type MedicalId } from '@/apps/health/medicalApi';
import { mdtPatient, mdtSaveMedical } from './mdtApi';
import { useMdtSession, useViewEnter } from './useMdtSession';
import {
    mdtFieldArea, mdtFieldClass, mdtPanePad, mdtRef, mdtRowMeta, mdtRowTitle, mdtSectionHeader,
} from './mdtTheme';
import { MdtButton } from './ui/MdtButton';
import { MdtCard } from './ui/MdtCard';
import { BLOOD_TYPES, type MedicalFile, type PatientDetail } from './data';

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className={mdtSectionHeader}>{label}</div>
            <div className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-black dark:text-white">
                {value || t('mdt.nothingOnFile', 'Nothing on file')}
            </div>
        </div>
    );
}

function MedicalIdSection({ citizenid }: { citizenid: string }) {
    const { data } = useAsyncData(() => apiMedicalLookup(citizenid), [citizenid]);
    if (!data) return null;

    const card: MedicalId = data;
    const contact = card.contactName
        ? `${card.contactName}  ·  ${card.contactNumber}`
        : t('mdt.nothingOnFile', 'Nothing on file');

    return (
        <>
            <div className={`mt-6 ${mdtSectionHeader}`}>{t('mdt.patientMedicalId', 'Medical ID')}</div>
            <MdtCard className="mt-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="red">{card.bloodType || t('mdt.bloodUnknown', 'Blood unknown')}</Pill>
                    {card.organDonor && <Pill tone="green">{t('mdt.organDonor', 'Organ donor')}</Pill>}
                </div>
                <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    <Field label={t('mdt.allergies', 'Allergies')} value={card.allergies} />
                    <Field label={t('mdt.conditions', 'Conditions')} value={card.conditions} />
                    <Field label={t('mdt.medications', 'Medications')} value={card.medications} />
                    <Field label={t('mdt.emergencyContact', 'Emergency contact')} value={contact} />
                </div>
                <div className="mt-4">
                    <Field label={t('mdt.medicalNotes', 'Notes')} value={card.notes} />
                </div>
                <div className={`mt-4 ${mdtRowMeta}`}>
                    {card.updatedAt > 0
                        ? t('mdt.medicalIdFiledBy', 'Filed by the patient  ·  {date}', { date: formatMediumDate(card.updatedAt) })
                        : t('mdt.medicalIdFiled', 'Filed by the patient')}
                </div>
            </MdtCard>
        </>
    );
}

function FileEditor({ patient, enter, onCancel, onSaved }: {
    patient:  PatientDetail;
    enter:    string;
    onCancel: () => void;
    onSaved:  (file: MedicalFile) => void;
}) {
    const [draft, setDraft] = useState<MedicalFile>(patient.file);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = <K extends keyof MedicalFile>(key: K, value: MedicalFile[K]) =>
        setDraft(d => ({ ...d, [key]: value }));

    async function save() {
        setSaving(true);
        const file = await mdtSaveMedical(patient.citizenid, {
            bloodType:   draft.bloodType,
            allergies:   draft.allergies,
            conditions:  draft.conditions,
            medications: draft.medications,
            notes:       draft.notes,
            dnr:         draft.dnr,
        });
        setSaving(false);
        if (!file) { setError(t('mdt.medicalSaveFailed', 'That could not be saved.')); return; }
        onSaved(file);
    }

    return (
        <Scroller key="edit" className={`h-full ${mdtPanePad} ${enter}`}>
            <h1 className="text-[26px] font-bold tracking-ios-display text-black dark:text-white">
                {t('mdt.editMedicalFile', 'Medical file')}
            </h1>
            <div className={`mt-1 ${mdtRowMeta}`}>{patient.name}</div>

            <MdtCard className="mt-5 p-5">
                <div className={mdtSectionHeader}>{t('mdt.bloodType', 'Blood type')}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                    {BLOOD_TYPES.map(type => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => set('bloodType', draft.bloodType === type ? '' : type)}
                            className={`rounded-[9px] px-3 py-1.5 text-[14px] font-semibold transition-colors duration-150 ${
                                draft.bloodType === type
                                    ? 'bg-ios-blue text-white'
                                    : 'bg-black/[0.05] text-black hover:bg-black/[0.08] dark:bg-white/[0.07] dark:text-white dark:hover:bg-white/[0.11]'
                            }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={() => set('dnr', !draft.dnr)}
                    className={`mt-4 flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-left transition-colors duration-150 ${
                        draft.dnr ? 'bg-ios-red/10' : 'bg-black/[0.05] hover:bg-black/[0.08] dark:bg-white/[0.07] dark:hover:bg-white/[0.11]'
                    }`}
                >
                    <span>
                        <span className={`block ${mdtRowTitle}`}>{t('mdt.dnrOrder', 'Do not resuscitate')}</span>
                        <span className={`block ${mdtRowMeta}`}>
                            {t('mdt.dnrOrderSub', 'A standing order on this patient, shown on every list they appear in.')}
                        </span>
                    </span>
                    {draft.dnr && <Pill tone="red">{t('mdt.onFile', 'On file')}</Pill>}
                </button>

                <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                    <div>
                        <div className={mdtSectionHeader}>{t('mdt.allergies', 'Allergies')}</div>
                        <input
                            className={`mt-1.5 ${mdtFieldClass}`}
                            value={draft.allergies}
                            maxLength={400}
                            onChange={e => set('allergies', e.target.value)}
                            placeholder={t('mdt.allergiesPlaceholder', 'Penicillin, latex')}
                        />
                    </div>
                    <div>
                        <div className={mdtSectionHeader}>{t('mdt.conditions', 'Conditions')}</div>
                        <input
                            className={`mt-1.5 ${mdtFieldClass}`}
                            value={draft.conditions}
                            maxLength={400}
                            onChange={e => set('conditions', e.target.value)}
                            placeholder={t('mdt.conditionsPlaceholder', 'Asthma, type 1 diabetes')}
                        />
                    </div>
                    <div>
                        <div className={mdtSectionHeader}>{t('mdt.medications', 'Medications')}</div>
                        <input
                            className={`mt-1.5 ${mdtFieldClass}`}
                            value={draft.medications}
                            maxLength={400}
                            onChange={e => set('medications', e.target.value)}
                            placeholder={t('mdt.medicationsPlaceholder', 'Salbutamol inhaler')}
                        />
                    </div>
                </div>

                <div className="mt-4">
                    <div className={mdtSectionHeader}>{t('mdt.medicalNotes', 'Notes')}</div>
                    <textarea
                        className={`mt-1.5 ${mdtFieldArea} w-full`}
                        rows={8}
                        value={draft.notes}
                        maxLength={4000}
                        onChange={e => set('notes', e.target.value)}
                        placeholder={t('mdt.medicalNotesPlaceholder', 'Treatment history, presentation on scene, anything the next crew needs.')}
                    />
                </div>
            </MdtCard>

            {error && <div className="mt-4 text-[14px] text-ios-red">{error}</div>}

            <div className="mt-5 flex items-center gap-3 pb-6">
                <MdtButton variant="filled" disabled={saving} onClick={() => void save()}>
                    {saving ? t('mdt.saving', 'Saving') : t('common.save', 'Save')}
                </MdtButton>
                <MdtButton onClick={onCancel}>{t('common.cancel', 'Cancel')}</MdtButton>
            </div>
        </Scroller>
    );
}

export function PatientRecord({ citizenid }: { citizenid: string }) {
    const { can, open } = useMdtSession();
    const { data, loading, refetch } = useAsyncData(() => mdtPatient(citizenid), [citizenid]);
    const [editing, setEditing] = useState(false);
    const [override, setOverride] = useState<MedicalFile | null>(null);

    const enter = useViewEnter(editing ? 'edit' : data ? 'read' : null);

    if (!data) {
        if (loading) {
            return (
                <div className="flex flex-col gap-3 p-6">
                    <div className="h-24 animate-shimmer rounded-[16px] bg-black/[0.06] dark:bg-white/[0.06]" />
                    <div className="h-40 animate-shimmer rounded-[16px] bg-black/[0.06] dark:bg-white/[0.06]" />
                </div>
            );
        }
        return (
            <EmptyState
                center
                icon={HeartPulse}
                title={t('mdt.patientGone', 'Patient unavailable')}
                subtitle={t('mdt.patientGoneSub', 'That record is no longer on file.')}
            />
        );
    }

    const patient: PatientDetail = override ? { ...data, file: override } : data;
    const file = patient.file;

    if (editing) {
        return (
            <FileEditor
                patient={patient}
                enter={enter}
                onCancel={() => setEditing(false)}
                onSaved={saved => { setOverride(saved); setEditing(false); refetch(); }}
            />
        );
    }

    return (
        <Scroller key="read" className={`h-full ${mdtPanePad} ${enter}`}>
            <div className="flex flex-wrap items-center gap-3">
                <InitialsAvatar name={patient.name} color={colorFor(patient.citizenid)} size={52} />
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-[26px] font-bold leading-tight tracking-ios-display text-black dark:text-white">
                        {patient.name}
                    </h1>
                    <div className={`mt-0.5 ${mdtRowMeta}`}>
                        {[patient.dob, patient.sex, patient.phone].filter(Boolean).join('  ·  ')}
                    </div>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                    {file.dnr && <Pill tone="red">{t('mdt.dnr', 'DNR')}</Pill>}
                    {file.bloodType !== '' && <Pill tone="blue">{file.bloodType}</Pill>}
                    {can('patients.edit') && (
                        <MdtButton variant="filled" size="sm" onClick={() => setEditing(true)}>
                            {t('common.edit', 'Edit')}
                        </MdtButton>
                    )}
                </span>
            </div>

            <MdtCard className="mt-5 p-5">
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    <Field label={t('mdt.allergies', 'Allergies')} value={file.allergies} />
                    <Field label={t('mdt.conditions', 'Conditions')} value={file.conditions} />
                    <Field label={t('mdt.medications', 'Medications')} value={file.medications} />
                </div>
                <div className="mt-4">
                    <Field label={t('mdt.medicalNotes', 'Notes')} value={file.notes} />
                </div>
                {file.updatedBy !== '' && (
                    <div className={`mt-4 ${mdtRowMeta}`}>
                        {t('mdt.lastUpdatedBy', 'Last updated by {who}', { who: file.updatedBy })}
                        {file.updatedAt > 0 && `  ·  ${formatMediumDate(file.updatedAt)}`}
                    </div>
                )}
            </MdtCard>

            <MedicalIdSection citizenid={patient.citizenid} />

            <div className={`mt-6 ${mdtSectionHeader}`}>{t('mdt.patientPaperwork', 'Incidents')}</div>
            <MdtCard className="mt-2 overflow-hidden">
                {patient.reports.length === 0 ? (
                    <div className="px-4 py-6">
                        <EmptyState
                            center
                            icon={FileText}
                            title={t('mdt.noPatientReports', 'No incidents')}
                            subtitle={t('mdt.noPatientReportsSub', 'This patient does not appear on any incident your service has filed.')}
                        />
                    </div>
                ) : (
                    patient.reports.map((r, i) => (
                        <button
                            key={r.ref}
                            type="button"
                            onClick={() => open('reports', r.ref)}
                            className="relative w-full px-4 py-3 text-left transition-colors duration-150 hover:bg-black/[0.035] active:bg-black/[0.06] dark:hover:bg-white/[0.05] dark:active:bg-white/[0.08]"
                        >
                            <div className="flex items-center gap-2">
                                <span className={mdtRef}>{r.ref}</span>
                                <Pill tone="blue">{r.type}</Pill>
                                <span className="flex-1" />
                                <span className={`shrink-0 ${mdtRowMeta}`}>{formatMediumDate(r.createdAt)}</span>
                            </div>
                            <div className={`mt-1 truncate ${mdtRowTitle}`}>{r.title}</div>
                            {i < patient.reports.length - 1 && (
                                <span
                                    className="pointer-events-none absolute inset-x-4 bottom-0 bg-ios-gray4 dark:bg-control"
                                    style={{ height: '0.5px' }}
                                />
                            )}
                        </button>
                    ))
                )}
            </MdtCard>
            <div className="h-6" />
        </Scroller>
    );
}
