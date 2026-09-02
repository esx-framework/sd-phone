import { useState } from 'react';
import { Clock, ImagePlus, Link2, X } from 'lucide-react';

import { t } from '@/i18n';
import { useIosPush } from '@/hooks/useIosPush';
import { Scroller } from '@/ui/Scroller';
import { MediaPickerSheet } from '@/shared/MediaPickerSheet';
import { SchedulePickerSheet, scheduleLabel } from '@/shared/SchedulePickerSheet';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Toggle } from '@/ui/Toggle';
import { CATEGORIES, categoryLabel, type Article as ArticleT, type ArticleDraft, type Category, WEAZEL_RED } from './data';
import { StatusBarSpacer } from '@/ui/StatusBarSpacer';

type Timing = 'now' | 'later';

export function EditArticle({ initial, dark, onClose, onSave }: {
    initial:  ArticleT | null;
    dark:     boolean;
    onClose:  () => void;
    onSave:   (draft: ArticleDraft) => Promise<boolean>;
}) {
    const { goBack, pageStyle } = useIosPush(onClose);

    const [category, setCategory] = useState<Category>(initial?.category ?? 'Local');
    const [headline, setHeadline] = useState(initial?.headline ?? '');
    const [dek,      setDek]      = useState(initial?.dek ?? '');
    const [body,     setBody]     = useState((initial?.body ?? []).join('\n\n'));
    const [image,    setImage]    = useState<string | undefined>(initial?.image);
    const [featured, setFeatured] = useState(initial?.featured ?? false);
    const [picking,  setPicking]  = useState(false);
    const [urlMode,  setUrlMode]  = useState(false);
    const [busy,     setBusy]     = useState(false);
    const [timing,   setTiming]   = useState<Timing>(initial?.publishAt ? 'later' : 'now');
    const [publishAt, setPublishAt] = useState<number | null>(initial?.publishAt ?? null);
    const [timePicker, setTimePicker] = useState(false);

    const queued = !initial || !!initial.publishAt;

    const paragraphs = body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const scheduling = queued && timing === 'later';
    const canSubmit = headline.trim().length > 0 && paragraphs.length > 0 && !busy
        && (!scheduling || publishAt !== null);

    function chooseTiming(next: Timing) {
        setTiming(next);
        if (next === 'later' && publishAt === null) setTimePicker(true);
    }

    async function submit() {
        if (!canSubmit) return;
        setBusy(true);
        const ok = await onSave({
            id: initial?.id,
            category,
            headline: headline.trim(),
            dek: dek.trim(),
            body: paragraphs,
            image: image?.trim() || undefined,
            featured,
            publishAt: scheduling && publishAt !== null ? publishAt : undefined,
        });
        setBusy(false);
        if (ok) goBack();
    }

    const submitLabel = scheduling
        ? t('weazelnews.schedule', 'Schedule')
        : initial && !initial.publishAt
            ? t('weazelnews.save', 'Save')
            : t('weazelnews.publish', 'Publish');

    const card  = dark ? 'bg-surface text-white placeholder:text-white/90' : 'bg-surface text-black placeholder:text-black/75';
    const sheet = dark ? 'bg-black' : 'bg-[#d4d4d4]';

    return (
        <div className={`absolute inset-0 z-40 flex flex-col font-sf ${sheet}`} style={pageStyle}>
            <StatusBarSpacer />

            <div className="flex h-11 shrink-0 items-center justify-between px-4">
                <button type="button" onClick={goBack} className="text-[16px]" style={{ color: WEAZEL_RED }}>{t('weazelnews.cancel', 'Cancel')}</button>
                <span className={`text-[15px] font-semibold ${dark ? 'text-white' : 'text-black'}`}>
                    {initial ? t('weazelnews.editStory', 'Edit Story') : t('weazelnews.newStory', 'New Story')}
                </span>
                <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={submit}
                    className="text-[16px] font-semibold disabled:opacity-40"
                    style={{ color: WEAZEL_RED }}
                >
                    {submitLabel}
                </button>
            </div>

            <Scroller className="min-h-0 flex-1 px-4 pb-8 pt-1">
                <Label dark={dark}>{t('weazelnews.category', 'Category')}</Label>
                <div className="flex flex-wrap items-center gap-2">
                    {CATEGORIES.filter((c): c is Category => c !== 'All').map(c => {
                        const active = category === c;
                        return (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setCategory(c)}
                                className={`rounded-full px-4 py-2 text-[14px] font-semibold transition-colors active:scale-[0.97] ${
                                    active
                                        ? 'text-white'
                                        : dark
                                            ? 'bg-white/[0.14] text-white'
                                            : 'bg-black/[0.05] text-black'
                                }`}
                                style={active ? { background: WEAZEL_RED } : undefined}
                            >
                                {categoryLabel(c)}
                            </button>
                        );
                    })}
                </div>

                <Label dark={dark}>{t('weazelnews.headline', 'Headline')}</Label>
                <input
                    value={headline}
                    onChange={e => setHeadline(e.target.value)}
                    maxLength={140}
                    placeholder={t('weazelnews.storyHeadlinePlaceholder', 'The story headline')}
                    className={`w-full rounded-xl p-3 text-[16px] font-semibold outline-none ${card}`}
                />

                <Label dark={dark}>{t('weazelnews.standfirst', 'Standfirst')}</Label>
                <textarea
                    value={dek}
                    onChange={e => setDek(e.target.value)}
                    rows={2}
                    maxLength={240}
                    placeholder={t('weazelnews.standfirstPlaceholder', 'A one-line summary shown under the headline (optional)')}
                    className={`ios-scrollbar w-full resize-none rounded-xl p-3 text-[15px] outline-none ${card}`}
                />

                <Label dark={dark}>{t('weazelnews.article', 'Article')}</Label>
                <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={9}
                    maxLength={8000}
                    placeholder={t('weazelnews.articlePlaceholder', 'Write the story…\n\nSeparate paragraphs with a blank line.')}
                    className={`ios-scrollbar w-full resize-none rounded-xl p-3 text-[15px] leading-relaxed outline-none ${card}`}
                />

                <Label dark={dark}>{t('weazelnews.bannerImage', 'Banner image')}</Label>
                {image ? (
                    <div className="relative inline-block">
                        <img src={image} alt="" className="h-28 w-44 rounded-xl object-cover" />
                        <button
                            type="button"
                            onClick={() => setImage(undefined)}
                            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"
                            aria-label={t('weazelnews.removeImage', 'Remove image')}
                        >
                            <X className="h-[14px] w-[14px]" strokeWidth={2.6} />
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setPicking(true)}
                                className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[15px] ${card}`}
                                style={{ color: WEAZEL_RED }}
                            >
                                <ImagePlus className="h-[18px] w-[18px]" strokeWidth={2} /> {t('weazelnews.chooseFromPhotos', 'Choose from Photos')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setUrlMode(u => !u)}
                                className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[15px] ${card}`}
                                style={{ color: WEAZEL_RED }}
                            >
                                <Link2 className="h-[18px] w-[18px]" strokeWidth={2} /> {t('weazelnews.url', 'URL')}
                            </button>
                        </div>
                        {urlMode && (
                            <input
                                autoFocus
                                onChange={e => setImage(e.target.value || undefined)}
                                placeholder="https://…"
                                className={`w-full rounded-xl p-3 text-[15px] outline-none ${card}`}
                            />
                        )}
                    </div>
                )}

                <div className={`mt-5 flex items-center justify-between rounded-2xl p-4 ${card}`}>
                    <span className="min-w-0 flex-1 pr-4">
                        <span className="block text-[17px] font-semibold">{t('weazelnews.featuredStory', 'Featured story')}</span>
                        <span className={`mt-1 block text-[15px] font-medium leading-snug ${dark ? 'text-white/80' : 'text-black/75'}`}>
                            {t('weazelnews.featuredStoryHint', 'Pin as the lead hero at the top of the feed.')}
                        </span>
                    </span>
                    <Toggle on={featured} onChange={setFeatured} />
                </div>

                {queued && (
                    <>
                        <Label dark={dark}>{t('weazelnews.publishing', 'Publishing')}</Label>
                        <SegmentedControl<Timing>
                            value={timing}
                            onChange={chooseTiming}
                            options={[
                                { value: 'now',   label: t('weazelnews.publishNowOption', 'Publish now') },
                                { value: 'later', label: t('weazelnews.scheduleOption', 'Schedule') },
                            ]}
                            slide
                        />
                        {timing === 'later' && (
                            <button
                                type="button"
                                onClick={() => setTimePicker(true)}
                                className={`mt-3 flex w-full items-center gap-3 rounded-2xl p-4 text-left active:opacity-80 ${card}`}
                            >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: WEAZEL_RED }}>
                                    <Clock className="h-[19px] w-[19px]" strokeWidth={2.3} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[16px] font-semibold">
                                        {publishAt !== null
                                            ? scheduleLabel(publishAt)
                                            : t('weazelnews.pickPublishTime', 'Pick a publish time')}
                                    </span>
                                    <span className="mt-0.5 block text-[14px] font-medium text-ios-gray">
                                        {t('weazelnews.scheduleHint', 'Hidden from readers until then.')}
                                    </span>
                                </span>
                            </button>
                        )}
                    </>
                )}
            </Scroller>

            {picking && (
                <MediaPickerSheet
                    forceDark={dark}
                    onSelect={p => { setImage(p.url); setPicking(false); }}
                    onClose={() => setPicking(false)}
                />
            )}

            {timePicker && (
                <SchedulePickerSheet
                    at={publishAt}
                    accent={WEAZEL_RED}
                    forceDark={dark}
                    onPick={setPublishAt}
                    onClose={() => setTimePicker(false)}
                />
            )}
        </div>
    );
}

function Label({ children, dark }: { children: React.ReactNode; dark: boolean }) {
    return (
        <div className={`mb-2 mt-5 flex items-center gap-2 text-[14px] font-extrabold uppercase tracking-wide ${dark ? 'text-white/80' : 'text-black/75'}`}>
            <span className="h-[13px] w-[3.5px] rounded-full" style={{ background: WEAZEL_RED }} />
            {children}
        </div>
    );
}
