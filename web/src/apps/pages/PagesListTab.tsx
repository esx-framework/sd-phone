import { Newspaper, SearchX, SquarePen } from 'lucide-react';

import { useSessionState } from '@/hooks/useSessionState';
import { t } from '@/i18n';
import { SearchBar } from '@/ui/SearchBar';
import { EmptyState } from '@/ui/EmptyState';
import { ListingCard } from '@/apps/_classifieds/ListingCard';
import { type Post } from './data';

export function PagesListTab({ posts, onCreate, onOpen, onMessage, onCall, onEmail, onDelete }: {
    posts:     Post[];
    onCreate:  () => void;
    onOpen:    (post: Post) => void;
    onMessage: (post: Post) => void;
    onCall:    (post: Post) => void;
    onEmail:   (post: Post) => void;
    onDelete:  (post: Post) => void;
}) {
    const [query, setQuery] = useSessionState('pages:search', '');

    const q = query.trim().toLowerCase();
    const listed = posts.filter(p => p.publishAt == null);
    const list = q
        ? listed.filter(p =>
            p.title.toLowerCase().includes(q) ||
            p.body.toLowerCase().includes(q) ||
            p.number.replace(/\D/g, '').includes(q.replace(/\D/g, '')))
        : listed;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-5 pb-1 pt-1">
                <h1 className="text-[34px] font-bold tracking-tight text-black dark:text-white">{t('pages.pages','Pages')}</h1>
                <button type="button" aria-label={t('pages.createPost','Create post')} onClick={onCreate} className="text-ios-blue active:opacity-60">
                    <SquarePen className="h-[24px] w-[24px]" strokeWidth={2} />
                </button>
            </div>

            <SearchBar value={query} onChange={setQuery} placeholder={t('pages.searchPlaceholder','Find a post or a poster')} className="mx-4 mb-2 mt-1" />

            <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-4 pb-6">
                {list.length === 0 ? (
                    q
                        ? <EmptyState icon={SearchX} title={t('pages.noResults','No Results')} subtitle={t('pages.noResultsSubtitle','No posts match “{query}”.',{query:query.trim()})} />
                        : <EmptyState icon={Newspaper} title={t('pages.noPostsYet','No Posts Yet')} subtitle={t('pages.noPostsBrowseSubtitle','Posts from around the city show up here. Tap the pencil to create one.')} />
                ) : (
                    <div className="flex flex-col gap-3">
                        {list.map(p => (
                            <ListingCard
                                key={p.id}
                                item={p}
                                subject="poster"
                                onOpen={() => onOpen(p)}
                                onMessage={() => onMessage(p)}
                                onCall={() => onCall(p)}
                                onEmail={p.email ? () => onEmail(p) : undefined}
                                onDelete={p.mine ? () => onDelete(p) : undefined}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
