import { useState } from 'react';

import { apiData } from '@/core/api';
import { fetchNui, isFiveM } from '@/core/nui';
import { t } from '@/i18n';
import { useSessionState } from '@/hooks/useSessionState';
import { useDidEnter } from '@/hooks/useDidEnter';
import { AlertDialog } from '@/ui/AlertDialog';
import { LISTINGS, type Listing, type ListingDraft } from './data';
import { MarketplaceListTab } from './MarketplaceListTab';
import { YourPostsTab } from './YourPostsTab';
import { CreateEntryPage } from '@/apps/_classifieds/CreateEntryPage';
import { ListingDetail } from '@/apps/_classifieds/ListingDetail';
import { useClassifiedsFeed } from '@/apps/_classifieds/useClassifiedsFeed';
import { useContactActions } from '@/apps/_classifieds/useContactActions';
import { MarketplaceTabBar, type MarketTab } from './MarketplaceTabBar';
import { SchedulePickerSheet } from '@/shared/SchedulePickerSheet';
import { StatusBarSpacer } from '@/ui/StatusBarSpacer';

export function Marketplace({ onClose: _onClose }: { onClose: () => void }) {
    const [tab,      setTab]      = useSessionState<MarketTab>('marketplace:tab', 'home');
    const [creating, setCreating] = useSessionState('marketplace:creating', false);
    const [editing,  setEditing]  = useSessionState<Listing | null>('marketplace:editing', null);
    const [confirmDelete, setConfirmDelete] = useState<Listing | null>(null);
    const [retiming, setRetiming] = useState<Listing | null>(null);
    const [openId,   setOpenId]   = useSessionState<string | null>('marketplace:openListing', null);
    const [listings, setListings] = useClassifiedsFeed<Listing>(
        'sd-phone:marketplace:list', 'sd-phone:marketplace:feed', 'sd-phone:marketplace:watch', 'listings', isFiveM ? [] : LISTINGS,
        rid => { setOpenId(cur => (cur === rid ? null : cur)); setEditing(cur => (cur?.id === rid ? null : cur)); },
    );
    const open = listings.find(l => l.id === openId) ?? null;
    const contact = useContactActions();

    const animateNav = useDidEnter();

    function addListing(draft: ListingDraft) {
        setCreating(false);
        setTab('posts');
        if (!isFiveM) {
            const listing: Listing = {
                id:     'new-' + Date.now(),
                title:  draft.title,
                body:   draft.body,
                price:  draft.price,
                image:  draft.image,
                images: draft.images,
                number: draft.number || '0000000000',
                email:  draft.email,
                date:   'Just now',
                mine:   true,
                publishAt: draft.publishAt,
            };
            setListings(prev => [listing, ...prev]);
            return;
        }
        apiData<{ listing: Listing }>('sd-phone:marketplace:create', draft)
            .then(data => { if (data) setListings(prev => [data.listing, ...prev]); })
            .catch(() => {});
    }

    function updateListing(id: string, draft: ListingDraft) {
        const wasScheduled = listings.some(l => l.id === id && l.publishAt != null);
        setEditing(null);
        setListings(prev => prev.map(l => l.id === id ? {
            ...l,
            title:  draft.title,
            body:   draft.body,
            price:  draft.price,
            image:  draft.image,
            images: draft.images,
            number: draft.number || l.number,
            email:  draft.email,
            publishAt: wasScheduled ? draft.publishAt : l.publishAt,
        } : l));
        if (!isFiveM) return;
        apiData<{ listing: Listing }>('sd-phone:marketplace:update', { id, ...draft })
            .then(data => { if (data) setListings(prev => prev.map(l => l.id === id ? data.listing : l)); })
            .catch(() => {});
    }

    function rescheduleListing(id: string, at: number) {
        setListings(prev => prev.map(l => l.id === id ? { ...l, publishAt: at } : l));
        if (!isFiveM) return;
        apiData<{ listing: Listing }>('sd-phone:marketplace:reschedule', { id, publishAt: at })
            .then(data => { if (data) setListings(prev => prev.map(l => l.id === id ? data.listing : l)); })
            .catch(() => {});
    }

    function publishListingNow(id: string) {
        setListings(prev => prev.map(l => l.id === id ? { ...l, publishAt: undefined } : l));
        if (!isFiveM) return;
        apiData<{ listing: Listing }>('sd-phone:marketplace:publishNow', { id })
            .then(data => { if (data) setListings(prev => prev.map(l => l.id === id ? data.listing : l)); })
            .catch(() => {});
    }

    function deleteListing(id: string) {
        setListings(prev => prev.filter(l => l.id !== id));
        if (isFiveM) void fetchNui('sd-phone:marketplace:delete', { id });
    }

    function callPoster(l: Listing) {
        contact.call(l.number, l.mine);
    }
    function messagePoster(l: Listing) {
        contact.message(l.number, l.mine);
    }
    function emailPoster(l: Listing) {
        contact.email(l.email ?? '', l.mine);
    }

    return (
        <div className="absolute inset-0 flex flex-col bg-base font-sf">
            <StatusBarSpacer />

            <div className="flex flex-1 flex-col overflow-hidden">
                <div key={tab} className="flex min-h-0 flex-1 flex-col animate-swipe-in-left">
                    {tab === 'home'
                        ? <MarketplaceListTab listings={listings} onCreate={() => setCreating(true)} onOpen={l => setOpenId(l.id)} onMessage={messagePoster} onCall={callPoster} onEmail={emailPoster} onDelete={setConfirmDelete} />
                        : <YourPostsTab listings={listings} onCreate={() => setCreating(true)} onOpen={l => setOpenId(l.id)} onDelete={setConfirmDelete}
                            onEdit={setEditing} onRetime={setRetiming} onPublishNow={l => publishListingNow(l.id)} />}
                </div>
            </div>

            <MarketplaceTabBar tab={tab} onChange={setTab} />

            {creating && (
                <CreateEntryPage pageTitle={t('marketplace.newListing','New Listing')} backLabel={t('marketplace.marketplace','Marketplace')} bodyPlaceholder={t('marketplace.sellingPlaceholder','What are you selling?')}
                    allowSchedule draftKey="marketplace:createDraft" animateIn={animateNav}
                    onCancel={() => setCreating(false)} onCreate={addListing} />
            )}

            {open && (
                <ListingDetail
                    item={open}
                    backLabel={tab === 'home' ? t('marketplace.home','Home') : t('marketplace.yourPosts','Your Posts')}
                    itemNoun={t('marketplace.listing','Listing')}
                    onBack={() => setOpenId(null)}
                    onMessage={() => messagePoster(open)}
                    onCall={() => callPoster(open)}
                    onEmail={() => emailPoster(open)}
                    onEdit={() => setEditing(open)}
                    onDelete={() => { deleteListing(open.id); setOpenId(null); }}
                    animateIn={animateNav}
                />
            )}

            {editing && (
                <CreateEntryPage pageTitle={t('marketplace.editListing','Edit Listing')} submitLabel={t('marketplace.save','Save')} backLabel={t('marketplace.listing','Listing')}
                    bodyPlaceholder={t('marketplace.sellingPlaceholder','What are you selling?')} initial={editing}
                    allowSchedule={editing.publishAt != null}
                    draftKey="marketplace:editDraft" animateIn={animateNav}
                    onCancel={() => setEditing(null)} onCreate={draft => updateListing(editing.id, draft)} />
            )}

            {retiming && (
                <SchedulePickerSheet
                    at={retiming.publishAt ?? null}
                    onPick={at => rescheduleListing(retiming.id, at)}
                    onClose={() => setRetiming(null)}
                />
            )}

            {contact.dialog}

            {confirmDelete && (
                <AlertDialog
                    title={confirmDelete.publishAt != null
                        ? t('marketplace.cancelListingTitle','Cancel Listing?')
                        : t('marketplace.removeListingTitle','Remove Listing?')}
                    message={confirmDelete.publishAt != null
                        ? t('marketplace.cancelListingMessage','This will discard the listing, and it will never go live.')
                        : t('marketplace.removeListingMessage','This will permanently remove your listing.')}
                    confirmLabel={confirmDelete.publishAt != null
                        ? t('marketplace.discard','Discard')
                        : t('marketplace.remove','Remove')}
                    destructive
                    onCancel={() => setConfirmDelete(null)}
                    onConfirm={() => { deleteListing(confirmDelete.id); setConfirmDelete(null); }}
                />
            )}
        </div>
    );
}
