---@type table Audible-ring module; the table returned at end of file. Pure helpers shared by the
---server (which decides whose phone rings out loud) and the client (which decides how loud).
local callring = {}

---@type string Tone id handed to bystanders when the ringing player's own choice cannot be played
---by a nearby phone, which is every custom tone: those are YouTube-backed, and the page plays them
---through one shared iframe channel already spoken for by the listener's own ringtone.
local FALLBACK_TONE = 'nimbus'

---@type table<string, boolean> Tone ids the page carries as bundled audio, so every client can play
---one from its own build without the file travelling.
local BUILTIN_TONES = {
    nimbus = true, meridian = true, lantern = true, prism = true,
    solstice = true, vesper = true, drift = true, ember = true,
}

---Resolves a stored ringtone id to one a bystander's phone can actually play.
---@param toneId any the ringing player's saved ringtone id
---@return string toneId a bundled tone id
function callring.playableTone(toneId)
    if type(toneId) ~= 'string' or not BUILTIN_TONES[toneId] then return FALLBACK_TONE end
    return toneId
end

---Collects every party a call payload is ringing, excluding whoever placed it: the caller hears
---ringback in their ear, and their handset is not the one making noise.
---@param call table eventCall/eventRing payload from server.calls.actions
---@return number[] sources
function callring.ringRecipients(call)
    if type(call) ~= 'table' then return {} end

    local callerSrc = call.caller and tonumber(call.caller.source or call.caller.src)
    local seen, out = {}, {}

    local function add(party)
        local src = party and tonumber(party.source or party.src)
        if not src or src == callerSrc or seen[src] then return end
        seen[src] = true
        out[#out + 1] = src
    end

    ---Adds every party in one of the payload's party lists, which may be absent.
    ---@param list table|nil
    local function addAll(list)
        if type(list) ~= 'table' then return end
        for _, party in ipairs(list) do add(party) end
    end

    add(call.callee)
    addAll(call.merged)
    addAll(call.targets)
    return out
end

---Falloff for a ring heard from `distance` metres away. Squared rather than linear so a phone
---across the street is faint instead of merely quieter, and clamped to silence at the edge so a
---bystander walking out of range never leaves a floor of audio behind.
---@param distance number metres between listener and the ringing ped
---@param range number metres at which the ring is inaudible
---@return number volume 0-1
function callring.volumeAt(distance, range)
    range = tonumber(range) or 0
    distance = tonumber(distance) or 0
    if range <= 0 then return 0.0 end
    if distance <= 0 then return 1.0 end
    if distance >= range then return 0.0 end
    local falloff = 1.0 - (distance / range)
    return falloff * falloff
end

return callring
