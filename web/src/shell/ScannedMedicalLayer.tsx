import { useCallback, useState } from 'react';

import { t } from '@/i18n';
import { useNuiEvent } from '@/hooks/useNuiEvent';
import { MedicalIdFacts, MedicalIdHeader } from '@/apps/health/MedicalIdCard';
import type { MedicalId } from '@/apps/health/medicalApi';
import { StatusBarSpacer } from '@/ui/StatusBarSpacer';

export function ScannedMedicalLayer() {
    const [record, setRecord] = useState<MedicalId | null>(null);
    const [leaving, setLeaving] = useState(false);

    useNuiEvent('sd-phone:medical:scanned', useCallback((data: { record?: MedicalId } | undefined) => {
        if (!data?.record) return;
        setLeaving(false);
        setRecord(data.record);
    }, []));

    function dismiss() {
        if (leaving) return;
        setLeaving(true);
        window.setTimeout(() => { setRecord(null); setLeaving(false); }, 260);
    }

    if (!record) return null;

    return (
        <div
            className="absolute inset-0 z-[90] flex flex-col bg-base font-sf text-black dark:text-white"
            style={{ animation: leaving
                ? 'ios-sheet-down 0.26s cubic-bezier(0.32,0,0.68,1) forwards'
                : 'ios-sheet-up 0.34s cubic-bezier(0.32,0.72,0,1)' }}
        >
            <StatusBarSpacer />

            <div className="shrink-0 px-5 pb-3 pt-2 text-center">
                <div className="text-[15px] font-semibold text-ios-gray">{t('medical.scannedTitle', 'Medical ID')}</div>
                <div className="mt-0.5 truncate text-[22px] font-bold">{record.name}</div>
                <div className="mt-0.5 text-[13px] text-ios-gray">{t('medical.scanNote', 'Scanned at the scene. Not saved to your phone.')}</div>
            </div>

            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5">
                <MedicalIdHeader record={record} />
                <div className="mt-4">
                    <MedicalIdFacts record={record} />
                </div>
            </div>

            <div className="shrink-0 px-5 pb-9 pt-3">
                <button
                    type="button"
                    onClick={dismiss}
                    className="w-full rounded-[14px] bg-ios-blue py-[13px] text-[17px] font-semibold text-white active:opacity-80"
                >
                    {t('common.done', 'Done')}
                </button>
            </div>
        </div>
    );
}
