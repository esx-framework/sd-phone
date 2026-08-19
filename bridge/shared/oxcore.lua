---@type table sd-phone config root (configs.config): read for the OxCore group type mapping.
local config = require 'configs.config'

---@type table ox_core helpers; the table returned at end of file. Every ox_core-specific call in
---the bridge goes through here, so an upstream API change is one file to fix rather than fifteen.
local ox = {}

---@type table<string, boolean> Group types the phone treats as jobs / gangs, as sets. ox_core's
---group `type` is a free-form string with no enforced vocabulary, so the mapping is configured
---rather than guessed - see configs/framework.lua.
local JOB_TYPES = {}
local GANG_TYPES = {}

---@type string[] The same two, kept in config order: getGroupByType is asked one type at a time
---and the first hit wins, so order is meaningful and a set alone would lose it.
local JOB_ORDER = {}
local GANG_ORDER = {}

do
    local cfg = (config.Framework and config.Framework.OxCore) or {}
    for _, t in ipairs(cfg.JobTypes or { 'job' }) do
        JOB_TYPES[t] = true
        JOB_ORDER[#JOB_ORDER + 1] = t
    end
    for _, t in ipairs(cfg.GangTypes or { 'gang' }) do
        GANG_TYPES[t] = true
        GANG_ORDER[#GANG_ORDER + 1] = t
    end
end

---@type boolean Whether a group's highest grade counts as its boss grade.
local TOP_GRADE_IS_BOSS = ((config.Framework and config.Framework.OxCore) or {}).TopGradeIsBoss ~= false

ox.jobTypes = JOB_ORDER
ox.gangTypes = GANG_ORDER
ox.topGradeIsBoss = TOP_GRADE_IS_BOSS

---ox_core's own tables, for the two bridges that read character and vehicle rows directly rather
---than going through an export. `characters` is keyed by charId, and `vehicles.owner` is a foreign
---key onto it; ox_core's `users` table is the ACCOUNT (one per player, many characters), which is
---not the same thing as ESX's `users` despite the shared name.
ox.PEOPLE_TABLE = 'characters'
ox.PEOPLE_ID_COL = 'charId'
ox.VEHICLE_TABLE = 'vehicles'
ox.VEHICLE_ID_COL = 'owner'

---@type boolean Server context. ox_core's exports are shaped differently on the two sides: the
---server addresses a player by source, the client only ever means the local player and takes no
---source at all. Passing one anyway shifts every remaining argument by a place.
local IS_SERVER = IsDuplicityVersion() == true

---Raw ox_core player record. `source` is required on the server and ignored on the client, which
---can only ever mean the local player. Nil when there is no loaded character.
---@param source? number player server id (server only)
---@return table|nil
function ox.player(source)
    local ok, p = pcall(function()
        if IS_SERVER then return exports.ox_core:GetPlayer(source) end
        return exports.ox_core:GetPlayer()
    end)
    return ok and p or nil
end

---The phone's identifier for a source: ox_core's charId, as a string. charId is the character
---primary key, is never nil on a loaded character, and is the value ox_core itself hands
---ox_inventory, so the phone and the inventory agree on who owns what.
---@param source number player server id
---@return string|nil
function ox.charId(source)
    local p = ox.player(source)
    local id = p and p.charId
    return id and tostring(id) or nil
end

---Invoke a method on a player's ox_core class instance. ox_core exposes its classes to other
---resources only through this proxy; there is no player object to hold. `source` is ignored on the
---client, whose CallPlayer takes the method first and always means the local player.
---@param source? number player server id (server only)
---@param method string
---@return any
function ox.call(source, method, ...)
    local ok, res = pcall(function(...)
        if IS_SERVER then return exports.ox_core:CallPlayer(source, method, ...) end
        return exports.ox_core:CallPlayer(method, ...)
    end, ...)
    if not ok then return nil end
    return res
end

---Resolve a source from a charId. A direct index on ox_core's side, unlike the qb/ESX bridges
---which walk every connected player.
---@param charId string|number
---@return number|nil
function ox.sourceFromCharId(charId)
    local id = tonumber(charId)
    if not id then return nil end
    local ok, p = pcall(function() return exports.ox_core:GetPlayerFromCharId(id) end)
    return (ok and p and p.source) or nil
end

---The character's default money account.
---@param charId string|number
---@return table|nil account record carrying accountId and balance
function ox.account(charId)
    local id = tonumber(charId)
    if not id then return nil end
    local ok, acc = pcall(function() return exports.ox_core:GetCharacterAccount(id) end)
    return ok and acc or nil
end

---A group's shared account. ox_core creates one per group at setup, so this needs no provisioning
---the way qb's society accounts do.
---@param groupName string
---@return table|nil
function ox.groupAccount(groupName)
    if not groupName then return nil end
    local ok, acc = pcall(function() return exports.ox_core:GetGroupAccount(groupName) end)
    return ok and acc or nil
end

---Invoke a method on an account class instance, the account counterpart of ox.call.
---@param accountId number
---@param method string
---@return any
function ox.accountCall(accountId, method, ...)
    if not accountId then return nil end
    local ok, res = pcall(function(...) return exports.ox_core:CallAccount(accountId, method, ...) end, ...)
    if not ok then return nil end
    return res
end

---A group's definition (label, grades, type). ox_core publishes every group to GlobalState under
---its principal, so this is a state read rather than a call.
---@param groupName string
---@return table|nil
function ox.group(groupName)
    if not groupName then return nil end
    local ok, g = pcall(function() return GlobalState[('group.%s'):format(groupName)] end)
    return ok and g or nil
end

---The player's group for the first of `types` they hold one of. Returns nil when they hold none.
---
---ox_core grades are 1-BASED, and grade 0 means "not in the group" (setGroup with 0 removes it).
---Passed through untranslated: shifting it would break comparisons against the grade numbers
---configured elsewhere on the server.
---@param source number player server id
---@param types string[] group types, in preference order
---@return string|nil name, integer grade
function ox.groupByTypes(source, types)
    for i = 1, #types do
        local res = ox.call(source, 'getGroupByType', types[i])
        -- getGroupByType returns [name, grade], or an empty table when the player holds none.
        if type(res) == 'table' and res[1] then return res[1], res[2] or 0 end
    end
    return nil, 0
end

---Every group the player holds, as name -> grade. ox_core is natively multi-group, so this is a
---plain read rather than the saved-jobs table qb keeps alongside the active job.
---@param source number player server id
---@return table<string, integer>
function ox.groups(source)
    local res = ox.call(source, 'getGroups')
    return type(res) == 'table' and res or {}
end

---Whether a group type is configured as a job / as a gang.
---@param groupType string|nil
---@return boolean
function ox.isJobType(groupType) return groupType ~= nil and JOB_TYPES[groupType] == true end

---@param groupType string|nil
---@return boolean
function ox.isGangType(groupType) return groupType ~= nil and GANG_TYPES[groupType] == true end

---The highest grade defined for a group. ox_core stores grades as an array of labels, so the top
---grade is the array length.
---@param groupName string
---@return integer
function ox.topGrade(groupName)
    local g = ox.group(groupName)
    local grades = g and g.grades
    return (type(grades) == 'table' and #grades) or 0
end

---A grade's label within a group, or nil when the group or grade is unknown.
---@param groupName string
---@param grade integer
---@return string|nil
function ox.gradeLabel(groupName, grade)
    local g = ox.group(groupName)
    local grades = g and g.grades
    if type(grades) ~= 'table' then return nil end
    return grades[grade]
end

return ox
