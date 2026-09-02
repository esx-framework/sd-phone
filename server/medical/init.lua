---@type table Boot reporter (server.boot): one console summary instead of per-module prints.
local boot = require 'server.boot'

---@type table Medical ID persistence layer (server.medical.store): schema bootstrap + the row.
local store   = require 'server.medical.store'
---@type table Authoritative Medical ID handlers (server.medical.actions): read, save, EMS lookup.
local actions = require 'server.medical.actions'
---@type table Shared server helpers (server.util): string caps for the export argument.
local util    = require 'server.util'

-- Boot thread: creates the Medical ID table.
CreateThread(function()
    local ok, err = pcall(store.ensureSchema)
    if not ok then
        boot.schemaFailed('medical', err)
        return
    end
    boot.schemaReady()
end)

---Register one Medical ID callback under the app's 'sd-phone:server:medical:' prefix.
---@param action string callback name suffix
---@param fn function handler fun(src, payload?): table
local function register(action, fn)
    lib.callback.register('sd-phone:server:medical:' .. action, fn)
end

-- App callbacks: thin delegates into server.medical.actions.
register('get',    function(src) return actions.get(src) end)
register('set',    function(src, payload) return actions.set(src, payload) end)
register('lookup', function(src, payload) return actions.lookup(src, payload) end)

---Public export: exports['sd-phone']:getMedicalId(citizenid). Returns the merged card an EMS
---script would put on a patient's chart: name, date of birth and blood type from the framework's
---own record, plus the allergies, conditions, medications, notes, organ-donor flag and emergency
---contact the player filled in on their phone. Nil when there is no such character.
---@param citizenid string
---@return table|nil record
exports('getMedicalId', function(citizenid)
    local cid = util.limitedString(citizenid, 64)
    if not cid then return nil end
    return actions.record(cid)
end)
