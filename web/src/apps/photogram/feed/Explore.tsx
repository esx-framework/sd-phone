import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

import { t } from '@/i18n';
import { IG, type Post } from '../data';
import { MediaThumb } from '../create/Media';
import { apiSearch, type FollowUser } from '../photogramApi';
import { VerifiedCheck } from '../ui';

export function Explore({ posts, onOpen, onOpenProfile }: {
    posts:          Post[];
    onOpen:         (post: Post) => void;
    onOpenProfile:  (handle: string) => void;
}) {
    const [query,   setQuery]   = useState('');
    const [results, setResults] = useState<FollowUser[] | null>(null);
    const q = query.trim();
    const searching = q.length > 0;

    useEffect(() => {
        if (!searching) { setResults(null); return; }
        let alive = true;
        setResults(null);
        const timer = window.setTimeout(() => {
            void apiSearch(q).then(u => { if (alive) setResults(u); });
        }, 250);
        return () => { alive = false; window.clearTimeout(timer); };
    }, [q, searching]);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="px-3.5 pb-2 pt-0.5">
                <div className="flex items-center gap-2 rounded-[10px] bg-black/[0.06] px-3 py-2">
                    <Search className="h-[16px] w-[16px] text-black/45" strokeWidth={2.6} />
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={t('photogram.searchPeople', 'Search people')}
                        spellCheck={false}
                        autoCapitalize="off"
                        autoCorrect="off"
                        className="min-w-0 flex-1 bg-transparent text-[15px] text-black outline-none placeholder:text-black/40"
                    />
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
                {searching ? (
                    results === null ? null : results.length === 0 ? (
                        <div className="flex flex-col items-center px-8 pt-20 text-center">
                            <div className="text-[20px] font-semibold text-black">{t('photogram.noPeopleFound', 'No people found')}</div>
                            <div className="mt-1.5 text-[16px] leading-snug text-black/55">{t('photogram.noPeopleMatch', 'No accounts match “{q}”. Try a different name.', { q })}</div>
                        </div>
                    ) : (
                        <div className="animate-swipe-in-left">
                            {results.map(u => <SearchRow key={u.handle} u={u} onOpenProfile={onOpenProfile} />)}
                        </div>
                    )
                ) : posts.length === 0 ? (
                    <div className="flex flex-col items-center px-8 pt-20 text-center">
                        <div className="text-[20px] font-semibold text-black">{t('photogram.searchForPeople', 'Search for people')}</div>
                        <div className="mt-1.5 text-[16px] leading-snug text-black/55">{t('photogram.searchForPeopleDesc', 'Find friends and creators by username above. Photos from across the city will also show up here.')}</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-[2px]">
                        {posts.map(p => (
                            <button key={p.id} type="button" onClick={() => onOpen(p)} className="aspect-square active:opacity-80">
                                <MediaThumb url={p.images[0]} className="h-full w-full" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function SearchRow({ u, onOpenProfile }: { u: FollowUser; onOpenProfile: (handle: string) => void }) {
    return (
        <button
            type="button"
            onClick={() => onOpenProfile(u.handle)}
            className="flex w-full items-center gap-4 px-4 py-4 text-start active:opacity-70"
        >
            <img src={u.avatar} alt="" draggable={false} className="h-[76px] w-[76px] shrink-0 rounded-full object-cover" />
            <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                    <span dir="auto" className="truncate text-[24px] font-semibold text-black">{u.handle}</span>
                    {u.verified && <VerifiedCheck size={24} />}
                </div>
                {u.name && <div dir="auto" className="truncate text-[19px]" style={{ color: IG.sub }}>{u.name}</div>}
            </div>
        </button>
    );
}
