import { SquarePen, Store } from 'lucide-react';

import { EmptyState } from '@/ui/EmptyState';
import { ListingCard } from '@/apps/_classifieds/ListingCard';
import { ScheduledRow } from '@/shared/ScheduledRow';
import { type Listing } from './data';
import { t } from '@/i18n';

export function YourPostsTab({ listings, onCreate, onOpen, onDelete, onEdit, onRetime, onPublishNow }: {
    listings: Listing[];
    onCreate: () => void;
    onOpen:   (listing: Listing) => void;
    onDelete: (listing: Listing) => void;
    onEdit:   (listing: Listing) => void;
    onRetime: (listing: Listing) => void;
    onPublishNow: (listing: Listing) => void;
}) {
    const mine = listings.filter(l => l.mine);
    const queued = mine
        .filter(l => l.publishAt != null)
        .sort((a, b) => (a.publishAt ?? 0) - (b.publishAt ?? 0));
    const live = mine.filter(l => l.publishAt == null);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-5 pb-1 pt-1">
                <h1 className="text-[28px] font-bold tracking-tight text-black dark:text-white">{t('marketplace.yourPosts','Your Posts')}</h1>
                <button type="button" aria-label={t('marketplace.createListing','Create listing')} onClick={onCreate} className="text-ios-blue active:opacity-60">
                    <SquarePen className="h-[24px] w-[24px]" strokeWidth={2} />
                </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-4 pb-6 pt-1">
                {queued.length > 0 && (
                    <div className="mb-5">
                        <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ios-gray">
                            {t('marketplace.scheduled','Scheduled')}
                        </h2>
                        <div className="flex flex-col gap-3">
                            {queued.map(l => (
                                <ScheduledRow
                                    key={l.id}
                                    title={l.title}
                                    body={l.body}
                                    publishAt={l.publishAt ?? 0}
                                    onOpen={() => onEdit(l)}
                                    onEdit={() => onEdit(l)}
                                    onRetime={() => onRetime(l)}
                                    onPublishNow={() => onPublishNow(l)}
                                    onCancel={() => onDelete(l)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {mine.length === 0 ? (
                    <EmptyState icon={Store} title={t('marketplace.noListingsYet','No Listings Yet')}
                        subtitle={t('marketplace.noListingsPostsSubtitle','Listings you create show up here. Tap the pencil to sell something.')} />
                ) : (
                    <div className="flex flex-col gap-3">
                        {live.map(l => <ListingCard key={l.id} item={l} subject="seller" onOpen={() => onOpen(l)} onDelete={() => onDelete(l)} />)}
                    </div>
                )}
            </div>
        </div>
    );
}
