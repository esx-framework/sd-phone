---@type table Post-0.9.0 column back-fills (server.migrations).
local migrations = require 'server.migrations'
---@type table Shared server helpers (server.util): ensureIndex for the scheduled-sweep index.
local util = require 'server.util'

---@type table Store module; the table returned at end of file. One row per post; the feed is
---just the most recent live rows across all players. A post waiting on a publish time sits at
---`status` 'scheduled' and is read back only for its own owner. `price` is always NULL and
---`image` is an optional remote URL. Every value is a ? parameter.
local store = {}

---Creates the pages_posts table if it doesn't exist and back-fills the `email`, `images` and
---scheduling columns. Runs once at boot.
function store.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `pages_posts` (
            `id`         INT AUTO_INCREMENT PRIMARY KEY,
            `citizenid`  VARCHAR(60)  NOT NULL,
            `title`      VARCHAR(80)  NOT NULL,
            `body`       TEXT         NOT NULL,
            `price`      BIGINT       NULL,
            `image`      VARCHAR(512) NULL,
            `images`     TEXT         NULL,
            `number`     VARCHAR(20)  NOT NULL,
            `email`      VARCHAR(128) NULL,
            `status`     VARCHAR(12)  NOT NULL DEFAULT 'published',
            `publish_at` BIGINT       NULL,
            `created_at` BIGINT       NOT NULL,
            KEY `citizenid` (`citizenid`),
            KEY `created_at` (`created_at`),
            KEY `status_publish_at` (`status`, `publish_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]])

    migrations.apply('pages_posts')
    util.ensureIndex('pages_posts', 'status_publish_at', '(`status`, `publish_at`)')
end

---Persists a new post. `price`/`image`/`images`/`email` may be nil (stored as SQL NULL);
---`images` is a JSON-encoded array string. A `publishAt` holds the post back: it goes in
---scheduled and stays out of the feed until the due sweep flips it.
---@param citizenid string owner citizenid (resolved server-side, never from the payload)
---@param title string post title (pre-capped)
---@param body string post body (pre-capped)
---@param price nil always nil for Pages (schema parity with marketplace_listings)
---@param image string|nil first photo URL (legacy column + card thumbnail)
---@param images string|nil JSON array of photo URLs
---@param number string contact number digits (may be '')
---@param email string|nil contact email
---@param ts integer unix seconds created_at (server-set)
---@param publishAt integer|nil unix seconds the post should go live, nil to publish straight away
---@return integer insertId new row id
function store.insert(citizenid, title, body, price, image, images, number, email, ts, publishAt)
    return MySQL.insert.await(
        'INSERT INTO `pages_posts` (citizenid, title, body, price, image, images, number, email, publish_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        { citizenid, title, body, price, image, images, number, email,
          publishAt, publishAt and 'scheduled' or 'published', ts })
end

---Updates an existing post's editable fields in place; owner and created_at never change.
---@param id integer post row id
---@param title string post title (pre-capped)
---@param body string post body (pre-capped)
---@param price nil always nil for Pages
---@param image string|nil first photo URL
---@param images string|nil JSON array of photo URLs
---@param number string contact number digits (may be '')
---@param email string|nil contact email
function store.update(id, title, body, price, image, images, number, email)
    MySQL.update.await(
        'UPDATE `pages_posts` SET title = ?, body = ?, price = ?, image = ?, images = ?, number = ?, email = ? WHERE id = ?',
        { title, body, price, image, images, number, email, id })
end

---A single post row by id, or nil. Read-only.
---@param id integer post row id
---@return table|nil row
function store.byId(id)
    return MySQL.single.await('SELECT * FROM `pages_posts` WHERE id = ?', { id })
end

---The most-recent `limit` live posts across everyone, newest-first (id order = insert order).
---Scheduled rows never appear here. Read-only.
---@param limit integer max rows (config PG.ListLimit, never client input)
---@return table[] rows
function store.recent(limit)
    return MySQL.query.await(
        "SELECT * FROM `pages_posts` WHERE status = 'published' ORDER BY id DESC LIMIT ?", { limit }) or {}
end

---One character's own queued posts, soonest first. Nobody else ever sees these. Read-only.
---@param citizenid string owner citizenid
---@param limit integer max rows
---@return table[] rows
function store.scheduledFor(citizenid, limit)
    return MySQL.query.await([[
        SELECT * FROM `pages_posts`
        WHERE citizenid = ? AND status = 'scheduled'
        ORDER BY publish_at ASC LIMIT ?
    ]], { citizenid, limit }) or {}
end

---Queued posts whose publish time has passed, oldest first. Read-only; the sweep in init.lua
---flips each one through actions.
---@param now integer unix seconds to compare publish_at against
---@param limit integer max rows to flip in one sweep
---@return table[] rows
function store.dueScheduled(now, limit)
    return MySQL.query.await([[
        SELECT * FROM `pages_posts`
        WHERE status = 'scheduled' AND publish_at <= ?
        ORDER BY publish_at ASC LIMIT ?
    ]], { now, limit }) or {}
end

---Moves a queued post to a new publish time. A live post is left alone, so a stale client can
---never pull one back off the feed.
---@param id integer post row id
---@param publishAt integer unix seconds the post should go live
---@return integer changed rows updated (0 when the post is not scheduled)
function store.reschedule(id, publishAt)
    return tonumber(MySQL.update.await(
        "UPDATE `pages_posts` SET publish_at = ? WHERE id = ? AND status = 'scheduled'",
        { publishAt, id })) or 0
end

---Flips a queued post live, restamping created_at so it sorts as fresh. The status clause is what
---makes this safe to race: two callers reaching the same row leave exactly one with a non-zero
---result, so the publish side effects run once.
---@param id integer post row id
---@param ts integer unix seconds to stamp as the publish moment
---@return integer changed rows updated (0 when the post was not scheduled any more)
function store.markPublished(id, ts)
    return tonumber(MySQL.update.await([[
        UPDATE `pages_posts` SET status = 'published', publish_at = NULL, created_at = ?
        WHERE id = ? AND status = 'scheduled'
    ]], { ts, id })) or 0
end

---The status of a post, or nil if it doesn't exist. Read-only.
---@param id integer post row id
---@return string|nil status 'published' or 'scheduled'
function store.statusOf(id)
    return MySQL.scalar.await('SELECT status FROM `pages_posts` WHERE id = ?', { id })
end

---How many posts a character currently has - drives the MaxPostsPerPlayer cap. Queued posts count:
---they are the character's own and every one of them is a post-in-waiting, so leaving them out
---would let the cap be walked straight past by scheduling.
---@param citizenid string owner citizenid
---@return integer count
function store.countFor(citizenid)
    return MySQL.scalar.await('SELECT COUNT(*) FROM `pages_posts` WHERE citizenid = ?', { citizenid }) or 0
end

---Owner citizenid of a post, or nil if it doesn't exist.
---@param id integer post row id
---@return string|nil citizenid
function store.ownerOf(id)
    return MySQL.scalar.await('SELECT citizenid FROM `pages_posts` WHERE id = ?', { id })
end

---Remove a post row. Ownership is checked by the caller (actions.delete).
---@param id integer post row id
function store.delete(id)
    MySQL.query.await('DELETE FROM `pages_posts` WHERE id = ?', { id })
end

return store
