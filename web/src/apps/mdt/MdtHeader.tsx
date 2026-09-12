import { t } from '@/i18n';
import { ContactAvatar } from '@/shared/ContactAvatar';
import { Pill } from '@/ui/Pill';
import { colorFor, initialsFor } from '@/lib/format';
import { DepartmentSeal } from './DepartmentSeal';
import { MDT_ACCENT, mdtRuleX } from './mdtTheme';
import { useMdtSession } from './useMdtSession';

export function MdtHeader({ compact = false }: { compact?: boolean }) {
    const { me, department, open } = useMdtSession();

    const accent = department?.accent ?? MDT_ACCENT;
    const deptName = department?.label ?? t('mdt.departmentFallback', 'Department Terminal');

    return (
        <div className="shrink-0">
            <div className="flex items-center gap-3.5 px-6 pb-3.5 pt-1">
                <DepartmentSeal seal={department?.seal} accent={accent} size={44} />

                <div className="flex min-w-0 flex-col">
                    <h1 className="min-w-0 truncate text-[19px] font-semibold leading-tight tracking-tight text-black dark:text-white">
                        {deptName}
                    </h1>
                    <span className="min-w-0 truncate text-[12px] font-semibold uppercase tracking-[0.09em] text-ios-gray">
                        {department?.type === 'ems'
                            ? t('mdt.terminalNameEms', 'Mobile Medical Terminal')
                            : department?.type === 'doj'
                                ? t('mdt.terminalNameDoj', 'Court Records Terminal')
                                : t('mdt.terminalName', 'Mobile Police Terminal')}
                    </span>
                </div>

                <span className="flex-1" />

                {me && (
                    <button
                        type="button"
                        onClick={() => open('employees', me.citizenid)}
                        aria-label={t('mdt.openMyRecord', 'Open my personnel record')}
                        className="flex shrink-0 items-center gap-3 rounded-[12px] px-2 py-1 transition-colors duration-150 hover:bg-black/[0.04] active:bg-black/[0.07] dark:hover:bg-white/[0.06] dark:active:bg-white/[0.09]"
                    >
                        {me.callsign && <Pill tone="green">{me.callsign}</Pill>}

                        {!compact && (
                            <span className="flex min-w-0 flex-col items-end">
                                <span className="min-w-0 max-w-[220px] truncate text-[15px] font-semibold leading-tight text-black dark:text-white">
                                    {me.name}
                                </span>
                                <span className="min-w-0 max-w-[220px] truncate text-[12.5px] font-medium text-ios-gray">
                                    {me.rank}
                                </span>
                            </span>
                        )}

                        <span className="relative flex shrink-0">
                            <ContactAvatar
                                size={40}
                                contact={{
                                    name:     me.name,
                                    initials: initialsFor(me.name),
                                    color:    colorFor(me.citizenid),
                                    avatar:   me.avatar,
                                }}
                            />
                            <span
                                aria-label={me.duty ? t('mdt.onDuty', 'On Duty') : t('mdt.offDuty', 'Off Duty')}
                                className={`absolute -bottom-px -end-px h-3 w-3 rounded-full ring-2 ring-base ${me.duty ? 'bg-ios-green' : 'bg-ios-gray3'}`}
                            />
                        </span>
                    </button>
                )}
            </div>

            <div className={mdtRuleX} />
        </div>
    );
}
