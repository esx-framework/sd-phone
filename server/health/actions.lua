---@type table sd-phone config root (configs/config.lua).
local config = require 'configs.config'
---@type table Health persistence (server.health.store): daily row banking + reads.
local store = require 'server.health.store'
---@type table Player bridge (bridge.server.player): citizenid from a server id.
local player = require 'bridge.server.player'

---@type table Health settings (configs/health.lua).
local H <const> = config.Health or {}
---@type table Leaderboard settings; a missing table reads as enabled at the default size.
local LB <const> = H.Leaderboard or {}
---@type integer Ranked rows returned to the app.
local LB_SIZE <const> = math.max(1, math.floor(tonumber(LB.Size) or 20))
---@type integer Days of history the summary carries; the chart draws all of them.
local CHART_DAYS <const> = 7

---@type table Actions module; the table returned at end of file.
local actions = {}

---@type table<number, number> Server id -> os.time of that player's last accepted flush. The gap
---between flushes is the only budget a claim is measured against, so it is held per source and
---dropped when they leave rather than trusted from the client.
local lastFlush = {}

---Whether the leaderboard is switched on.
---@return boolean
function actions.leaderboardEnabled()
    return LB.Enabled ~= false
end

---Forgets a player's flush clock. A reconnect starts a fresh budget.
---@param source number
function actions.forget(source)
    lastFlush[source] = nil
end

---Banks a flush from one player. The elapsed budget is the gap since their previous flush, or the
---flush interval on their first one.
---@param source number
---@param delta table client-reported deltas since its last flush
---@return boolean accepted
function actions.flush(source, delta)
    if type(delta) ~= 'table' then return false end

    local cid = player.getRealIdentifier(source)
    if not cid then return false end

    local now     = os.time()
    local elapsed = lastFlush[source] and (now - lastFlush[source]) or 60
    lastFlush[source] = now

    store.bank(cid, player.getName(source) or '', delta, elapsed)
    return true
end

---Everything the Summary tab draws: today's totals, the last week of daily rows, and the goal the
---ring fills to.
---@param source number
---@return table|nil summary nil when the caller has no character
function actions.summary(source)
    local cid = player.getRealIdentifier(source)
    if not cid then return nil end

    local history = store.history(cid, CHART_DAYS)
    local today   = history[#history] or { steps = 0, distanceM = 0, activeMs = 0, peakHr = 0 }

    return {
        goal    = math.max(1, math.floor(tonumber(H.StepGoal) or 10000)),
        today   = today,
        history = history,
    }
end

---Today's steps board, with the caller's own standing attached. Returns display names only, never
---citizenids.
---@param source number
---@return table|nil board nil when the caller has no character or the board is switched off
function actions.leaderboard(source)
    if not actions.leaderboardEnabled() then return nil end

    local cid = player.getRealIdentifier(source)
    if not cid then return nil end

    local board = store.leaderboard(cid, LB_SIZE)
    local rows  = {}
    for i = 1, #board.top do
        local entry = board.top[i]
        rows[i] = {
            rank  = i,
            name  = (entry.name ~= nil and entry.name ~= '') and entry.name or 'Unknown',
            steps = math.floor(tonumber(entry.steps) or 0),
            you   = entry.citizenid == cid,
        }
    end

    return { entries = rows, rank = board.rank, steps = board.steps }
end

return actions
