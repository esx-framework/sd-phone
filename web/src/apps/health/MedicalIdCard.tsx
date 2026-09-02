import { Droplet, HeartHandshake, Phone } from 'lucide-react';

import { t } from '@/i18n';
import { GroupCard } from '@/ui/ListGroup';
import type { MedicalId } from './medicalApi';

export function MedicalIdHeader({ record }: { record: MedicalId }) {
    const blood = record.bloodType || t('medical.unknown', 'Unknown');

    return (
        <GroupCard radius={14} className="px-4 py-4">
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[24px] font-bold leading-tight tracking-tight text-black dark:text-white">
                        {record.name || t('medical.noName', 'Unnamed')}
                    </p>
                    {record.dob && (
                        <p className="mt-0.5 text-[15px] text-ios-gray">
                            {t('medical.bornOn', 'Born {date}', { date: record.dob })}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 flex-col items-center rounded-[12px] bg-ios-red/15 px-3 py-2">
                    <Droplet className="h-[15px] w-[15px] text-ios-red" strokeWidth={2.4} />
                    <span className="mt-1 text-[17px] font-bold leading-none text-ios-red">{blood}</span>
                    <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-ios-red/80">
                        {t('medical.bloodType', 'Blood Type')}
                    </span>
                </div>
            </div>
        </GroupCard>
    );
}

function Fact({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
    return (
        <div className="relative px-4 py-3">
            <p className="text-[13px] uppercase tracking-wider text-ios-gray">{label}</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[17px] leading-snug text-black dark:text-white">
                {value || t('medical.noneListed', 'None listed')}
            </p>
            {divider && (
                <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 bg-ios-gray4 dark:bg-control"
                    style={{ height: '0.5px' }}
                />
            )}
        </div>
    );
}

export function MedicalIdFacts({ record }: { record: MedicalId }) {
    return (
        <div className="flex flex-col gap-4">
            <GroupCard radius={14}>
                <Fact label={t('medical.allergies', 'Allergies & Reactions')} value={record.allergies} divider />
                <Fact label={t('medical.conditions', 'Medical Conditions')} value={record.conditions} divider />
                <Fact label={t('medical.medications', 'Medications')} value={record.medications} divider />
                <Fact label={t('medical.notes', 'Medical Notes')} value={record.notes} />
            </GroupCard>

            <GroupCard radius={14}>
                <div className="flex items-center gap-3 px-4 py-3">
                    <HeartHandshake className="h-[19px] w-[19px] shrink-0 text-ios-red" strokeWidth={2.2} />
                    <span className="flex-1 text-[17px] text-black dark:text-white">
                        {t('medical.organDonor', 'Organ Donor')}
                    </span>
                    <span className="text-[17px] font-semibold text-ios-gray">
                        {record.organDonor ? t('medical.yes', 'Yes') : t('medical.no', 'No')}
                    </span>
                </div>
            </GroupCard>

            <GroupCard radius={14} header={t('medical.emergencyContact', 'Emergency Contact')}>
                <div className="flex items-center gap-3 px-4 py-3">
                    <Phone className="h-[19px] w-[19px] shrink-0 text-ios-green" strokeWidth={2.2} />
                    {record.contactName ? (
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[17px] text-black dark:text-white">{record.contactName}</span>
                            <span className="block truncate text-[14px] text-ios-gray">{record.contactNumber}</span>
                        </span>
                    ) : (
                        <span className="flex-1 text-[17px] text-ios-gray">
                            {t('medical.noContact', 'No contact listed')}
                        </span>
                    )}
                </div>
            </GroupCard>
        </div>
    );
}
