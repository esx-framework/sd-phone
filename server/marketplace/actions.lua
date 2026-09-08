---@type table sd-phone config root (configs/config.lua).
local config = require 'configs.config'
---@type table Marketplace persistence layer (server.marketplace.store): listing row CRUD.
local store = require 'server.marketplace.store'
---@type table Player bridge (bridge.server.player): citizenid/identifier lookup from a server id.
local player = require 'bridge.server.player'
---@type table Watcher registry (server.watchers): players with Marketplace open.
local watchers = require('server.watchers').of('marketplace')
---@type table Media trust boundary: only gallery-owned images may reach public listings.
local mediaGuard = require 'server.media.guard'

---@type table Marketplace app config (configs/marketplace.lua): feed limit + field caps.
local MP = config.Marketplace
---@type table Actions module; the table returned at end of file. Every handler returns the
---{ success, message?, data? } envelope. The owner is the caller's citizenid and the timestamp is
---set here. Structural twin of server.pages.actions.
local actions = {}

local util = require 'server.util'
local digits, trim = util.digits, util.trim

---@type integer Longest client images array parseFields will walk; every element is trimmed before
---the MaxImages cap applies, so an unbounded array is free CPU for the caller.
local MAX_IMAGE_ENTRIES = 50
---@type integer Rolling window the write budget is measured over, in ms.
local WRITE_WINDOW = 10000
---@type integer Creates plus edits plus deletes one character may make per window. Clearing out a
---full MaxListingsPerPlayer set in one go still fits.
local WRITE_MAX = 16
---@type integer Shortest lead time a listing may be queued for, in seconds.
local SCHEDULE_MIN_AHEAD = 5 * 60
---@type integer Longest lead time a listing may be queued for, in seconds.
local SCHEDULE_MAX_AHEAD = 30 * 86400
---@type integer Due listings one sweep flips live, so a long-idle server catches up over several
---passes instead of one blocking burst.
local DUE_LIMIT = 20

---Caller identity, resolved from src via the player bridge.
---@param src integer player server id
---@return string|nil citizenid (nil while no character is loaded)
local function cidOf(src) return player.getIdentifier(src) end

---Coerces a client-supplied listing id to a positive integer, or nil.
---@param v any client-supplied id value
---@return integer|nil id
local function listingId(v)
    local n = tonumber(v)
    n = n and math.tointeger(n)
    if not n or n < 1 then return nil end
    return n
end

---Validates a client-supplied publish time: a whole unix second between five minutes and thirty
---days from now. Anything else is refused rather than clamped, so a wrong time is never published.
---@param v any client-supplied publishAt
---@param now integer unix seconds
---@return integer|nil publishAt validated stamp, nil when out of range or malformed
---@return string? key catalogue key for the refusal
---@return string? message English refusal text
local function scheduleAt(v, now)
    local n = tonumber(v)
    if not n or n ~= n or n == math.huge or n ~= math.floor(n) then
        return nil, 'marketplace.badPublishTime', 'Pick a publish time'
    end
    if n < now + SCHEDULE_MIN_AHEAD then
        return nil, 'marketplace.publishTooSoon', 'Schedule at least 5 minutes ahead'
    end
    if n > now + SCHEDULE_MAX_AHEAD then
        return nil, 'marketplace.publishTooFar', 'Schedule at most 30 days ahead'
    end
    return n
end


---English ordinal suffix for a day number: "1st" / "2nd" / "3rd" / "11th".
---@param d integer day of the month
---@return string day day number with suffix
local function ordinal(d)
    local m100 = d % 100
    if m100 >= 11 and m100 <= 13 then return d .. 'th' end
    local m10 = d % 10
    if m10 == 1 then return d .. 'st' end
    if m10 == 2 then return d .. 'nd' end
    if m10 == 3 then return d .. 'rd' end
    return d .. 'th'
end

---Display string matching the UI: "Today, 14:52", "Yesterday, 09:10" or "May 25th, 2026" for
---anything older. Rendered server-side.
---@param ts integer unix seconds (the server-written created_at)
---@return string date display string
local function fmtDate(ts)
    local now   = os.time()
    local today = os.date('*t', now)
    local that  = os.date('*t', ts)
    local hm    = os.date('%H:%M', ts)
    if that.year == today.year and that.yday == today.yday then
        return 'Today, ' .. hm
    end
    local yd = os.date('*t', now - 86400)
    if that.year == yd.year and that.yday == yd.yday then
        return 'Yesterday, ' .. hm
    end
    return os.date('%B ', ts) .. ordinal(that.day) .. ', ' .. that.year
end

---A row's photo URLs: the JSON `images` array when present, else the legacy single `image`
---column. A corrupt array degrades to no photos.
---@param row table listing DB row
---@return string[] urls photo URLs (possibly empty)
local function decodeImages(row)
    local out = {}
    if row.images and row.images ~= '' then
        local ok, d = pcall(json.decode, row.images)
        if ok and type(d) == 'table' then
            for _, u in ipairs(d) do
                if type(u) == 'string' and u ~= '' then out[#out + 1] = u end
            end
        end
    end
    if #out == 0 and row.image and row.image ~= '' then out = { row.image } end
    return out
end

---DB row -> the shape the React app renders. The owner's citizenid is never sent; authorship is
---exposed only as the `mine` boolean, computed against the viewer's cid.
---@param row table listing DB row
---@param cid string|nil viewer citizenid (nil when building a broadcast copy)
---@return table listing UI listing shape
local function toListing(row, cid)
    local imgs = decodeImages(row)
    return {
        id     = tostring(row.id),
        title  = row.title,
        body   = row.body,
        price  = row.price,
        image  = imgs[1],
        images = (#imgs > 0 and imgs or nil),
        number = row.number,
        email  = row.email,
        date   = fmtDate(row.created_at),
        mine   = row.citizenid == cid,
        publishAt = row.status == 'scheduled' and tonumber(row.publish_at) or nil,
    }
end

---The most-recent MP.ListLimit live listings across all players, with the caller's own queued
---listings appended. A queued listing carries `publishAt`, which is what "Your Posts" sorts it out
---by and what the browse list filters it out on; nobody else's queue is ever in this list.
---Read-only apart from the `mine` flag, which is stamped against the caller.
---@param src integer player server id
---@return table result { success, data = { listings } }
function actions.list(src)
    local cid = cidOf(src)
    if not cid then return { success = false, data = { listings = {} } } end

    local out = {}
    for _, row in ipairs(store.recent(MP.ListLimit)) do
        out[#out + 1] = toListing(row, cid)
    end
    for _, row in ipairs(store.scheduledFor(cid, MP.MaxListingsPerPlayer)) do
        out[#out + 1] = toListing(row, cid)
    end
    return { success = true, data = { listings = out } }
end

---Validates + normalises a listing payload into the columns we store, or nil + an error message.
---Title/body are required and capped, price clamps to MaxPrice (nil = "wanted"), images cap at
---MaxImages, and a number or email is required.
---@param payload table client payload (all fields untrusted)
---@param cid string caller citizenid
---@return table|nil fields columns to store, nil when invalid
---@return string? err rejection message when fields is nil
local function parseFields(payload, cid)
    local title = trim(payload.title)
    local body  = trim(payload.body)
    if #title < MP.MinTitleLength then return nil, 'Title required' end
    if #body  < MP.MinBodyLength  then return nil, 'Description required' end
    if #title > MP.MaxTitleLength then title = title:sub(1, MP.MaxTitleLength) end
    if #body  > MP.MaxBodyLength  then body  = body:sub(1, MP.MaxBodyLength)  end

    local price
    if type(payload.price) == 'number' and payload.price >= 0 then
        price = math.min(math.floor(payload.price), MP.MaxPrice)
    end

    local images = {}
    local function addImg(u)
        local url = mediaGuard.photo(cid, u)
        if url and #images < (MP.MaxImages or 3) then images[#images + 1] = url end
    end
    if type(payload.images) == 'table' then
        if #payload.images > MAX_IMAGE_ENTRIES then return nil, 'Too many photos' end
        for _, u in ipairs(payload.images) do addImg(u) end
    end
    if #images == 0 then addImg(payload.image) end

    local number = digits(payload.number)
    if #number > MP.MaxContactLength then number = number:sub(1, MP.MaxContactLength) end

    local email = trim(payload.email):lower()
    if email == '' then email = nil
    elseif #email > 128 then email = email:sub(1, 128) end

    if number == '' and not email then
        return nil, 'Add a phone number or email'
    end

    return {
        title  = title, body = body, price = price,
        image  = images[1], images = (#images > 0 and json.encode(images) or nil),
        number = number, email = email,
    }
end

---Pushes a live feed change to the OTHER players with Marketplace open; the author is excluded.
---Scoped to watchers: the handler only exists while the app is mounted, so pushing to every
---player serialised a message across the NUI boundary for everyone who would discard it.
---Anyone opening Marketplace later fetches the list, so a missed push is never a stale feed.
---@param exceptSrc integer author server id to skip
---@param payload table feed push { type, item? } or { type, id? }
local function broadcastFeed(exceptSrc, payload)
    watchers.push('sd-phone:client:marketplace:feed', payload, exceptSrc)
end

---The one publish path: everything a listing does the moment it becomes visible. A listing created
---without a schedule runs this straight away; a queued one runs it when the sweep (or its owner)
---flips it, so a scheduled listing lands exactly the way an immediate one does.
---@param row table the live listing DB row
---@param exceptSrc integer|nil player who already has the change (the author), skipped by the push
local function announce(row, exceptSrc)
    broadcastFeed(exceptSrc, { type = 'added', item = toListing(row, nil) })
    -- First-party hook: one server-local event per created listing; the payload carries a citizenid.
    TriggerEvent('sd-phone:server:marketplace:post', {
        id = row.id, source = exceptSrc or player.getSourceByIdentifier(row.citizenid),
        citizenid = row.citizenid, number = row.number,
        title = row.title, body = row.body, price = row.price,
        image = row.image, images = row.images,
    })
end

---Flips a queued listing live and announces it. The status-guarded UPDATE means a row racing two
---callers only ever announces once.
---@param id integer listing row id
---@param ts integer unix seconds stamped as the publish moment
---@param exceptSrc integer|nil the actor, skipped by the feed push
---@return table|nil row the freshly published listing row, nil when it was no longer scheduled
local function publishRow(id, ts, exceptSrc)
    if store.markPublished(id, ts) < 1 then return nil end

    local row = store.byId(id)
    if not row then return nil end

    announce(row, exceptSrc)
    return row
end

---Creates a listing. Owner and timestamp are server-authoritative, listings cap at
---MP.MaxListingsPerPlayer per character, and every field passes parseFields. A `publishAt` queues
---the listing instead: it is stored, counted against the cap and shown back to its owner, but
---nobody else sees it and no feed push goes out until its time comes.
---@param src integer player server id
---@param payload table|nil client payload (untrusted)
---@return table result { success, message?, data = { listing }? }
function actions.create(src, payload)
    local cid = cidOf(src)
    if not cid then return { success = false } end
    if type(payload) ~= 'table' then payload = {} end
    if not util.rateLimit(cid, 'marketplace:write', WRITE_WINDOW, WRITE_MAX) then
        return { success = false, messageKey = 'marketplace.slowDown', message = 'Slow down' }
    end

    if store.countFor(cid) >= MP.MaxListingsPerPlayer then
        return { success = false, messageKey = 'marketplace.haveTooManyActiveListings', message = 'You have too many active listings' }
    end

    local f, err = parseFields(payload, cid)
    if not f then return { success = false, message = err } end

    local ts = os.time()
    local publishAt
    if payload.publishAt ~= nil then
        local at, key, msg = scheduleAt(payload.publishAt, ts)
        if not at then return { success = false, messageKey = key, message = msg } end
        publishAt = at
    end

    local id = store.insert(cid, f.title, f.body, f.price, f.image, f.images, f.number, f.email, ts, publishAt)
    local row = {
        id = id, citizenid = cid, title = f.title, body = f.body, price = f.price,
        image = f.image, images = f.images, number = f.number, email = f.email, created_at = ts,
        status = publishAt and 'scheduled' or 'published', publish_at = publishAt,
    }
    if not publishAt then announce(row, src) end
    return { success = true, data = { listing = toListing(row, cid) } }
end

---Moves one of the caller's queued listings to a new publish time. Ownership-gated like update; a
---listing already live is refused rather than pulled back off the feed.
---@param src integer player server id
---@param payload table|nil client payload { id, publishAt } (untrusted)
---@return table result { success, message?, data = { listing }? }
function actions.reschedule(src, payload)
    local cid = cidOf(src)
    if not cid then return { success = false } end
    if type(payload) ~= 'table' then payload = {} end
    if not util.rateLimit(cid, 'marketplace:write', WRITE_WINDOW, WRITE_MAX) then
        return { success = false, messageKey = 'marketplace.slowDown', message = 'Slow down' }
    end

    local id = listingId(payload.id)
    if not id then return { success = false, messageKey = 'marketplace.badListingId', message = 'Bad listing id' } end
    if store.ownerOf(id) ~= cid then return { success = false, messageKey = 'marketplace.notListing', message = 'Not your listing' } end
    if store.statusOf(id) ~= 'scheduled' then
        return { success = false, messageKey = 'marketplace.alreadyPublished', message = 'That listing is already published' }
    end

    local at, key, msg = scheduleAt(payload.publishAt, os.time())
    if not at then return { success = false, messageKey = key, message = msg } end

    store.reschedule(id, at)
    local row = store.byId(id)
    if not row then return { success = false, messageKey = 'marketplace.listingNotFound', message = 'Listing not found' } end
    return { success = true, data = { listing = toListing(row, cid) } }
end

---Publishes one of the caller's queued listings immediately, through the same path the sweep uses.
---@param src integer player server id
---@param id any listing id from the client (untrusted)
---@return table result { success, message?, data = { listing }? }
function actions.publishNow(src, id)
    local cid = cidOf(src)
    if not cid then return { success = false } end
    if not util.rateLimit(cid, 'marketplace:write', WRITE_WINDOW, WRITE_MAX) then
        return { success = false, messageKey = 'marketplace.slowDown', message = 'Slow down' }
    end

    id = listingId(id)
    if not id then return { success = false, messageKey = 'marketplace.badListingId', message = 'Bad listing id' } end
    if store.ownerOf(id) ~= cid then return { success = false, messageKey = 'marketplace.notListing', message = 'Not your listing' } end

    local row = publishRow(id, os.time(), src)
    if not row then return { success = false, messageKey = 'marketplace.alreadyPublished', message = 'That listing is already published' } end
    return { success = true, data = { listing = toListing(row, cid) } }
end

---Flips every queued listing whose publish time has passed, oldest first, and tells each owner
---their listing is live. Driven by the sweep timer in server/marketplace/init.lua.
---@return integer published how many listings went live this pass
function actions.runDue()
    local now = os.time()
    local due = store.dueScheduled(now, DUE_LIMIT)
    if #due == 0 then return 0 end

    ---@type table Notification relay (server.notifications.init): offline-safe owner receipts.
    local notifications = require 'server.notifications.init'

    local published = 0
    for _, row in ipairs(due) do
        if publishRow(row.id, now, nil) then
            published = published + 1
            notifications.notifyCid(row.citizenid, {
                app      = 'Marketplace',
                appId    = 'marketplace',
                image    = (row.image and row.image ~= '') and row.image or nil,
                titleKey = 'marketplace.notifPublishedTitle',
                title    = 'Listing published',
                bodyKey  = 'marketplace.notifPublishedBody',
                body     = '{title}',
                bodyVars = { title = row.title },
                time     = 'now',
            })
        end
    end
    return published
end

---Edits a listing. Ownership-gated: the row's stored citizenid must equal the caller's; the id
---must be a finite integer. The row is re-read after the write.
---@param src integer player server id
---@param payload table|nil client payload { id, ...fields } (untrusted)
---@return table result { success, message?, data = { listing }? }
function actions.update(src, payload)
    local cid = cidOf(src)
    if not cid then return { success = false } end
    if type(payload) ~= 'table' then payload = {} end
    if not util.rateLimit(cid, 'marketplace:write', WRITE_WINDOW, WRITE_MAX) then
        return { success = false, messageKey = 'marketplace.slowDown', message = 'Slow down' }
    end

    local id = listingId(payload.id)
    if not id then return { success = false, messageKey = 'marketplace.badListingId', message = 'Bad listing id' } end
    if store.ownerOf(id) ~= cid then return { success = false, messageKey = 'marketplace.notListing', message = 'Not your listing' } end

    local f, err = parseFields(payload, cid)
    if not f then return { success = false, message = err } end

    local ts = os.time()
    local wasScheduled = store.statusOf(id) == 'scheduled'
    local publishAt
    if payload.publishAt ~= nil then
        if not wasScheduled then
            return { success = false, messageKey = 'marketplace.alreadyPublished', message = 'That listing is already published' }
        end
        local at, key, msg = scheduleAt(payload.publishAt, ts)
        if not at then return { success = false, messageKey = key, message = msg } end
        publishAt = at
    end

    store.update(id, f.title, f.body, f.price, f.image, f.images, f.number, f.email)

    if wasScheduled then
        if publishAt then
            store.reschedule(id, publishAt)
        else
            publishRow(id, ts, src)
        end
    end

    local row = store.byId(id)
    if not row then return { success = false, messageKey = 'marketplace.listingNotFound', message = 'Listing not found' } end
    if not wasScheduled then broadcastFeed(src, { type = 'updated', item = toListing(row, nil) }) end
    return { success = true, data = { listing = toListing(row, cid) } }
end

---Deletes a listing. Ownership-gated like update; the id is normalised to a finite integer and the
---feed push echoes it back as a string. This is also how a queued listing is cancelled, so the push
---is skipped when nobody else could see the listing in the first place.
---@param src integer player server id
---@param id any listing id from the client (untrusted)
---@return table result { success, message?, data = { id }? }
function actions.delete(src, id)
    local cid = cidOf(src)
    if not cid then return { success = false } end
    if not util.rateLimit(cid, 'marketplace:write', WRITE_WINDOW, WRITE_MAX) then
        return { success = false, messageKey = 'marketplace.slowDown', message = 'Slow down' }
    end
    id = listingId(id)
    if not id then return { success = false, messageKey = 'marketplace.badListingId', message = 'Bad listing id' } end
    if store.ownerOf(id) ~= cid then return { success = false, messageKey = 'marketplace.notListing', message = 'Not your listing' } end
    local wasScheduled = store.statusOf(id) == 'scheduled'
    store.delete(id)
    if not wasScheduled then broadcastFeed(src, { type = 'removed', id = tostring(id) }) end
    return { success = true, data = { id = tostring(id) } }
end

return actions
