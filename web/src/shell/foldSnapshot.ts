import { useFoldStore } from '@/stores/foldStore';

export const STAGE_ATTR = 'data-phone-stage';

let outgoing: { node: HTMLElement | null; id: number } | null = null;
let cloneSeq = 0;

const REF_ATTRS = [
    'clip-path', 'mask', 'filter', 'fill', 'stroke', 'style',
    'marker-start', 'marker-mid', 'marker-end', 'href', 'xlink:href',
];

function isolateIds(copy: HTMLElement): void {
    const seq = ++cloneSeq;
    const map = new Map<string, string>();
    copy.querySelectorAll('[id]').forEach(n => {
        const old = n.getAttribute('id');
        if (!old) return;
        const next = `fold${seq}-${old}`;
        map.set(old, next);
        n.setAttribute('id', next);
    });
    if (!map.size) return;

    const retarget = (value: string): string =>
        value.replace(/url\(\s*#([^)\s"']+)\s*\)/g, (whole, id: string) => {
            const next = map.get(id);
            return next ? `url(#${next})` : whole;
        });

    const all = [copy, ...Array.from(copy.querySelectorAll<HTMLElement>('*'))];
    for (const el of all) {
        for (const attr of REF_ATTRS) {
            const value = el.getAttribute(attr);
            if (!value) continue;
            let next = value.includes('url(') ? retarget(value) : value;
            if ((attr === 'href' || attr === 'xlink:href') && next.startsWith('#')) {
                const mapped = map.get(next.slice(1));
                if (mapped) next = `#${mapped}`;
            }
            if (next !== value) el.setAttribute(attr, next);
        }
    }
}

function liveStage(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    return document.querySelector(`[${STAGE_ATTR}]`);
}

function repaintCanvases(src: HTMLElement, copy: HTMLElement): void {
    const from = src.querySelectorAll('canvas');
    const to   = copy.querySelectorAll('canvas');
    for (let i = 0; i < from.length && i < to.length; i++) {
        const a = from[i];
        const b = to[i];
        if (a.width === 0 || a.height === 0) continue;
        b.width  = a.width;
        b.height = a.height;
        try {
            b.getContext('2d')?.drawImage(a, 0, 0);
        } catch {}
    }
}

export function cloneStage(): HTMLElement | null {
    const src = liveStage();
    if (!src) return null;

    const copy = src.cloneNode(true) as HTMLElement;
    copy.removeAttribute(STAGE_ATTR);
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    copy.style.zoom = '1';
    copy.style.animation = 'none';
    copy.style.transition = 'none';
    copy.style.transform = 'none';
    copy.style.visibility = 'visible';
    copy.style.opacity = '';
    copy.classList.add('sd-fold-frozen');
    isolateIds(copy);
    repaintCanvases(src, copy);
    return copy;
}

export function requestFold(open?: boolean): void {
    const fold = useFoldStore.getState();
    if (!fold.foldable || fold.swing) return;
    if (open !== undefined && open === fold.open) return;

    const node = cloneStage();
    if (open === undefined) fold.toggle(); else fold.setOpen(open);
    const swing = useFoldStore.getState().swing;
    outgoing = swing ? { node, id: swing.id } : null;
}

export function takeOutgoing(forSwing: number): HTMLElement | null {
    return outgoing && outgoing.id === forSwing ? outgoing.node : null;
}
