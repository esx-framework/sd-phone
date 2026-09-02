---@type table sd-phone config root (configs/config.lua).
local config = require 'configs.config'
---@type table Weazel News persistence layer (server.weazelnews.store): article + ticker row CRUD.
local store  = require 'server.weazelnews.store'
---@type table Watcher registries (server.watchers): the phones with Weazel News open.
local watchers = require('server.watchers').of('weazelnews')
---@type table Player bridge (bridge.server.player): citizenid/name lookups from a server id.
local player = require 'bridge.server.player'
---@type table Job bridge (bridge.server.job): framework job membership/grade/boss checks.
local job    = require 'bridge.server.job'

---@type table Weazel News config (configs/weazelnews.lua): staff gating + content caps.
local WZ = config.WeazelNews

---@type integer Shortest lead time a story may be queued for, in seconds.
local SCHEDULE_MIN_AHEAD = 5 * 60
---@type integer Longest lead time a story may be queued for, in seconds.
local SCHEDULE_MAX_AHEAD = 30 * 86400
---@type integer Queued stories listed in the newsroom.
local SCHEDULED_LIMIT = 60
---@type integer Due stories one sweep flips live, so a long-idle server catches up over several
---passes instead of one blocking burst.
local DUE_LIMIT = 20

---@type table Actions module; the table returned at end of file. Handlers return the phone's
---{ success, message?, data? } envelope. The feed is public; publishing is staff-only. Byline,
---author citizenid and timestamps are stamped server-side and every input is clamped.
local actions = {}

---Nudges every other open phone to refetch. The newsroom publishes rarely and both feeds are
---small, so a refetch is cheaper to reason about than patching two lists in place.
---@param exceptSrc integer|nil author to skip, who already has the change
local function nudge(exceptSrc)
    watchers.push('sd-phone:weazelnews:feed', { type = 'changed' }, exceptSrc)
end

---@type table<string, boolean> Whitelist set of allowed article categories (WZ.Categories);
---mirrors the web Category union.
local CATS = {}
for _, c in ipairs(WZ.Categories) do CATS[c] = true end

---The acting player's citizenid, resolved from src via the player bridge.
---@param src integer player server id
---@return string|nil citizenid nil when the player can't be resolved
local function cidOf(src) return player.getIdentifier(src) end

local util = require 'server.util'
local trim = util.trim

---Coerces a client-supplied article id to a positive integer, or nil; NaN/inf/fractional values
---are rejected.
---@param v any client-supplied id value
---@return integer|nil id positive integer, nil when malformed
local function articleId(v)
    local n = tonumber(v)
    if not n or n ~= n or n == math.huge or n ~= math.floor(n) or n < 1 then return nil end
    return n
end

---True when `src` is news staff allowed to manage the newsroom: any listed job when CheckIsBoss
---is false, otherwise a boss (or ManageMinGrade+) of a configured job.
---@param src integer player server id
---@return boolean canManage
local function canManage(src)
    for _, name in ipairs(WZ.Jobs) do
        if not WZ.CheckIsBoss then
            if job.has(src, name) then return true end
        else
            if job.isBoss(src, name, WZ.BossGrade) then return true end
            if WZ.ManageMinGrade and job.has(src, name, WZ.ManageMinGrade) then return true end
        end
    end
    return false
end

---True when `src` may edit or cancel a queued story: newsroom staff, or the byline that wrote it.
---@param src integer player server id
---@param row table article DB row
---@return boolean allowed
local function canEditRow(src, row)
    if canManage(src) then return true end
    local cid = cidOf(src)
    return cid ~= nil and row.author_cid == cid
end

---Validates a client-supplied publish time: a whole unix second between five minutes and thirty
---days from now. Anything else is refused rather than clamped, so a wrong time is never published.
---@param v any client-supplied publish_at
---@param now integer unix seconds
---@return integer|nil publishAt validated stamp, nil when out of range or malformed
---@return string? key catalogue key for the refusal
---@return string? message English refusal text
local function scheduleAt(v, now)
    local n = tonumber(v)
    if not n or n ~= n or n == math.huge or n ~= math.floor(n) then
        return nil, 'weazelnews.badPublishTime', 'Pick a publish time'
    end
    if n < now + SCHEDULE_MIN_AHEAD then
        return nil, 'weazelnews.publishTooSoon', 'Schedule at least 5 minutes ahead'
    end
    if n > now + SCHEDULE_MAX_AHEAD then
        return nil, 'weazelnews.publishTooFar', 'Schedule at most 30 days ahead'
    end
    return n
end

---Compact relative-time label from a unix timestamp: "now", "38m", "2h", "3d".
---@param ts integer|nil unix seconds the article was created
---@return string label
local function relTime(ts)
    local d = os.time() - (ts or 0)
    if d < 60      then return 'now' end
    if d < 3600    then return math.floor(d / 60) .. 'm' end
    if d < 86400   then return math.floor(d / 3600) .. 'h' end
    return math.floor(d / 86400) .. 'd'
end

---Splits blank-line-separated text back into the paragraph array the reader expects. Falls back
---to the whole trimmed text as one paragraph.
---@param text string|nil stored body text
---@return string[] body paragraph array
local function splitParas(text)
    local body = {}
    for chunk in ((text or '') .. '\n\n'):gmatch('(.-)\n\n') do
        local p = trim(chunk)
        if p ~= '' then body[#body + 1] = p end
    end
    if #body == 0 then
        local t = trim(text or '')
        if t ~= '' then body[1] = t end
    end
    return body
end

---Public article shape sent to the app; omits author_cid. Handles oxmysql's TINYINT(1) reads
---arriving as either a Lua boolean or a number. A queued story carries `publishAt`, which is the
---only thing marking it as not-yet-live for the newsroom list.
---@param row table article DB row
---@return table article public article payload
local function pubArticle(row)
    local body = splitParas(row.body)
    return {
        id        = tostring(row.id),
        category  = row.category,
        headline  = row.headline,
        dek       = row.dek,
        body      = body,
        author    = row.author,
        time      = relTime(row.created_at),
        views     = tonumber(row.views) or 0,
        image     = (row.image and row.image ~= '') and row.image or nil,
        featured  = (tonumber(row.featured) == 1) or row.featured == true,
        publishAt = row.status == 'scheduled' and tonumber(row.publish_at) or nil,
    }
end

---The one publish path: flips a queued story live and runs every side effect a manual publish
---runs. Both the newsroom's "Publish now" and the due sweep call this, so a scheduled story lands
---exactly the way a hand-published one does. The status-guarded UPDATE means a row racing two
---callers only ever runs these once.
---@param id integer article id
---@param ts integer unix seconds stamped as the publish moment
---@param exceptSrc integer|nil player who already has the change (the actor), skipped by the push
---@return table|nil row the freshly published article row, nil when it was no longer scheduled
local function publishRow(id, ts, exceptSrc)
    if store.markPublished(id, ts) < 1 then return nil end

    local row = store.articleById(id)
    if not row then return nil end

    if (tonumber(row.featured) == 1) or row.featured == true then store.clearFeatured(id) end
    nudge(exceptSrc)
    return row
end

---Validates + clamps a client save payload into a row-ready table. Category is whitelist-checked
---and the headline required; everything else is clamped to the configured caps.
---@param payload any client-supplied article draft
---@return table|nil row row-ready fields, nil on a hard validation failure
---@return string? message failure reason when row is nil
local function sanitize(payload)
    if type(payload) ~= 'table' then payload = {} end

    local category = trim(payload.category)
    if not CATS[category] then return nil, 'Pick a valid category' end

    local headline = trim(payload.headline)
    if headline == '' then return nil, 'Headline is required' end
    if #headline > WZ.MaxHeadlineLength then headline = headline:sub(1, WZ.MaxHeadlineLength) end

    local dek = trim(payload.dek)
    if #dek > WZ.MaxDekLength then dek = dek:sub(1, WZ.MaxDekLength) end

    local paras = {}
    if type(payload.body) == 'table' then
        for _, p in ipairs(payload.body) do
            local t = trim(p)
            if t ~= '' then paras[#paras + 1] = t end
        end
    elseif type(payload.body) == 'string' then
        local t = trim(payload.body)
        if t ~= '' then paras[1] = t end
    end
    local body = table.concat(paras, '\n\n')
    if #body > WZ.MaxBodyLength then body = body:sub(1, WZ.MaxBodyLength) end

    local image = trim(payload.image)
    if image == '' then image = nil
    elseif #image > WZ.MaxImageUrlLength then image = image:sub(1, WZ.MaxImageUrlLength) end

    return {
        category = category,
        headline = headline,
        dek      = dek,
        body     = body,
        image    = image,
        featured = (payload.featured == true or payload.featured == 1) and 1 or 0,
    }
end

---Public feed: the latest live articles plus the breaking ticker, and whether the caller is news
---staff. Queued stories ride along only for staff, who are the only ones with a newsroom to see
---them in. Read-only.
---@param src integer player server id
---@return table result envelope with { articles, ticker, canManage, scheduled }
function actions.feed(src)
    local articles = {}
    for _, row in ipairs(store.articles(WZ.ArticlesPerFeed)) do
        articles[#articles + 1] = pubArticle(row)
    end
    local ticker = {}
    for _, row in ipairs(store.breaking()) do ticker[#ticker + 1] = row.text end

    local manage = canManage(src)
    local scheduled = {}
    if manage then
        for _, row in ipairs(store.scheduled(SCHEDULED_LIMIT)) do
            scheduled[#scheduled + 1] = pubArticle(row)
        end
    end

    return { success = true, data = { articles = articles, ticker = ticker, canManage = manage, scheduled = scheduled } }
end

---@type integer Rolling window the article-read budget is measured over, in ms.
local VIEW_WINDOW = 60000
---@type integer Article opens one character may register per window.
local VIEW_MAX = 60
---@type table<integer, integer> View increments not yet written, by article id.
local pendingViews = {}
---@type table<integer, integer> Running view total per article id, seeded from the row on first read.
local viewTotals = {}
---@type table<string, table<integer, boolean>> Articles a character has already counted this session.
local viewedBy = {}

util.onCleanup(function(_, citizenid)
    if citizenid then viewedBy[citizenid] = nil end
end)

---Writes the buffered view counts and clears the buffer. Driven by the flush timer in
---server/weazelnews/init.lua.
function actions.flushViews()
    if next(pendingViews) == nil then return end
    local batch = pendingViews
    pendingViews = {}
    store.bumpViewsBatch(batch)
end

---Counts one read of an article and returns its new view total. A bad or unknown id no-ops. The
---count is per character per session and buffered in memory, so re-opening a story is neither a
---free write nor a way to inflate the number.
---@param src integer player server id
---@param id any client-supplied article id
---@return table result envelope with { id, views }
function actions.view(src, id)
    id = articleId(id)
    if not id then return { success = false, messageKey = 'weazelnews.badArticleId', message = 'Bad article id' } end

    local cid = cidOf(src)
    if cid and not util.rateLimit(cid, 'weazelnews:view', VIEW_WINDOW, VIEW_MAX) then
        return { success = false, messageKey = 'weazelnews.slowDown', message = 'Slow down' }
    end

    local total = viewTotals[id]
    if not total then
        -- Unknown ids stop here: seeding the table from a client id would let id probing grow it.
        total = store.viewsOf(id)
        if not total then return { success = false, messageKey = 'weazelnews.articleNotFound', message = 'Article not found' } end
        viewTotals[id] = total
    end

    if cid then
        local seen = viewedBy[cid]
        if not seen then seen = {}; viewedBy[cid] = seen end
        if not seen[id] then
            seen[id] = true
            total = total + 1
            viewTotals[id] = total
            pendingViews[id] = (pendingViews[id] or 0) + 1
        end
    end

    return { success = true, data = { id = tostring(id), views = total } }
end

---Staff-only: creates a new article, or updates an existing one when `id` is set. Byline, author
---citizenid and created_at are stamped on first insert only; `featured` demotes every other live
---story. A `publishAt` in the payload queues the story instead of publishing it: it stays out of
---the feed, out of the ticker's way and off the featured slot until its time comes. Saving a
---queued story with no `publishAt` publishes it there and then.
---@param src integer player server id
---@param payload any client-supplied article draft (sanitize documents the shape) plus publishAt
---@return table result envelope with { article } on success
function actions.save(src, payload)
    if not canManage(src) then return { success = false, messageKey = 'weazelnews.onlyWeazelNewsStaffCan', message = 'Only Weazel News staff can publish' } end
    local cid = cidOf(src)
    if not cid then return { success = false } end

    local row, err = sanitize(payload)
    if not row then return { success = false, message = err } end

    local ts = os.time()
    local id
    if type(payload) == 'table' and payload.id ~= nil then
        id = articleId(payload.id)
        if not id then return { success = false, messageKey = 'weazelnews.articleNotFound', message = 'Article not found' } end
    end

    local publishAt
    if type(payload) == 'table' and payload.publishAt ~= nil then
        local at, key, msg = scheduleAt(payload.publishAt, ts)
        if not at then return { success = false, messageKey = key, message = msg } end
        publishAt = at
    end

    if id then
        local existing = store.articleById(id)
        if not existing then return { success = false, messageKey = 'weazelnews.articleNotFound', message = 'Article not found' } end

        local wasScheduled = existing.status == 'scheduled'
        if publishAt and not wasScheduled then
            return { success = false, messageKey = 'weazelnews.alreadyPublished', message = 'That story is already published' }
        end

        row.updated_at = ts
        store.updateArticle(id, row)

        if wasScheduled then
            if publishAt then
                store.reschedule(id, publishAt, ts)
            else
                publishRow(id, ts, src)
            end
            local queued = store.articleById(id)
            return { success = true, data = { article = queued and pubArticle(queued) or nil } }
        end
    else
        row.author     = player.getName(src) or 'Weazel Staff'
        row.author_cid = cid
        row.created_at = ts
        row.updated_at = ts
        row.publish_at = publishAt
        row.status     = publishAt and 'scheduled' or 'published'
        id = store.insertArticle(row)

        if publishAt then
            local queued = store.articleById(id)
            return { success = true, data = { article = queued and pubArticle(queued) or nil } }
        end
    end

    if row.featured == 1 then store.clearFeatured(id) end

    local saved = store.articleById(id)
    nudge(src)
    return { success = true, data = { article = saved and pubArticle(saved) or nil } }
end

---Moves a queued story to a new publish time. Staff or the byline that wrote it; a story already
---live is refused rather than pulled back off the feed.
---@param src integer player server id
---@param payload any client-supplied { id, publishAt }
---@return table result envelope with { article } on success
function actions.reschedule(src, payload)
    if type(payload) ~= 'table' then payload = {} end
    local id = articleId(payload.id)
    if not id then return { success = false, messageKey = 'weazelnews.badArticleId', message = 'Bad article id' } end

    local row = store.articleById(id)
    if not row then return { success = false, messageKey = 'weazelnews.articleNotFound', message = 'Article not found' } end
    if not canEditRow(src, row) then return { success = false, messageKey = 'weazelnews.onlyWeazelNewsStaffCan2', message = 'Only Weazel News staff can edit this' } end
    if row.status ~= 'scheduled' then return { success = false, messageKey = 'weazelnews.alreadyPublished', message = 'That story is already published' } end

    local ts = os.time()
    local at, key, msg = scheduleAt(payload.publishAt, ts)
    if not at then return { success = false, messageKey = key, message = msg } end

    store.reschedule(id, at, ts)
    local saved = store.articleById(id)
    return { success = true, data = { article = saved and pubArticle(saved) or nil } }
end

---Publishes a queued story immediately, through the same path the due sweep uses.
---@param src integer player server id
---@param payload any client-supplied { id }
---@return table result envelope with { article } on success
function actions.publishNow(src, payload)
    if type(payload) ~= 'table' then payload = {} end
    local id = articleId(payload.id)
    if not id then return { success = false, messageKey = 'weazelnews.badArticleId', message = 'Bad article id' } end

    local row = store.articleById(id)
    if not row then return { success = false, messageKey = 'weazelnews.articleNotFound', message = 'Article not found' } end
    if not canEditRow(src, row) then return { success = false, messageKey = 'weazelnews.onlyWeazelNewsStaffCan2', message = 'Only Weazel News staff can edit this' } end
    if row.status ~= 'scheduled' then return { success = false, messageKey = 'weazelnews.alreadyPublished', message = 'That story is already published' } end

    local published = publishRow(id, os.time(), src)
    return { success = true, data = { article = published and pubArticle(published) or nil } }
end

---Flips every story whose publish time has passed, oldest first, and tells each byline their
---story is live. Driven by the sweep timer in server/weazelnews/init.lua.
---@return integer published how many stories went live this pass
function actions.runDue()
    local now  = os.time()
    local due  = store.dueScheduled(now, DUE_LIMIT)
    if #due == 0 then return 0 end

    ---@type table Notification relay (server.notifications.init): offline-safe author receipts.
    local notifications = require 'server.notifications.init'

    local published = 0
    for _, row in ipairs(due) do
        if publishRow(row.id, now, nil) then
            published = published + 1
            notifications.notifyCid(row.author_cid, {
                app      = 'Weazel News',
                appId    = 'weazelnews',
                image    = (row.image and row.image ~= '') and row.image or nil,
                titleKey = 'weazelnews.notifPublishedTitle',
                title    = 'Story published',
                bodyKey  = 'weazelnews.notifPublishedBody',
                body     = '{headline}',
                bodyVars = { headline = row.headline },
                time     = 'now',
            })
        end
    end
    return published
end

---Staff-only: deletes an article by id. This is also how a queued story is cancelled, so the push
---is skipped when nobody could see the story in the first place.
---@param src integer player server id
---@param id any client-supplied article id
---@return table result envelope with { id } on success
function actions.delete(src, id)
    id = articleId(id)
    if not id then return { success = false, messageKey = 'weazelnews.badArticleId', message = 'Bad article id' } end

    local row = store.articleById(id)
    if row then
        if not canEditRow(src, row) then return { success = false, messageKey = 'weazelnews.onlyWeazelNewsStaffCan2', message = 'Only Weazel News staff can edit this' } end
    elseif not canManage(src) then
        return { success = false, messageKey = 'weazelnews.onlyWeazelNewsStaffCan2', message = 'Only Weazel News staff can edit this' }
    end

    store.deleteArticle(id)
    if not row or row.status ~= 'scheduled' then nudge(src) end
    return { success = true, data = { id = tostring(id) } }
end

---Clamps candidate ticker lines: non-strings and empties are dropped, the rest trimmed, capped
---per line and capped to MaxBreakingLines in order. A non-table clamps to an empty list.
---@param raw any candidate lines array
---@return string[] lines row-ready ticker lines in display order
local function clampTickerLines(raw)
    local lines = {}
    if type(raw) == 'table' then
        for _, l in ipairs(raw) do
            local t = trim(l)
            if t ~= '' then
                if #t > WZ.MaxBreakingLength then t = t:sub(1, WZ.MaxBreakingLength) end
                lines[#lines + 1] = t
                if #lines >= WZ.MaxBreakingLines then break end
            end
        end
    end
    return lines
end

---Staff-only: replaces the whole breaking ticker. Lines walk the clampTickerLines clamps.
---@param src integer player server id
---@param payload any client-supplied { lines: string[] }
---@return table result envelope with { ticker } echoing the stored lines
function actions.setBreaking(src, payload)
    if not canManage(src) then return { success = false, messageKey = 'weazelnews.onlyWeazelNewsStaffCan2', message = 'Only Weazel News staff can edit this' } end
    if type(payload) ~= 'table' then payload = {} end

    local lines = clampTickerLines(payload.lines)
    store.replaceBreaking(lines, os.time())
    nudge(src)
    return { success = true, data = { ticker = lines } }
end

---Trusted-caller publish for the postArticle export: skips the staff gate but walks every
---sanitize clamp. Byline defaults to 'Weazel News', author_cid is the 'export' sentinel. Insert-only.
---@param article any export-supplied article draft (sanitize documents the shape)
---@return integer|nil articleId new article id, nil on validation failure
---@return string? reason failure reason when articleId is nil
function actions.publish(article)
    local row, err = sanitize(article)
    if not row then return nil, err end

    local author = trim(article.author)
    if author == '' then author = 'Weazel News' end

    local ts = os.time()
    row.author     = author:sub(1, 80)
    row.author_cid = 'export'
    row.created_at = ts
    row.updated_at = ts

    local id = store.insertArticle(row)
    if row.featured == 1 then store.clearFeatured(id) end
    nudge(nil)
    return id
end

---Trusted-caller ticker replace for the setBreakingTicker export: no staff gate, same
---clampTickerLines clamps. An empty array clears the ticker; a non-table returns false.
---@param lines any string[] ticker lines in display order
---@return boolean replaced
function actions.replaceTicker(lines)
    if type(lines) ~= 'table' then return false end
    store.replaceBreaking(clampTickerLines(lines), os.time())
    nudge(nil)
    return true
end

return actions
