---@type table Boot reporter (server.boot): one console summary instead of per-module prints.
local boot = require 'server.boot'

---@type table Calendar persistence layer (server.calendar.store): schema bootstrap + row CRUD.
local store   = require 'server.calendar.store'
---@type table Authoritative Calendar handlers (server.calendar.actions): organizer/attendee gating,
---input clamping and envelope responses.
local actions = require 'server.calendar.actions'

-- Boot thread: creates the events and attendees tables.
CreateThread(function()
    local ok, err = pcall(store.ensureSchema)
    if not ok then
        boot.schemaFailed('calendar', err)
        return
    end
    boot.schemaReady()
end)

---Register one Calendar callback under the app's 'sd-phone:server:calendar:' prefix.
---@param action string callback name suffix
---@param fn function handler fun(src, payload?): table
local function register(action, fn)
    lib.callback.register('sd-phone:server:calendar:' .. action, fn)
end

-- App callbacks: thin delegates into server.calendar.actions.
register('list',     function(src) return actions.list(src) end)
register('save',     function(src, payload) return actions.save(src, payload) end)
register('delete',   function(src, payload) return actions.remove(src, payload) end)
register('invite',   function(src, payload) return actions.invite(src, payload) end)
register('respond',  function(src, payload) return actions.respond(src, payload) end)
register('uninvite', function(src, payload) return actions.uninvite(src, payload) end)
