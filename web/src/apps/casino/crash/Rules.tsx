import { t } from '@/i18n';
import { EMBER, GOLD, SURFACE } from '@/apps/casino/theme';

import { fmtMult } from './curve';

const REACH = [150, 200, 500, 1000, 5000];

export function CrashRules() {
    return (
        <>
            <Row
                label={t('crash.cashOut', 'Cash Out')}
                sub={t('crash.cashOutSub', 'Tap before the round busts')}
                value={t('crash.stakeTimes', 'Stake x multiplier')}
                example="100 at 2.41x = 241"
                highlight
            />
            <Row
                label={t('crash.busted', 'Busted')}
                sub={t('crash.bustedSub', 'The multiplier stops climbing')}
                value={t('crash.stakeLost', 'Stake lost')}
                example="100 at 1.00x = 0"
            />
            <Row
                label={t('crash.auto', 'Auto cash out')}
                sub={t('crash.autoSub', 'Pays at your target even if you look away')}
                value={t('crash.autoValue', 'Your target')}
                example="2.00x"
            />

            <div className="flex items-center justify-between border-t pb-1 pt-3 text-[12px] font-bold uppercase tracking-wide text-white/45" style={{ borderColor: SURFACE.hair }}>
                <span>{t('crash.reachHeader', 'Reaches')}</span>
                <span>{t('crash.chance', 'Chance')}</span>
            </div>
            {REACH.map(x100 => (
                <div key={x100} className="flex items-center justify-between border-t py-2" style={{ borderColor: SURFACE.hair }}>
                    <span className="text-[15px] font-semibold text-white/85">{fmtMult(x100)}x</span>
                    <span className="text-[15px] font-extrabold tabular-nums" style={{ color: x100 >= 1000 ? GOLD.top : '#fff' }}>
                        {(9700 / x100).toFixed(1)}%
                    </span>
                </div>
            ))}

            <p className="border-t pb-1 pt-2 text-[13px] font-semibold text-white/55" style={{ borderColor: SURFACE.hair }}>
                {t('crash.edge', 'The house edge is 3% at every cash out target.')}
            </p>
            <p className="pb-2 text-[13px] font-semibold" style={{ color: EMBER.hot }}>
                {t('crash.verifyHow', 'The seed with ":commit" on the end hashes to the round hash you saw before betting. The seed on its own decides where the round busts.')}
            </p>
        </>
    );
}

function Row({ label, sub, value, example, highlight }: {
    label:      string;
    sub:        string;
    value:      string;
    example:    string;
    highlight?: boolean;
}) {
    return (
        <div className="flex items-center justify-between border-t py-2 first:border-t-0" style={{ borderColor: SURFACE.hair }}>
            <span className="flex min-w-0 flex-col pr-3">
                <span className="text-[15px] font-bold text-white">{label}</span>
                <span className="text-[13px] font-semibold text-white/55">{sub}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end">
                <span className="text-[15px] font-extrabold" style={{ color: highlight ? GOLD.top : '#fff' }}>{value}</span>
                <span className="text-[13px] font-semibold tabular-nums text-white/55">{example}</span>
            </span>
        </div>
    );
}
