-- Casino app (Blackjack, Baccarat, Crash, Roulette, Slots, Texas Hold'em). Table limits and
-- cadence only: the reel strips, the paytable, the roulette odds, the baccarat commission and the
-- crash curve are fixed in server/games/casino/* because they set the house edge (slots 4.65%,
-- roulette 2.70%, baccarat 1.06% on Banker, crash a flat 3.00%, hold'em rake-free) and a wrong
-- value there is invisible until it is expensive. Blackjack keeps its own limits in
-- server/games/blackjack.lua.
return {
    Slots = {
        MinLineBet   = 5,
        MaxLineBet   = 5000,   -- x5 lines, so 25,000 chips is the biggest slots stake
        SpinCooldown = 700,    -- ms between spins, per character
    },
    Roulette = {
        MinChip       = 5,
        MaxTotalStake = 25000, -- summed across every bet on one spin
        MaxBets       = 20,    -- distinct bet entries per spin
        SpinCooldown  = 1200,
    },
    Baccarat = {
        MinBet       = 25,
        MaxBet       = 100000, -- per main spot (Player / Banker / Tie)
        MaxSideBet   = 10000,  -- per pair spot
        MaxTotal     = 200000, -- summed across every spot on one hand
        DealCooldown = 800,
    },
    Crash = {
        MinBet        = 25,
        MaxBet        = 50000,
        BettingMs     = 12000,
        BustHoldMs    = 5000,
        MaxMultiplier = 100,   -- 100.00x ceiling; the round busts here at the latest
        HistorySize   = 20,
    },
    Holdem = {
        ActionSeconds = 20,
        Tables = {
            { id = 'low',  name = 'Sandy Shores', sb = 25,  bb = 50,   minBuyIn = 2000,  maxBuyIn = 10000 },
            { id = 'mid',  name = 'Vinewood',     sb = 100, bb = 200,  minBuyIn = 8000,  maxBuyIn = 40000 },
            { id = 'high', name = 'Diamond',      sb = 500, bb = 1000, minBuyIn = 40000, maxBuyIn = 200000 },
        },
    },
}
