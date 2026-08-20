-- The casino's two push channels. Both carry per-round state that the generic games relay cannot
-- express: crash fans out to every watcher at 4Hz, hold'em pushes a different view to each seat.

---Server push: one crash tick (betting countdown or the running multiplier plus the deltas since
---the previous tick).
---@param data table tick payload from server/games/casino/crash/round.lua
RegisterNetEvent('sd-phone:client:crash:tick', function(data)
    SendNUIMessage({ action = 'sd-phone:crash:tick', data = data })
end)

---Server push: the round busted; carries the revealed seed so the client can verify the commit.
---@param data table bust payload from server/games/casino/crash/round.lua
RegisterNetEvent('sd-phone:client:crash:bust', function(data)
    SendNUIMessage({ action = 'sd-phone:crash:bust', data = data })
end)

---Server push: this player's own crash bet settled (cashed out, or lost at the bust).
---@param data table settlement payload from server/games/casino/crash/round.lua
RegisterNetEvent('sd-phone:client:crash:settled', function(data)
    SendNUIMessage({ action = 'sd-phone:crash:settled', data = data })
end)

---Server push: a hold'em table state change, already narrowed to this seat's view.
---@param data table table state from server/games/casino/holdem/table.lua
RegisterNetEvent('sd-phone:client:holdem:state', function(data)
    SendNUIMessage({ action = 'sd-phone:holdem:state', data = data })
end)

---Server push: a hold'em hand ended; pot breakdown, awards and every revealed hand.
---@param data table hand summary from server/games/casino/holdem/table.lua
RegisterNetEvent('sd-phone:client:holdem:hand', function(data)
    SendNUIMessage({ action = 'sd-phone:holdem:hand', data = data })
end)

---@type boolean Whether the NUI last asked to receive the crash tick.
local crashWanted = false
---@type boolean Whether the phone is on screen.
local phoneOpen = false

---Mirrors the NUI's subscribe intent, then applies it against the phone's open state: a holstered
---phone must not be fed a 4Hz tick, but the intent has to survive so re-opening resumes it. This is
---the only writer of the subscription, so the NUI takes its snapshot from the reply rather than
---asking the server a second time and overwriting the gate with a raw `on`.
---@param push boolean true to hand the snapshot to the NUI as a push
---@return table envelope the server's reply
local function applyCrashWatch(push)
    local reply = lib.callback.await('sd-phone:server:games:crashWatch', false,
        { on = crashWanted and phoneOpen })
    if push and reply and reply.success and reply.data then
        SendNUIMessage({ action = 'sd-phone:crash:snapshot', data = reply.data })
    end
    return reply or { success = false, message = 'No response from server' }
end

-- Unsubscribing stops rendering traffic only. A live crash bet is keyed on citizenid inside the
-- round and settles regardless of whether anyone is watching.
RegisterNUICallback('sd-phone:crash:watch', function(payload, cb)
    crashWanted = payload and payload.on == true
    cb(applyCrashWatch(false))
end)

-- Re-opening the phone re-subscribes, and the board moved on while it was holstered: the snapshot
-- from that same call is pushed straight in so the history rail and the player's own bet are not
-- left stale until the next round starts.
AddEventHandler('sd-phone:client:openState', function(open)
    phoneOpen = open
    if crashWanted then CreateThread(function() applyCrashWatch(open) end) end
end)
