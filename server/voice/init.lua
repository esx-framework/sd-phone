---@type table sd-phone config root (configs/config.lua).
local config = require 'configs.config'
---@type table Player bridge (bridge.server.player): citizenid/name/phone-number lookups.
local player = require 'bridge.server.player'
---@type table Shared server helpers (server.util): rate limiting + client-payload validation.
local util   = require 'server.util'
---@type table Shared ICE provisioning (server.voice.ice): STUN + Cloudflare TURN for every
---WebRTC feature, video calls included.
local ice    = require 'server.voice.ice'

---@type table Voice config (configs/voice.lua): nearby-capture switches + TURN provisioning.
local CFG   = config.Voice or {}
---@type number Capture radius in metres - how close another player must be to be recordable.
local RANGE = tonumber(CFG.NearbyRange) or 12.0
---@type integer Cap on simultaneous nearby voices mixed into one recording (bandwidth/CPU guard).
local MAXN  = tonumber(CFG.MaxNearbyVoices) or 6

---@return boolean true when nearby-voice capture is switched on (config.Voice.RecordNearbyVoices)
local function enabled() return CFG.RecordNearbyVoices == true end

---Live ped coords for a player, nil when they have no ped (disconnecting / not spawned).
---@param src number player server id
---@return vector3|nil coords
local function coordsOf(src)
    local ped = GetPlayerPed(src)
    if not ped or ped == 0 then return nil end
    return GetEntityCoords(ped)
end

---True if `a` and `b` are within `range` metres of each other, from live server-side coords;
---false when either has no ped.
---@param a number player server id
---@param b number player server id
---@param range number metres
---@return boolean within
local function withinRange(a, b, range)
    local ca, cb = coordsOf(a), coordsOf(b)
    if not ca or not cb then return false end
    return #(ca - cb) <= range
end

---Players (other than `src`) within RANGE metres, nearest first, capped to MAXN. Positions are
---read server-side at query time; the trimmed result carries only id + display name.
---@param src number recorder server id
---@return { id: number, name: string }[] targets
local function nearbyTargets(src)
    local origin = coordsOf(src)
    if not origin then return {} end

    local found = {}
    for _, pid in ipairs(GetPlayers()) do
        local tgt = tonumber(pid)
        if tgt and tgt ~= src then
            local c = coordsOf(tgt)
            if c then
                local dist = #(origin - c)
                if dist <= RANGE then
                    found[#found + 1] = { id = tgt, name = player.getName(tgt), dist = dist }
                end
            end
        end
    end

    table.sort(found, function(a, b) return a.dist < b.dist end)
    local out = {}
    for i = 1, math.min(#found, MAXN) do
        out[#out + 1] = { id = found[i].id, name = found[i].name }
    end
    return out
end

---ICE servers for this client's peer connections. Read-only; served from the shared cache.
lib.callback.register('sd-phone:server:voice:ice', function()
    return { success = true, data = { iceServers = ice.servers() } }
end)

---@type integer Nearby-lookup budget window in ms.
local NEARBY_WINDOW = 60000
---@type integer Lookups allowed per window. The client asks once when a recording starts, so this
---is far above any human, and it bounds the GetPlayers coord scan the callback pays for.
local NEARBY_PER_WINDOW = 30

---Who the recorder can capture right now (+ its ICE servers). Proximity is computed server-side;
---empty when the feature is disabled or the caller is over budget.
lib.callback.register('sd-phone:server:voice:nearby', function(src)
    if not enabled() or not util.rateLimit(player.getIdentifier(src), 'voice:nearby', NEARBY_WINDOW, NEARBY_PER_WINDOW) then
        return { success = true, data = { targets = {}, iceServers = ice.servers() } }
    end
    return { success = true, data = { targets = nearbyTargets(src), iceServers = ice.servers() } }
end)

---@type table<string, boolean> Signal kinds the mesh actually sends (web/src/media/nearbyVoice.ts).
local SIGNAL_KINDS = { offer = true, answer = true, ice = true }
---@type integer Byte ceiling on one SDP description. The mesh is audio-only, so a real offer runs
---about 2 KB; this is more than ten times that.
local SDP_BYTES = 32768
---@type integer Byte ceiling on one trickled ICE candidate (~200 bytes in practice).
local CANDIDATE_BYTES = 2048
---@type integer Signal-relay budget window in ms.
local SIGNAL_WINDOW = 10000
---@type integer Candidates allowed per window. Negotiating a full MAXN mesh trickles roughly a
---hundred, so this leaves several times the worst legitimate burst.
local CANDIDATES_PER_WINDOW = 400
---@type integer Descriptions allowed per window. A full MAXN mesh needs about a dozen, and the
---client only negotiates when a recording starts.
local SDP_PER_WINDOW = 60

---Relays one WebRTC signaling message (offer/answer/ICE candidate) to another player. Proximity
---is re-checked on every hop (1.5x RANGE) and `from` is stamped from the trusted source. Shape
---and size are validated before the coord lookups so an oversized blob is dropped for free.
---@param payload table { to: number, sid?: any, kind?: any, data?: any }
RegisterNetEvent('sd-phone:server:voice:signal', function(payload)
    local src = source
    if type(payload) ~= 'table' then return end
    local to = tonumber(payload.to)
    if not to or not enabled() then return end

    -- Bounded but never rewritten: both peers key their session map on this exact string, so a
    -- trim here would silently break the reply hop.
    local sid = payload.sid
    if type(sid) ~= 'string' or sid == '' or #sid > 64 then return end
    if not SIGNAL_KINDS[payload.kind] then return end
    -- Descriptions and candidates differ by two orders of magnitude in both size and count, so
    -- they get their own budget; one shared limit would have to be loose enough for the worst of both.
    local ice = payload.kind == 'ice'
    -- The mesh sends objects here ({ type, sdp } or a candidate), never bare strings.
    local data = util.smallTable(payload.data, 16, ice and CANDIDATE_BYTES or SDP_BYTES)
    if not data then return end
    local cid = player.getIdentifier(src)
    if ice then
        if not util.rateLimit(cid, 'voice:signal:ice', SIGNAL_WINDOW, CANDIDATES_PER_WINDOW) then return end
    elseif not util.rateLimit(cid, 'voice:signal:sdp', SIGNAL_WINDOW, SDP_PER_WINDOW) then
        return
    end
    if not withinRange(src, to, RANGE * 1.5) then return end

    TriggerClientEvent('sd-phone:client:voice:signal', to, {
        from = src,
        sid  = sid,
        kind = payload.kind,
        data = data,
    })
end)
