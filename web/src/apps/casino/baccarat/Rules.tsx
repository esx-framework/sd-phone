import { t } from '@/i18n';

import { GOLD, SURFACE } from '../theme';

const PAYOUTS: { key: string; label: () => string; pays: string; note: () => string }[] = [
    { key: 'player', label: () => t('baccarat.player', 'Player'),     pays: '1:1',    note: () => t('baccarat.edgePlayer', 'Player 1.24%') },
    { key: 'banker', label: () => t('baccarat.banker', 'Banker'),     pays: '0.95:1', note: () => t('baccarat.edgeBanker', 'Banker 1.06%') },
    { key: 'tie',    label: () => t('baccarat.tie', 'Tie'),           pays: '8:1',    note: () => t('baccarat.edgeTie', 'Tie 14.36%') },
    { key: 'ppair',  label: () => t('baccarat.playerPair', 'P Pair'), pays: '11:1',   note: () => t('baccarat.edgePairs', 'Pairs 10.36%') },
    { key: 'bpair',  label: () => t('baccarat.bankerPair', 'B Pair'), pays: '11:1',   note: () => t('baccarat.edgePairs', 'Pairs 10.36%') },
];

const TABLEAU: { total: string; draws: () => string }[] = [
    { total: '0, 1, 2', draws: () => t('baccarat.anyCard', 'Any card') },
    { total: '3',       draws: () => '0-7, 9' },
    { total: '4',       draws: () => '2-7' },
    { total: '5',       draws: () => '4-7' },
    { total: '6',       draws: () => '6, 7' },
    { total: '7',       draws: () => t('baccarat.stands', 'Stands') },
];

export function BaccaratRules() {
    return (
        <>
            <div className="flex items-center justify-between pb-1 pt-2 text-[12px] font-bold uppercase tracking-wide text-white/45">
                <span>{t('casino.paytable', 'Paytable')}</span>
                <span>{t('baccarat.total', 'Total')}</span>
            </div>
            {PAYOUTS.map(row => (
                <div
                    key={row.key}
                    className="flex items-center justify-between border-t py-2 first:border-t-0"
                    style={{ borderColor: SURFACE.hair }}
                >
                    <span className="flex min-w-0 flex-col">
                        <span className="text-[15px] font-bold text-white">{row.label()}</span>
                        <span className="text-[13px] font-semibold text-white/50">{row.note()}</span>
                    </span>
                    <span className="text-[15px] font-extrabold tabular-nums" style={{ color: GOLD.top }}>{row.pays}</span>
                </div>
            ))}

            <p className="border-t pt-2 text-[13px] font-semibold text-white/55" style={{ borderColor: SURFACE.hair }}>
                {t('baccarat.commission', '5% commission on Banker wins, to the nearest chip')}
            </p>
            <p className="pt-1 text-[13px] font-semibold text-white/55">
                {t('baccarat.tiePush', 'Player and Banker bets push on a tie')}
            </p>
            <p className="pt-1 text-[13px] font-semibold text-white/55">
                {t('baccarat.pairRule', 'A pair is two cards of the same rank')}
            </p>

            <div className="mt-3 pb-1 text-[12px] font-bold uppercase tracking-wide text-white/45">
                {t('baccarat.thirdCard', 'Third card rules')}
            </div>
            <p className="text-[13px] font-semibold text-white/55">
                {t('baccarat.naturalRule', 'An 8 or 9 on the first two cards ends the hand where it stands.')}
            </p>
            <p className="pt-1 text-[13px] font-semibold text-white/55">
                {t('baccarat.playerRule', 'The Player draws on 0 to 5 and stands on 6 or 7.')}
            </p>
            <p className="pb-1 pt-1 text-[13px] font-semibold text-white/55">
                {t('baccarat.bankerStoodRule', 'If the Player stands, the Banker draws on 0 to 5 and stands on 6 or 7.')}
            </p>

            <div
                className="mt-2 flex items-center justify-between border-t pb-1 pt-2 text-[12px] font-bold uppercase tracking-wide text-white/45"
                style={{ borderColor: SURFACE.hair }}
            >
                <span>{t('baccarat.banker', 'Banker')}</span>
                <span>{t('baccarat.drawsOn', 'Draws on the third card')}</span>
            </div>
            {TABLEAU.map(row => (
                <div
                    key={row.total}
                    className="flex items-center justify-between border-t py-1.5"
                    style={{ borderColor: SURFACE.hair }}
                >
                    <span className="text-[14px] font-semibold tabular-nums text-white/80">{row.total}</span>
                    <span className="text-[14px] font-bold tabular-nums text-white">{row.draws()}</span>
                </div>
            ))}
            <div className="pb-2" />
        </>
    );
}
