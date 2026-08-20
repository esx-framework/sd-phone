import { t } from '@/i18n';

import { GOLD, SURFACE } from '../theme';

const RANKING: { key: string; label: () => string; example: string }[] = [
    { key: 'straightFlush', label: () => t('holdem.straightFlush', 'Straight flush'),  example: '9♠ 8♠ 7♠ 6♠ 5♠' },
    { key: 'quads',         label: () => t('holdem.quads', 'Four of a kind'),          example: 'Q♠ Q♥ Q♦ Q♣ 4♠' },
    { key: 'fullHouse',     label: () => t('holdem.fullHouse', 'Full house'),          example: 'J♠ J♥ J♦ 8♣ 8♠' },
    { key: 'flush',         label: () => t('holdem.flush', 'Flush'),                   example: 'A♥ J♥ 8♥ 5♥ 2♥' },
    { key: 'straight',      label: () => t('holdem.straight', 'Straight'),             example: '10♠ 9♥ 8♦ 7♣ 6♠' },
    { key: 'trips',         label: () => t('holdem.trips', 'Three of a kind'),         example: '7♠ 7♥ 7♦ K♣ 3♠' },
    { key: 'twoPair',       label: () => t('holdem.twoPair', 'Two pair'),              example: 'A♠ A♥ 6♦ 6♣ 9♠' },
    { key: 'pair',          label: () => t('holdem.pair', 'Pair'),                     example: '5♠ 5♥ K♦ 9♣ 2♠' },
    { key: 'highCard',      label: () => t('holdem.highCard', 'High card'),            example: 'A♠ Q♥ 9♦ 6♣ 3♠' },
];

export function HoldemRules() {
    return (
        <>
            <div className="flex items-center justify-between pb-1 pt-2 text-[12px] font-bold uppercase tracking-wide text-white/45">
                <span>{t('holdem.ranking', 'Hand ranking')}</span>
                <span>{t('holdem.bestFive', 'Best five of seven')}</span>
            </div>

            {RANKING.map((row, i) => (
                <div key={row.key} className="flex items-center justify-between border-t py-2 first:border-t-0" style={{ borderColor: SURFACE.hair }}>
                    <span className="text-[15px] font-semibold text-white/85">{row.label()}</span>
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: i === 0 ? GOLD.top : 'rgba(255,255,255,0.55)' }}>
                        {row.example}
                    </span>
                </div>
            ))}

            <div className="border-t pt-2" style={{ borderColor: SURFACE.hair }}>
                <p className="text-[13px] font-semibold text-white/55">
                    {t('holdem.noRake', 'No rake. Every chip in the pot goes to a player.')}
                </p>
                <p className="pt-1 text-[13px] font-semibold text-white/55">
                    {t('holdem.blindsRule', 'The button posts the small blind and acts first before the flop when only two are seated.')}
                </p>
                <p className="pb-2 pt-1 text-[13px] font-semibold text-white/55">
                    {t('holdem.sidePotRule', 'When a player is all in for less, the extra chips form a side pot only the remaining players can win.')}
                </p>
            </div>
        </>
    );
}
