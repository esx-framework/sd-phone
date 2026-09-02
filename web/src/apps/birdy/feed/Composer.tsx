import { useEffect, useRef, useState } from 'react';
import { BarChart2, Image as ImageIcon, Plus, Smile, X } from 'lucide-react';

import { t } from '@/i18n';
import { useTheme } from '@/stores/themeStore';
import { useSessionState } from '@/hooks/useSessionState';
import { EmojiPanel } from '@/shared/chat/EmojiPanel';
import { GifPickerSheet } from '@/shared/chat/GifPickerSheet';
import { MediaPickerSheet } from '@/shared/MediaPickerSheet';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { BG, BLUE, LINE, MAX_POLL_OPTIONS, MAX_POLL_OPTION_LENGTH, MAX_POST_LENGTH, META, POLL_DURATIONS } from '../data';
import { Avatar } from '../ui';
import type { BirdyAuthor, PollDurationKey } from '../data';
import type { PollDraft } from '../birdyApi';
import { StatusBarSpacer } from '@/ui/StatusBarSpacer';

const MAX_IMAGES = 3;

export function Composer({ me, onClose, onPost }: {
    me:      BirdyAuthor;
    onClose: () => void;
    onPost:  (body: string, images: string[], poll?: PollDraft) => void;
}) {
    const { theme } = useTheme('theme');
    const isDark = theme === 'dark';

    const [text, setText] = useSessionState('birdy:composerDraft', '');
    const [images, setImages] = useState<string[]>([]);
    const [picking, setPicking] = useState(false);
    const [pickingGif, setPickingGif] = useState(false);
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [exiting, setExiting] = useState(false);
    const [pollOptions, setPollOptions] = useSessionState<string[] | null>('birdy:composerPoll', null);
    const [pollDuration, setPollDuration] = useSessionState<PollDurationKey>('birdy:composerPollDuration', '1d');
    const taRef = useRef<HTMLTextAreaElement>(null);

    const durations: { value: PollDurationKey; label: string }[] = [
        { value: '1h', label: t('squawk.pollHour',  '1 hour') },
        { value: '1d', label: t('squawk.pollDay',   '1 day') },
        { value: '3d', label: t('squawk.pollDays3', '3 days') },
        { value: '7d', label: t('squawk.pollDays7', '7 days') },
    ];

    const filledOptions = (pollOptions ?? []).map(o => o.trim()).filter(o => o.length > 0);
    const canPost = pollOptions
        ? text.trim().length > 0 && filledOptions.length >= 2
        : text.trim().length > 0 || images.length > 0;

    useEffect(() => {
        const t = window.setTimeout(() => taRef.current?.focus({ preventScroll: true }), 360);
        return () => window.clearTimeout(t);
    }, []);

    function submit() {
        if (!canPost) return;
        onPost(text.trim(), images, pollOptions ? { options: filledOptions, duration: POLL_DURATIONS[pollDuration] } : undefined);
        setText('');
        setPollOptions(null);
    }

    function togglePoll() {
        setPollOptions(prev => (prev ? null : ['', '']));
        setImages([]);
    }

    function setOption(idx: number, value: string) {
        setPollOptions(prev => (prev ? prev.map((o, i) => (i === idx ? value : o)) : prev));
    }

    function addOption() {
        setPollOptions(prev => (prev && prev.length < MAX_POLL_OPTIONS ? [...prev, ''] : prev));
    }

    function removeOption(idx: number) {
        setPollOptions(prev => (prev && prev.length > 2 ? prev.filter((_, i) => i !== idx) : prev));
    }

    function requestClose() {
        if (!exiting) setExiting(true);
    }

    function addImages(urls: string[]) {
        setImages(prev => [...prev, ...urls].slice(0, MAX_IMAGES));
        setPicking(false);
    }

    function removeImage(idx: number) {
        setImages(prev => prev.filter((_, i) => i !== idx));
    }

    function toggleEmoji() {
        setEmojiOpen(o => {
            if (!o) taRef.current?.blur();
            return !o;
        });
    }

    const atImageLimit = images.length >= MAX_IMAGES || pollOptions != null;

    return (
        <div
            className="absolute inset-0 z-50 flex flex-col"
            onAnimationEnd={e => { if (exiting && e.animationName === 'ios-sheet-down') onClose(); }}
            style={{
                background: BG,
                animation: exiting
                    ? 'ios-sheet-down 0.3s cubic-bezier(0.32,0,0.68,1) forwards'
                    : 'ios-sheet-up 0.42s cubic-bezier(0.32,0.72,0,1)',
                willChange: 'transform',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                boxShadow: '0 -8px 30px rgba(0,0,0,0.18)',
            }}
        >
            <StatusBarSpacer />

            <header className="flex items-center justify-between px-4 py-2.5">
                <button type="button" onClick={requestClose} className="text-[16px]" style={{ color: BLUE }}>
                    {t('squawk.cancel', 'Cancel')}
                </button>
                <button
                    type="button"
                    onClick={submit}
                    disabled={!canPost}
                    className="rounded-full px-4 py-1.5 text-[15px] font-bold text-white transition-[transform,opacity] active:scale-95 disabled:opacity-50"
                    style={{ background: BLUE }}
                >
                    {t('squawk.post', 'Post')}
                </button>
            </header>

            <div className="flex min-h-0 flex-1 gap-3 overflow-y-auto no-scrollbar px-4 pt-3">
                <Avatar size={40} src={me.avatar} />
                <div className="flex min-w-0 flex-1 flex-col">
                    <textarea
                        ref={taRef}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onFocus={() => setEmojiOpen(false)}
                        maxLength={MAX_POST_LENGTH}
                        placeholder={t('squawk.whatsHappening', "What's on your mind?")}
                        className="min-h-[110px] flex-none resize-none bg-transparent pt-1 text-[17px] leading-snug text-label outline-none placeholder:font-semibold placeholder:text-ios-gray"
                        style={{ caretColor: BLUE, outline: 'none', boxShadow: 'none' }}
                    />

                    {images.length > 0 && (
                        <div className="mb-3 mt-1 flex gap-2">
                            {images.map((url, i) => (
                                <div key={`${url}-${i}`} className="relative min-w-0 flex-1">
                                    <img src={url} alt="" draggable={false} className="h-[240px] w-full rounded-[14px] object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(i)}
                                        aria-label={t('squawk.removeImage', 'Remove image')}
                                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 active:opacity-70"
                                    >
                                        <X className="h-[16px] w-[16px] text-white" strokeWidth={2.6} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {pollOptions && (
                        <div className="mb-3 mt-1 rounded-[16px] border border-hairline/15 p-3">
                            <div className="flex flex-col gap-2">
                                {pollOptions.map((value, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <input
                                            value={value}
                                            onChange={e => setOption(i, e.target.value)}
                                            maxLength={MAX_POLL_OPTION_LENGTH}
                                            placeholder={t('squawk.pollOptionN', 'Choice {n}', { n: i + 1 })}
                                            className="min-w-0 flex-1 rounded-[10px] border border-hairline/15 bg-transparent px-3 py-2 text-[16px] text-label outline-none placeholder:text-ios-gray"
                                            style={{ caretColor: BLUE }}
                                        />
                                        {pollOptions.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => removeOption(i)}
                                                aria-label={t('squawk.pollRemoveOption', 'Remove choice')}
                                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full active:bg-hairline/5"
                                                style={{ color: META }}
                                            >
                                                <X className="h-[18px] w-[18px]" strokeWidth={2.4} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {pollOptions.length < MAX_POLL_OPTIONS && (
                                <button
                                    type="button"
                                    onClick={addOption}
                                    className="mt-2 flex items-center gap-1.5 text-[15px] font-semibold active:opacity-60"
                                    style={{ color: BLUE }}
                                >
                                    <Plus className="h-[17px] w-[17px]" strokeWidth={2.6} />
                                    {t('squawk.pollAddOption', 'Add a choice')}
                                </button>
                            )}

                            <p className="mb-1.5 mt-3 text-[13px] font-semibold uppercase tracking-wide" style={{ color: META }}>
                                {t('squawk.pollLength', 'Poll length')}
                            </p>
                            <SegmentedControl
                                value={pollDuration}
                                onChange={setPollDuration}
                                options={durations}
                                slide
                            />

                            <button
                                type="button"
                                onClick={togglePoll}
                                className="mt-3 w-full rounded-[10px] py-2 text-center text-[15px] font-semibold text-ios-red active:opacity-60"
                            >
                                {t('squawk.pollRemove', 'Remove poll')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {emojiOpen && <EmojiPanel isDark={isDark} onSelect={e => setText(t => t + e)} />}

            <div className="flex items-center gap-1 px-3 pb-8 pt-1.5" style={{ background: BG }}>
                <button
                    type="button"
                    aria-label={t('squawk.addImage', 'Add image')}
                    disabled={atImageLimit}
                    onClick={() => setPicking(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-full active:bg-hairline/5 disabled:opacity-40"
                >
                    <ImageIcon className="h-[26px] w-[26px]" style={{ color: BLUE }} strokeWidth={2} />
                </button>
                <button
                    type="button"
                    aria-label={t('squawk.addGif', 'Add GIF')}
                    disabled={atImageLimit}
                    onClick={() => setPickingGif(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-full active:bg-hairline/5 disabled:opacity-40"
                >
                    <span className="rounded-[6px] border-2 px-[4px] py-[2px] text-[11px] font-extrabold leading-none" style={{ borderColor: BLUE, color: BLUE }}>GIF</span>
                </button>
                <button
                    type="button"
                    aria-label={t('squawk.addPoll', 'Add poll')}
                    disabled={images.length > 0}
                    onClick={togglePoll}
                    className="flex h-10 w-10 items-center justify-center rounded-full active:bg-hairline/5 disabled:opacity-40"
                    style={pollOptions ? { background: 'rgb(var(--ios-blue) / 0.12)' } : undefined}
                >
                    <BarChart2 className="h-[26px] w-[26px] -rotate-90" style={{ color: BLUE }} strokeWidth={2} />
                </button>
                <button
                    type="button"
                    aria-label={t('squawk.addEmoji', 'Add emoji')}
                    onClick={toggleEmoji}
                    className="flex h-10 w-10 items-center justify-center rounded-full active:bg-hairline/5"
                >
                    <Smile className="h-[26px] w-[26px]" style={{ color: BLUE }} strokeWidth={2} />
                </button>
                <CounterRing len={text.length} />
            </div>

            {picking && (
                <MediaPickerSheet
                    multiple
                    onSelectMany={ps => addImages(ps.map(p => p.url))}
                    onClose={() => setPicking(false)}
                />
            )}
            {pickingGif && (
                <GifPickerSheet
                    onSelect={url => { addImages([url]); setPickingGif(false); }}
                    onClose={() => setPickingGif(false)}
                />
            )}
        </div>
    );
}

/** Twitter's character budget as a filling ring: quiet blue while there's room, the remaining
 *  number fades in for the last 20 characters, red when the budget is spent. Hidden until the
 *  first character so an empty composer stays clean. */
function CounterRing({ len }: { len: number }) {
    if (len === 0) return null;
    const remaining = MAX_POST_LENGTH - len;
    const frac = Math.min(1, len / MAX_POST_LENGTH);
    const R = 9;
    const C = 2 * Math.PI * R;
    const color = remaining <= 0 ? '#f4212e' : remaining <= 20 ? '#ffad1f' : BLUE;
    return (
        <span className="ml-auto mr-1 flex items-center gap-1.5">
            {remaining <= 20 && (
                <span className={`text-[13px] tabular-nums ${remaining <= 0 ? 'font-semibold text-[#f4212e]' : 'text-[#536471]'}`}>
                    {remaining}
                </span>
            )}
            <svg width="22" height="22" viewBox="0 0 22 22" className="-rotate-90" aria-hidden>
                <circle cx="11" cy="11" r={R} fill="none" stroke={LINE} strokeWidth="2.5" />
                <circle
                    cx="11" cy="11" r={R} fill="none"
                    stroke={color} strokeWidth="2.5" strokeLinecap="round"
                    strokeDasharray={C} strokeDashoffset={C * (1 - frac)}
                    className="transition-[stroke-dashoffset,stroke] duration-150"
                />
            </svg>
        </span>
    );
}
