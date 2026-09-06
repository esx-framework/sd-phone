---@type table sd-phone config root (configs/config.lua).
local config   = require 'configs.config'
---@type table Player bridge (bridge.server.player): identifier and display name.
local player   = require 'bridge.server.player'
---@type table Job bridge (bridge.server.job): the caller's live job name, for the scan gate.
local job      = require 'bridge.server.job'
---@type table Notify bridge (bridge.server.notify): the optional heads-up to a scanned player.
local notify   = require 'bridge.server.notify'
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

---@type table Medical config (configs.medical): the field-scan rules. Read with the group guard,
---so an install whose configs/config.lua predates this file still loads.
local CFG = config.Medical or require 'configs.medical'

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

---@type table<string, boolean> The blood types a player may pick. Anything else is refused rather
---than stored, so a card can only ever read as a real group.
local BLOOD_TYPES = {
    ['A+'] = true, ['A-'] = true, ['B+'] = true, ['B-'] = true,
    ['AB+'] = true, ['AB-'] = true, ['O+'] = true, ['O-'] = true,
}

---A blood type the player is allowed to store, or nil. Upper-cased first so 'o+' is accepted.
---@param v any client-supplied value
---@return string|nil
local function bloodType(v)
    if type(v) ~= 'string' then return nil end
    local up = v:upper():gsub('%s', '')
    return BLOOD_TYPES[up] and up or nil
end

---The merged Medical ID for one character: the identity the framework holds, plus whatever the
---player filled in themselves. Every field comes back as a string or a boolean, never nil, so
---nothing is dropped on the wire and the reader never has an undefined to guard.
---
---Blood type is the one field with two possible sources, and the PLAYER's own pick wins. The
---framework's `metadata.bloodtype` is only the starting value for a character who has never
---chosen, so a server that sets one gets a sensible default rather than a locked field.
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

    local frameworkBlood = citizen.bloodtype or ''
    local chosenBlood    = row and row.blood_type or ''

    return {
        citizenid     = cid,
        name          = name or '',
        dob           = citizen.dob or '',
        bloodType     = chosenBlood ~= '' and chosenBlood or frameworkBlood,
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
        bloodType     = current and current.blood_type or nil,
    }

    for field, cap in pairs(TEXT_FIELDS) do
        if payload[field] ~= nil then row[field] = util.limitedString(payload[field], cap) end
    end
    if payload.bloodType ~= nil then row.bloodType = bloodType(payload.bloodType) end
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

---Whether one player may scan another right now: the caller works a listed job, the subject is a
---real other player, and the two really are standing together. Distance is measured server-side
---from both peds, so a client naming a target across the map is refused rather than trusted.
---@param src integer caller server id
---@param targetSrc integer subject server id
---@return string|nil failKey nil when the scan is allowed
local function scanRefusal(src, targetSrc)
    local scan = CFG.Scan or {}
    if scan.Enabled == false then return 'off' end
    if targetSrc == src then return 'self' end

    local myJob = job.getName(src)
    local allowed = false
    for _, name in ipairs(scan.Jobs or {}) do
        if name == myJob then allowed = true break end
    end
    if not allowed then return 'job' end

    local mine  = GetPlayerPed(src)
    local their = GetPlayerPed(targetSrc)
    if mine == 0 or their == 0 then return 'gone' end

    local range = tonumber(scan.Distance) or 2.5
    if #(GetEntityCoords(mine) - GetEntityCoords(their)) > range then return 'far' end

    -- 100 is the engine's floor for a conscious ped; anything at or under it is down or dead.
    if scan.RequireDowned == true and GetEntityHealth(their) > 100 then return 'well' end

    return nil
end

---@type table<string, { key: string, msg: string }> Refusal reason -> what the medic is told.
local SCAN_REFUSALS = {
    off  = { key = 'medical.scanOff',       msg = 'Scanning is unavailable' },
    self = { key = 'medical.scanSelf',      msg = 'That is your own card' },
    job  = { key = 'medical.noScanJob',     msg = 'You are not on a medical crew' },
    far  = { key = 'medical.scanTooFar',    msg = 'Get closer to scan' },
    well = { key = 'medical.scanNotDowned', msg = 'They are not injured' },
    gone = { key = 'medical.scanGone',      msg = 'They are no longer there' },
}

---Reads the Medical ID of the player the caller is standing next to. This is the route that works
---on every phone setup: the lock-screen card is only readable by a third party under unique phones,
---because every other DataOwner mode shows a held phone the HOLDER's data, not the owner's.
---@param src integer caller server id
---@param payload table { target: number } the subject's server id
---@return table envelope { record }
function actions.scan(src, payload)
    payload = type(payload) == 'table' and payload or {}
    local targetSrc = tonumber(payload.target)
    if not targetSrc or targetSrc < 1 or targetSrc % 1 ~= 0 then
        return fail(SCAN_REFUSALS.gone.key, SCAN_REFUSALS.gone.msg)
    end

    local refusal = scanRefusal(src, targetSrc)
    if refusal then
        local r = SCAN_REFUSALS[refusal] or SCAN_REFUSALS.gone
        return fail(r.key, r.msg)
    end

    local cid = player.getRealIdentifier(targetSrc)
    if not cid then return fail(SCAN_REFUSALS.gone.key, SCAN_REFUSALS.gone.msg) end

    local record = actions.record(cid, targetSrc)
    if not record then return fail('medical.noSuchCitizen', 'No Medical ID on file for that person') end

    if (CFG.Scan or {}).NotifyTarget == true then
        notify.to(targetSrc, 'A medic read your Medical ID.', 'info')
    end

    return ok({ record = record })
end

return actions
