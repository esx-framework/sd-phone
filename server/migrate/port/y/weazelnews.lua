---@type table Weazel News porter (server.migrate.port.y.weazelnews). Carries YSeries' News
---articles across.
---
---sd-phone stamps every article with an author citizenid. YSeries records only the author's News
---username, so `news_loggedin` supplies the character; an article whose author nobody was signed in
---as still lands, keeping its byline, with no citizenid attached.
local M = {}

---@type table Migration data layer (server.migrate.store).
local store = require 'server.migrate.store'
---@type table YSeries source reads (server.migrate.ystore): paged reads + the owner map.
local ystore = require 'server.migrate.ystore'
---@type table Attachment extraction (server.migrate.media): image_urls is object-wrapped.
local media = require 'server.migrate.media'
---@type table Shared helpers (server.util): trim.
local util = require 'server.util'

---@type integer Rows read per page. News is a small table even on a busy server.
local PAGE <const> = 500

---@type table<string, string> YSeries category ids -> the categories the Weazel app renders. An
---unmapped id falls through to 'news', which is the app's own default.
local CATEGORY = {
    ['1'] = 'news', ['2'] = 'crime', ['3'] = 'sport', ['4'] = 'business',
    ['5'] = 'politics', ['6'] = 'weather', ['7'] = 'lifestyle',
    news = 'news', crime = 'crime', sport = 'sport', sports = 'sport',
    business = 'business', politics = 'politics', weather = 'weather',
}

---@param ctx table migration context (imeiToCid, dryRun)
---@return { articles: number, skipped: number, unattributed: number }
function M.run(ctx)
    local out = { articles = 0, skipped = 0, unattributed = 0 }
    if not ystore.table('news_articles') then return out end

    local owners = ystore.accountOwners('news')
    local cidOf, nameOf = {}, {}
    for username, imei in pairs(owners) do
        local cid = ctx.imeiToCid[imei]
        if cid then cidOf[username] = cid end
    end

    if ystore.table('news_accounts') then
        local offset = 0
        while true do
            local page = ystore.page('news_accounts', '`username`, `display_name`', offset, PAGE, '`username`')
            if #page == 0 then break end
            offset = offset + #page
            for _, a in ipairs(page) do
                local display = util.trim(a.display_name)
                nameOf[a.username] = display ~= '' and display or util.trim(a.username)
            end
        end
    end

    local offset = 0
    while true do
        local page = ystore.page('news_articles',
            '`id`, `title`, `summary`, `content`, `image_urls`, `category_id`, `author_id`, `views_count`, UNIX_TIMESTAMP(`created_at`) AS ts, UNIX_TIMESTAMP(`updated_at`) AS uts',
            offset, PAGE)
        if #page == 0 then break end
        offset = offset + #page

        local rows = {}
        for _, a in ipairs(page) do
            local headline = util.trim(a.title)
            if headline == '' then
                out.skipped = out.skipped + 1
            else
                local author = nameOf[a.author_id] or util.trim(a.author_id)
                local cid = cidOf[a.author_id]
                if not cid then out.unattributed = out.unattributed + 1 end

                local ts = tonumber(a.ts) or os.time()
                rows[#rows + 1] = {
                    CATEGORY[tostring(a.category_id or ''):lower()] or 'news',
                    headline:sub(1, 160),
                    (util.trim(a.summary)):sub(1, 255),
                    util.trim(a.content),
                    (author ~= '' and author or 'Weazel News'):sub(1, 80),
                    cid or '',
                    media.urls(a.image_urls)[1],
                    0,
                    math.max(0, math.floor(tonumber(a.views_count) or 0)),
                    ts,
                    tonumber(a.uts) or ts,
                }
                out.articles = out.articles + 1
            end
        end

        if not ctx.dryRun and #rows > 0 then store.insertWeazelArticles(rows) end
    end

    return out
end

return M
