export type CrashPhase = 'idle' | 'bet' | 'run' | 'bust';

export interface CrashPlayerBet { n: string; s: number }

export interface CrashCashout { n: string; m: number; w: number }

export interface CrashRound { id: string; bust: number; seed: string | null; commit: string | null }

export interface CrashTick {
    id:      string;
    ph:      'bet' | 'run';
    ms:      number;
    now:     number;
    mx?:     number;
    commit?: string | null;
    bet?:    CrashPlayerBet[];
    cash?:   CrashCashout[];
}

export interface CrashBust { id: string; bust: number; seed: string | null; commit: string | null }

export interface CrashSettled { id: string; stake: number; payout: number; mx: number | null; chips: number }

export interface CrashMine { stake: number; auto: number | null; settled: boolean; mx: number | null; payout: number }

export interface CrashSnapshot {
    ph:        CrashPhase;
    id:        string;
    commit:    string | null;
    max:       number;
    now:       number;
    startedAt: number;
    msLeft:    number;
    mx:        number;
    bets:      CrashPlayerBet[];
    cash:      CrashCashout[];
    mine:      CrashMine | null;
    history:   CrashRound[];
}
