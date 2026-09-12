import { t } from '@/i18n';
import { IG } from '../data';
import { type ActivityItem, type FollowUser } from '../photogramApi';
import { SwipeToDismiss } from '../create/SwipeToDismiss';
import { VerifiedCheck } from '../ui';

export function Activity({ items, requests, onRespond, onOpenProfile, onOpenPost, onDismiss }: {
    items:         ActivityItem[];
    requests:      FollowUser[];
    onRespond:     (handle: string, accept: boolean) => void;
    onOpenProfile: (handle: string) => void;
    onOpenPost:    (postId: string) => void;
    onDismiss:     (id: string) => void;
}) {
    const notifs = items.filter(n => n.kind !== 'follow_request');

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <h1 className="px-4 pb-0.5 pt-0.5 text-[27px] font-bold tracking-tight text-black">{t('photogram.notifications', 'Notifications')}</h1>
            <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-4 pt-1">
                {requests.length > 0 && (
                    <>
                        <h2 className="pb-1 pt-2 text-[18px] font-semibold text-black">{t('photogram.followRequests', 'Follow Requests')}</h2>
                        {requests.map(r => (
                            <div key={r.handle} className="flex items-center gap-4 py-3">
                                <button type="button" onClick={() => onOpenProfile(r.handle)} className="shrink-0 active:opacity-70">
                                    <img src={r.avatar} alt="" draggable={false} className="h-[66px] w-[66px] rounded-full object-cover" />
                                </button>
                                <div className="min-w-0 flex-1 leading-snug">
                                    <div className="flex items-center gap-1.5">
                                        <span dir="auto" className="text-[19px] font-semibold text-black">{r.handle}</span>
                                        {r.verified && <VerifiedCheck size={20} />}
                                    </div>
                                    {r.name && <div dir="auto" className="truncate text-[16px]" style={{ color: IG.sub }}>{r.name}</div>}
                                </div>
                                <button type="button" onClick={() => onRespond(r.handle, true)} className="shrink-0 rounded-[10px] px-4 py-2.5 text-[16px] font-semibold text-white active:opacity-80" style={{ background: IG.blue }}>
                                    {t('photogram.confirm', 'Confirm')}
                                </button>
                                <button type="button" onClick={() => onRespond(r.handle, false)} className="shrink-0 rounded-[10px] bg-black/[0.06] px-4 py-2.5 text-[16px] font-semibold text-black active:opacity-70">
                                    {t('photogram.delete', 'Delete')}
                                </button>
                            </div>
                        ))}
                        <div className="my-1 h-px bg-black/[0.06]" />
                    </>
                )}

                {notifs.length === 0 && requests.length === 0 ? (
                    <div className="flex flex-col items-center px-8 pt-20 text-center">
                        <div className="text-[20px] font-semibold text-black">{t('photogram.noActivityYet', 'No activity yet')}</div>
                        <div className="mt-1.5 text-[16px] leading-snug text-black/55">{t('photogram.noActivityDesc', "When people like, comment on, or follow you, you'll see it here.")}</div>
                    </div>
                ) : notifs.map(n => (
                    <SwipeToDismiss key={n.id} onDismiss={() => onDismiss(n.id)}>
                        <div className="flex items-center gap-4 bg-[#f2f2f2] py-3">
                            <button type="button" onClick={() => onOpenProfile(n.user.handle)} className="shrink-0 active:opacity-70">
                                <img src={n.user.avatar} alt="" draggable={false} className="h-[66px] w-[66px] rounded-full object-cover" />
                            </button>
                            <p className="min-w-0 flex-1 text-[19px] leading-snug text-black">
                                <button type="button" onClick={() => onOpenProfile(n.user.handle)} className="font-semibold active:opacity-60">{n.user.handle}</button>{' '}
                                {n.text}{' '}
                                <span style={{ color: IG.sub }}>{n.time}</span>
                            </p>
                            {n.thumb ? (
                                <button type="button" onClick={() => n.postId && onOpenPost(n.postId)} className="shrink-0 active:opacity-80">
                                    <img src={n.thumb} alt="" draggable={false} className="h-[66px] w-[66px] rounded-[4px] object-cover" />
                                </button>
                            ) : (n.kind === 'follow' || n.kind === 'follow_accept') ? (
                                <button type="button" onClick={() => onOpenProfile(n.user.handle)} className="shrink-0 rounded-[10px] px-5 py-2.5 text-[17px] font-semibold text-white active:opacity-80" style={{ background: IG.blue }}>
                                    {t('photogram.view', 'View')}
                                </button>
                            ) : null}
                        </div>
                    </SwipeToDismiss>
                ))}
            </div>
        </div>
    );
}
