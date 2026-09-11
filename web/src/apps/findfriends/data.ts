import { readJson, writeJson } from '@/lib/storage';

export interface Friend {
    id:        string;
    name:      string;
    phone:     string;
    color:     string;
    avatar?:   string;
    youShare:  boolean;
    theyShare: boolean;
    pending?:  boolean;
    incoming?: boolean;
    x?:        number;
    y?:        number;
    updatedAt?: number;
    unavailable?: boolean;
}

const FRIENDS_KEY = 'sd-phone:friends:v1';

export const FRIEND_COLORS = [
    '#0a84ff', '#34c759', '#ff9f0a', '#ff375f', '#bf5af2',
    '#64d2ff', '#ffd60a', '#ff6482', '#5e5ce6', '#30d158',
];

export function loadFriends(): Friend[] {
    return readJson<Friend[]>(FRIENDS_KEY, Array.isArray) ?? DEFAULT_FRIENDS;
}

export function saveFriends(friends: Friend[]): void {
    writeJson(FRIENDS_KEY, friends);
}

const DEFAULT_FRIENDS: Friend[] = [
    { id: 'fr-ash',     name: 'Ash B',     phone: '555-0291', color: '#ff375f', youShare: false, theyShare: false, incoming: true },
    { id: 'fr-mia',     name: 'Mia Park',  phone: '555-0142', color: '#0a84ff', avatar: 'https://i.pravatar.cc/96?img=47', youShare: true, theyShare: true, x: 215, y: -810, updatedAt: Date.now() },
    { id: 'fr-deshawn', name: 'DeShawn R', phone: '555-0188', color: '#34c759', youShare: true,  theyShare: true,  x: -1290, y: -1490, updatedAt: Date.now() },
    { id: 'fr-toni',    name: 'Toni V',    phone: '555-0207', color: '#ff9f0a', youShare: false, theyShare: false },
    { id: 'fr-jordan',  name: 'Jordan K',  phone: '555-0233', color: '#bf5af2', youShare: true,  theyShare: false, pending: true },
];
