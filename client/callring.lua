---@type table sd-phone config root (configs.config): Phone.AudibleRing drives every value here.
local config = require 'configs.config'
---@type table Audible-ring helpers (shared.callring): distance falloff shared with the server.
local callring = require 'shared.callring'

---@type table Phone.AudibleRing settings, read once: a config reload restarts the resource anyway.
local cfg = config.Phone.AudibleRing or {}
---@type number Metres at which a nearby ring is inaudible.
local RANGE = tonumber(cfg.Range) or 15.0
---@type number Loudest a nearby ring is allowed to be, right next to the ringing player.
local VOLUME = tonumber(cfg.Volume) or 0.5
---@type number Volume multiplier applied when the ringing player is out of line of sight.
local OCCLUSION = tonumber(cfg.Occlusion) or 0.35
---@type integer Trace flag for HasEntityClearLosToEntity: world geometry plus vehicles.
local LOS_FLAGS <const> = 17
---@type integer Milliseconds between volume recalculations. Fast enough that walking away fades
---smoothly, slow enough that a busy street costs nothing.
local TICK <const> = 200

---@type table<number, string> Ringing player server id -> the tone id their phone is playing.
local ringing = {}
---@type boolean True while the volume loop is alive.
local looping = false
---@type string Last payload pushed to the page, so an unchanged street sends nothing.
local lastPush = ''

---Resolves a ringing player's ped, which is 0 whenever they are out of scope.
---@param src number player server id
---@return number ped
local function pedFor(src)
    local player = GetPlayerFromServerId(src)
    if player == -1 then return 0 end
    return GetPlayerPed(player)
end

---Builds the list of audible rings for the page: one entry per ringing player currently within
---earshot, carrying the tone to play and how loud it should be from here.
---@return table[] rings
---@return string signature comparable summary of the same list
local function collect()
    local listener = cache.ped
    local at = GetEntityCoords(listener)
    local rings, parts = {}, {}

    for src, tone in pairs(ringing) do
        local ped = pedFor(src)
        if ped ~= 0 then
            local volume = callring.volumeAt(#(GetEntityCoords(ped) - at), RANGE) * VOLUME
            if volume > 0 and not HasEntityClearLosToEntity(listener, ped, LOS_FLAGS) then
                volume = volume * OCCLUSION
            end
            if volume > 0.01 then
                volume = math.floor(volume * 100 + 0.5) / 100
                rings[#rings + 1] = { id = src, tone = tone, volume = volume }
                parts[#parts + 1] = ('%d:%s:%.2f'):format(src, tone, volume)
            end
        end
    end

    table.sort(parts)
    return rings, table.concat(parts, '|')
end

---Pushes the current set of audible rings to the page, which starts, retunes and stops its own
---audio from it. Skipped whenever nothing about the street has changed.
local function push()
    local rings, signature = collect()
    if signature == lastPush then return end
    lastPush = signature
    SendNUIMessage({ action = 'sd-phone:ring:nearby', data = { rings = rings } })
end

---Runs the volume loop for as long as any phone within earshot is ringing, then pushes one last
---empty list so the page stops whatever it still has playing.
local function startLoop()
    if looping then return end
    looping = true
    CreateThread(function()
        while next(ringing) do
            push()
            Wait(TICK)
        end
        looping = false
        push()
    end)
end

if cfg.Enabled ~= false then
    ---Resolves a `player:<serverId>` bag name to the server id it belongs to.
    ---@param bagName string
    ---@return integer|nil source
    local function bagOwner(bagName)
        return tonumber(bagName:match('player:(%d+)'))
    end

    ---Server to client: a player's phone started or stopped ringing out loud. The local player is
    ---skipped, since their own ringtone already plays on their own phone.
    AddStateBagChangeHandler('phoneRinging', nil, function(bagName, _key, value)
        local src = bagOwner(bagName)
        if not src or src == cache.serverId then return end

        if type(value) == 'string' and value ~= '' then
            ringing[src] = value
            startLoop()
        elseif ringing[src] then
            ringing[src] = nil
            push()
        end
    end)
end

---A phone left ringing when the resource stops would keep playing on every listener's page, since
---nothing else clears it.
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    SendNUIMessage({ action = 'sd-phone:ring:nearby', data = { rings = {} } })
end)
