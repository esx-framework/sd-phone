import { useState } from 'react';
import { ImagePlus, Link2, Play, X } from 'lucide-react';

import { t } from '@/i18n';
import { isVideoUrl } from '@/core/photosApi';
import { ImageLightbox } from '@/ui/ImageLightbox';
import { PromptDialog } from '@/ui/PromptDialog';
import { MediaPickerSheet } from '@/shared/MediaPickerSheet';

import { mdtRowMeta, mdtSectionHeader } from '../mdtTheme';
import { MdtButton } from './MdtButton';

export interface EvidenceItem {
    url:   string;
    label: string;
}

export const MAX_EVIDENCE = 24;

function Tile({ item, onOpen, onRemove }: {
    item:      EvidenceItem;
    onOpen:    () => void;
    onRemove?: () => void;
}) {
    const video = isVideoUrl(item.url);
    return (
        <div className="relative">
            <button
                type="button"
                onClick={onOpen}
                aria-label={video ? t('mdt.evPlay', 'Play clip') : t('mdt.evView', 'View evidence')}
                className="relative block h-[88px] w-[88px] overflow-hidden rounded-[10px] bg-black/10 transition-opacity active:opacity-70 dark:bg-white/10"
            >
                {video
                    ? <video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    : <img src={item.url} alt="" className="h-full w-full object-cover" draggable={false} />}
                {video && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play className="h-6 w-6 fill-white text-white drop-shadow" />
                    </span>
                )}
            </button>
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label={t('mdt.evRemove', 'Remove evidence')}
                    className="absolute -end-1.5 -top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#efefef] text-ios-gray shadow-[0_1px_3px_rgba(0,0,0,0.25)] ring-1 ring-black/[0.06] transition-colors hover:text-ios-red dark:bg-elevated dark:ring-white/[0.10]"
                >
                    <X className="h-[13px] w-[13px]" strokeWidth={2.6} />
                </button>
            )}
            {item.label && (
                <span className={`mt-1 block max-w-[88px] truncate ${mdtRowMeta}`}>{item.label}</span>
            )}
        </div>
    );
}

export function MdtEvidence({ items, onChange, label }: {
    items:     EvidenceItem[];
    onChange?: (items: EvidenceItem[]) => void;
    label?:    string;
}) {
    const [picker, setPicker] = useState(false);
    const [linking, setLinking] = useState(false);
    const [viewing, setViewing] = useState<string | null>(null);

    const editable = !!onChange;
    const full = items.length >= MAX_EVIDENCE;

    function add(urls: string[]) {
        if (!onChange) return;
        const have = new Set(items.map(i => i.url));
        const fresh = urls.filter(u => u && !have.has(u)).map(url => ({ url, label: '' }));
        if (fresh.length === 0) return;
        onChange([...items, ...fresh].slice(0, MAX_EVIDENCE));
    }

    if (!editable && items.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <span className={mdtSectionHeader}>{label ?? t('mdt.evidence', 'Evidence')}</span>
                {editable && (
                    <span className="ms-auto flex items-center gap-1">
                        <MdtButton size="sm" variant="text" disabled={full} onClick={() => setPicker(true)}>
                            <span className="flex items-center gap-1.5">
                                <ImagePlus className="h-[14px] w-[14px]" strokeWidth={2.2} />
                                {t('mdt.evFromPhone', 'From phone')}
                            </span>
                        </MdtButton>
                        <MdtButton size="sm" variant="text" disabled={full} onClick={() => setLinking(true)}>
                            <span className="flex items-center gap-1.5">
                                <Link2 className="h-[14px] w-[14px]" strokeWidth={2.2} />
                                {t('mdt.evFromLink', 'Link')}
                            </span>
                        </MdtButton>
                    </span>
                )}
            </div>

            {items.length === 0 ? (
                <span className={mdtRowMeta}>
                    {t('mdt.evNone', 'Nothing attached. Add photos or clips from your phone, or paste a link.')}
                </span>
            ) : (
                <div className="flex flex-wrap gap-2.5">
                    {items.map((item, i) => (
                        <Tile
                            key={`${item.url}:${i}`}
                            item={item}
                            onOpen={() => setViewing(item.url)}
                            onRemove={onChange ? () => onChange(items.filter((_, x) => x !== i)) : undefined}
                        />
                    ))}
                </div>
            )}

            {picker && (
                <MediaPickerSheet
                    multiple
                    max={MAX_EVIDENCE - items.length}
                    onSelectMany={photos => { add(photos.map(p => p.url)); setPicker(false); }}
                    onClose={() => setPicker(false)}
                />
            )}

            {linking && (
                <PromptDialog
                    title={t('mdt.evLinkTitle', 'Attach by link')}
                    message={t('mdt.evLinkBody', 'Paste a direct link to an image or clip.')}
                    placeholder="https://"
                    confirmLabel={t('mdt.evAttach', 'Attach')}
                    onCancel={() => setLinking(false)}
                    onConfirm={value => {
                        const url = value.trim();
                        if (/^https?:\/\//i.test(url)) add([url]);
                        setLinking(false);
                    }}
                />
            )}

            {viewing && <ImageLightbox src={viewing} onClose={() => setViewing(null)} />}
        </div>
    );
}
