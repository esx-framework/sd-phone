import { apiData } from '@/core/api';
import { isFiveM } from '@/core/nui';

export interface MedicalId {
    citizenid:     string;
    name:          string;
    dob:           string;
    bloodType:     string;
    allergies:     string;
    conditions:    string;
    medications:   string;
    notes:         string;
    organDonor:    boolean;
    contactName:   string;
    contactNumber: string;
    showOnLock:    boolean;
    updatedAt:     number;
}

export type MedicalField = 'allergies' | 'conditions' | 'medications' | 'notes';

export type MedicalPatch = Partial<Pick<
    MedicalId,
    MedicalField | 'organDonor' | 'contactName' | 'contactNumber' | 'showOnLock'
>>;

export const MEDICAL_LIMITS: Record<MedicalField | 'contactName' | 'contactNumber', number> = {
    allergies:     200,
    conditions:    200,
    medications:   200,
    notes:         300,
    contactName:   60,
    contactNumber: 20,
};

let devRecord: MedicalId = {
    citizenid:     'ABC12345',
    name:          'Samuel Black',
    dob:           '1994-03-08',
    bloodType:     'O+',
    allergies:     'Penicillin, shellfish',
    conditions:    'Type 1 diabetes, asthma',
    medications:   'Insulin (Lantus), salbutamol inhaler',
    notes:         'Insulin pump on left hip. Carries glucose gel in jacket pocket.',
    organDonor:    true,
    contactName:   'Bree Larsen',
    contactNumber: '(213) 555-0192',
    showOnLock:    true,
    updatedAt:     Math.floor(Date.now() / 1000) - 86400,
};

function devLookup(citizenid: string): MedicalId {
    return {
        ...devRecord,
        citizenid,
        name:          'Jane Doe',
        dob:           '1988-11-21',
        bloodType:     'AB-',
        allergies:     'Latex',
        conditions:    'Epilepsy',
        medications:   'Levetiracetam 500mg',
        notes:         'Seizure history, most recent episode two months ago.',
        organDonor:    false,
        contactName:   'Carl Jensen',
        contactNumber: '(310) 555-0123',
    };
}

export async function apiMedicalId(): Promise<MedicalId | null> {
    if (!isFiveM) return { ...devRecord };
    return (await apiData<{ record: MedicalId }>('sd-phone:medical:get'))?.record ?? null;
}

export async function apiSaveMedicalId(patch: MedicalPatch): Promise<MedicalId | null> {
    if (!isFiveM) {
        devRecord = { ...devRecord, ...patch, updatedAt: Math.floor(Date.now() / 1000) };
        return { ...devRecord };
    }
    return (await apiData<{ record: MedicalId }>('sd-phone:medical:set', patch))?.record ?? null;
}

export async function apiMedicalLookup(citizenid: string): Promise<MedicalId | null> {
    if (!isFiveM) return devLookup(citizenid);
    return (await apiData<{ record: MedicalId }>('sd-phone:medical:lookup', { citizenid }))?.record ?? null;
}
