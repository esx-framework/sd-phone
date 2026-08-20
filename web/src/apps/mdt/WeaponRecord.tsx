import { useState, type ReactNode } from 'react';
import { ClipboardList, Crosshair, ShieldAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { getLocaleTag, t } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { ToggleRow } from '@/ui/ListGroup';
import { Pill, type PillTone } from '@/ui/Pill';
import { Scroller } from '@/ui/Scroller';
import { useAsyncData } from '@/hooks/useAsyncData';

import { mdtRegisterWeapon, mdtUpdateWeapon, mdtWeapon } from './mdtApi';
import { useMdtSession } from './useMdtSession';
import { mdtPanePad, mdtRuleX, mdtSectionHeader } from './mdtTheme';
import { MdtButton } from './ui/MdtButton';
import { MdtCard } from './ui/MdtCard';
import { MdtField } from './ui/MdtField';
import {
    WEAPON_CLASSES, WEAPON_STATUSES,
    type WeaponClass, type WeaponDetail, type WeaponStatus,
} from './data';

const MAX_NOTES = 2000;
const MAX_SERIAL = 32;
const MAX_NAME = 96;

export const WEAPON_TONE: Record<WeaponStatus, PillTone> = {
    registered: 'green',
    stolen:     'red',
    seized:     'orange',
    destroyed:  'blue',
};

export function weaponStatusLabel(status: string): string {
    switch (status) {
        case 'registered': return t('mdt.weaponRegistered', 'Registered');
        case 'stolen':     return t('mdt.weaponStolen', 'Stolen');
        case 'seized':     return t('mdt.weaponSeized', 'Seized');
        case 'destroyed':  return t('mdt.weaponDestroyed', 'Destroyed');
        default:           return status;
    }
}

export function weaponClassLabel(weaponClass: string): string {
    switch (weaponClass) {
        case 'pistol':  return t('mdt.weaponPistol', 'Pistol');
        case 'smg':     return t('mdt.weaponSmg', 'Submachine gun');
        case 'rifle':   return t('mdt.weaponRifle', 'Rifle');
        case 'shotgun': return t('mdt.weaponShotgun', 'Shotgun');
        case 'sniper':  return t('mdt.weaponSniper', 'Sniper rifle');
        case 'melee':   return t('mdt.weaponMelee', 'Melee');
        default:        return t('mdt.weaponOther', 'Other');
    }
}

export function SerialChip({ serial, large }: { serial: string; large?: boolean }) {
    return (
        <span
            className={`inline-flex min-w-0 max-w-full items-center truncate rounded-[6px] border border-black/15 bg-elevated font-bold uppercase tabular-nums tracking-[0.08em] text-black dark:border-white/20 dark:bg-base/50 dark:text-white ${
                large ? 'px-3 py-1.5 text-[19px]' : 'px-2 py-1 text-[13px]'
            }`}
        >
            {serial}
        </span>
    );
}

function Section({ title, icon: Icon, action, children }: {
    title:    string;
    icon:     LucideIcon;
    action?:  ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 px-1">
                <Icon className="h-[15px] w-[15px] shrink-0 text-ios-gray" strokeWidth={2.2} />
                <span className={`flex-1 ${mdtSectionHeader}`}>{title}</span>
                {action}
            </div>
            <MdtCard className="overflow-hidden">{children}</MdtCard>
        </div>
    );
}

function Fact({ label, value, onPress }: { label: string; value?: string | number | null; onPress?: () => void }) {
    const shown = value === 0 ? '0' : value;
    const text = shown && shown !== '' ? String(shown) : t('mdt.notOnFile', 'Not on file');
    return (
        <div className="min-w-0">
            <div className="text-[12px] uppercase tracking-wide text-ios-gray">{label}</div>
            {onPress ? (
                <button
                    type="button"
                    onClick={onPress}
                    className="block max-w-full truncate text-left text-[15px] font-medium text-ios-blue active:opacity-60"
                >
                    {text}
                </button>
            ) : (
                <div className="truncate text-[15px] font-medium text-black dark:text-white">{text}</div>
            )}
        </div>
    );
}

function dateOf(stamp: number | null): string {
    if (!stamp) return '';
    return new Date(stamp * 1000).toLocaleDateString(getLocaleTag(), {
        day: 'numeric', month: 'short', year: 'numeric',
    });
}

const CLASS_OPTIONS = WEAPON_CLASSES.map(c => ({ value: c, label: weaponClassLabel(c) }));
const STATUS_OPTIONS = WEAPON_STATUSES.map(s => ({ value: s, label: weaponStatusLabel(s) }));

interface Draft {
    status:     WeaponStatus;
    owner:      string;
    bolo:       boolean;
    ballistics: boolean;
    notes:      string;
}

function draftOf(weapon: WeaponDetail): Draft {
    return {
        status:     WEAPON_STATUSES.find(s => s === weapon.status) ?? 'registered',
        owner:      weapon.owner ?? '',
        bolo:       weapon.bolo,
        ballistics: weapon.ballistics,
        notes:      weapon.notes,
    };
}

export function WeaponRecord({ serial }: { serial: string }) {
    const { can, open } = useMdtSession();

    const [weapon, setWeapon] = useState<WeaponDetail | null>(null);
    const [draft, setDraft]   = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError]   = useState('');

    const { loading } = useAsyncData(() => mdtWeapon(serial), [serial], {
        onData: next => { setWeapon(next); setDraft(draftOf(next)); },
    });

    const editable = can('weapons.edit');

    if (!weapon || !draft) {
        if (loading) {
            return (
                <div className="flex flex-col gap-3 p-6">
                    <div className="h-20 animate-shimmer rounded-[16px] bg-black/[0.06] dark:bg-white/[0.06]" />
                    <div className="h-36 animate-shimmer rounded-[16px] bg-black/[0.06] dark:bg-white/[0.06]" />
                    <div className="h-52 animate-shimmer rounded-[16px] bg-black/[0.06] dark:bg-white/[0.06]" />
                </div>
            );
        }
        return (
            <EmptyState
                center
                icon={Crosshair}
                title={t('mdt.serialUnavailable', 'Serial not on the registry')}
                subtitle={t('mdt.serialUnavailableSub', 'No firearm is registered on that serial, or you do not have access to it.')}
            />
        );
    }

    const dirty = draft.status !== weapon.status
        || draft.owner !== (weapon.owner ?? '')
        || draft.bolo !== weapon.bolo
        || draft.ballistics !== weapon.ballistics
        || draft.notes !== weapon.notes;

    function patch(part: Partial<Draft>) {
        setDraft(prev => (prev ? { ...prev, ...part } : prev));
    }

    async function save() {
        if (!weapon || !draft || saving) return;
        setSaving(true);
        setError('');
        const next = await mdtUpdateWeapon(weapon.serial, {
            status:     draft.status,
            owner:      draft.owner.trim(),
            bolo:       draft.bolo,
            ballistics: draft.ballistics,
            notes:      draft.notes,
        });
        setSaving(false);
        if (!next) { setError(t('mdt.weaponSaveFailed', 'That could not be saved.')); return; }
        setWeapon(next);
        setDraft(draftOf(next));
    }

    const saveBar = editable && dirty ? (
        <span className="flex items-center gap-3">
            <MdtButton size="sm" onClick={() => { setError(''); setDraft(draftOf(weapon)); }}>
                {t('common.cancel', 'Cancel')}
            </MdtButton>
            <MdtButton size="sm" variant="filled" disabled={saving} onClick={() => void save()}>
                {t('common.save', 'Save')}
            </MdtButton>
        </span>
    ) : undefined;

    return (
        <Scroller className={`h-full ${mdtPanePad}`}>
            <div className="flex flex-wrap items-center gap-3">
                <SerialChip large serial={weapon.serial} />
                <h1 className="min-w-0 flex-1 truncate text-[26px] font-bold tracking-ios-display text-black dark:text-white">
                    {weapon.name || t('mdt.unknownWeapon', 'Unknown firearm')}
                </h1>
                <span className="flex shrink-0 items-center gap-1.5">
                    {weapon.bolo && <Pill tone="orange">{t('mdt.bolo', 'BOLO')}</Pill>}
                    {weapon.ballistics && <Pill tone="blue">{t('mdt.ballistics', 'Ballistics')}</Pill>}
                    <Pill tone={WEAPON_TONE[weapon.status] ?? 'green'}>{weaponStatusLabel(weapon.status)}</Pill>
                </span>
            </div>

            <div className="mt-6 grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
                <Section title={t('mdt.weaponRegistration', 'Registration')} icon={ClipboardList}>
                    <div className="grid gap-4 p-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                        <Fact label={t('mdt.serial', 'Serial number')} value={weapon.serial} />
                        <Fact label={t('mdt.weaponName', 'Firearm')} value={weapon.name} />
                        <Fact label={t('mdt.weaponClass', 'Class')} value={weaponClassLabel(weapon.class)} />
                        <Fact
                            label={t('mdt.registeredOwner', 'Registered owner')}
                            value={weapon.ownerName || weapon.owner}
                            onPress={weapon.owner ? () => open('profiles', weapon.owner) : undefined}
                        />
                        <Fact label={t('mdt.registeredOn', 'Registered')} value={dateOf(weapon.registeredAt)} />
                        <Fact label={t('mdt.registeredBy', 'Registered by')} value={weapon.registeredBy} />
                    </div>
                </Section>

                <Section title={t('mdt.firearmsRecord', 'Firearms record')} icon={ShieldAlert} action={saveBar}>
                    {editable ? (
                        <>
                            <div className="grid gap-4 p-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                                <MdtField
                                    label={t('mdt.weaponStatusLabel', 'Registry status')}
                                    value={draft.status}
                                    onChange={v => patch({ status: v as WeaponStatus })}
                                    options={STATUS_OPTIONS}
                                />
                                <MdtField
                                    label={t('mdt.registeredOwner', 'Registered owner')}
                                    value={draft.owner}
                                    onChange={v => patch({ owner: v.slice(0, 64) })}
                                    placeholder={t('mdt.citizenIdPlaceholder', 'Citizen ID')}
                                    hint={t('mdt.weaponOwnerHint', 'Leave empty for a firearm recovered with no owner on file.')}
                                />
                            </div>
                            <div className={mdtRuleX} />
                            <ToggleRow
                                divider
                                label={t('mdt.boloActive', 'BOLO active')}
                                on={draft.bolo}
                                onToggle={() => patch({ bolo: !draft.bolo })}
                            />
                            <ToggleRow
                                divider
                                label={t('mdt.ballisticsOnFile', 'Ballistics on file')}
                                on={draft.ballistics}
                                onToggle={() => patch({ ballistics: !draft.ballistics })}
                            />
                            <div className="p-4">
                                <MdtField
                                    multiline
                                    rows={4}
                                    label={t('mdt.weaponNotes', 'Notes')}
                                    value={draft.notes}
                                    onChange={v => patch({ notes: v })}
                                    maxLength={MAX_NOTES}
                                    placeholder={t('mdt.weaponNotesPlaceholder', 'Where it was recovered, what it is tied to, anything a unit should know before it turns up again.')}
                                />
                                {error && <div className="mt-3 text-[14px] text-ios-red">{error}</div>}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="grid gap-4 p-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                                <Fact label={t('mdt.weaponStatusLabel', 'Registry status')} value={weaponStatusLabel(weapon.status)} />
                                <Fact label={t('mdt.boloActive', 'BOLO active')} value={weapon.bolo ? t('common.yes', 'Yes') : t('common.no', 'No')} />
                                <Fact label={t('mdt.ballisticsOnFile', 'Ballistics on file')} value={weapon.ballistics ? t('common.yes', 'Yes') : t('common.no', 'No')} />
                            </div>
                            <div className={mdtRuleX} />
                            <div className="p-4">
                                <div className="mb-1 text-[12px] uppercase tracking-wide text-ios-gray">
                                    {t('mdt.weaponNotes', 'Notes')}
                                </div>
                                {weapon.notes ? (
                                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-black dark:text-white">
                                        {weapon.notes}
                                    </p>
                                ) : (
                                    <div className="text-[14px] text-ios-gray">
                                        {t('mdt.noWeaponNotes', 'No notes on this firearm.')}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </Section>
            </div>

            {weapon.updatedAt ? (
                <div className="mt-5 px-1 text-[13px] text-ios-gray">
                    {t('mdt.lastUpdated', 'Last updated {date}', { date: dateOf(weapon.updatedAt) })}
                </div>
            ) : null}
        </Scroller>
    );
}

interface RegisterDraft {
    serial: string;
    name:   string;
    class:  WeaponClass;
    owner:  string;
    notes:  string;
}

const BLANK: RegisterDraft = { serial: '', name: '', class: 'pistol', owner: '', notes: '' };

export function WeaponRegister({ onRegistered, onCancel }: {
    onRegistered: (serial: string) => void;
    onCancel:     () => void;
}) {
    const [draft, setDraft]   = useState<RegisterDraft>(BLANK);
    const [saving, setSaving] = useState(false);
    const [error, setError]   = useState('');

    function set<K extends keyof RegisterDraft>(key: K, value: RegisterDraft[K]) {
        setDraft(prev => ({ ...prev, [key]: value }));
    }

    async function submit() {
        if (saving) return;
        if (!draft.serial.trim() || !draft.name.trim()) {
            setError(t('mdt.weaponNeedsSerial', 'A serial number and a firearm are both required.'));
            return;
        }
        setSaving(true);
        setError('');
        const res = await mdtRegisterWeapon({
            serial: draft.serial.trim(),
            name:   draft.name.trim(),
            class:  draft.class,
            owner:  draft.owner.trim(),
            notes:  draft.notes,
        });
        setSaving(false);
        if (typeof res === 'string') {
            setError(res || t('mdt.weaponRegisterFailed', 'That could not be registered.'));
            return;
        }
        onRegistered(res.serial);
    }

    return (
        <Scroller className={`h-full ${mdtPanePad}`}>
            <h1 className="text-[26px] font-bold tracking-ios-display text-black dark:text-white">
                {t('mdt.registerWeapon', 'Register a firearm')}
            </h1>
            <div className="mt-1 text-[14px] text-ios-gray">
                {t('mdt.registerWeaponSub', 'The serial number is what every later lookup runs on, so take it from the frame rather than from memory.')}
            </div>

            <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <MdtField
                    label={t('mdt.serial', 'Serial number')}
                    value={draft.serial}
                    onChange={v => set('serial', v.toUpperCase().slice(0, MAX_SERIAL))}
                    placeholder="LS-0000-A"
                    maxLength={MAX_SERIAL}
                />
                <MdtField
                    label={t('mdt.weaponName', 'Firearm')}
                    value={draft.name}
                    onChange={v => set('name', v)}
                    placeholder={t('mdt.weaponNamePlaceholder', 'Combat Pistol')}
                    maxLength={MAX_NAME}
                />
                <MdtField
                    label={t('mdt.weaponClass', 'Class')}
                    value={draft.class}
                    onChange={v => set('class', v as WeaponClass)}
                    options={CLASS_OPTIONS}
                />
                <MdtField
                    label={t('mdt.registeredOwner', 'Registered owner')}
                    value={draft.owner}
                    onChange={v => set('owner', v.slice(0, 64))}
                    placeholder={t('mdt.citizenIdPlaceholder', 'Citizen ID')}
                    hint={t('mdt.weaponOwnerHint', 'Leave empty for a firearm recovered with no owner on file.')}
                />
            </div>

            <div className="mt-4">
                <MdtField
                    multiline
                    rows={5}
                    label={t('mdt.weaponNotes', 'Notes')}
                    value={draft.notes}
                    onChange={v => set('notes', v)}
                    maxLength={MAX_NOTES}
                    placeholder={t('mdt.weaponNotesPlaceholder', 'Where it was recovered, what it is tied to, anything a unit should know before it turns up again.')}
                />
            </div>

            {error && <div className="mt-4 text-[14px] text-ios-red">{error}</div>}

            <div className="mt-5 flex items-center gap-3 pb-6">
                <MdtButton variant="filled" disabled={saving} onClick={() => void submit()}>
                    {saving ? t('mdt.saving', 'Saving') : t('mdt.register', 'Register')}
                </MdtButton>
                <MdtButton onClick={onCancel}>{t('common.cancel', 'Cancel')}</MdtButton>
            </div>
        </Scroller>
    );
}
