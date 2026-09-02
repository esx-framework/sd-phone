import { useEffect, useRef, useState } from 'react';

import { t } from '@/i18n';
import { BLUE, META, type BirdyPoll } from '../data';
import { compactCount, pollTimeLeft } from '../polish/format';
import { apiVote } from '../birdyApi';

export function PollBlock({ postId, poll, onVoted }: {
    postId:   string;
    poll:     BirdyPoll;
    onVoted?: (poll: BirdyPoll) => void;
}) {
    const [live, setLive] = useState(poll);
    const fromProps = useRef(poll);
    if (fromProps.current !== poll) {
        fromProps.current = poll;
        setLive(poll);
    }

    const [expired, setExpired] = useState(() => live.ended || live.endsAt <= Date.now());
    useEffect(() => {
        if (live.ended) { setExpired(true); return; }
        const remaining = live.endsAt - Date.now();
        if (remaining <= 0) { setExpired(true); return; }
        setExpired(false);
        const id = window.setTimeout(() => setExpired(true), Math.min(remaining, 2_147_483_000));
        return () => window.clearTimeout(id);
    }, [live.ended, live.endsAt]);

    const ended = live.ended || expired;
    const voted = live.myVote != null;
    const showResults = voted || ended;

    function vote(idx: number) {
        if (ended || voted) return;
        const optimistic: BirdyPoll = {
            ...live,
            myVote:  idx,
            total:   live.total + 1,
            options: live.options.map(o => (o.idx === idx ? { ...o, votes: o.votes + 1 } : o)),
        };
        setLive(optimistic);
        onVoted?.(optimistic);
        void apiVote(postId, idx).then(next => {
            if (!next) return;
            setLive(next);
            onVoted?.(next);
        });
    }

    const winning = live.options.reduce((best, o) => (o.votes > best ? o.votes : best), -1);

    return (
        <div className="mt-3 flex flex-col gap-2">
            {live.options.map(option => {
                const share = live.total > 0 ? option.votes / live.total : 0;
                const mine = live.myVote === option.idx;

                if (!showResults) {
                    return (
                        <button
                            key={option.idx}
                            type="button"
                            onClick={e => { e.stopPropagation(); vote(option.idx); }}
                            className="w-full truncate rounded-full border px-4 py-2 text-center text-[17px] font-semibold transition-colors hover:bg-ios-blue/10 active:opacity-70"
                            style={{ borderColor: BLUE, color: BLUE }}
                        >
                            {option.label}
                        </button>
                    );
                }

                return (
                    <div key={option.idx} className="relative overflow-hidden rounded-[8px]">
                        <div
                            aria-hidden
                            className="absolute inset-y-0 left-0 rounded-[8px] transition-[width] duration-500 ease-out"
                            style={{
                                width: `${Math.max(share * 100, 1.5)}%`,
                                background: mine ? 'rgb(var(--ios-blue) / 0.32)' : 'rgb(var(--hairline) / 0.16)',
                            }}
                        />
                        <div className="relative flex items-center gap-2 px-3 py-1.5">
                            <span className={`min-w-0 flex-1 truncate text-[17px] text-label ${live.total > 0 && option.votes === winning ? 'font-bold' : ''}`}>
                                {option.label}
                            </span>
                            {mine && (
                                <span className="shrink-0 text-[15px]" style={{ color: META }}>
                                    {t('squawk.pollYourChoice', 'Your choice')}
                                </span>
                            )}
                            <span className="shrink-0 text-[17px] font-bold tabular-nums text-label">
                                {Math.round(share * 100)}%
                            </span>
                        </div>
                    </div>
                );
            })}

            <div className="text-[15px]" style={{ color: META }}>
                {live.total === 1
                    ? t('squawk.pollOneVote', '1 vote')
                    : t('squawk.pollVotes', '{n} votes', { n: compactCount(live.total) })}
                {' · '}
                {ended ? t('squawk.pollFinalResults', 'Final results') : pollTimeLeft(live.endsAt)}
            </div>
        </div>
    );
}
