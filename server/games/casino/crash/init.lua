---@type table Shared server helpers (server.util): envelopes, the configs/apps.lua switch, cleanup.
local util     = require 'server.util'
---@type table Casino helpers (server.games.casino.shared): identity from a server-trusted source.
local shared   = require 'server.games.casino.shared'
---@type table Crash round engine (server.games.casino.crash.round): the loop, the seed, the money.
local round    = require 'server.games.casino.crash.round'
---@type table Chip wallet (server.games.chips): the batched refund written on resource stop.
local chips    = require 'server.games.chips'
---@type table Watcher registry (server.watchers) for players with Crash on screen.
local watchers = require('server.watchers').of('crash')

---@type boolean Whether the Casino is switched on in configs/apps.lua. A disabled app must not
---run a round loop nobody can reach, so the thread returns before its first cycle.
local APP_ENABLED = util.appEnabled('casino')

---Subscribes or unsubscribes the caller from the round push and, on subscribe, answers with the
---whole board. There is no separate state call: a phone opening nine seconds into a climb gets
---the round id, the commitment, the clock offset and every bet placed so far from this one reply.
lib.callback.register('sd-phone:server:games:crashWatch', function(src, payload)
    if not shared.enabled('crash') then return shared.shut() end
    payload = type(payload) == 'table' and payload or {}
    local on = payload.on == true
    watchers.watch(src, on)
    if not on then return util.ok({}) end
    return util.ok(round.snapshot(shared.cidOf(src)))
end)

---Places the caller's stake for the open betting window.
lib.callback.register('sd-phone:server:games:crashBet', function(src, payload)
    if not shared.enabled('crash') then return shared.shut() end
    return round.placeBet(src, type(payload) == 'table' and payload or {})
end)

---Cashes the caller out of the running round. The payload carries the round id and nothing else.
lib.callback.register('sd-phone:server:games:crashCashout', function(src, payload)
    if not shared.enabled('crash') then return shared.shut() end
    return round.cashout(src, type(payload) == 'table' and payload or {})
end)

---Drops a departing player's push subscription and detaches their bet's source. The bet itself
---stays in the round, so an auto cash out still pays and a losing round still loses.
util.onCleanup(function(src, cid)
    watchers.drop(src)
    round.markOffline(cid)
end)

---Every stake still riding the round is refunded before the resource goes away. The round cannot
---be run to its bust once the loop is gone, so the alternative is quietly keeping the chips.
---@param resource string name of the resource that stopped
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    local ok, err = pcall(function() chips.creditMany(round.releaseAll()) end)
    if not ok then print(('^1[sd-phone] crash stakes were not returned: %s^7'):format(err)) end
end)

-- The shared round loop. Idle costs one 250ms poll and nothing else: no seed is generated and no
-- packet is sent until somebody is actually looking at the game. runCycle blocks for exactly one
-- round, so the cadence inside a round is owned there rather than split across two places.
CreateThread(function()
    if not APP_ENABLED or not shared.enabled('crash') then return end

    while true do
        Wait(250)
        if watchers.any() then round.runCycle() end
    end
end)

return round
