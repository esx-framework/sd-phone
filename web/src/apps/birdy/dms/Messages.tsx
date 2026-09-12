import { useState } from 'react';
import { ArrowLeft, Mail, PenSquare, Search as SearchIcon } from 'lucide-react';

import { t } from '@/i18n';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useIosPush } from '@/hooks/useIosPush';
import { SearchBar } from '@/ui/SearchBar';
import { EmptyState } from '@/ui/EmptyState';
import { StatusBarSpacer } from '@/ui/StatusBarSpacer';
import { apiSearch } from '../birdyApi';
import { BG, BLUE, META, PILL, TEXT, type BirdyAuthor, type BirdyConversation, type BirdyMessage } from '../data';
import { Avatar, VerifiedBadge } from '../ui';

function previewText(m?: BirdyMessage): string {
    if (!m) return '';
    switch (m.kind) {
        case 'image':    return t('squawk.photoPreview', '📷 Photo');
        case 'gif':      return t('squawk.gif', 'GIF');
        case 'money':    return `$${m.amount ?? 0}`;
        case 'voice':    return t('squawk.voiceMessagePreview', '🎤 Voice message');
        case 'location': return t('squawk.locationPreview', '📍 Location');
        default:         return m.body;
    }
}

export function MessagesList({ me, conversations, onOpen, onOpenProfile, onCompose }: {
    me:            BirdyAuthor;
    conversations: BirdyConversation[];
    onOpen:        (id: string) => void;
    onOpenProfile: () => void;
    onCompose?:    (handle: string) => void;
}) {
    const [query, setQuery] = useState('');
    const [composing, setComposing] = useState(false);
    const q = query.trim().toLowerCase();
    const filtered = q
        ? conversations.filter(c => c.user.name.toLowerCase().includes(q) || c.user.handle.toLowerCase().includes(q))
        : conversations;

    return (
        <div className="flex h-full flex-col" style={{ background: BG }}>
            <header className="flex shrink-0 items-center px-4 py-2">
                <button type="button" onClick={onOpenProfile} aria-label={t('squawk.yourProfile', 'Your profile')}><Avatar size={44} src={me.avatar} /></button>
                <h1 className="flex-1 text-center text-[22px] font-extrabold text-label">{t('squawk.messages', 'Messages')}</h1>
                {onCompose ? (
                    <button type="button" onClick={() => setComposing(true)} aria-label={t('squawk.newMessage', 'New message')} className="flex h-11 w-11 items-center justify-center" style={{ color: BLUE }}>
                        <PenSquare className="h-[24px] w-[24px]" strokeWidth={2} />
                    </button>
                ) : (
                    <div className="w-11" aria-hidden />
                )}
            </header>

            <div className="shrink-0 px-4 pb-2 pt-1">
                <SearchBar
                    value={query}
                    onChange={setQuery}
                    placeholder={t('squawk.findAConversation', 'Find a conversation')}
                    pillClassName="min-w-0 flex-1 gap-2 rounded-[12px] px-3.5 py-[10px]"
                    pillStyle={{ background: PILL }}
                    iconClassName="h-[18px] w-[18px] text-label/55"
                    textClassName="text-[17px] font-medium text-label placeholder:text-label/55"
                    caretColor={BLUE}
                />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
                {conversations.length === 0 ? (
                    <EmptyState
                        center
                        icon={<Mail className="h-7 w-7" strokeWidth={1.8} />}
                        circleClassName="bg-hairline/[0.06] text-label/35"
                        title={t('squawk.noMessagesYet', 'No messages yet')}
                        subtitle={t('squawk.messagesEmptySubtitle', 'Your direct messages will show up here.')}
                        subtitleClassName="text-ios-gray"
                    />
                ) : filtered.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center px-12 text-center">
                        <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-hairline/[0.06] text-label/35">
                            <SearchIcon className="h-12 w-12" strokeWidth={1.8} />
                        </div>
                        <div className="text-[24px] font-bold text-label">{t('squawk.noResults', 'No results')}</div>
                        <div className="mt-2 text-[17px] leading-snug" style={{ color: META }}>{t('squawk.noConversationsMatch', 'No conversations match "{query}".', { query: query.trim() })}</div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 pt-1">
                        {filtered.map(c => {
                            const last   = c.messages[c.messages.length - 1];
                            const unread = (c.unread ?? 0) > 0;
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => onOpen(c.id)}
                                    className="flex w-full items-center gap-3.5 px-4 py-[14px] text-start active:bg-hairline/5"
                                >
                                    <Avatar size={64} src={c.user.avatar} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span dir="auto" className="truncate text-[21px] font-bold text-label">{c.user.name}</span>
                                            {c.user.verified && <VerifiedBadge size={18} type={c.user.verifiedType} />}
                                            <span dir="ltr" className="truncate text-[16px]" style={{ color: META }}>@{c.user.handle}</span>
                                            <span className="ms-auto shrink-0 text-[15px]" style={{ color: META }}>{c.updated}</span>
                                        </div>
                                        <div
                                            dir="auto"
                                            className={`mt-0.5 truncate text-[19px] ${unread ? 'font-semibold' : ''}`}
                                            style={{ color: unread ? TEXT : META }}
                                        >
                                            {previewText(last)}
                                        </div>
                                    </div>
                                    {unread && <span className="ms-1 shrink-0 h-[11px] w-[11px] rounded-full" style={{ background: BLUE }} aria-label={t('squawk.unread', 'Unread')} />}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {composing && onCompose && (
                <NewDm onSelect={h => { setComposing(false); onCompose(h); }} onBack={() => setComposing(false)} />
            )}
        </div>
    );
}

function NewDm({ onSelect, onBack }: { onSelect: (handle: string) => void; onBack: () => void }) {
    const { goBack, pageStyle } = useIosPush(onBack);
    const [query, setQuery] = useState('');
    const { data } = useAsyncData<BirdyAuthor[]>(() => apiSearch(query), [query]);
    const users = data ?? [];

    return (
        <div className="absolute inset-0 z-20 flex flex-col" style={{ background: BG, ...pageStyle }}>
            <StatusBarSpacer />
            <header className="flex shrink-0 items-center px-2 py-2">
                <button type="button" onClick={goBack} aria-label={t('squawk.back', 'Back')} className="flex h-11 w-11 items-center justify-center text-label active:opacity-60">
                    <ArrowLeft className="h-6 w-6" strokeWidth={2.2} />
                </button>
                <h1 className="flex-1 text-center text-[22px] font-extrabold text-label">{t('squawk.newMessage', 'New message')}</h1>
                <div className="w-11" aria-hidden />
            </header>

            <div className="shrink-0 px-4 pb-2 pt-1">
                <SearchBar
                    value={query}
                    onChange={setQuery}
                    placeholder={t('squawk.searchPeople', 'Search people')}
                    pillClassName="min-w-0 flex-1 gap-2 rounded-[12px] px-3.5 py-[10px]"
                    pillStyle={{ background: PILL }}
                    iconClassName="h-[18px] w-[18px] text-label/55"
                    textClassName="text-[17px] font-medium text-label placeholder:text-label/55"
                    caretColor={BLUE}
                />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
                {users.map(u => (
                    <button key={u.handle} type="button" onClick={() => onSelect(u.handle)} className="flex w-full items-center gap-3.5 px-4 py-3 text-start active:bg-hairline/5">
                        <Avatar size={48} src={u.avatar} />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                <span dir="auto" className="truncate text-[18px] font-bold text-label">{u.name}</span>
                                {u.verified && <VerifiedBadge size={16} type={u.verifiedType} />}
                            </div>
                            <div className="truncate text-[15px]" style={{ color: META }}><span dir="ltr">@{u.handle}</span></div>
                        </div>
                    </button>
                ))}
                {query.trim() !== '' && users.length === 0 && (
                    <div className="px-4 pt-10 text-center text-[15px]" style={{ color: META }}>{t('squawk.noResults', 'No results')}</div>
                )}
            </div>
        </div>
    );
}
