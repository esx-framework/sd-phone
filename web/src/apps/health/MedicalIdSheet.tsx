import { t } from '@/i18n';
import { Sheet } from '@/ui/Sheet';
import { MedicalIdFacts, MedicalIdHeader } from './MedicalIdCard';
import type { MedicalId } from './medicalApi';

export function MedicalIdSheet({ record, onClose }: { record: MedicalId; onClose: () => void }) {
    return (
        <Sheet
            onClose={onClose}
            top={96}
            title={t('medical.title', 'Medical ID')}
            forceDark
            zIndex={90}
            className="bg-base"
        >
            {() => (
                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-1">
                    <MedicalIdHeader record={record} />
                    <div className="mt-4">
                        <MedicalIdFacts record={record} />
                    </div>
                    <p className="px-3 pt-5 text-center text-[13px] leading-snug text-ios-gray">
                        {t('medical.lockNote', 'Shown without unlocking this phone.')}
                    </p>
                </div>
            )}
        </Sheet>
    );
}
