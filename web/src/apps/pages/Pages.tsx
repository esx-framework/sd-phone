import { useState } from 'react';

import { apiData } from '@/core/api';
import { fetchNui, isFiveM } from '@/core/nui';
import { t } from '@/i18n';
import { useSessionState } from '@/hooks/useSessionState';
import { useDidEnter } from '@/hooks/useDidEnter';
import { AlertDialog } from '@/ui/AlertDialog';
import { POSTS, type Post, type PostDraft } from './data';
import { PagesListTab } from './PagesListTab';
import { YourPostsTab } from './YourPostsTab';
import { CreateEntryPage } from '@/apps/_classifieds/CreateEntryPage';
import { ListingDetail } from '@/apps/_classifieds/ListingDetail';
import { useClassifiedsFeed } from '@/apps/_classifieds/useClassifiedsFeed';
import { useContactActions } from '@/apps/_classifieds/useContactActions';
import { PagesTabBar, type PagesTab } from './PagesTabBar';
import { SchedulePickerSheet } from '@/shared/SchedulePickerSheet';
import { StatusBarSpacer } from '@/ui/StatusBarSpacer';

export function Pages({ onClose: _onClose }: { onClose: () => void }) {
    const [tab,      setTab]      = useSessionState<PagesTab>('pages:tab', 'browse');
    const [creating, setCreating] = useSessionState('pages:creating', false);
    const [editing,  setEditing]  = useSessionState<Post | null>('pages:editing', null);
    const [confirmDelete, setConfirmDelete] = useState<Post | null>(null);
    const [retiming, setRetiming] = useState<Post | null>(null);
    const [openId,   setOpenId]   = useSessionState<string | null>('pages:openPost', null);
    const [posts,    setPosts]    = useClassifiedsFeed<Post>(
        'sd-phone:pages:list', 'sd-phone:pages:feed', 'sd-phone:pages:watch', 'posts', isFiveM ? [] : POSTS,
        rid => { setOpenId(cur => (cur === rid ? null : cur)); setEditing(cur => (cur?.id === rid ? null : cur)); },
    );
    const open = posts.find(p => p.id === openId) ?? null;
    const contact = useContactActions();

    const animateNav = useDidEnter();

    function addPost(draft: PostDraft) {
        setCreating(false);
        setTab('posts');
        if (!isFiveM) {
            const post: Post = {
                id:     'new-' + Date.now(),
                title:  draft.title,
                body:   draft.body,
                price:  draft.price,
                image:  draft.image,
                images: draft.images,
                number: draft.number || '0000000000',
                email:  draft.email,
                mine:   true,
                publishAt: draft.publishAt,
            };
            setPosts(prev => [post, ...prev]);
            return;
        }
        apiData<{ post: Post }>('sd-phone:pages:create', draft)
            .then(data => { if (data) setPosts(prev => [data.post, ...prev]); })
            .catch(() => {});
    }

    function updatePost(id: string, draft: PostDraft) {
        const wasScheduled = posts.some(p => p.id === id && p.publishAt != null);
        setEditing(null);
        setPosts(prev => prev.map(p => p.id === id ? {
            ...p,
            title:  draft.title,
            body:   draft.body,
            price:  draft.price,
            image:  draft.image,
            images: draft.images,
            number: draft.number || p.number,
            email:  draft.email,
            publishAt: wasScheduled ? draft.publishAt : p.publishAt,
        } : p));
        if (!isFiveM) return;
        apiData<{ post: Post }>('sd-phone:pages:update', { id, ...draft })
            .then(data => { if (data) setPosts(prev => prev.map(p => p.id === id ? data.post : p)); })
            .catch(() => {});
    }

    function reschedulePost(id: string, at: number) {
        setPosts(prev => prev.map(p => p.id === id ? { ...p, publishAt: at } : p));
        if (!isFiveM) return;
        apiData<{ post: Post }>('sd-phone:pages:reschedule', { id, publishAt: at })
            .then(data => { if (data) setPosts(prev => prev.map(p => p.id === id ? data.post : p)); })
            .catch(() => {});
    }

    function publishPostNow(id: string) {
        setPosts(prev => prev.map(p => p.id === id ? { ...p, publishAt: undefined } : p));
        if (!isFiveM) return;
        apiData<{ post: Post }>('sd-phone:pages:publishNow', { id })
            .then(data => { if (data) setPosts(prev => prev.map(p => p.id === id ? data.post : p)); })
            .catch(() => {});
    }

    function deletePost(id: string) {
        setPosts(prev => prev.filter(p => p.id !== id));
        if (isFiveM) void fetchNui('sd-phone:pages:delete', { id });
    }

    function callPoster(p: Post) {
        contact.call(p.number, p.mine);
    }
    function messagePoster(p: Post) {
        contact.message(p.number, p.mine);
    }
    function emailPoster(p: Post) {
        contact.email(p.email ?? '', p.mine);
    }

    return (
        <div className="absolute inset-0 flex flex-col bg-base font-sf">
            <StatusBarSpacer />

            <div className="flex flex-1 flex-col overflow-hidden">
                <div key={tab} className="flex min-h-0 flex-1 flex-col animate-swipe-in-left">
                    {tab === 'browse'
                        ? <PagesListTab posts={posts} onCreate={() => setCreating(true)} onOpen={p => setOpenId(p.id)} onMessage={messagePoster} onCall={callPoster} onEmail={emailPoster} onDelete={setConfirmDelete} />
                        : <YourPostsTab posts={posts} onCreate={() => setCreating(true)} onOpen={p => setOpenId(p.id)} onDelete={setConfirmDelete}
                            onEdit={setEditing} onRetime={setRetiming} onPublishNow={p => publishPostNow(p.id)} />}
                </div>
            </div>

            <PagesTabBar tab={tab} onChange={setTab} />

            {creating && (
                <CreateEntryPage pageTitle={t('pages.newPost','New Post')} backLabel={t('pages.pages','Pages')} bodyPlaceholder={t('pages.bodyPlaceholder',"What's your post about?")} showPrice={false}
                    allowSchedule draftKey="pages:createDraft" animateIn={animateNav}
                    onCancel={() => setCreating(false)} onCreate={addPost} />
            )}

            {open && (
                <ListingDetail
                    item={open}
                    backLabel={tab === 'browse' ? t('pages.pages','Pages') : t('pages.yourPosts','Your Posts')}
                    itemNoun={t('pages.post','Post')}
                    onBack={() => setOpenId(null)}
                    onMessage={() => messagePoster(open)}
                    onCall={() => callPoster(open)}
                    onEmail={() => emailPoster(open)}
                    onEdit={() => setEditing(open)}
                    onDelete={() => { deletePost(open.id); setOpenId(null); }}
                    animateIn={animateNav}
                />
            )}

            {editing && (
                <CreateEntryPage pageTitle={t('pages.editPost','Edit Post')} submitLabel={t('pages.save','Save')} backLabel={t('pages.post','Post')} showPrice={false}
                    bodyPlaceholder={t('pages.bodyPlaceholder',"What's your post about?")} initial={editing}
                    allowSchedule={editing.publishAt != null}
                    draftKey="pages:editDraft" animateIn={animateNav}
                    onCancel={() => setEditing(null)} onCreate={draft => updatePost(editing.id, draft)} />
            )}

            {retiming && (
                <SchedulePickerSheet
                    at={retiming.publishAt ?? null}
                    onPick={at => reschedulePost(retiming.id, at)}
                    onClose={() => setRetiming(null)}
                />
            )}

            {contact.dialog}

            {confirmDelete && (
                <AlertDialog
                    title={confirmDelete.publishAt != null
                        ? t('pages.cancelPostTitle','Cancel Post?')
                        : t('pages.removePostTitle','Remove Post?')}
                    message={confirmDelete.publishAt != null
                        ? t('pages.cancelPostMessage','This will discard the post, and it will never go live.')
                        : t('pages.removePostMessage','This will permanently remove your post.')}
                    confirmLabel={confirmDelete.publishAt != null
                        ? t('pages.discard','Discard')
                        : t('pages.remove','Remove')}
                    destructive
                    onCancel={() => setConfirmDelete(null)}
                    onConfirm={() => { deletePost(confirmDelete.id); setConfirmDelete(null); }}
                />
            )}
        </div>
    );
}
