import { SearchX, SquarePen, Store } from 'lucide-react';

import { useSessionState } from '@/hooks/useSessionState';
import { t } from '@/i18n';
import { SearchBar } from '@/ui/SearchBar';
import { EmptyState } from '@/ui/EmptyState';
import { ListingCard } from '@/apps/_classifieds/ListingCard';
import { type Listing } from './data';

export function MarketplaceListTab({ listings, onCreate, onOpen, onMessage, onCall, onEmail, onDelete }: {
    listings:  Listing[];
    onCreate:  () => void;
    onOpen:    (listing: Listing) => void;
    onMessage: (listing: Listing) => void;
    onCall:    (listing: Listing) => void;
    onEmail:   (listing: Listing) => void;
    onDelete:  (listing: Listing) => void;
}) {
    const [query, setQuery] = useSessionState('marketplace:search', '');

    const q = query.trim().toLowerCase();
    const listed = listings.filter(l => l.publishAt == null);
    const list = q
        ? listed.filter(l =>
            l.title.toLowerCase().includes(q) ||
            l.body.toLowerCase().includes(q) ||
            l.number.replace(/\D/g, '').includes(q.replace(/\D/g, '')))
        : listed;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-5 pb-1 pt-1">
                <h1 className="text-[28px] font-bold tracking-tight text-black dark:text-white">{t('marketplace.marketplace','Marketplace')}</h1>
                <button type="button" aria-label={t('marketplace.createListing','Create listing')} onClick={onCreate} className="text-ios-blue active:opacity-60">
                    <SquarePen className="h-[24px] w-[24px]" strokeWidth={2} />
                </button>
            </div>

            <SearchBar value={query} onChange={setQuery} placeholder={t('marketplace.searchPlaceholder','Find a listing or a seller')} className="mx-4 mb-2 mt-1" />

            <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-4 pb-6">
                {list.length === 0 ? (
                    q
                        ? <EmptyState icon={SearchX} title={t('marketplace.noResults','No Results')} subtitle={t('marketplace.noResultsSubtitle','No listings match “{query}”.',{query:query.trim()})} />
                        : <EmptyState icon={Store} title={t('marketplace.noListingsYet','No Listings Yet')} subtitle={t('marketplace.noListingsHomeSubtitle','Listings from around the city show up here. Tap the pencil to sell something.')} />
                ) : (
                    <div className="flex flex-col gap-3">
                        {list.map(l => (
                            <ListingCard
                                key={l.id}
                                item={l}
                                subject="seller"
                                onOpen={() => onOpen(l)}
                                onMessage={() => onMessage(l)}
                                onCall={() => onCall(l)}
                                onEmail={l.email ? () => onEmail(l) : undefined}
                                onDelete={l.mine ? () => onDelete(l) : undefined}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
