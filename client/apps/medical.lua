---@type fun(nuiAction: string, serverEvent: string) NUI->server pass-through registrar (client.nui).
local proxyCallback = require 'client.nui'
---@type table Locale (bridge.shared.locale): the refusal strings a medic sees.
local locale = require 'bridge.shared.locale'
---@type table sd-phone config root (configs/config.lua).
local config = require 'configs.config'
---@type table Target bridge (bridge.client.target): one API over ox_target/qb-target/qtarget.
local target = require 'bridge.client.target'
---@type table Job bridge (bridge.client.job): the local player's live job, for the eye option.
local job = require 'bridge.client.job'
---@type table Notify bridge (bridge.client.notify): refusals the medic sees on a failed scan.
local notify = require 'bridge.client.notify'

---@type string[] NUI action suffixes proxied 1:1 to sd-phone:server:medical:<action>.
local ACTIONS = { 'get', 'set', 'lookup' }

-- Thin delegates into server/medical.
for _, action in ipairs(ACTIONS) do
    proxyCallback('sd-phone:medical:' .. action, 'sd-phone:server:medical:' .. action)
end

---@type table Medical config (configs.medical). Read with the group guard so an install whose
---configs/config.lua predates the file still loads.
local CFG = config.Medical or require 'configs.medical'
---@type table Field-scan settings.
local SCAN = CFG.Scan or {}

---Whether the local player works a job allowed to scan. Synchronous, because the target eye asks
---this while it is deciding what to draw.
---@return boolean
local function mayScan()
    local mine = job.name()
    if not mine then return false end
    for _, name in ipairs(SCAN.Jobs or {}) do
        if name == mine then return true end
    end
    return false
end

---Reads the targeted player's Medical ID and puts it on this medic's own phone. The server decides
---whether the scan is allowed; everything here is presentation.
---@param entity number the targeted ped
local function scan(entity)
    local targetSrc = NetworkGetPlayerIndexFromPed(entity)
    if targetSrc == -1 then
        notify.show({ description = locale.t('medical.scanGone', 'They are no longer there'), type = 'error' })
        return
    end

    local res = lib.callback.await('sd-phone:server:medical:scan', false, {
        target = GetPlayerServerId(targetSrc),
    })
    if type(res) ~= 'table' or not res.success then
        notify.show({
            description = (type(res) == 'table' and res.message) or locale.t('medical.scanFailed', 'Could not read their Medical ID'),
            type = 'error',
        })
        return
    end

    -- Open the phone if it is holstered: a card that lands on a screen nobody is looking at is the
    -- same as no card at all. Reached through the resource's own exports rather than main.lua's
    -- locals, the same way client/apps/share.lua and maps.lua do it.
    local function isOpen()
        local ok, open = pcall(function() return exports['sd-phone']:isOpen() end)
        return ok and open == true
    end

    -- The card has to WAIT for the open to finish. OpenPhone re-initialises the interface - boot
    -- splash, then lockscreen - and a push that lands mid-sequence is thrown away with the rest of
    -- the pre-open state, which reads in game as the phone opening to a lockscreen and no card.
    if not isOpen() then
        pcall(function() exports['sd-phone']:open() end)
        local waited = 0
        while not isOpen() and waited < 3000 do
            Wait(50)
            waited = waited + 50
        end
        if not isOpen() then return end
        Wait(350)
    end

    SendNUIMessage({ action = 'sd-phone:medical:scanned', data = res.data })
end

-- The eye option, registered once a target backend exists. With none running this never appears,
-- which is why the lock-screen card stays as the fallback route in.
if SCAN.Enabled ~= false then
    target.onReady(function()
        target.addGlobalPlayer({
            {
                name     = 'sd-phone:medical:scan',
                icon     = 'fa-solid fa-heart-pulse',
                label    = locale.t('medical.scanOption', 'Scan Medical ID'),
                distance = tonumber(SCAN.Distance) or 2.5,
                canInteract = function() return mayScan() end,
                onSelect = function(data)
                    local entity = type(data) == 'table' and data.entity or data
                    if entity then scan(entity) end
                end,
            },
        })
    end)
end
