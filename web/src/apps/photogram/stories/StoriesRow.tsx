import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Plus } from 'lucide-react';

import { IG, type User } from '../data';
import type { LiveEntry, StoryGroup } from '../photogramApi';
import { t } from '@/i18n';

export function StoriesRow({ stories, lives, me, hasOwnStory, onOpen, onOpenLive, onAddStory }: {
    stories:    StoryGroup[];
    lives:      LiveEntry[];
    me:         User | null;
    hasOwnStory: boolean;
    onOpen:     (i: number) => void;
    onOpenLive: (entry: LiveEntry) => void;
    onAddStory: () => void;
}) {
    const scroller = useRef<HTMLDivElement>(null);
    const drag = useRef({ down: false, startX: 0, startScroll: 0, moved: 0 });

    function onPointerDown(e: ReactPointerEvent) {
        const el = scroller.current;
        if (!el) return;
        drag.current = { down: true, startX: e.clientX, startScroll: el.scrollLeft, moved: 0 };
    }
    function onPointerMove(e: ReactPointerEvent) {
        const el = scroller.current;
        if (!drag.current.down || !el) return;
        const dx = e.clientX - drag.current.startX;
        drag.current.moved = Math.max(drag.current.moved, Math.abs(dx));
        el.scrollLeft = drag.current.startScroll - dx;
    }
    function endDrag() { drag.current.down = false; }
    function onClickCapture(e: ReactMouseEvent) {
        if (drag.current.moved > 8) { e.stopPropagation(); e.preventDefault(); }
    }

    return (
        <div
            ref={scroller}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
            onClickCapture={onClickCapture}
            className="flex cursor-grab gap-3 overflow-x-auto no-scrollbar px-4 py-3.5 active:cursor-grabbing"
        >
            <Ring src={me?.avatar ?? ''} label={t('photogram.yourStory', 'Your Story')} addBadge onClick={() => (hasOwnStory ? onOpen(0) : onAddStory())} />
            {lives.map(l => (
                <Ring key={`live-${l.liveId}`} src={l.user.avatar} live label={l.user.handle} onClick={() => onOpenLive(l)} />
            ))}
            {stories.map((s, i) => (
                s.isMe ? null : <Ring key={s.user.id} src={s.user.avatar} seen={s.seen} label={s.user.handle} onClick={() => onOpen(i)} />
            ))}
        </div>
    );
}

function Ring({ src, label, seen, addBadge, live, onClick }: {
    src: string; label: string; seen?: boolean; addBadge?: boolean; live?: boolean; onClick: () => void;
}) {
    return (
        <button type="button" onClick={onClick} className="flex w-[92px] shrink-0 flex-col items-center gap-2 active:opacity-70">
            <div className="rounded-full p-[3px]" style={{ background: addBadge ? 'transparent' : live ? '#ED4956' : (seen ? '#d4d4d4' : IG.ring) }}>
                <div className="relative">
                    <img src={src} alt="" draggable={false} className="block h-[78px] w-[78px] rounded-full object-cover" />
                    {addBadge && (
                        <span className="absolute -bottom-[1px] -end-[1px] flex h-[28px] w-[28px] items-center justify-center rounded-full border-[2.5px] border-white" style={{ background: IG.blue }}>
                            <Plus className="h-[19px] w-[19px] text-white" strokeWidth={3} />
                        </span>
                    )}
                    {live && (
                        <span className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 rounded-[5px] border-[1.5px] border-white bg-[#ED4956] px-1.5 py-[1px] text-[11px] font-bold uppercase leading-none tracking-wide text-white">
                            {t('photogram.live', 'Live')}
                        </span>
                    )}
                </div>
            </div>
            <span className="max-w-[88px] truncate text-[16px] font-medium text-black">{label}</span>
        </button>
    );
}
