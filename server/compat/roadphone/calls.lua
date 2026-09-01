---@type table Shared shim helpers (server.compat.roadphone.shared): export registration + warn-once.
local shim = require 'server.compat.roadphone.shared'
---@type table Player bridge (bridge.server.player): online map, job and identity lookups.
local player = require 'bridge.server.player'
---@type table Services persistence layer (server.services.store): per-job duty preferences.
local store = require 'server.services.store'
---@type table Services handlers (server.services.actions): resolves a dialed line to its job, the
---same map the Phone dialer routes 911 through, so the shim cannot answer for a different set of
---numbers than the phone itself rings.
local services = require 'server.services.actions'

local registerExport, stubExport, warnOnce = shim.registerExport, shim.stubExport, shim.warnOnce

---isLeitstelleNumber(number): whether a number is one of the callable company lines.
registerExport('isLeitstelleNumber', function(number)
    local digits = shim.digits(number)
    return digits ~= nil and services.jobForCallNumber(digits) ~= nil
end)

---getLeitstelleDispatcherSource(number): a random on-duty member of the company that line belongs
---to, nil when nobody is on duty. Duty comes from the framework where it reports one and from the
---player's own Services duty toggle otherwise, exactly as company messaging resolves it.
registerExport('getLeitstelleDispatcherSource', function(number)
    local digits = shim.digits(number)
    local job = digits and services.jobForCallNumber(digits) or nil
    if not job then return nil end

    local onDuty = {}
    for cid, src in pairs(player.onlineCidMap()) do
        if player.getJob(src) == job and store.getPrefs(cid, job).duty then
            onDuty[#onDuty + 1] = src
        end
    end
    if #onDuty == 0 then return nil end
    return onDuty[math.random(#onDuty)]
end)

---generateCallChannelID(): a 7-digit voice channel id. sd-phone mints its own channels per call, so
---this hands back an id in RoadPhone's documented range for a provider to use as it likes; it is not
---reserved against sd-phone's own channels.
registerExport('generateCallChannelID', function()
    warnOnce('generateCallChannelID', ('generateCallChannelID returns a free-standing 7-digit id (called by %s); sd-phone mints its own call channels and does not reserve this one'):format(GetInvokingResource() or 'unknown'))
    return tostring(math.random(1000000, 9999999))
end)

-- External number providers: RoadPhone hands a provider resource the call and message it cannot
-- place itself, then calls back into that resource's ExternalNumber_* exports. sd-phone has no such
-- protocol, so registration is refused rather than accepted-and-ignored: a provider told it
-- registered would wait forever for callbacks that never come.
stubExport('registerNumberProvider', false,
    'is refused: sd-phone has no external number-provider protocol, and reporting success would leave the provider waiting for ExternalNumber_* callbacks that never arrive')
stubExport('getCallSettings', { unavailableRingSeconds = 30 },
    'has no sd-phone counterpart: ring cadence lives in configs/phone.lua and is not published as a provider contract, so RoadPhone\'s documented default is reported')
stubExport('rememberActiveCall', nil,
    'has no sd-phone counterpart: the provider-connected call register belongs to the number-provider protocol sd-phone does not implement')
stubExport('forgetActiveCall', nil,
    'has no sd-phone counterpart: the provider-connected call register belongs to the number-provider protocol sd-phone does not implement')
