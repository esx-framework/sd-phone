import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { t } from '@/i18n';

interface GameHeaderProps {
    title:   string;
    accent?: string;
    onBack:  () => void;
    right?:  ReactNode;
}

export function GameHeader({ title, accent = '#fff', onBack, right }: GameHeaderProps) {
    return (
        <div className="relative flex shrink-0 items-center justify-center px-4 pb-1 pt-1">
            <button type="button" onClick={onBack} aria-label={t('games.back', 'Back')} className="absolute left-3 flex items-center active:opacity-60" style={{ color: accent }}>
                <ChevronLeft className="h-[30px] w-[30px]" strokeWidth={2.4} />
            </button>
            <h1 className="text-[20px] font-extrabold tracking-tight text-white">{title}</h1>
            {right && <div className="absolute right-3 flex items-center">{right}</div>}
        </div>
    );
}
