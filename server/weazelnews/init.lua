---@type table Boot reporter (server.boot): one console summary instead of per-module prints.
local boot = require 'server.boot'

---@type table Weazel News persistence layer (server.weazelnews.store): article + ticker row CRUD.
local store   = require 'server.weazelnews.store'
---@type table Authoritative Weazel News handlers (server.weazelnews.actions): staff gating,
---input clamping and envelope responses.
local actions = require 'server.weazelnews.actions'
---@type table Shared server helpers (server.util): the configs/apps.lua switch.
local util    = require 'server.util'

---@type boolean Whether Weazel News is switched on in configs/apps.lua.
local APP_ENABLED = util.appEnabled('weazelnews')

-- Boot-time schema bootstrap.
CreateThread(function()
    local ok, err = pcall(store.ensureSchema)
    if not ok then
        boot.schemaFailed('weazelnews', err)
        return
    end
    boot.schemaReady()
end)

-- Batched view counts: article reads buffer in memory and land in one pass per minute. An app
-- nobody can open buffers no reads.
CreateThread(function()
    if not APP_ENABLED then return end

    while true do
        Wait(60000)
        local ok, err = pcall(actions.flushViews)
        if not ok then print(('^1[sd-phone:weazelnews]^0 view flush failed: %s'):format(err)) end
    end
end)

-- Scheduled publishing: queued stories go live on their own, in publish order, a small batch at a
-- time. Half a minute is close enough for a newsroom and cheap enough to run on an idle server,
-- where the query hits the (status, publish_at) index and matches nothing.
CreateThread(function()
    if not APP_ENABLED then return end

    while true do
        Wait(30000)
        local ok, err = pcall(actions.runDue)
        if not ok then print(('^1[sd-phone:weazelnews]^0 scheduled publish failed: %s'):format(err)) end
    end
end)

---Flushes the buffered view counts once on resource stop. Guarded to this resource only.
---@param resource string name of the resource that stopped
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    pcall(actions.flushViews)
end)

-- NUI callbacks: thin delegates into server.weazelnews.actions; shims normalize non-table payloads.
lib.callback.register('sd-phone:server:weazelnews:feed', function(src)
    return actions.feed(src)
end)

lib.callback.register('sd-phone:server:weazelnews:watch', function(src, payload)
    if type(payload) ~= 'table' then payload = {} end
    require('server.watchers').of('weazelnews').watch(src, payload.on == true)
    return { success = true }
end)

lib.callback.register('sd-phone:server:weazelnews:view', function(src, payload)
    if type(payload) ~= 'table' then payload = {} end
    return actions.view(src, payload.id)
end)

lib.callback.register('sd-phone:server:weazelnews:save', function(src, payload)
    return actions.save(src, payload)
end)

lib.callback.register('sd-phone:server:weazelnews:delete', function(src, payload)
    if type(payload) ~= 'table' then payload = {} end
    return actions.delete(src, payload.id)
end)

lib.callback.register('sd-phone:server:weazelnews:reschedule', function(src, payload)
    return actions.reschedule(src, payload)
end)

lib.callback.register('sd-phone:server:weazelnews:publishNow', function(src, payload)
    return actions.publishNow(src, payload)
end)

lib.callback.register('sd-phone:server:weazelnews:setBreaking', function(src, payload)
    return actions.setBreaking(src, payload)
end)

---Publishes an article from another server resource (exports['sd-phone']:postArticle). `article`
---mirrors the staff draft; every staff-path clamp applies. Returns the new id, or nil + reason.
---@param article table
---@return integer|nil articleId
---@return string? reason failure reason when articleId is nil
exports('postArticle', function(article)
    return actions.publish(article)
end)

---Replaces the breaking ticker from another server resource (exports['sd-phone']:setBreakingTicker).
---Same clamps as the staff editor; an empty array clears the ticker, a non-table returns false.
---@param lines string[] ticker lines in display order
---@return boolean replaced
exports('setBreakingTicker', function(lines)
    return actions.replaceTicker(lines)
end)
