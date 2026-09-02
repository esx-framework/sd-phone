import type { ComponentType } from 'react';
import { Clock, Send, Trash2 } from 'lucide-react';

import { t } from '@/i18n';
import { scheduleLabel } from './SchedulePickerSheet';

export function ScheduledRow({ title, eyebrow, body, publishAt, accent, onOpen, onRetime, onPublishNow, onCancel }: {
    title:         string;
    eyebrow?:      string;
    body?:         string;
    publishAt:     number;
    accent?:       string;
    onOpen:        () => void;
    onRetime:      () => void;
    onPublishNow:  () => void;
    onCancel:      () => void;
}) {
    return (
        <div className="rounded-[16px] bg-surface p-3.5 shadow-sm">
            <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 text-left active:opacity-80">
                <span
                    className={`mt-[3px] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${accent ? '' : 'bg-ios-blue'}`}
                    style={accent ? { background: accent } : undefined}
                >
                    <Clock className="h-[18px] w-[18px]" strokeWidth={2.3} />
                </span>
                <span className="min-w-0 flex-1">
                    {eyebrow && (
                        <span
                            className={`block text-[12px] font-bold uppercase tracking-wide ${accent ? '' : 'text-ios-blue'}`}
                            style={accent ? { color: accent } : undefined}
                        >
                            {eyebrow}
                        </span>
                    )}
                    <span className="mt-0.5 line-clamp-2 block text-[17px] font-semibold leading-[1.2] text-black dark:text-white">
                        {title}
                    </span>
                    {body && <span className="mt-1 line-clamp-2 block text-[15px] leading-snug text-black/70 dark:text-white/70">{body}</span>}
                    <span className="mt-1.5 block text-[13.5px] font-medium text-ios-gray">
                        {t('schedule.publishes', 'Publishes {when}', { when: scheduleLabel(publishAt) })}
                    </span>
                </span>
            </button>

            <div className="mt-3 flex items-center gap-2 border-t border-hairline/10 pt-3">
                <RowAction icon={Clock} label={t('schedule.changeTime', 'Change time')} onClick={onRetime} />
                <RowAction icon={Send} label={t('schedule.publishNow', 'Publish now')} onClick={onPublishNow} />
                <RowAction icon={Trash2} label={t('schedule.cancel', 'Cancel')} destructive onClick={onCancel} />
            </div>
        </div>
    );
}

function RowAction({ icon: Icon, label, destructive = false, onClick }: {
    icon:         ComponentType<{ className?: string; strokeWidth?: number }>;
    label:        string;
    destructive?: boolean;
    onClick:      () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13.5px] font-semibold active:opacity-60 ${
                destructive ? 'bg-ios-red/10 text-ios-red' : 'bg-black/[0.05] text-black dark:bg-white/[0.12] dark:text-white'
            }`}
        >
            <Icon className="h-[16px] w-[16px]" strokeWidth={2.3} />
            {label}
        </button>
    );
}
