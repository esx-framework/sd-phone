---@type table Post-0.9.0 column back-fills (server.migrations).
local migrations = require 'server.migrations'
---@type table Shared server helpers (server.util): ensureIndex for the scheduled-sweep index.
local util = require 'server.util'

---@type table Store module; the table returned at end of file. Two tables: articles and the
---ordered "Breaking" ticker lines. An article row is either live (`status` 'published') or waiting
---on its `publish_at` stamp (`status` 'scheduled'); only the live ones are ever read publicly.
---Every statement is parameterized.
local store = {}

---Creates the article + ticker tables if they don't exist and back-fills the scheduling columns.
---Runs once at boot from init.lua.
function store.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `phone_weazel_articles` (
            `id`         INT AUTO_INCREMENT PRIMARY KEY,
            `category`   VARCHAR(24)  NOT NULL,
            `headline`   VARCHAR(160) NOT NULL,
            `dek`        VARCHAR(255) NOT NULL,
            `body`       TEXT         NOT NULL,
            `author`     VARCHAR(80)  NOT NULL,
            `author_cid` VARCHAR(60)  NOT NULL,
            `image`      VARCHAR(512) NULL,
            `featured`   TINYINT(1)   NOT NULL DEFAULT 0,
            `views`      INT          NOT NULL DEFAULT 0,
            `status`     VARCHAR(12)  NOT NULL DEFAULT 'published',
            `publish_at` BIGINT       NULL,
            `created_at` BIGINT       NOT NULL,
            `updated_at` BIGINT       NOT NULL,
            KEY `created_at` (`created_at`),
            KEY `featured` (`featured`),
            KEY `status_publish_at` (`status`, `publish_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]])
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `phone_weazel_breaking` (
            `id`         INT AUTO_INCREMENT PRIMARY KEY,
            `text`       VARCHAR(220) NOT NULL,
            `pos`        INT          NOT NULL DEFAULT 0,
            `created_at` BIGINT       NOT NULL,
            KEY `pos` (`pos`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]])

    migrations.apply('phone_weazel_articles')
    util.ensureIndex('phone_weazel_articles', 'status_publish_at', '(`status`, `publish_at`)')
end

---The most-recent live articles, newest-first. Scheduled rows are invisible here. Read-only.
---@param limit integer max rows to return (config WZ.ArticlesPerFeed)
---@return table[] rows article rows, empty when none
function store.articles(limit)
    return MySQL.query.await([[
        SELECT * FROM `phone_weazel_articles`
        WHERE status = 'published'
        ORDER BY created_at DESC LIMIT ?
    ]], { limit }) or {}
end

---Every article still waiting on its publish time, soonest first. The newsroom is shared, so
---staff see each other's queue. Read-only.
---@param limit integer max rows to return
---@return table[] rows scheduled article rows, empty when none
function store.scheduled(limit)
    return MySQL.query.await([[
        SELECT * FROM `phone_weazel_articles`
        WHERE status = 'scheduled'
        ORDER BY publish_at ASC LIMIT ?
    ]], { limit }) or {}
end

---Scheduled articles whose publish time has passed, oldest first. Read-only; the sweep in
---init.lua flips each one through actions.
---@param now integer unix seconds to compare publish_at against
---@param limit integer max rows to flip in one sweep
---@return table[] rows due article rows, empty when none
function store.dueScheduled(now, limit)
    return MySQL.query.await([[
        SELECT * FROM `phone_weazel_articles`
        WHERE status = 'scheduled' AND publish_at <= ?
        ORDER BY publish_at ASC LIMIT ?
    ]], { now, limit }) or {}
end

---One article by id, whatever its status. Read-only.
---@param id integer article id
---@return table|nil row article row, nil when missing
function store.articleById(id)
    return MySQL.single.await('SELECT * FROM `phone_weazel_articles` WHERE id = ?', { id })
end

---Inserts a freshly-sanitized article row; views always start at 0. `a.publish_at` set (with
---`a.status` 'scheduled') holds the story back until the due sweep picks it up.
---@param a table row-ready fields from actions.sanitize plus the stamped author/status/timestamps
---@return integer id auto-increment id of the new article
function store.insertArticle(a)
    return MySQL.insert.await([[
        INSERT INTO `phone_weazel_articles`
            (category, headline, dek, body, author, author_cid, image, featured, views, publish_at, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    ]], { a.category, a.headline, a.dek, a.body, a.author, a.author_cid, a.image, a.featured,
          a.publish_at, a.status or 'published', a.created_at, a.updated_at })
end

---Updates the editable fields of an existing article. Author/views/status/created_at are never
---touched.
---@param id integer article id
---@param a table row-ready fields from actions.sanitize plus updated_at
function store.updateArticle(id, a)
    MySQL.query.await([[
        UPDATE `phone_weazel_articles`
        SET category = ?, headline = ?, dek = ?, body = ?, image = ?, featured = ?, updated_at = ?
        WHERE id = ?
    ]], { a.category, a.headline, a.dek, a.body, a.image, a.featured, a.updated_at, id })
end

---Moves a scheduled article to a new publish time. A published row is left alone, so a stale
---client can never pull a live story back off the feed.
---@param id integer article id
---@param publishAt integer unix seconds the story should go live
---@param ts integer unix seconds stamped as updated_at
---@return integer changed rows updated (0 when the article is not scheduled)
function store.reschedule(id, publishAt, ts)
    return tonumber(MySQL.update.await([[
        UPDATE `phone_weazel_articles` SET publish_at = ?, updated_at = ?
        WHERE id = ? AND status = 'scheduled'
    ]], { publishAt, ts, id })) or 0
end

---Flips a scheduled article live, restamping created_at so it sorts as fresh. The status clause
---is what makes this safe to race: two callers reaching the same row leave exactly one with a
---non-zero result, so the publish side effects run once.
---@param id integer article id
---@param ts integer unix seconds to stamp as the publish moment
---@return integer changed rows updated (0 when the article was not scheduled any more)
function store.markPublished(id, ts)
    return tonumber(MySQL.update.await([[
        UPDATE `phone_weazel_articles`
        SET status = 'published', publish_at = NULL, created_at = ?, updated_at = ?
        WHERE id = ? AND status = 'scheduled'
    ]], { ts, ts, id })) or 0
end

---Delete an article. Idempotent - a missing id deletes nothing.
---@param id integer article id
function store.deleteArticle(id)
    MySQL.query.await('DELETE FROM `phone_weazel_articles` WHERE id = ?', { id })
end

---Clears the featured flag on every live article except `keepId` (pass nil/0 to clear all). A
---queued story keeps its own flag: it only demotes the lead once it actually publishes.
---@param keepId integer|nil article id keeping its featured flag
function store.clearFeatured(keepId)
    MySQL.query.await(
        "UPDATE `phone_weazel_articles` SET featured = 0 WHERE id <> ? AND status = 'published'",
        { keepId or 0 })
end

---Adds buffered view counts to their articles, one statement per article touched since the last
---flush. Reading an article used to cost an UPDATE plus a SELECT per call, on a path with no gate.
---@param counts table<integer, integer> article id -> views to add
function store.bumpViewsBatch(counts)
    for id, n in pairs(counts) do
        if n > 0 then
            MySQL.query.await('UPDATE `phone_weazel_articles` SET views = views + ? WHERE id = ?', { n, id })
        end
    end
end

---A live article's current view total, or nil when no such article is published. Read-only; the
---status clause is what stops a client probing ids for queued stories.
---@param id integer article id
---@return integer|nil views
function store.viewsOf(id)
    return tonumber(MySQL.scalar.await(
        "SELECT views FROM `phone_weazel_articles` WHERE id = ? AND status = 'published'", { id }))
end

---Ticker lines in display order. Read-only.
---@return table[] rows { text } rows, empty when none
function store.breaking()
    return MySQL.query.await('SELECT text FROM `phone_weazel_breaking` ORDER BY pos ASC, id ASC') or {}
end

---Replaces the whole ticker with `lines` (already trimmed/clamped by the caller), preserving
---their order.
---@param lines string[] ticker lines in display order
---@param ts integer unix seconds stamp for the new rows
function store.replaceBreaking(lines, ts)
    MySQL.query.await('DELETE FROM `phone_weazel_breaking`')
    for i = 1, #lines do
        MySQL.insert.await(
            'INSERT INTO `phone_weazel_breaking` (text, pos, created_at) VALUES (?, ?, ?)',
            { lines[i], i, ts })
    end
end

return store
