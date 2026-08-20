import { Volume2, VolumeX } from 'lucide-react';

import { t } from '@/i18n';

import { useCasinoMute } from './muteStore';

export function MuteButton({ accent = '#fff' }: { accent?: string }) {
    const muted = useCasinoMute(s => s.muted);
    const toggle = useCasinoMute(s => s.toggle);
    const Icon = muted ? VolumeX : Volume2;

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={muted ? t('casino.unmute', 'Unmute') : t('casino.mute', 'Mute')}
            aria-pressed={muted}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full active:opacity-60"
            style={{ color: muted ? 'rgba(255,255,255,0.38)' : accent }}
        >
            <Icon className="h-[19px] w-[19px]" strokeWidth={2.3} />
        </button>
    );
}
