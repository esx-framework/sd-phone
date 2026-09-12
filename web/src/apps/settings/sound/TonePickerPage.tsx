import { useEffect, useState } from 'react';
import { Check, Play, Plus, Square, Trash2 } from 'lucide-react';

import { t } from '@/i18n';
import { useIosPush } from '@/hooks/useIosPush';
import { NavBar } from '@/ui/NavBar';
import type { CustomTone, Tone } from '../tones';
import { startPreview, stopPreview } from '../tonePlayer';
import { AddToneDialog } from './AddToneDialog';

export function TonePickerPage({
    title, backLabel, tones, selected, previewVol, onSelect, onBack, custom,
}: {
    title: string;
    backLabel: string;
    tones: Tone[];
    selected: string;
    previewVol: number;
    onSelect: (id: string) => void;
    onBack: () => void;
    custom?: {
        noun:           string;
        myTones:        string;
        addTone:        string;
        pasteHint:      string;
        addToneMessage: string;
        items:    CustomTone[];
        onAdd:    (name: string, url: string) => void;
        onRemove: (id: string) => void;
    };
}) {
    const { goBack, pageStyle } = useIosPush(onBack);

    const [previewing, setPreviewing] = useState<string | null>(null);
    const [adding, setAdding]         = useState(false);

    useEffect(() => stopPreview, []);

    const togglePreview = (tone: { id: string; url: string }) => {
        if (previewing === tone.id) {
            stopPreview();
            setPreviewing(null);
        } else {
            startPreview(tone.url, previewVol, () => setPreviewing(null));
            setPreviewing(tone.id);
        }
    };

    const renderTone = (
        tone: { id: string; name: string; url: string },
        divider: boolean,
        onDelete?: () => void,
    ) => {
        const isPreviewing = previewing === tone.id;
        return (
            <div key={tone.id} className="relative flex w-full items-center ps-4 pe-2">
                <button
                    type="button"
                    onClick={() => onSelect(tone.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 py-3 text-start active:opacity-50"
                >
                    <span dir="auto" className="min-w-0 flex-1 truncate text-[17px] font-normal text-black dark:text-white">{tone.name}</span>
                    {selected === tone.id && (
                        <Check className="h-[17px] w-[17px] shrink-0 text-ios-blue" strokeWidth={2.5} />
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => togglePreview(tone)}
                    aria-label={isPreviewing
                        ? t('settings.stopPreviewOf', 'Stop preview of {name}', { name: tone.name })
                        : t('settings.previewOf', 'Preview {name}', { name: tone.name })}
                    className="ms-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ios-blue active:opacity-40"
                >
                    {isPreviewing
                        ? <Square className="h-[15px] w-[15px]" fill="currentColor" strokeWidth={0} />
                        : <Play className="h-[16px] w-[16px] translate-x-[1px]" fill="currentColor" strokeWidth={0} />}
                </button>
                {onDelete && (
                    <button
                        type="button"
                        onClick={onDelete}
                        aria-label={t('settings.deleteOf', 'Delete {name}', { name: tone.name })}
                        className="ms-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ios-red active:opacity-40"
                    >
                        <Trash2 className="h-[16px] w-[16px]" strokeWidth={2} />
                    </button>
                )}
                {divider && (
                    <div
                        className="pointer-events-none absolute bottom-0 end-0 bg-ios-gray4 dark:bg-control"
                        style={{ insetInlineStart: 0, height: '0.5px' }}
                    />
                )}
            </div>
        );
    };

    return (
        <div
            className="absolute inset-0 z-30 flex flex-col bg-base"
            style={pageStyle}
        >
            <div className="h-11 shrink-0" aria-hidden />

            <NavBar backLabel={backLabel} onBack={goBack} title={title} hairline />

            <div className="flex-1 overflow-y-auto no-scrollbar">
                <div className="mt-6 px-4 pb-10">
                    <div className="overflow-hidden rounded-[10px] bg-surface">
                        {tones.map((tone, i) => renderTone(tone, i < tones.length - 1))}
                    </div>

                    {custom && (
                        <>
                            <div className="mb-2 mt-7 px-4 text-[13px] font-normal uppercase tracking-wide text-ios-gray">
                                {custom.myTones}
                            </div>
                            <div className="overflow-hidden rounded-[10px] bg-surface">
                                {custom.items.map(c => renderTone(c, true, () => {
                                    if (previewing === c.id) { stopPreview(); setPreviewing(null); }
                                    custom.onRemove(c.id);
                                }))}
                                <button
                                    type="button"
                                    onClick={() => setAdding(true)}
                                    className="flex w-full items-center gap-2 px-4 py-3 text-start active:opacity-50"
                                >
                                    <Plus className="h-[18px] w-[18px] shrink-0 text-ios-blue" strokeWidth={2.5} />
                                    <span className="text-[17px] text-ios-blue">{custom.addTone}</span>
                                </button>
                            </div>
                            <div className="mt-2 px-4 text-[13px] leading-snug text-ios-gray">
                                {custom.pasteHint}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {adding && custom && (
                <AddToneDialog
                    title={custom.addTone}
                    message={custom.addToneMessage}
                    onCancel={() => setAdding(false)}
                    onConfirm={(name, url) => { custom.onAdd(name, url); setAdding(false); }}
                />
            )}
        </div>
    );
}
