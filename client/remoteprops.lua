---@type table sd-phone config root (configs/config.lua).
local config = require 'configs.config'
---@type table Hold pose (client.pose): createProp builds the welded copy.
local pose = require 'client.pose'
---@type table<string, boolean> Valid frame colours (client.framecolors).
local FRAME_COLORS = require 'client.framecolors'

---@type table Module table; the table returned at end of file. Owns the local phone-prop copies
---welded onto OTHER players, driven by the replicated `sdPhone` statebag each holder broadcasts.
local remoteprops = {}

---@type table<integer, { obj: integer, color: string }> Server id -> welded copy.
local props = {}
---@type table<integer, string> Server id -> the colour that holder is currently broadcasting, held
---whether or not a copy is welded yet, so a holder who was out of scope still gets one later.
local wanted = {}
---@type table<integer, integer> Server id -> weld generation. Welding streams the model, which
---yields, so a weld can finish after another has replaced it or after the holder stowed their
---phone; comparing this tells it to delete what it built rather than orphan a prop nothing tracks.
local seq = {}

---@type integer Seconds between reconcile sweeps.
local SWEEP_INTERVAL <const> = 1000

---Deletes a holder's welded copy, if any. Idempotent, and cancels any weld still streaming.
---@param source integer server id of the remote holder
function remoteprops.remove(source)
    seq[source] = (seq[source] or 0) + 1
    local entry = props[source]
    if entry and entry.obj and DoesEntityExist(entry.obj) then DeleteObject(entry.obj) end
    props[source] = nil
end

---Forgets a holder entirely: the copy, the colour they were broadcasting, and the generation.
---@param source integer server id of the remote holder
local function forget(source)
    remoteprops.remove(source)
    wanted[source] = nil
    seq[source] = nil
end

---The ped a holder is currently on for this client, or 0 when they are out of scope.
---@param source integer server id
---@return integer ped
local function pedOf(source)
    local plyr = GetPlayerFromServerId(source)
    if plyr == -1 then return 0 end
    return GetPlayerPed(plyr)
end

---Welds a fresh copy in `colour` onto `ped`. A weld superseded or stowed while its model streamed
---deletes what it built instead of claiming the slot.
---@param source integer server id of the remote holder
---@param ped integer that holder's ped
---@param colour string frame colour; must be a key of FRAME_COLORS
local function weld(source, ped, colour)
    local mine = (seq[source] or 0) + 1
    seq[source] = mine

    local obj = pose.createProp(ped, colour)
    if not obj then return end

    if seq[source] ~= mine or wanted[source] ~= colour then
        DeleteObject(obj)
        return
    end

    remoteprops.remove(source)
    seq[source] = mine
    props[source] = { obj = obj, color = colour }
end

---Whether the copy welded for a holder already matches what they are broadcasting.
---@param source integer server id
---@param colour string frame colour
---@return boolean
local function upToDate(source, colour)
    local entry = props[source]
    return entry ~= nil and entry.color == colour and DoesEntityExist(entry.obj)
end

---Records what a holder is broadcasting and welds the copy when they are in scope. A falsy value
---means they stowed the phone; an unknown colour is ignored rather than trusted.
---@param source integer server id of the remote holder
---@param value any the holder's `sdPhone` statebag value: a frame colour, or false
function remoteprops.set(source, value)
    if not value then
        forget(source)
        return
    end
    if not FRAME_COLORS[value] then return end

    wanted[source] = value
    if upToDate(source, value) then return end

    local ped = pedOf(source)
    if ped ~= 0 then weld(source, ped, value) end
end

---Brings every holder's copy back in line with what they are broadcasting: welds one for a holder
---who came into scope, and drops copies whose owner left or whose prop is gone.
function remoteprops.reconcile()
    for source, colour in pairs(wanted) do
        local ped = pedOf(source)
        if ped == 0 or not DoesEntityExist(ped) then
            remoteprops.remove(source)
        elseif not upToDate(source, colour) then
            weld(source, ped, colour)
        end
    end

    for source in pairs(props) do
        if not wanted[source] then remoteprops.remove(source) end
    end
end

---Drops every copy this client has welded.
function remoteprops.clear()
    for source in pairs(props) do remoteprops.remove(source) end
    wanted, seq = {}, {}
end

if config.Phone.PropVisibleToOthers then
    ---Resolves a `player:<serverId>` bag name to the server id it belongs to.
    ---@param bagName string
    ---@return integer|nil source
    local function bagOwner(bagName)
        return tonumber(bagName:match('player:(%d+)'))
    end

    AddStateBagChangeHandler('sdPhone', nil, function(bagName, _key, value)
        local source = bagOwner(bagName)
        if not source or source == cache.serverId then return end
        remoteprops.set(source, value)
    end)

    CreateThread(function()
        while true do
            Wait(SWEEP_INTERVAL)
            remoteprops.reconcile()
        end
    end)
end

return remoteprops
