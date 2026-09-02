---@type table Player bridge (bridge.server.player): identifier and display name.
local player   = require 'bridge.server.player'
---@type table Records bridge (bridge.server.records): the framework's citizen row, normalised.
local records  = require 'bridge.server.records'
---@type table Settings persistence (server.settings.store): phone number to owner resolution.
local settings = require 'server.settings.store'
---@type table Medical ID persistence layer (server.medical.store): schema bootstrap + the row.
local store    = require 'server.medical.store'
---@type table MDT permission layer (server.mdt.access): caller identity and terminal domain.
local access   = require 'server.mdt.access'
---@type table Shared server helpers (server.util): envelopes, string caps, TINYINT reads.
local util     = require 'server.util'
local ok, fail = util.ok, util.fail

---@type table<string, integer> Editable text field -> the byte cap its column stores.
local TEXT_FIELDS = {
    allergies     = 200,
    conditions    = 200,
    medications   = 200,
    notes         = 300,
    contactName   = 60,
    contactNumber = 20,
}

---@type integer Rolling window for the write budget, in ms.
local WRITE_WINDOW <const> = 60000
---@type integer Accepted writes inside one window. The card saves on every change, so a player
---toggling a switch and typing every field is well inside this while a scripted client is not.
local WRITE_MAX <const> = 40

---@type table Actions module; the table returned at end of file.
local actions = {}

---Stable per-character key (citizenid on qb/qbx, identifier on ESX), resolved from the server id.
---@param src integer player server id
---@return string|nil citizenid nil when the player can't be resolved
local function cidOf(src) return player.getIdentifier(src) end

---The merged Medical ID for one character: the identity and blood type the framework holds, plus
---whatever the player filled in themselves. Every field comes back as a string or a boolean, never
---nil, so nothing is dropped on the wire and the reader never has an undefined to guard.
---@param cid string citizenid
---@param src? integer the character's server id when they are the caller, for the live name
---@return table|nil record nil when there is no such character
function actions.record(cid, src)
    local citizen = records.getCitizen(cid)
    local row     = store.get(cid)
    if not citizen and not row then return nil end
    citizen = citizen or {}

    local name = citizen.name
    if (not name or name == '' or name == cid) and src then name = player.getName(src) end

    return {
        citizenid     = cid,
        name          = name or '',
        dob           = citizen.dob or '',
        bloodType     = citizen.bloodtype or '',
        allergies     = row and row.allergies or '',
        conditions    = row and row.conditions or '',
        medications   = row and row.medications or '',
        notes         = row and row.notes or '',
        organDonor    = row ~= nil and util.truthy(row.organ_donor),
        contactName   = row and row.contact_name or '',
        contactNumber = row and row.contact_number or '',
        -- A card nobody has saved yet still shows on the lock screen: the column's own default is
        -- on, and an emergency card that has to be switched on to be useful is the wrong way round.
        showOnLock    = row == nil or util.truthy(row.show_on_lock),
        updatedAt     = row and tonumber(row.updated_at) or 0,
    }
end

---The caller's own Medical ID. Answered whether or not their phone is unlocked: the lock screen
---reads this to paint its Medical ID button and sheet, which is the whole point of the feature.
---@param src integer player server id
---@return table envelope { record }
function actions.get(src)
    local cid = cidOf(src)
    if not cid then return fail('medical.playerNotFound', 'Player not found') end
    local record = actions.record(cid, src)
    if not record then return fail('medical.playerNotFound', 'Player not found') end
    return ok({ record = record })
end

---Applies a client patch to a stored row. Only the keys the payload actually carries are touched,
---so a toggle never blanks the text the player typed; an empty string clears a field.
---@param current table|nil the stored row, nil when none exists yet
---@param payload table client patch
---@return table row column values ready for the upsert
local function merge(current, payload)
    local row = {
        allergies     = current and current.allergies or nil,
        conditions    = current and current.conditions or nil,
        medications   = current and current.medications or nil,
        notes         = current and current.notes or nil,
        contactName   = current and current.contact_name or nil,
        contactNumber = current and current.contact_number or nil,
        organDonor    = current ~= nil and util.truthy(current.organ_donor),
        showOnLock    = current == nil or util.truthy(current.show_on_lock),
    }

    for field, cap in pairs(TEXT_FIELDS) do
        if payload[field] ~= nil then row[field] = util.limitedString(payload[field], cap) end
    end
    if payload.organDonor ~= nil then row.organDonor = payload.organDonor == true end
    if payload.showOnLock ~= nil then row.showOnLock = payload.showOnLock == true end

    -- A contact is a name and a number together; keeping one without the other leaves a card that
    -- tells a medic who to call with nothing to call, or a number with nobody behind it.
    if not row.contactNumber then row.contactName = nil end
    if not row.contactName then row.contactNumber = nil end

    return row
end

---Saves a patch onto the caller's own Medical ID and hands the merged record back.
---@param src integer player server id
---@param payload table the changed fields only
---@return table envelope { record }
function actions.set(src, payload)
    local cid = cidOf(src)
    if not cid then return fail('medical.playerNotFound', 'Player not found') end
    payload = type(payload) == 'table' and payload or {}

    if not util.rateLimit(cid, 'medical:set', WRITE_WINDOW, WRITE_MAX) then
        return fail('medical.tooFast', 'Slow down for a moment')
    end

    store.upsert(cid, merge(store.get(cid), payload), os.time())

    local record = actions.record(cid, src)
    if not record then return fail('medical.playerNotFound', 'Player not found') end
    return ok({ record = record })
end

---Another citizen's Medical ID, for a medic working the EMS terminal. The subject is named by
---citizenid or by phone number; nothing about the caller is taken from the payload, and a police
---or court terminal is refused the same way a civilian phone is.
---@param src integer player server id
---@param payload table { citizenid?: string, number?: string }
---@return table envelope { record }
function actions.lookup(src, payload)
    local me = access.identity(src)
    if not me or access.domain(me) ~= 'ems' or not access.can(src, 'patients.view') then
        return fail('medical.noMedicalAccess', 'You do not have access to medical records')
    end
    payload = type(payload) == 'table' and payload or {}

    local cid = util.limitedString(payload.citizenid, 64)
    if not cid then
        local number = util.limitedString(payload.number, 20)
        cid = number and settings.getCitizenByNumber(number) or nil
    end
    if not cid then return fail('medical.noSuchCitizen', 'No Medical ID on file for that person') end

    local record = actions.record(cid)
    if not record then return fail('medical.noSuchCitizen', 'No Medical ID on file for that person') end
    return ok({ record = record })
end

return actions
