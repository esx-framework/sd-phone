import { useEffect, useState } from 'react';
import { Crosshair, Plus, Search } from 'lucide-react';

import { device } from '@device';
import { getLocaleTag, t } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { ListColumn } from '@/ui/ListColumn';
import { MasterDetail } from '@/ui/MasterDetail';
import { Pager } from '@/ui/Pager';
import { Pill } from '@/ui/Pill';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useSessionState } from '@/hooks/useSessionState';

import { SerialChip, WEAPON_TONE, WeaponRecord, WeaponRegister, weaponClassLabel, weaponStatusLabel } from './WeaponRecord';
import { mdtWeapons } from './mdtApi';
import { useMdtSession } from './useMdtSession';
import { mdtRowHover, mdtRowMeta, mdtRowTitle, mdtSegmentedDense } from './mdtTheme';
import { WEAPON_STATUSES, type WeaponRow, type WeaponStatus } from './data';
import { MdtButton } from './ui/MdtButton';

const NEW_REF = 'new';
const IS_PHONE = device.id === 'phone';

type StatusFilter = 'all' | WeaponStatus;

function registeredOn(stamp: number): string {
    if (!stamp) return '';
    return new Date(stamp * 1000).toLocaleDateString(getLocaleTag(), { day: 'numeric', month: 'short', year: 'numeric' });
}

function WeaponListRow({ weapon, selected, onPress }: {
    weapon:   WeaponRow;
    selected: boolean;
    onPress:  () => void;
}) {
    const name  = weapon.name || t('mdt.unknownWeapon', 'Unknown firearm');
    const owner = weapon.ownerName || t('mdt.noWeaponOwner', 'No registered owner');
    const meta  = `${weaponClassLabel(weapon.class)} · ${owner}`;

    const marks = (
        <>
            {weapon.bolo && <Pill tone="orange">{t('mdt.bolo', 'BOLO')}</Pill>}
            <Pill tone={WEAPON_TONE[weapon.status] ?? 'green'}>{weaponStatusLabel(weapon.status)}</Pill>
        </>
    );

    const surface = `w-full rounded-[10px] px-3 py-2.5 text-left ${
        selected ? 'bg-ios-blue/10' : mdtRowHover
    }`;

    if (IS_PHONE) {
        return (
            <button type="button" onClick={onPress} className={surface}>
                <span className="flex min-w-0 items-center gap-2">
                    <SerialChip serial={weapon.serial} />
                    <span className="flex-1" />
                    <span className="flex shrink-0 items-center gap-1.5">{marks}</span>
                </span>
                <span className={`mt-1.5 block truncate ${mdtRowTitle}`}>{name}</span>
                <span className={`mt-0.5 block truncate ${mdtRowMeta}`}>{meta}</span>
            </button>
        );
    }

    return (
        <button type="button" onClick={onPress} className={`flex items-center gap-3 ${surface}`}>
            <SerialChip serial={weapon.serial} />
            <span className="min-w-0 flex-1">
                <span className={`block truncate ${mdtRowTitle}`}>{name}</span>
                <span className={`block truncate ${mdtRowMeta}`}>{meta}</span>
            </span>
            <span className={`hidden shrink-0 tabular-nums sm:block ${mdtRowMeta}`}>
                {registeredOn(weapon.registeredAt)}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">{marks}</span>
        </button>
    );
}

export function WeaponsPane() {
    const { selected, select, can } = useMdtSession();

    const [query, setQuery]   = useSessionState('mdt:weapons:query', '');
    const [status, setStatus] = useSessionState<StatusFilter>('mdt:weapons:status', 'all');
    const [page, setPage]     = useSessionState('mdt:weapons:page', 1);
    const [term, setTerm]     = useState(query.trim());

    useEffect(() => {
        const id = window.setTimeout(() => setTerm(query.trim()), 250);
        return () => window.clearTimeout(id);
    }, [query]);

    useEffect(() => { setPage(1); }, [term, status, setPage]);

    const { data, loading, settled, refetch } = useAsyncData(
        () => mdtWeapons({ query: term, status, page }),
        [term, status, page],
    );

    const rows     = data?.rows ?? [];
    const total    = data?.total ?? 0;
    const pageSize = data?.pageSize ?? 25;

    const canRegister = can('weapons.edit');
    const registering = selected === NEW_REF;

    const empty = (
        <EmptyState
            center
            icon={Search}
            title={loading
                ? t('mdt.loading', 'Loading')
                : term ? t('mdt.noMatches', 'No matches') : t('mdt.noWeapons', 'No firearms on the registry')}
            subtitle={loading
                ? undefined
                : term ? t('mdt.noWeaponMatch', 'No firearm on the registry matches that search.') : undefined}
        />
    );

    const statusOptions = [
        { value: 'all' as StatusFilter, label: IS_PHONE ? t('mdt.anyStatus', 'Any status') : t('common.all', 'All') },
        ...WEAPON_STATUSES.map(s => ({ value: s as StatusFilter, label: weaponStatusLabel(s) })),
    ];

    const master = (
        <ListColumn
            className="flex-1"
            title={t('mdt.weapons', 'Weapons')}
            count={total}
            query={query}
            onQuery={setQuery}
            placeholder={t('mdt.searchWeapons', 'Serial, firearm or owner')}
            action={canRegister ? (
                <MdtButton
                    size="sm"
                    icon={<Plus className="h-[13px] w-[13px]" strokeWidth={3} />}
                    onClick={() => select(NEW_REF)}
                >
                    {t('mdt.register', 'Register')}
                </MdtButton>
            ) : undefined}
            isEmpty={settled && rows.length === 0}
            empty={empty}
            footer={<Pager page={data?.page ?? page} pageSize={pageSize} total={total} onPage={setPage} />}
            minWidth={IS_PHONE ? 0 : undefined}
        >
            {IS_PHONE ? (
                <div className="px-3 pb-2">
                    <Select<StatusFilter>
                        value={status}
                        onChange={setStatus}
                        size="sm"
                        ariaLabel={t('mdt.weaponStatusLabel', 'Registry status')}
                        options={statusOptions}
                    />
                </div>
            ) : (
                <div className="px-1 pb-1">
                    <SegmentedControl<StatusFilter>
                        className={mdtSegmentedDense}
                        value={status}
                        onChange={setStatus}
                        options={statusOptions}
                    />
                </div>
            )}
            <div className="mdt-stagger flex flex-col gap-0.5">
                {rows.map(row => (
                    <WeaponListRow
                        key={row.serial}
                        weapon={row}
                        selected={row.serial === selected}
                        onPress={() => select(row.serial)}
                    />
                ))}
            </div>
        </ListColumn>
    );

    const detail = registering
        ? (
            <WeaponRegister
                onRegistered={serial => { refetch(); select(serial); }}
                onCancel={() => select(null)}
            />
        )
        : selected ? <WeaponRecord key={selected} serial={selected} /> : undefined;

    return (
        <MasterDetail
            master={master}
            detail={detail}
            placeholder={(
                <EmptyState
                    center
                    icon={Crosshair}
                    title={t('mdt.pickWeaponRecord', 'No firearm selected')}
                    subtitle={t('mdt.pickWeaponRecordSub', 'Pick a firearm from the list, or run a serial number, to see its registry record.')}
                />
            )}
            onCloseDetail={() => select(null)}
            backLabel={t('mdt.weapons', 'Weapons')}
        />
    );
}
