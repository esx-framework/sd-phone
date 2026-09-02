---@type table sd-phone config root (configs/config.lua).
local config = require 'configs.config'
---@type table Banking persistence layer (server.banking.store): phone_bank_standing_orders rows.
local store = require 'server.banking.store'
---@type table Authoritative banking handlers (server.banking.actions): the transfer path a due
---order is put through, unchanged, so recipient resolution and both statement rows stay shared.
local actions = require 'server.banking.actions'
---@type table Player bridge (bridge.server.player): citizenid/name/source lookups.
local player = require 'bridge.server.player'
---@type table Settings persistence layer (server.settings.store): phone-number ownership.
local settings = require 'server.settings.store'
---@type table Notifications module (server.notifications.init): offline-safe per-citizen banners.
local notifications = require 'server.notifications.init'
---@type table Shared server helpers (server.util): envelopes, amount coercion, rate limits.
local util = require 'server.util'

local ok, fail = util.ok, util.fail
local digits, truthy = util.digits, util.truthy

---@type table Standing-order knobs (configs/banking.lua StandingOrders): Enabled, MaxActive,
---MinAmount, MaxAmount.
local SO = config.Banking.StandingOrders or {}

---@type table Standing module; the table returned at end of file.
local standing = {}

---@type table<string, integer> Fixed-length intervals in seconds. 'monthly' is absent because a
---month is not a fixed number of seconds; it advances through the calendar instead.
local STEP = { daily = 86400, weekly = 604800 }
---@type table<string, true> Every interval the app may ask for.
local INTERVALS = { daily = true, weekly = true, monthly = true }
---@type integer Longest a label may be, matching the label column.
local LABEL_MAX = 40
---@type integer Longest a stored recipient-name snapshot may be, matching its column.
local NAME_MAX = 80
---@type integer Orders one character may have switched on at once, when the config is silent.
local MAX_ACTIVE = 10
---@type integer Smallest gap between two creates by the same character, in ms.
local CREATE_GAP = 3000
---@type integer Orders attempted per pass. The batch is already scoped to connected payers, so
---this only bounds one tick's worth of transfers.
local BATCH = 50
---@type integer How long a run that could not settle waits before it is retried, in seconds.
local RETRY_AFTER = 3600
---@type string Wallet transaction category both statement rows of a standing order carry.
local CATEGORY = 'standing'
---@type integer Latest a first run may be scheduled, in seconds from now (one year out).
local MAX_LEAD = 366 * 86400

---Days in a calendar month, so a monthly order dated the 31st lands on the last day of a short
---month instead of spilling into the next one.
---@param year integer
---@param month integer 1-12
---@return integer days
local function daysInMonth(year, month)
    local y, m = year, month + 1
    if m > 12 then m, y = 1, y + 1 end
    return tonumber(os.date('%d', os.time({ year = y, month = m, day = 1, hour = 12 }) - 86400)) or 28
end

---The same clock time one calendar month later.
---@param ts integer unix seconds
---@return integer next unix seconds
local function addMonth(ts)
    local d = os.date('*t', ts)
    local y, m = d.year, d.month + 1
    if m > 12 then m, y = 1, y + 1 end
    return os.time({
        year = y, month = m, day = math.min(d.day, daysInMonth(y, m)),
        hour = d.hour, min = d.min, sec = d.sec,
    })
end

---The run after `from`, wound forward until it is in the future. A server that was down for a
---fortnight therefore charges a daily order once on the way back up, not fourteen times.
---@param from integer unix seconds of the run just taken
---@param interval string 'daily' | 'weekly' | 'monthly'
---@param now integer unix seconds
---@return integer next unix seconds, strictly after `now`
local function advance(from, interval, now)
    local step = STEP[interval]
    local at   = from
    for _ = 1, 4000 do
        at = step and (at + step) or addMonth(at)
        if at > now then return at end
    end
    return now + (step or 86400)
end

---Maps a DB row to the shape the Standing Orders page renders.
---@param row table phone_bank_standing_orders row
---@return table out { id, recipient, recipientName?, label, amount, interval, nextRun, active, lastRun?, lastStatus? }
local function orderOut(row)
    return {
        id            = tostring(row.id),
        recipient     = row.recipient,
        recipientName = (row.recipient_name ~= '' and row.recipient_name) or nil,
        label         = row.label,
        amount        = math.floor(tonumber(row.amount) or 0),
        interval      = row.interval,
        nextRun       = math.floor(tonumber(row.next_run) or 0),
        active        = truthy(row.active),
        lastRun       = row.last_run and math.floor(tonumber(row.last_run)) or nil,
        lastStatus    = row.last_status,
    }
end

---Every standing order the caller owns.
---@param src integer player server id
---@return table result envelope { success, data? }
function standing.list(src)
    local cid = player.getIdentifier(src)
    if not cid then return { success = false } end

    local out = {}
    for _, row in ipairs(store.listOrders(cid)) do out[#out + 1] = orderOut(row) end
    return ok({ orders = out })
end

---Validates the payer-supplied half of an order: label, amount and interval.
---@param payload table raw client payload
---@return table|nil fields { label: string, amount: integer, interval: string }
---@return table|nil err refusal envelope, set only when fields is nil
local function readFields(payload)
    local label = util.limitedString(payload.label, LABEL_MAX)
    if not label then
        return nil, fail('banking.standingNeedsLabel', 'Give this standing order a name')
    end

    local amount = util.wholeAmount(payload.amount)
    if amount < (tonumber(SO.MinAmount) or 1) then
        return nil, fail('banking.enterValidAmount', 'Enter a valid amount')
    end
    if amount > (tonumber(SO.MaxAmount) or math.huge) then
        return nil, fail('banking.amountTooLarge', 'Amount is too large')
    end

    local interval = tostring(payload.interval or '')
    if not INTERVALS[interval] then
        return nil, fail('banking.standingBadInterval', 'Pick how often this repeats')
    end

    return { label = label, amount = amount, interval = interval }
end

---Clamps a client-supplied first-run time into the next year, defaulting to an hour from now.
---@param value any unix seconds from the app
---@param now integer unix seconds
---@return integer nextRun unix seconds
local function readFirstRun(value, now)
    local at = math.floor(tonumber(value) or 0)
    if not util.finite(at) or at <= now then return now + 3600 end
    if at > now + MAX_LEAD then return now + MAX_LEAD end
    return at
end

---Creates a standing order against another character's phone number. Rejects the caller's own
---number and numbers nobody owns, the same way a one-off transfer does.
---@param src integer player server id
---@param payload table { number: string, name?: string, label: string, amount: number, interval: string, firstRun?: number }
---@return table result envelope { success, message?, data? }
function standing.create(src, payload)
    local cid = player.getIdentifier(src)
    if not cid then return { success = false } end
    if SO.Enabled == false then return fail('banking.standingDisabled', 'Standing orders are turned off') end
    payload = type(payload) == 'table' and payload or {}

    if not util.cooldown(cid, 'bank:standing:create', CREATE_GAP) then
        return fail('banking.standingTooFast', 'Slow down a moment')
    end

    local fields, err = readFields(payload)
    if not fields then return err end

    local number = digits(payload.number)
    if number == '' then return fail('banking.enterRecipientNumber', 'Enter a recipient number') end
    if number == digits(settings.ensurePhoneNumber(cid)) then
        return fail('banking.canTSendMoneyYourself', "You can't send money to yourself")
    end

    local rcid = settings.getCitizenByNumber(number)
    if not rcid then return fail('banking.noOneOwnsNumber', 'No one owns that number') end
    if rcid == cid then return fail('banking.canTSendMoneyYourself', "You can't send money to yourself") end

    local maxActive = tonumber(SO.MaxActive) or MAX_ACTIVE
    if store.countActiveOrders(cid) >= maxActive then
        return fail('banking.standingAtMost', 'You can have at most {n} active standing orders', { n = maxActive })
    end

    local now  = os.time()
    local name = util.limitedString(payload.name, NAME_MAX)
    if not name then
        local rsrc = player.getSourceByIdentifier(rcid)
        name = rsrc and player.getName(rsrc) or nil
    end

    store.insertOrder(cid, number, name, fields.label, fields.amount, fields.interval,
        readFirstRun(payload.firstRun, now), now)
    return standing.list(src)
end

---Edits one of the caller's standing orders. Switching a paused order back on brings its next run
---forward to now when the schedule ran past while it slept, so it does not sit dormant.
---@param src integer player server id
---@param payload table { id: string|number, label: string, amount: number, interval: string, active?: boolean }
---@return table result envelope { success, message?, data? }
function standing.update(src, payload)
    local cid = player.getIdentifier(src)
    if not cid then return { success = false } end
    payload = type(payload) == 'table' and payload or {}

    local id = math.floor(tonumber(payload.id) or 0)
    if id <= 0 then return fail('banking.standingNotFound', 'That standing order is gone') end

    local row = store.getOrder(cid, id)
    if not row then return fail('banking.standingNotFound', 'That standing order is gone') end

    local fields, err = readFields(payload)
    if not fields then return err end

    local active = payload.active ~= false
    if active and not truthy(row.active) then
        local maxActive = tonumber(SO.MaxActive) or MAX_ACTIVE
        if store.countActiveOrders(cid) >= maxActive then
            return fail('banking.standingAtMost', 'You can have at most {n} active standing orders', { n = maxActive })
        end
    end

    local now     = os.time()
    local nextRun = math.floor(tonumber(row.next_run) or now)
    if active and nextRun <= now then nextRun = now + 60 end

    store.updateOrder(cid, id, fields.label, fields.amount, fields.interval, active, nextRun)
    return standing.list(src)
end

---Deletes one of the caller's standing orders.
---@param src integer player server id
---@param payload table { id: string|number }
---@return table result envelope { success, message?, data? }
function standing.delete(src, payload)
    local cid = player.getIdentifier(src)
    if not cid then return { success = false } end
    payload = type(payload) == 'table' and payload or {}

    local id = math.floor(tonumber(payload.id) or 0)
    if id <= 0 or store.deleteOrder(cid, id) == 0 then
        return fail('banking.standingNotFound', 'That standing order is gone')
    end
    return standing.list(src)
end

---Runs one due order through the shared transfer path and records the outcome. The order is
---claimed (its next run pushed forward) before any money moves, so a crash between the debit and
---the bookkeeping cannot replay the charge on the following pass.
---@param row table phone_bank_standing_orders row
---@param src integer payer's server id, already known to be connected
---@param now integer unix seconds
local function runOrder(row, src, now)
    local id       = math.floor(tonumber(row.id) or 0)
    local due      = math.floor(tonumber(row.next_run) or now)
    local amount   = math.floor(tonumber(row.amount) or 0)
    local interval = row.interval
    local money    = actions.formatMoney(amount)
    local to       = (row.recipient_name ~= '' and row.recipient_name) or row.recipient

    if not store.claimOrder(id, advance(due, interval, now), due) then return end

    local res = actions.send(src, { number = row.recipient, amount = amount, note = row.label },
        { category = CATEGORY, skipLimits = true })

    if res.success then
        store.finishOrder(id, 'ok', now, advance(due, interval, now))
        notifications.notifyCid(row.citizenid, {
            app = 'bank', appId = 'bank', time = 'now',
            titleKey = 'banking.bankTitle', title = 'Bank',
            bodyKey = 'banking.standingPaidBody', body = ('Standing order paid: %s of %s to %s'):format(row.label, money, to),
            bodyVars = { label = row.label, amount = money, name = to },
        })
        return
    end

    if res.messageKey == 'banking.insufficientFunds' then
        store.finishOrder(id, 'insufficient', now, now + RETRY_AFTER)
        notifications.notifyCid(row.citizenid, {
            app = 'bank', appId = 'bank', time = 'now',
            titleKey = 'banking.bankTitle', title = 'Bank',
            bodyKey = 'banking.standingShortBody', body = ('%s needs %s and your account is short. We will try again in an hour.'):format(row.label, money),
            bodyVars = { label = row.label, amount = money },
        })
        return
    end

    store.finishOrder(id, 'failed', now, now + RETRY_AFTER)
    notifications.notifyCid(row.citizenid, {
        app = 'bank', appId = 'bank', time = 'now',
        titleKey = 'banking.bankTitle', title = 'Bank',
        bodyKey = 'banking.standingFailedBody', body = ('%s could not be paid. We will try again in an hour.'):format(row.label),
        bodyVars = { label = row.label },
    })
end

---One pass of the runner: every due order whose payer is connected, oldest due first. The money
---bridge has no offline debit path, so an offline payer's order is simply left due and fires on
---the first pass after they connect.
function standing.tick()
    if SO.Enabled == false then return end

    local online = player.activeCidMap()
    local cids = {}
    for cid in pairs(online) do cids[#cids + 1] = cid end
    if #cids == 0 then return end

    local now = os.time()
    for _, row in ipairs(store.dueOrders(cids, now, BATCH)) do
        local src = online[row.citizenid]
        if src then runOrder(row, src, now) end
    end
end

return standing
