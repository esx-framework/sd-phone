---@type table Shared server helpers (server.util): schema creation and index back-fill.
local util = require 'server.util'

---@type table Store module; the table returned at end of file.
local store = {}

---Creates the voicemails table. One row per message left on a mailbox, holding only the
---CDN-hosted audio URL plus enough context to say who left it. Runs once at boot.
function store.ensureSchema()
    util.ensureTable('phone_voicemails', 'owner_cid', [[
        CREATE TABLE IF NOT EXISTS `phone_voicemails` (
            `id`          INT AUTO_INCREMENT PRIMARY KEY,
            `owner_cid`   VARCHAR(64)  NOT NULL,
            `from_number` VARCHAR(32)  NOT NULL DEFAULT '',
            `from_name`   VARCHAR(80)  NULL,
            `url`         VARCHAR(512) NOT NULL,
            `duration`    INT          NOT NULL DEFAULT 0,
            `listened`    TINYINT(1)   NOT NULL DEFAULT 0,
            `created_at`  BIGINT       NOT NULL,
            KEY `owner_cid` (`owner_cid`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]])

    -- The two reads on the hot path are "newest first for this mailbox" and "how many are
    -- unlistened", and both are per-owner: a covering index keeps either off a table scan.
    util.ensureIndex('phone_voicemails', 'owner_created', '(owner_cid, created_at)')
    util.ensureIndex('phone_voicemails', 'owner_listened', '(owner_cid, listened)')
end

---Inserts one voicemail row; every field was sanitized by the actions layer.
---@param ownerCid string mailbox owner's framework per-character id
---@param vm { fromNumber: string, fromName: string|nil, url: string, duration: integer, ts: integer }
---@return integer|nil insertId
function store.insert(ownerCid, vm)
    return MySQL.insert.await([[
        INSERT INTO `phone_voicemails`
            (owner_cid, from_number, from_name, url, duration, listened, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
    ]], { ownerCid, vm.fromNumber, vm.fromName, vm.url, vm.duration, vm.ts })
end

---A mailbox's voicemails, newest first. Read-only.
---@param ownerCid string mailbox owner's framework per-character id
---@param limit integer maximum rows to return
---@return table[] rows raw voicemail rows (empty when none)
function store.listFor(ownerCid, limit)
    return MySQL.query.await(
        'SELECT * FROM `phone_voicemails` WHERE owner_cid = ? ORDER BY created_at DESC, id DESC LIMIT ?',
        { ownerCid, limit }) or {}
end

---One voicemail row by id, scoped to its owner. Read-only.
---@param ownerCid string mailbox owner's framework per-character id
---@param id integer voicemail id
---@return table|nil row
function store.getFor(ownerCid, id)
    return MySQL.single.await(
        'SELECT * FROM `phone_voicemails` WHERE id = ? AND owner_cid = ?', { id, ownerCid })
end

---How many voicemails a mailbox holds. Read-only.
---@param ownerCid string mailbox owner's framework per-character id
---@return integer count
function store.countFor(ownerCid)
    return tonumber(MySQL.scalar.await(
        'SELECT COUNT(*) FROM `phone_voicemails` WHERE owner_cid = ?', { ownerCid })) or 0
end

---How many of a mailbox's voicemails have never been listened to. Read-only; this is the number
---the Phone badge adds to its missed calls.
---@param ownerCid string mailbox owner's framework per-character id
---@return integer count
function store.unlistenedCount(ownerCid)
    return tonumber(MySQL.scalar.await(
        'SELECT COUNT(*) FROM `phone_voicemails` WHERE owner_cid = ? AND listened = 0', { ownerCid })) or 0
end

---Marks every unlistened voicemail in a mailbox as heard.
---@param ownerCid string mailbox owner's framework per-character id
---@return integer changed rows updated
function store.markListened(ownerCid)
    return tonumber(MySQL.update.await(
        'UPDATE `phone_voicemails` SET listened = 1 WHERE owner_cid = ? AND listened = 0', { ownerCid })) or 0
end

---Deletes one voicemail, scoped to its owner so an id alone cannot reach another mailbox.
---@param ownerCid string mailbox owner's framework per-character id
---@param id integer voicemail id
---@return integer removed
function store.delete(ownerCid, id)
    return tonumber(MySQL.update.await(
        'DELETE FROM `phone_voicemails` WHERE id = ? AND owner_cid = ?', { id, ownerCid })) or 0
end

---Drops the oldest rows a mailbox holds beyond `keep`, so a full mailbox makes room for a new
---message rather than refusing it.
---@param ownerCid string mailbox owner's framework per-character id
---@param keep integer rows to leave behind
---@return integer removed
function store.trim(ownerCid, keep)
    return tonumber(MySQL.update.await([[
        DELETE FROM `phone_voicemails`
        WHERE owner_cid = ?
          AND id NOT IN (
              SELECT id FROM (
                  SELECT id FROM `phone_voicemails`
                  WHERE owner_cid = ? ORDER BY created_at DESC, id DESC LIMIT ?
              ) AS keepers
          )
    ]], { ownerCid, ownerCid, keep })) or 0
end

return store
