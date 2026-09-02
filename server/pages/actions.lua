---@type table sd-phone config root (configs/config.lua).
local config = require 'configs.config'
---@type table Pages persistence layer (server.pages.store): post row CRUD.
local store = require 'server.pages.store'
---@type table Player bridge (bridge.server.player): citizenid/identifier lookup from a server id.
local player = require 'bridge.server.player'
---@type table Watcher registry (server.watchers): players with Pages open.
local watchers = require('server.watchers').of('pages')

---@type table Pages app config (configs/pages.lua): feed limit + field caps.
local PG = config.Pages
---@type table Actions module; the table returned at end of file. Every handler returns the
---{ success, message?, data? } envelope. The owner is the caller's citizenid and the timestamp is
---set here. Structural twin of server.marketplace.actions.
local actions = {}

local util = require 'server.util'
local digits, trim = util.digits, util.trim

---@type integer Longest client images array parseFields will walk; every element is trimmed before
---the MaxImages cap applies, so an unbounded array is free CPU for the caller.
local MAX_IMAGE_ENTRIES = 50
---@type integer Rolling window the write budget is measured over, in ms.
local WRITE_WINDOW = 10000
---@type integer Creates plus edits plus deletes one character may make per window. Clearing out a
---full MaxPostsPerPlayer set in one go still fits.
local WRITE_MAX = 16
---@type integer Shortest lead time a post may be queued for, in seconds.
local SCHEDULE_MIN_AHEAD = 5 * 60
---@type integer Longest lead time a post may be queued for, in seconds.
local SCHEDULE_MAX_AHEAD = 30 * 86400
---@type integer Due posts one sweep flips live, so a long-idle server catches up over several
---passes instead of one blocking burst.
local DUE_LIMIT = 20

---Caller identity, resolved from src via the player bridge.
---@param src integer player server id
---@return string|nil citizenid (nil while no character is loaded)
local function cidOf(src) return player.getIdentifier(src) end


---Coerces a client-supplied post id to a positive integer, or nil.
---@param v any client-supplied id value
---@return integer|nil id
local function postId(v)
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
        return nil, 'pages.badPublishTime', 'Pick a publish time'
    end
    if n < now + SCHEDULE_MIN_AHEAD then
        return nil, 'pages.publishTooSoon', 'Schedule at least 5 minutes ahead'
    end
    if n > now + SCHEDULE_MAX_AHEAD then
        return nil, 'pages.publishTooFar', 'Schedule at most 30 days ahead'
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
---@param row table post DB row
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
---@param row table post DB row
---@param cid string|nil viewer citizenid (nil when building a broadcast copy)
---@return table post UI post shape
local function toPost(row, cid)
    local imgs = decodeImages(row)
    return {
        id        = tostring(row.id),
        title     = row.title,
        body      = row.body,
        image     = imgs[1],
        images    = (#imgs > 0 and imgs or nil),
        number    = row.number,
        email     = row.email,
        date      = fmtDate(row.created_at),
        mine      = row.citizenid == cid,
        publishAt = row.status == 'scheduled' and tonumber(row.publish_at) or nil,
    }
end

---The most-recent PG.ListLimit live posts across all players, with the caller's own queued posts
---appended. A queued post carries `publishAt`, which is what "Your Posts" sorts it out by and
---what the browse list filters it out on; nobody else's queue is ever in this list. Read-only
---apart from the `mine` flag, which is stamped against the caller.
---@param src integer player server id
---@return table result { success, data = { posts } }
function actions.list(src)
    local cid = cidOf(src)
    if not cid then return { success = false, data = { posts = {} } } end

    local out = {}
    for _, row in ipairs(store.recent(PG.ListLimit)) do
        out[#out + 1] = toPost(row, cid)
    end
    for _, row in ipairs(store.scheduledFor(cid, PG.MaxPostsPerPlayer)) do
        out[#out + 1] = toPost(row, cid)
    end
    return { success = true, data = { posts = out } }
end

---Validates + normalises a post payload into the columns we store, or nil + an error message.
---Title/body are required and capped, images cap at MaxImages, and a number or email is required.
---@param payload table client payload (all fields untrusted)
---@param cid string caller citizenid (unused)
---@return table|nil fields columns to store, nil when invalid
---@return string? err rejection message when fields is nil
local function parseFields(payload, cid)
    local title = trim(payload.title)
    local body  = trim(payload.body)
    if #title < PG.MinTitleLength then return nil, 'Title required' end
    if #body  < PG.MinBodyLength  then return nil, 'Description required' end
    if #title > PG.MaxTitleLength then title = title:sub(1, PG.MaxTitleLength) end
    if #body  > PG.MaxBodyLength  then body  = body:sub(1, PG.MaxBodyLength)  end

    local price = nil

    local images = {}
    local function addImg(u)
        local url = trim(u)
        if url ~= '' and #images < (PG.MaxImages or 3) then
            images[#images + 1] = url:sub(1, PG.MaxImageUrlLength)
        end
    end
    if type(payload.images) == 'table' then
        if #payload.images > MAX_IMAGE_ENTRIES then return nil, 'Too many photos' end
        for _, u in ipairs(payload.images) do addImg(u) end
    end
    if #images == 0 then addImg(payload.image) end

    local number = digits(payload.number)
    if #number > PG.MaxContactLength then number = number:sub(1, PG.MaxContactLength) end

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

---Pushes a live feed change to the OTHER players with Pages open; the author is excluded.
---Scoped to watchers: the handler only exists while the app is mounted, so pushing to every
---player serialised a message across the NUI boundary for everyone who would discard it.
---Anyone opening Pages later fetches the list, so a missed push is never a stale feed.
---@param exceptSrc integer author server id to skip
---@param payload table feed push { type, item? } or { type, id? }
local function broadcastFeed(exceptSrc, payload)
    watchers.push('sd-phone:client:pages:feed', payload, exceptSrc)
end

---The one publish path: everything a post does the moment it becomes visible. A post created
---without a schedule runs this straight away; a queued one runs it when the sweep (or its owner)
---flips it, so a scheduled post lands exactly the way an immediate one does.
---@param row table the live post DB row
---@param exceptSrc integer|nil player who already has the change (the author), skipped by the push
local function announce(row, exceptSrc)
    broadcastFeed(exceptSrc, { type = 'added', item = toPost(row, nil) })
    -- First-party hook: one server-local event per published post; the payload carries a citizenid.
    TriggerEvent('sd-phone:server:pages:post', {
        id = row.id, source = exceptSrc or player.getSourceByIdentifier(row.citizenid),
        citizenid = row.citizenid, number = row.number,
        title = row.title, body = row.body, price = row.price,
        image = row.image, images = row.images,
    })
end

---Flips a queued post live and announces it. The status-guarded UPDATE means a row racing two
---callers only ever announces once.
---@param id integer post row id
---@param ts integer unix seconds stamped as the publish moment
---@param exceptSrc integer|nil the actor, skipped by the feed push
---@return table|nil row the freshly published post row, nil when it was no longer scheduled
local function publishRow(id, ts, exceptSrc)
    if store.markPublished(id, ts) < 1 then return nil end

    local row = store.byId(id)
    if not row then return nil end

    announce(row, exceptSrc)
    return row
end

---Creates a post. Owner and timestamp are server-authoritative, posts cap at PG.MaxPostsPerPlayer
---per character, and every field passes parseFields. A `publishAt` queues the post instead: it is
---stored, counted against the cap and shown back to its owner, but nobody else sees it and no feed
---push goes out until its time comes.
---@param src integer player server id
---@param payload table|nil client payload (untrusted)
---@return table result { success, message?, data = { post }? }
function actions.create(src, payload)
    local cid = cidOf(src)
    if not cid then return { success = false } end
    if type(payload) ~= 'table' then payload = {} end
    if not util.rateLimit(cid, 'pages:write', WRITE_WINDOW, WRITE_MAX) then
        return { success = false, messageKey = 'pages.slowDown', message = 'Slow down' }
    end

    if store.countFor(cid) >= PG.MaxPostsPerPlayer then
        return { success = false, messageKey = 'pages.haveTooManyActivePosts', message = 'You have too many active posts' }
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
    return { success = true, data = { post = toPost(row, cid) } }
end

---Moves one of the caller's queued posts to a new publish time. Ownership-gated like update; a
---post already live is refused rather than pulled back off the feed.
---@param src integer player server id
---@param payload table|nil client payload { id, publishAt } (untrusted)
---@return table result { success, message?, data = { post }? }
function actions.reschedule(src, payload)
    local cid = cidOf(src)
    if not cid then return { success = false } end
    if type(payload) ~= 'table' then payload = {} end
    if not util.rateLimit(cid, 'pages:write', WRITE_WINDOW, WRITE_MAX) then
        return { success = false, messageKey = 'pages.slowDown', message = 'Slow down' }
    end

    local id = postId(payload.id)
    if not id then return { success = false, messageKey = 'pages.badPostId', message = 'Bad post id' } end
    if store.ownerOf(id) ~= cid then return { success = false, messageKey = 'pages.notPost', message = 'Not your post' } end
    if store.statusOf(id) ~= 'scheduled' then
        return { success = false, messageKey = 'pages.alreadyPublished', message = 'That post is already published' }
    end

    local at, key, msg = scheduleAt(payload.publishAt, os.time())
    if not at then return { success = false, messageKey = key, message = msg } end

    store.reschedule(id, at)
    local row = store.byId(id)
    if not row then return { success = false, messageKey = 'pages.postNotFound', message = 'Post not found' } end
    return { success = true, data = { post = toPost(row, cid) } }
end

---Publishes one of the caller's queued posts immediately, through the same path the sweep uses.
---@param src integer player server id
---@param id any post id from the client (untrusted)
---@return table result { success, message?, data = { post }? }
function actions.publishNow(src, id)
    local cid = cidOf(src)
    if not cid then return { success = false } end
    if not util.rateLimit(cid, 'pages:write', WRITE_WINDOW, WRITE_MAX) then
        return { success = false, messageKey = 'pages.slowDown', message = 'Slow down' }
    end

    id = postId(id)
    if not id then return { success = false, messageKey = 'pages.badPostId', message = 'Bad post id' } end
    if store.ownerOf(id) ~= cid then return { success = false, messageKey = 'pages.notPost', message = 'Not your post' } end

    local row = publishRow(id, os.time(), src)
    if not row then return { success = false, messageKey = 'pages.alreadyPublished', message = 'That post is already published' } end
    return { success = true, data = { post = toPost(row, cid) } }
end

---Flips every queued post whose publish time has passed, oldest first, and tells each owner their
---post is live. Driven by the sweep timer in server/pages/init.lua.
---@return integer published how many posts went live this pass
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
                app      = 'Pages',
                appId    = 'pages',
                image    = (row.image and row.image ~= '') and row.image or nil,
                titleKey = 'pages.notifPublishedTitle',
                title    = 'Post published',
                bodyKey  = 'pages.notifPublishedBody',
                body     = '{title}',
                bodyVars = { title = row.title },
                time     = 'now',
            })
        end
    end
    return published
end

---Edits a post. Ownership-gated: the row's stored citizenid must equal the caller's; the id must
---be a finite integer. The row is re-read after the write.
---@param src integer player server id
---@param payload table|nil client payload { id, ...fields } (untrusted)
---@return table result { success, message?, data = { post }? }
function actions.update(src, payload)
    local cid = cidOf(src)
    if not cid then return { success = false } end
    if type(payload) ~= 'table' then payload = {} end
    if not util.rateLimit(cid, 'pages:write', WRITE_WINDOW, WRITE_MAX) then
        return { success = false, messageKey = 'pages.slowDown', message = 'Slow down' }
    end

    local id = postId(payload.id)
    if not id then return { success = false, messageKey = 'pages.badPostId', message = 'Bad post id' } end
    if store.ownerOf(id) ~= cid then return { success = false, messageKey = 'pages.notPost', message = 'Not your post' } end

    local f, err = parseFields(payload, cid)
    if not f then return { success = false, message = err } end

    local ts = os.time()
    local wasScheduled = store.statusOf(id) == 'scheduled'
    local publishAt
    if payload.publishAt ~= nil then
        if not wasScheduled then
            return { success = false, messageKey = 'pages.alreadyPublished', message = 'That post is already published' }
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
    if not row then return { success = false, messageKey = 'pages.postNotFound', message = 'Post not found' } end
    if not wasScheduled then broadcastFeed(src, { type = 'updated', item = toPost(row, nil) }) end
    return { success = true, data = { post = toPost(row, cid) } }
end

---Deletes a post. Ownership-gated like update; the id is normalised to a finite integer and the
---feed push echoes it back as a string. This is also how a queued post is cancelled, so the push
---is skipped when nobody else could see the post in the first place.
---@param src integer player server id
---@param id any post id from the client (untrusted)
---@return table result { success, message?, data = { id }? }
function actions.delete(src, id)
    local cid = cidOf(src)
    if not cid then return { success = false } end
    if not util.rateLimit(cid, 'pages:write', WRITE_WINDOW, WRITE_MAX) then
        return { success = false, messageKey = 'pages.slowDown', message = 'Slow down' }
    end
    id = postId(id)
    if not id then return { success = false, messageKey = 'pages.badPostId', message = 'Bad post id' } end
    if store.ownerOf(id) ~= cid then return { success = false, messageKey = 'pages.notPost', message = 'Not your post' } end
    local wasScheduled = store.statusOf(id) == 'scheduled'
    store.delete(id)
    if not wasScheduled then broadcastFeed(src, { type = 'removed', id = tostring(id) }) end
    return { success = true, data = { id = tostring(id) } }
end

return actions
