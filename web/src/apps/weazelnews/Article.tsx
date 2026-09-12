import { ChevronLeft, Eye } from 'lucide-react';

import { t } from '@/i18n';
import { useIosPush } from '@/hooks/useIosPush';
import { useTheme } from '@/stores/themeStore';
import { initials } from '@/lib/format';
import { type Article as ArticleT, formatViews, WEAZEL_RED } from './data';

const SB_H = 54;

export function Article({ article, onBack, animateIn = true }: { article: ArticleT; onBack: () => void; animateIn?: boolean }) {
    const { goBack, pageStyle } = useIosPush(onBack, animateIn);
    const { theme } = useTheme('theme');
    const dark = theme === 'dark';

    return (
        <div
            className={`absolute inset-0 z-20 flex flex-col select-none ${dark ? 'bg-black text-white' : 'bg-[#d4d4d4] text-black'}`}
            style={pageStyle}
        >
            <div className="shrink-0" style={{ height: SB_H }} />

            <div className={`relative flex h-11 shrink-0 items-center px-2 ${dark ? 'border-b border-white/10' : 'border-b border-black/[0.08]'}`}>
                <button
                    type="button"
                    onClick={goBack}
                    className="relative z-10 flex items-center gap-0.5 text-[17px] active:opacity-60"
                    style={{ color: WEAZEL_RED }}
                >
                    <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.5} />
                    <span className="font-medium">{t('weazelnews.weazelNews', 'Weazel News')}</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
                <div className="relative h-56 w-full overflow-hidden">
                    {article.image ? (
                        <img src={article.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                        <div
                            className="flex h-full w-full items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${WEAZEL_RED}, #7a0a1c)` }}
                        >
                            <span className="text-[28px] font-extrabold italic tracking-tighter text-white/90">WEAZEL NEWS</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                    <span
                        className="absolute start-4 top-4 rounded-[6px] px-3 py-1.5 text-[14px] font-bold uppercase tracking-wide text-white"
                        style={{ background: WEAZEL_RED }}
                    >
                        {article.category}
                    </span>
                </div>

                <div className="px-5 pb-10 pt-4">
                    <h1 dir="auto" className="text-[27px] font-extrabold leading-[1.12] tracking-tight">
                        {article.headline}
                    </h1>

                    <p dir="auto" className={`mt-3 text-[18.5px] font-medium leading-snug ${dark ? 'text-white/80' : 'text-black/70'}`}>
                        {article.dek}
                    </p>

                    <div className={`mt-6 flex items-center gap-3.5 border-y py-5 ${dark ? 'border-white/10' : 'border-black/[0.08]'}`}>
                        <div
                            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[20px] font-bold text-white"
                            style={{ background: WEAZEL_RED }}
                        >
                            {initials(article.author)}
                        </div>
                        <div className="min-w-0 flex-1 leading-tight">
                            <div dir="auto" className="truncate text-[19px] font-bold">{article.author}</div>
                            <div className="mt-1 text-[15px] font-medium text-ios-gray">
                                {t('weazelnews.weazelNews', 'Weazel News')} &middot; {article.time === 'now' ? t('weazelnews.justNow', 'Just now') : t('weazelnews.timeAgo', '{time} ago', { time: article.time })}
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-[17px] font-semibold text-ios-gray">
                            <Eye className="h-[20px] w-[20px]" strokeWidth={2.3} />
                            <span>{formatViews(article.views)}</span>
                        </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-4">
                        {article.body.map((para, i) => (
                            <p
                                key={i}
                                dir="auto"
                                className={`text-[17.5px] leading-[1.7] ${dark ? 'text-white/90' : 'text-black/85'}`}
                            >
                                {i === 0 ? <FirstLetter text={para} red={WEAZEL_RED} /> : para}
                            </p>
                        ))}
                    </div>

                    <div className={`mt-10 border-t pt-6 text-center ${dark ? 'border-white/10' : 'border-black/[0.08]'}`}>
                        <div className="text-[19px] font-extrabold italic tracking-tighter" style={{ color: WEAZEL_RED }}>
                            WEAZEL NEWS
                        </div>
                        <div className={`mt-2 text-[15px] font-medium leading-relaxed ${dark ? 'text-white/50' : 'text-black/50'}`}>
                            &copy; {t('weazelnews.copyright', 'Weazel News Network, Los Santos.')}<br />{t('weazelnews.rightsReserved', 'All rights reserved.')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FirstLetter({ text, red }: { text: string; red: string }) {
    const first = text.charAt(0);
    const rest = text.slice(1);
    return (
        <>
            <span
                className="float-start me-2 mt-1 text-[46px] font-extrabold leading-[0.78]"
                style={{ color: red }}
            >
                {first}
            </span>
            {rest}
        </>
    );
}

