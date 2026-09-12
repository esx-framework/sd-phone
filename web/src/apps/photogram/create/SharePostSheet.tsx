import { useState } from 'react';
import { Check } from 'lucide-react';

import { t } from '@/i18n';
import { useAsyncData } from '@/hooks/useAsyncData';
import { Sheet } from '@/ui/Sheet';
import { SearchBar } from '@/ui/SearchBar';
import { IG, type Post } from '../data';
import { apiDmList, apiSearch, apiSharePost, type FollowUser } from '../photogramApi';
import { VerifiedCheck } from '../ui';

interface Person { handle: string; avatar: string; verified?: boolean; name?: string }

export function SharePostSheet({ post, onClose }: { post: Post; onClose: () => void }) {
    const [query,    setQuery]    = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const [sent,     setSent]     = useState(false);

    const { data: convos } = useAsyncData(apiDmList, []);
    const q = query.trim();
    const { data: results } = useAsyncData<FollowUser[]>(() => apiSearch(q), [q], { enabled: q.length > 0 });

    const people: Person[] = q
        ? (results ?? []).map(u => ({ handle: u.handle, avatar: u.avatar, verified: u.verified, name: u.name }))
        : (convos ?? []).map(c => ({ handle: c.user.handle, avatar: c.user.avatar, verified: c.user.verified }));

    function toggle(handle: string) {
        setSelected(prev => prev.includes(handle) ? prev.filter(h => h !== handle) : [...prev, handle]);
    }

    function send(close: () => void) {
        if (selected.length === 0 || sent) return;
        setSent(true);
        void apiSharePost(selected, { id: post.id, image: post.images[0] ?? '', avatar: post.user.avatar, author: post.user.handle, caption: post.caption });
        window.setTimeout(close, 450);
    }

    return (
        <Sheet onClose={onClose} className="font-sf bg-[#f2f2f2]">
            {({ close }) => (
                <>
                    <div className="px-4 pb-2.5 pt-[22px] text-center text-[20px] font-bold text-black">{t('photogram.share', 'Share')}</div>
                    <div className="shrink-0 px-4 pb-2">
                        <SearchBar
                            value={query}
                            onChange={setQuery}
                            placeholder={t('photogram.search', 'Search')}
                            pillClassName="gap-2.5 rounded-[12px] bg-[#e7e7e9] px-3.5 py-2.5"
                            iconClassName="h-[20px] w-[20px] text-[#737373]"
                            textClassName="text-[18px] text-black placeholder:text-[#8e8e8e]"
                        />
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
                        {people.length === 0 ? (
                            <div className="px-8 pt-12 text-center text-[16px] text-black/45">
                                {query.trim() ? t('photogram.noAccountsFound', 'No accounts found.') : t('photogram.noConversationsSearch', 'No conversations yet, search to find people.')}
                            </div>
                        ) : people.map(p => {
                            const on = selected.includes(p.handle);
                            return (
                                <button key={p.handle} type="button" onClick={() => toggle(p.handle)} className="flex w-full items-center gap-4 px-4 py-3 text-start active:bg-black/5">
                                    <img src={p.avatar} alt="" draggable={false} className="h-[62px] w-[62px] shrink-0 rounded-full object-cover" />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span dir="auto" className="truncate text-[19px] font-semibold text-black">{p.handle}</span>
                                            {p.verified && <VerifiedCheck size={19} />}
                                        </div>
                                        {p.name && <div dir="auto" className="truncate text-[16px]" style={{ color: IG.sub }}>{p.name}</div>}
                                    </div>
                                    <span
                                        className={`flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${on ? 'border-transparent' : 'border-black/25'}`}
                                        style={on ? { background: IG.blue } : undefined}
                                    >
                                        {on && <Check className="h-[18px] w-[18px] text-white" strokeWidth={3} />}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="shrink-0 px-4 pb-8 pt-2">
                        <button
                            type="button"
                            disabled={selected.length === 0 || sent}
                            onClick={() => send(close)}
                            className="w-full rounded-[12px] py-3.5 text-[18px] font-semibold text-white transition-opacity disabled:opacity-40"
                            style={{ background: IG.blue }}
                        >
                            {sent ? t('common.sent', 'Sent') : selected.length > 1 ? t('photogram.sendCount', 'Send ({count})', { count: selected.length }) : t('photogram.send', 'Send')}
                        </button>
                    </div>
                </>
            )}
        </Sheet>
    );
}
