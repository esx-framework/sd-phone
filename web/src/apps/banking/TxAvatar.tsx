import { AppIconSVG } from '@/shell/AppIconSVG';
import type { CategoryMeta } from './data';
import type { BankTx } from './bankingApi';

const GAME_CATEGORIES = new Set(['chess', 'connectfour', 'battleship', 'blackjack', 'casino', 'wordle', 'ryde', 'streaks']);

export function TxAvatar({ tx, meta, size = 44 }: { tx: BankTx; meta: CategoryMeta; size?: number }) {
    const box = { width: size, height: size };
    if (GAME_CATEGORIES.has(tx.category)) {
        return (
            <span style={box} className="flex shrink-0 overflow-hidden rounded-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full">
                <AppIconSVG icon={tx.category} />
            </span>
        );
    }
    if (tx.avatar) {
        return <img src={tx.avatar} alt="" draggable={false} style={box} className="shrink-0 rounded-full object-cover" />;
    }
    if (tx.peerInitials) {
        return (
            <div
                className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
                style={{ ...box, fontSize: Math.round(size * 0.36), background: tx.peerColor ?? '#8e8e93' }}
            >
                {tx.peerInitials}
            </div>
        );
    }
    const Icon = meta.icon;
    return (
        <div className="flex shrink-0 items-center justify-center rounded-full" style={{ ...box, background: `${meta.color}22`, color: meta.color }}>
            <Icon style={{ width: Math.round(size * 0.45), height: Math.round(size * 0.45) }} strokeWidth={2} />
        </div>
    );
}
