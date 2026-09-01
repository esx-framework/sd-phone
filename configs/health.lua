-- Health. The client samples steps, on-foot distance and a simulated heart rate every
-- 250ms (client/apps/health.lua) and flushes the DELTAS to the server, which banks them
-- into one row per player per day in `phone_health_daily`. That table is what the 7-day
-- chart and the daily steps leaderboard both read.
--
-- Steps are counted on the client, so the server treats every flush as a claim rather
-- than a fact: anything above what the elapsed time could physically produce is capped
-- to that ceiling. A cheat becomes an unremarkable number instead of a banned player.
return {
    -- Steps the summary ring fills to. Purely cosmetic; nothing gates on it.
    StepGoal = 10000,

    -- Days of daily rows kept per player. Older rows are pruned once on boot. The chart
    -- shows 7; the rest is headroom for anyone who wants to query further back.
    RetentionDays = 30,

    Leaderboard = {
        -- Whether the Leaderboard tab appears at all. Off leaves Summary on its own.
        Enabled = true,

        -- Players listed. The caller's own row is always returned alongside these, even
        -- when they rank below the cut.
        Size = 20,
    },

    -- Ceilings the server applies per flush, per second of elapsed time. Both match the
    -- fastest the sampler could legitimately report: SPRINT cadence, and a sprint speed
    -- with headroom. Raise them only if a legitimate movement mode outruns them.
    Limits = {
        StepsPerSecond    = 3.4,
        MetresPerSecond   = 7.5,

        -- Seconds of a single flush that count toward those ceilings. A player who was
        -- away far longer than the flush interval cannot bank the whole gap.
        MaxElapsedSeconds = 120,
    },
}
