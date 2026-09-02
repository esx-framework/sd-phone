
import { isFiveM } from '@/core/nui';
import { ARTICLES, TICKER, type Article, type ArticleDraft, type NewsFeed } from './data';
import { apiCall, apiData } from '@/core/api';


let DEV_ARTICLES: Article[] = ARTICLES.map(a => ({ ...a, body: [...a.body] }));
let DEV_TICKER: string[] = [...TICKER];
let DEV_SCHEDULED: Article[] = [{
    id: 's1',
    category: 'Politics',
    headline: 'Council votes tonight on the harbour redevelopment',
    dek: 'The chamber sits at eight, and both sides say they have the numbers.',
    body: [
        'Councillors return to the chamber this evening for a vote that has been deferred twice, with the harbour redevelopment package back on the order paper in more or less the form that stalled it in the spring.',
        'Supporters point to the jobs figures attached to the plan. Opponents want the public slipway written into the deal before anyone signs anything.',
    ],
    author: 'You',
    time: 'now',
    views: 0,
    featured: false,
    publishAt: Math.floor(Date.now() / 1000) + 5400,
}];
let devIdSeq = 1000;


export async function weazelFeed(): Promise<NewsFeed> {
    if (!isFiveM) {
        return {
            articles: DEV_ARTICLES.map(a => ({ ...a })),
            ticker: [...DEV_TICKER],
            canManage: true,
            scheduled: DEV_SCHEDULED.map(a => ({ ...a })),
        };
    }
    const feed = await apiData<NewsFeed>('sd-phone:weazelnews:feed');
    if (!feed) return { articles: [], ticker: [], canManage: false, scheduled: [] };
    return { ...feed, scheduled: feed.scheduled ?? [] };
}

export async function weazelWatch(on: boolean): Promise<void> {
    if (!isFiveM) return;
    await apiCall('sd-phone:weazelnews:watch', { on });
}

export async function weazelView(id: string): Promise<number | null> {
    if (!isFiveM) {
        const a = DEV_ARTICLES.find(x => x.id === id);
        if (!a) return null;
        a.views += 1;
        return a.views;
    }
    return (await apiData<{ views: number }>('sd-phone:weazelnews:view', { id }))?.views ?? null;
}

export async function weazelSave(draft: ArticleDraft): Promise<Article | null> {
    if (!isFiveM) {
        const queued = DEV_SCHEDULED.find(x => x.id === draft.id);
        if (queued) {
            queued.category = draft.category;
            queued.headline = draft.headline;
            queued.dek      = draft.dek;
            queued.body     = [...draft.body];
            queued.image    = draft.image;
            queued.featured = draft.featured;
            if (draft.publishAt) {
                queued.publishAt = draft.publishAt;
                return { ...queued };
            }
            DEV_SCHEDULED = DEV_SCHEDULED.filter(x => x.id !== queued.id);
            const live: Article = { ...queued, publishAt: undefined, time: 'now' };
            DEV_ARTICLES = [live, ...DEV_ARTICLES];
            return { ...live };
        }
        if (draft.featured && !draft.publishAt) DEV_ARTICLES.forEach(a => { a.featured = false; });
        if (draft.id) {
            const a = DEV_ARTICLES.find(x => x.id === draft.id);
            if (!a) return null;
            a.category = draft.category;
            a.headline = draft.headline;
            a.dek      = draft.dek;
            a.body     = [...draft.body];
            a.image    = draft.image;
            a.featured = draft.featured;
            return { ...a };
        }
        const created: Article = {
            id: 'dev-' + devIdSeq++, category: draft.category, headline: draft.headline,
            dek: draft.dek, body: [...draft.body], author: 'You', time: 'now',
            views: 0, image: draft.image, featured: draft.featured, publishAt: draft.publishAt,
        };
        if (draft.publishAt) {
            DEV_SCHEDULED = [...DEV_SCHEDULED, created].sort((a, b) => (a.publishAt ?? 0) - (b.publishAt ?? 0));
        } else {
            DEV_ARTICLES = [created, ...DEV_ARTICLES];
        }
        return { ...created };
    }
    return (await apiData<{ article: Article }>('sd-phone:weazelnews:save', draft))?.article ?? null;
}

export async function weazelReschedule(id: string, publishAt: number): Promise<boolean> {
    if (!isFiveM) {
        const a = DEV_SCHEDULED.find(x => x.id === id);
        if (!a) return false;
        a.publishAt = publishAt;
        DEV_SCHEDULED = [...DEV_SCHEDULED].sort((x, y) => (x.publishAt ?? 0) - (y.publishAt ?? 0));
        return true;
    }
    return (await apiCall<unknown>('sd-phone:weazelnews:reschedule', { id, publishAt })).success;
}

export async function weazelPublishNow(id: string): Promise<boolean> {
    if (!isFiveM) {
        const a = DEV_SCHEDULED.find(x => x.id === id);
        if (!a) return false;
        DEV_SCHEDULED = DEV_SCHEDULED.filter(x => x.id !== id);
        if (a.featured) DEV_ARTICLES.forEach(x => { x.featured = false; });
        DEV_ARTICLES = [{ ...a, publishAt: undefined, time: 'now' }, ...DEV_ARTICLES];
        return true;
    }
    return (await apiCall<unknown>('sd-phone:weazelnews:publishNow', { id })).success;
}

export async function weazelDelete(id: string): Promise<boolean> {
    if (!isFiveM) {
        DEV_ARTICLES = DEV_ARTICLES.filter(a => a.id !== id);
        DEV_SCHEDULED = DEV_SCHEDULED.filter(a => a.id !== id);
        return true;
    }
    const r = await apiCall<unknown>('sd-phone:weazelnews:delete', { id });
    return r.success;
}

export async function weazelSetBreaking(lines: string[]): Promise<string[] | null> {
    if (!isFiveM) {
        DEV_TICKER = lines.map(l => l.trim()).filter(Boolean).slice(0, 8);
        return [...DEV_TICKER];
    }
    return (await apiData<{ ticker: string[] }>('sd-phone:weazelnews:setBreaking', { lines }))?.ticker ?? null;
}
