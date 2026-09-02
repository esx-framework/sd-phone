import { useEffect } from 'react';

import { startRing } from './ringtone';
import { startRingtone } from '@/apps/settings/tonePlayer';
import { resolveTone } from '@/apps/settings/tones';
import { useTheme } from '@/stores/themeStore';
import { useCallStore } from '@/stores/callStore';

export function useCallRing(enabled: boolean) {
    const phase = useCallStore(s => s.phase);
    const channel = useCallStore(s => s.channel);
    const { ringtone, ringtoneVol, customRingtones, focus } = useTheme('ringtone', 'ringtoneVol', 'customRingtones', 'focus');

    useEffect(() => {
        if (!enabled || !phase || phase === 'active') return;
        if (phase === 'incoming') {
            if (focus) return;
            return startRingtone(resolveTone('ringtone', ringtone, customRingtones).url, ringtoneVol / 100);
        }
        return startRing('ringback');
    }, [enabled, channel, phase, ringtone, ringtoneVol, customRingtones, focus]);
}
