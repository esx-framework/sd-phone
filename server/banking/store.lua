---@type table Shared server helpers (server.util): schema back-fill helpers.
local util = require 'server.util'

---@type table Store module; the table returned at end of file.
local store = {}

---Creates the phone_bank_transactions table if it doesn't exist: one row per side of a
---transfer, each keyed to its own citizenid.
function store.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `phone_bank_transactions` (
            `id`           INT AUTO_INCREMENT PRIMARY KEY,
            `citizenid`    VARCHAR(64)  NOT NULL,
            `label`        VARCHAR(120) NOT NULL,
            `amount`       BIGINT       NOT NULL,
            `category`     VARCHAR(32)  NOT NULL DEFAULT 'transfer',
            `counterparty` VARCHAR(64)  NULL,
            `created_at`   BIGINT       NOT NULL,
            KEY `citizenid` (`citizenid`),
            KEY `created_at` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]])

    -- The primary key is an auto-increment, so INSERT IGNORE has nothing to collide with and a
    -- repeated lb-phone import would duplicate every row. `src_id` carries the source row's
    -- identity and is unique; rows created in-game leave it NULL, and a unique index permits
    -- any number of NULLs.
    util.ensureColumns('phone_bank_transactions', { src_id = 'src_id VARCHAR(32) NULL' })
    util.ensureUniqueIndex('phone_bank_transactions', 'uq_bank_tx_src', '(src_id)')

    -- Standing orders. INTERVAL is a MySQL reserved word, so the column is `run_interval` and
    -- the reads alias it back to the app-facing `interval` name.
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `phone_bank_standing_orders` (
            `id`             INT AUTO_INCREMENT PRIMARY KEY,
            `citizenid`      VARCHAR(64) NOT NULL,
            `recipient`      VARCHAR(64) NOT NULL,
            `recipient_name` VARCHAR(80) NULL,
            `label`          VARCHAR(40) NOT NULL,
            `amount`         BIGINT      NOT NULL,
            `run_interval`   VARCHAR(16) NOT NULL DEFAULT 'monthly',
            `next_run`       BIGINT      NOT NULL,
            `active`         TINYINT(1)  NOT NULL DEFAULT 1,
            `created_at`     BIGINT      NOT NULL,
            `last_run`       BIGINT      NULL,
            `last_status`    VARCHAR(16) NULL,
            KEY `citizenid` (`citizenid`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])

    util.ensureIndex('phone_bank_standing_orders', 'idx_standing_due', '(active, next_run)')
end

---Appends one transaction row. `amount` is a signed whole-currency value: negative = outflow,
---positive = inflow.
---@param citizenid string owning character's citizenid
---@param label string display label (VARCHAR(120))
---@param amount integer signed whole-currency amount
---@param category string|nil category slug, defaults to 'transfer' (VARCHAR(32))
---@param counterparty string|nil other party's bare-digit phone number, if any (VARCHAR(64))
---@param ts integer unix-seconds timestamp
---@return integer insertId
function store.insert(citizenid, label, amount, category, counterparty, ts)
    return MySQL.insert.await(
        'INSERT INTO `phone_bank_transactions` (citizenid, label, amount, category, counterparty, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        { citizenid, label, amount, category or 'transfer', counterparty, ts })
end

---Trims a character's log to the newest `keep` rows. Nothing reads past that (the app takes
---Banking.TransactionLimit, the export caps at 100), so the tail only slows the list query and
---grows with every logged movement. The derived table is what lets MySQL delete from the table it
---is selecting from; a character under `keep` rows matches nothing and is left alone.
---@param citizenid string owning character's citizenid
---@param keep integer rows to retain
function store.prune(citizenid, keep)
    if not citizenid or citizenid == '' then return end
    MySQL.query.await([[
        DELETE FROM `phone_bank_transactions`
        WHERE citizenid = ? AND id <= (
            SELECT cutoff FROM (
                SELECT id AS cutoff FROM `phone_bank_transactions`
                WHERE citizenid = ? ORDER BY id DESC LIMIT 1 OFFSET ?
            ) AS t
        )
    ]], { citizenid, citizenid, math.floor(tonumber(keep) or 0) })
end

---Returns the most-recent `limit` transactions for a character, newest-first by insert id.
---Read-only.
---@param citizenid string owning character's citizenid
---@param limit integer row cap (Banking.TransactionLimit at the call site)
---@return table[] rows raw DB rows, {} when none
function store.recent(citizenid, limit)
    return MySQL.query.await(
        'SELECT * FROM `phone_bank_transactions` WHERE citizenid = ? ORDER BY id DESC LIMIT ?',
        { citizenid, limit }) or {}
end

---@type string Shared standing-order projection; `run_interval` is aliased back to the
---app-facing `interval` name. Every caller appends its own WHERE and ORDER BY.
local ORDER_SELECT = [[
    SELECT id, citizenid, recipient, recipient_name, label, amount,
           run_interval AS `interval`, next_run, active, created_at, last_run, last_status
    FROM `phone_bank_standing_orders`
]]

---Every standing order a character owns, live ones first and then soonest-due. Read-only.
---@param citizenid string owning character's citizenid
---@return table[] rows raw DB rows, {} when none
function store.listOrders(citizenid)
    return MySQL.query.await(ORDER_SELECT .. ' WHERE citizenid = ? ORDER BY active DESC, next_run ASC', { citizenid }) or {}
end

---One standing order by id, scoped to its owner so another character's id can never be read.
---Read-only.
---@param citizenid string owning character's citizenid
---@param id integer order id
---@return table|nil row
function store.getOrder(citizenid, id)
    return MySQL.single.await(ORDER_SELECT .. ' WHERE id = ? AND citizenid = ? LIMIT 1', { id, citizenid })
end

---How many standing orders a character currently has switched on. Read-only.
---@param citizenid string owning character's citizenid
---@return integer count
function store.countActiveOrders(citizenid)
    return tonumber(MySQL.scalar.await(
        'SELECT COUNT(*) FROM `phone_bank_standing_orders` WHERE citizenid = ? AND active = 1', { citizenid })) or 0
end

---Creates a standing order, switched on.
---@param citizenid string payer's citizenid
---@param recipient string recipient's bare-digit phone number (VARCHAR(64))
---@param recipientName string|nil display-name snapshot taken at creation (VARCHAR(80))
---@param label string what the payer called it (VARCHAR(40))
---@param amount integer whole-currency amount per run
---@param interval string 'daily' | 'weekly' | 'monthly'
---@param nextRun integer unix seconds of the first run
---@param createdAt integer unix seconds
---@return integer insertId
function store.insertOrder(citizenid, recipient, recipientName, label, amount, interval, nextRun, createdAt)
    return MySQL.insert.await([[
        INSERT INTO `phone_bank_standing_orders`
            (citizenid, recipient, recipient_name, label, amount, run_interval, next_run, active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    ]], { citizenid, recipient, recipientName, label, amount, interval, nextRun, createdAt })
end

---Updates the payer-editable fields of one order, scoped to its owner.
---@param citizenid string owning character's citizenid
---@param id integer order id
---@param label string new label (VARCHAR(40))
---@param amount integer new whole-currency amount
---@param interval string new interval slug
---@param active boolean whether the order runs
---@param nextRun integer unix seconds of the next run
---@return integer affected rows changed, 0 when the id is not this character's
function store.updateOrder(citizenid, id, label, amount, interval, active, nextRun)
    return MySQL.update.await([[
        UPDATE `phone_bank_standing_orders`
        SET label = ?, amount = ?, run_interval = ?, active = ?, next_run = ?
        WHERE id = ? AND citizenid = ?
    ]], { label, amount, interval, active and 1 or 0, nextRun, id, citizenid }) or 0
end

---Deletes one order, scoped to its owner.
---@param citizenid string owning character's citizenid
---@param id integer order id
---@return integer affected rows removed, 0 when the id is not this character's
function store.deleteOrder(citizenid, id)
    return MySQL.update.await(
        'DELETE FROM `phone_bank_standing_orders` WHERE id = ? AND citizenid = ?', { id, citizenid }) or 0
end

---Active orders that are due, restricted to the payers passed in. The money path needs the payer
---online, so scoping the query that way is also what stops a pile of offline orders crowding the
---batch and starving everyone who is actually connected. Read-only.
---@param citizenids string[] payer citizenids to consider, never empty at the call site
---@param now integer unix seconds
---@param limit integer batch cap
---@return table[] rows soonest-due first, {} when none
function store.dueOrders(citizenids, now, limit)
    local marks, params = {}, {}
    for i = 1, #citizenids do
        marks[i]  = '?'
        params[i] = citizenids[i]
    end
    params[#params + 1] = now
    return MySQL.query.await(
        ORDER_SELECT .. ' WHERE active = 1 AND citizenid IN (' .. table.concat(marks, ',') ..
        ') AND next_run <= ? ORDER BY next_run ASC LIMIT ' .. math.floor(tonumber(limit) or 50),
        params) or {}
end

---Moves an order's next run without touching its status. The runner claims a due order this way
---before attempting it, so a crash mid-transfer cannot replay the charge a minute later, and two
---overlapping passes cannot both take the same row.
---@param id integer order id
---@param nextRun integer unix seconds of the next run
---@param expected integer the next_run the caller read
---@return boolean claimed true when this call is the one that took the order
function store.claimOrder(id, nextRun, expected)
    return (MySQL.update.await(
        'UPDATE `phone_bank_standing_orders` SET next_run = ? WHERE id = ? AND next_run = ? AND active = 1',
        { nextRun, id, expected }) or 0) > 0
end

---Records the outcome of one attempted run.
---@param id integer order id
---@param status string 'ok' | 'insufficient' | 'failed'
---@param ranAt integer unix seconds of the attempt
---@param nextRun integer unix seconds of the next run
function store.finishOrder(id, status, ranAt, nextRun)
    MySQL.update.await(
        'UPDATE `phone_bank_standing_orders` SET last_status = ?, last_run = ?, next_run = ? WHERE id = ?',
        { status, ranAt, nextRun, id })
end

return store
