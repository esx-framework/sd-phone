import { formatMoney } from '@/lib/money';

export type ClassifiedFeedAction = 'sd-phone:pages:feed' | 'sd-phone:marketplace:feed';

export interface ClassifiedItem {
    id:     string;
    title:  string;
    body:   string;
    price?: number;
    image?:  string;
    images?: string[];
    number: string;
    email?: string;
    date?:  string;
    mine?:  boolean;
    publishAt?: number;
}

export interface ClassifiedDraft {
    title:  string;
    body:   string;
    price?:  number;
    image?:  string;
    images?: string[];
    number: string;
    email?: string;
    publishAt?: number;
}

export function fmtPrice(n: number): string {
    return formatMoney(n, { whole: true });
}
