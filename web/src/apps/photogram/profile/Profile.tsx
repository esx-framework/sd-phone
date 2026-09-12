import { useState } from 'react';
import { Bookmark, Grid3x3, Lock, type LucideIcon } from 'lucide-react';

import { t } from '@/i18n';
import { useAsyncData } from '@/hooks/useAsyncData';
import { type Post } from '../data';
import { MediaThumb } from '../create/Media';
import { apiSaved, type ProfileView } from '../photogramApi';
import { VerifiedCheck } from '../ui';

export function fmtCount(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'm';
    if (n >= 1_000)     return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'k';
    return String(n);
}

type Grid = 'posts' | 'saved';

export function Profile({ profile, posts, onEdit, onOpenPost, onOpenFollows }: {
    profile:       ProfileView;
    posts:         Post[];
    onEdit:        () => void;
    onOpenPost:    (p: Post) => void;
    onOpenFollows: (handle: string, kind: 'followers' | 'following') => void;
}) {
    const [grid,  setGrid]  = useState<Grid>('posts');
    const { data: saved, loading } = useAsyncData(apiSaved, [grid], { enabled: grid === 'saved' });

    const list = grid === 'posts' ? posts : (saved ?? []);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-0.5">
                <div className="flex items-center gap-1.5">
                    {profile.isPrivate && <Lock className="h-[22px] w-[22px] text-black" strokeWidth={2.4} />}
                    <span dir="auto" className="text-[28px] font-bold text-black">{profile.username}</span>
                    {profile.verified && <VerifiedCheck size={26} />}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
                <div className="flex items-center gap-6 px-4 py-3">
                    <img src={profile.avatar} alt="" draggable={false} className="h-[108px] w-[108px] rounded-full object-cover" />
                    <div className="flex flex-1 justify-around text-center">
                        <Stat n={profile.posts} label={t('photogram.posts', 'Posts')} />
                        <Stat n={fmtCount(profile.followers)} label={t('photogram.followers', 'Followers')} onClick={() => onOpenFollows(profile.username, 'followers')} />
                        <Stat n={fmtCount(profile.following)} label={t('photogram.following', 'Following')} onClick={() => onOpenFollows(profile.username, 'following')} />
                    </div>
                </div>

                <div className="px-4 pb-4">
                    <div dir="auto" className="text-[21px] font-semibold text-black">{profile.name}</div>
                    {profile.bio !== '' && <div dir="auto" className="mt-1 whitespace-pre-line text-[20px] leading-snug text-black">{profile.bio}</div>}
                </div>

                <div className="flex gap-2.5 px-4 pb-3">
                    <button type="button" onClick={onEdit} className="flex-1 rounded-[12px] bg-black/[0.06] py-3 text-[19px] font-semibold text-black active:opacity-70">{t('photogram.editProfile', 'Edit profile')}</button>
                    <button type="button" className="flex-1 rounded-[12px] bg-black/[0.06] py-3 text-[19px] font-semibold text-black active:opacity-70">{t('photogram.shareProfile', 'Share profile')}</button>
                </div>

                {profile.isMe ? (
                    <div className="flex border-t border-black/[0.08]">
                        <Tab icon={Grid3x3} active={grid === 'posts'} onClick={() => setGrid('posts')} />
                        <Tab icon={Bookmark} active={grid === 'saved'} onClick={() => setGrid('saved')} />
                    </div>
                ) : (
                    <div className="flex items-center justify-center border-t border-black/[0.08] py-3 text-black">
                        <Grid3x3 className="h-[30px] w-[30px]" strokeWidth={2.2} />
                    </div>
                )}

                {grid === 'saved' && loading ? null : (
                    <div key={grid} className="animate-swipe-in-left">
                        {list.length === 0 ? (
                            grid === 'saved' ? <EmptyGrid icon={Bookmark} label={t('photogram.noSavedPosts', 'No Saved Posts')} /> : <EmptyGrid />
                        ) : (
                            <div className="grid grid-cols-3 gap-[2px]">
                                {list.map(p => (
                                    <button key={p.id} type="button" onClick={() => onOpenPost(p)} className="aspect-square active:opacity-80">
                                        <MediaThumb url={p.images[0]} className="h-full w-full" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                <div className="h-2" />
            </div>
        </div>
    );
}

function Tab({ icon: Icon, active, onClick }: { icon: LucideIcon; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex flex-1 items-center justify-center py-3 ${active ? 'border-b-[1.5px] border-black' : 'border-b-[1.5px] border-transparent'}`}
        >
            <Icon className="h-[28px] w-[28px]" strokeWidth={2.2} style={{ color: active ? '#000' : 'rgba(0,0,0,0.3)' }} />
        </button>
    );
}

function Stat({ n, label, onClick }: { n: number | string; label: string; onClick?: () => void }) {
    const inner = (
        <>
            <div className="text-[27px] font-bold leading-tight text-black">{n}</div>
            <div className="text-[18px] text-black">{label}</div>
        </>
    );
    return onClick
        ? <button type="button" onClick={onClick} className="active:opacity-50">{inner}</button>
        : <div>{inner}</div>;
}

export function EmptyGrid({ icon: Icon = Grid3x3, label = t('photogram.noPostsYetTitle', 'No Posts Yet') }: { icon?: LucideIcon; label?: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 px-8 py-14 text-center">
            <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full border-[2.5px] border-black">
                <Icon className="h-[34px] w-[34px] text-black" strokeWidth={2} />
            </div>
            <div className="text-[22px] font-bold text-black">{label}</div>
        </div>
    );
}
