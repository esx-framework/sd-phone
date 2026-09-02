
import { t } from '@/i18n';
import { formatClockTime, formatMediumDate, relTimeCompact } from '@/lib/time';
import type { MsgKind, Reaction } from '@/shared/chat/data';
import seedPhoto1 from '@/assets/photos/background7.webp';
import seedPhoto2 from '@/assets/photos/background12.webp';
import seedPhoto3 from '@/assets/photos/background15.webp';
import seedPhoto4 from '@/assets/photos/background20.webp';

export type BirdyVerifiedType = 'blue' | 'gold' | 'grey';

export interface BirdyAuthor {
    name:     string;
    handle:   string;
    verified: boolean;
    verifiedType?: BirdyVerifiedType;
    avatar?:  string;
}

export interface BirdyProfile {
    name:         string;
    handle:       string;
    verified:     boolean;
    verifiedType?: BirdyVerifiedType;
    bio:          string;
    joined:       string;
    following:    number;
    followers:    number;
    protected:    boolean;
    avatar?:      string;
    banner?:      string;
    isMe?:        boolean;
    isFollowing?: boolean;
}

export interface BirdyFollowUser {
    name:        string;
    handle:      string;
    verified:    boolean;
    verifiedType?: BirdyVerifiedType;
    bio:         string;
    avatar?:     string;
    followsYou:  boolean;
    isFollowing: boolean;
}

export interface BirdyPollOption {
    idx:   number;
    label: string;
    votes: number;
}

export interface BirdyPoll {
    options: BirdyPollOption[];
    total:   number;
    endsAt:  number;
    ended:   boolean;
    myVote:  number | null;
}

export type BirdyPollCounts = Omit<BirdyPoll, 'myVote'>;

export const MAX_POLL_OPTIONS = 4;
export const MAX_POLL_OPTION_LENGTH = 40;

export const POLL_DURATIONS = { '1h': 3600, '1d': 86400, '3d': 259200, '7d': 604800 } as const;

export type PollDurationKey = keyof typeof POLL_DURATIONS;

export type PollDuration = typeof POLL_DURATIONS[PollDurationKey];

export interface BirdyPost {
    id:        string;
    author:    BirdyAuthor;
    body:      string;
    createdAt: number;
    replies:   number;
    reposts:   number;
    reposted?: boolean;
    likes:     number;
    liked:     boolean;
    images?:   string[];
    poll?:     BirdyPoll;
    views?:    number;
    thread?:   BirdyPost[];
    repostedBy?: { handle: string; name: string; avatar?: string };
}

export const postKey = (p: BirdyPost): string =>
    p.repostedBy ? `${p.id}@${p.repostedBy.handle}` : p.id;

export const BLUE   = 'rgb(var(--ios-blue))';
export const BRAND  = '#1d9bf0';
export const BRAND_DIM = '#0c4165';
export const META   = 'rgb(var(--ios-gray))';
export const LIKE   = '#f91880';
export const REPOST = '#00ba7c';
export const BG     = 'rgb(var(--base))';
export const CARD   = 'rgb(var(--surface))';
export const PILL   = 'rgb(var(--control))';
export const TEXT   = 'rgb(var(--label))';
export const LINE   = 'rgb(var(--hairline) / 0.12)';
export const LINE_STRONG = 'rgb(var(--hairline) / 0.25)';
export const AVATAR_EMPTY = '#5b6671';

export const CURRENT_USER: BirdyAuthor = { name: 'Renata Salas',      handle: 'renata_ls', verified: true, verifiedType: 'blue' };
export const MARCUS:       BirdyAuthor = { name: 'Kilo Tire & Wheel', handle: 'kilotire',  verified: true, verifiedType: 'gold' };
export const TOMMY:        BirdyAuthor = { name: 'Deb Karras',        handle: 'debkarras', verified: true, verifiedType: 'grey' };

export const MAX_POST_LENGTH = 280;

const HOUR = 3_600_000;
const MIN  = 60_000;

const SHOP_REPLY: BirdyPost = {
    id:        'reply-1',
    author:    MARCUS,
    body:      'we are ten minutes off that exit and open till eight, for anyone who gives up and pulls off',
    createdAt: Date.now() - 2 * HOUR,
    replies:   0,
    reposts:   0,
    likes:     2,
    liked:     false,
};

const NEIGHBOUR_REPLY: BirdyPost = {
    id:        'reply-2',
    author:    TOMMY,
    body:      'took the 68 to get around it and lost the same hour anyway',
    createdAt: Date.now() - 95 * MIN,
    replies:   0,
    reposts:   0,
    likes:     1,
    liked:     true,
};

export const SEED_POSTS: BirdyPost[] = [
    {
        id:        'seed-1',
        author:    TOMMY,
        body:      'Grey husky slipped his collar by the Route 68 turnoff last night. He answers to Bandit and he is chipped. Message me if you see him. #LostDog',
        createdAt: Date.now() - 40 * MIN,
        replies:   0,
        reposts:   6,
        likes:     14,
        liked:     true,
        views:     231,
        images:    [seedPhoto3],
        repostedBy: { handle: MARCUS.handle, name: MARCUS.name },
    },
    {
        id:        'seed-2',
        author:    CURRENT_USER,
        body:      'Southbound Del Perro Freeway is one lane again and nobody has said why. Twenty minutes to clear the on ramp. #LSTraffic',
        createdAt: Date.now() - 3 * HOUR,
        replies:   2,
        reposts:   1,
        likes:     9,
        liked:     false,
        views:     147,
        thread:    [SHOP_REPLY, NEIGHBOUR_REPLY],
    },
    {
        id:        'seed-poll-live',
        author:    MARCUS,
        body:      'Shop is open one extra night a week from next month. Which night do you actually want?',
        createdAt: Date.now() - 4 * HOUR,
        replies:   1,
        reposts:   0,
        likes:     7,
        liked:     false,
        views:     186,
        poll: {
            options: [
                { idx: 0, label: 'Thursday', votes: 12 },
                { idx: 1, label: 'Friday',   votes: 31 },
                { idx: 2, label: 'Sunday',   votes: 9 },
            ],
            total:  52,
            endsAt: Date.now() + 20 * HOUR,
            ended:  false,
            myVote: null,
        },
    },
    {
        id:        'seed-poll-ended',
        author:    TOMMY,
        body:      'Settled it then. Best late food in Del Perro?',
        createdAt: Date.now() - 5 * 24 * HOUR,
        replies:   0,
        reposts:   3,
        likes:     22,
        liked:     true,
        views:     914,
        poll: {
            options: [
                { idx: 0, label: 'The pier taco cart', votes: 88 },
                { idx: 1, label: 'Burger Shot',        votes: 41 },
                { idx: 2, label: 'That noodle window', votes: 63 },
                { idx: 3, label: 'Anything still open', votes: 17 },
            ],
            total:  209,
            endsAt: Date.now() - 2 * 24 * HOUR,
            ended:  true,
            myVote: 2,
        },
    },
    {
        id:        'seed-3',
        author:    MARCUS,
        body:      'Two tires and an alignment, out the door inside the hour. Corner of Innocence and Roy Lowenstein, cash or card. #LSTraffic',
        createdAt: Date.now() - 6 * HOUR,
        replies:   0,
        reposts:   0,
        likes:     4,
        liked:     true,
        views:     58,
    },
    {
        id:        'seed-4',
        author:    CURRENT_USER,
        body:      'City hall says the pier deck reopens in June. They said June last year as well. #DelPerro',
        createdAt: Date.now() - 11 * HOUR,
        replies:   0,
        reposts:   2,
        likes:     18,
        liked:     false,
        views:     402,
        images:    [seedPhoto2, seedPhoto4, seedPhoto1],
    },
];

export type BirdyNotification =
    | { id: string; kind: 'reply';  post: BirdyPost }
    | { id: string; kind: 'like';   user: BirdyAuthor; text: string; post?: BirdyPost }
    | { id: string; kind: 'repost'; user: BirdyAuthor; text: string; post?: BirdyPost }
    | { id: string; kind: 'post';   user: BirdyAuthor; text: string; post?: BirdyPost }
    | { id: string; kind: 'follow'; user: BirdyAuthor };

export const SEED_NOTIFICATIONS: BirdyNotification[] = [
    { id: 'n1', kind: 'reply',  post: SHOP_REPLY },
    { id: 'n2', kind: 'like',   user: TOMMY,  text: 'liked your post',     post: SEED_POSTS[1] },
    { id: 'n3', kind: 'repost', user: MARCUS, text: 'reposted your post',  post: SEED_POSTS[5] },
    { id: 'n4', kind: 'follow', user: MARCUS },
    { id: 'n5', kind: 'follow', user: TOMMY },
];

export interface BirdyMessage {
    id:     string;
    fromMe: boolean;
    body:   string;
    at:     string;
    ts?:    number;
    kind?:  MsgKind;
    gifUrl?:    string;
    amount?:    number;
    requested?: boolean;
    duration?:  number;
    audioUrl?:  string;
    waveform?:  number[];
    wpCode?:    string;
    wpSub?:     string;
    reactions?: Reaction[];
    replyTo?:   { name: string; body: string };
}

export interface BirdyConversation {
    id:       string;
    user:     BirdyAuthor;
    updated:  string;
    unread?:  number;
    messages: BirdyMessage[];
}

export const SEED_CONVERSATIONS: BirdyConversation[] = [
    {
        id:      'c1',
        user:    MARCUS,
        updated: '2h',
        unread:  2,
        messages: [
            { id: 'm1', fromMe: false, body: 'your rims came in on the morning truck',           at: '15:04', ts: Date.now() - 2 * HOUR },
            { id: 'm2', fromMe: false, body: 'we can fit them today if you get here before six', at: '15:06', ts: Date.now() - 2 * HOUR + 2 * MIN },
        ],
    },
    {
        id:      'c2',
        user:    TOMMY,
        updated: '1d',
        messages: [
            { id: 'm3', fromMe: false, body: 'any chance the husky came down your street last night', at: 'Yesterday', ts: Date.now() - 27 * HOUR },
            { id: 'm4', fromMe: true,  body: 'not that i saw, i was at the pier until late',          at: 'Yesterday', ts: Date.now() - 27 * HOUR + 3 * MIN },
            { id: 'm5', fromMe: false, body: 'someone said the gas station on the 68, driving out',   at: 'Yesterday', ts: Date.now() - 27 * HOUR + 9 * MIN },
            { id: 'm6', fromMe: true,  body: 'good luck, i will keep an eye out this end',            at: 'Yesterday', ts: Date.now() - 27 * HOUR + 11 * MIN },
        ],
    },
];

let seq = 0;
export function newId(prefix = 'id'): string {
    seq += 1;
    return `${prefix}-${Date.now()}-${seq}`;
}

export function relativeTime(from: number, now: number = Date.now()): string {
    return relTimeCompact(from, { now, nowLabel: t('squawk.now', 'now') });
}

export function absoluteTime(ms: number): string {
    const d = new Date(ms);
    return `${formatClockTime(d, true)} · ${formatMediumDate(d)}`;
}
