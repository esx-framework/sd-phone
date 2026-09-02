---@type table Shared server helpers (server.util): index bootstrap for the sightings table.
local util = require 'server.util'

---@type table Store module; the table returned at end of file.
local store = {}

---@type table<string, boolean> device key -> Lost Mode flag. Warmed lazily and written through,
---so the outgoing call and text paths read it the way they read airplane mode: from memory, with
---no query on the hot path.
local lostCache = {}

---Create the device-sightings table if it doesn't exist. Run once at boot.
function store.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS phone_devices_seen (
            device_key   VARCHAR(96)  NOT NULL,
            citizenid    VARCHAR(64)  NOT NULL,
            kind         VARCHAR(16)  NOT NULL DEFAULT 'phone',
            x            DOUBLE       NOT NULL DEFAULT 0,
            y            DOUBLE       NOT NULL DEFAULT 0,
            z            DOUBLE       NOT NULL DEFAULT 0,
            seen_at      INT          NOT NULL DEFAULT 0,
            lost         TINYINT(1)   NOT NULL DEFAULT 0,
            lost_message VARCHAR(120) NULL,
            lost_contact VARCHAR(24)  NULL,
            lost_at      INT          NULL,
            PRIMARY KEY (device_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])

    -- Every read is "the devices this character owns", so the owner column carries the lookup.
    util.ensureIndex('phone_devices_seen', 'idx_devices_seen_cid', '(citizenid)')
end

---Record where a device was last seen. The row is created on first sighting and refreshed after
---that; `claimOwner` decides whether the holder also becomes the recorded owner, so a thief
---carrying a stolen phone moves its position without taking it off the owner's Find My list.
---@param key string device key
---@param cid string citizenid of the holder (the owner on first sighting)
---@param kind string 'phone' | 'tablet'
---@param x number world x
---@param y number world y
---@param z number world z
---@param at integer unix seconds
---@param claimOwner boolean whether the holder owns this device
function store.recordSighting(key, cid, kind, x, y, z, at, claimOwner)
    MySQL.query.await([[
        INSERT INTO phone_devices_seen (device_key, citizenid, kind, x, y, z, seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            x         = VALUES(x),
            y         = VALUES(y),
            z         = VALUES(z),
            seen_at   = VALUES(seen_at),
            kind      = VALUES(kind),
            citizenid = IF(?, VALUES(citizenid), citizenid)
    ]], { key, cid, kind, x, y, z, at, claimOwner and 1 or 0 })
end

---Every device a character owns, most recently seen first. Read-only.
---@param cid string citizenid
---@return table[] rows sighting rows
function store.devicesFor(cid)
    return MySQL.query.await([[
        SELECT device_key, citizenid, kind, x, y, z, seen_at, lost, lost_message, lost_contact, lost_at
        FROM phone_devices_seen
        WHERE citizenid = ?
        ORDER BY seen_at DESC
    ]], { cid }) or {}
end

---One device row by its key. Read-only.
---@param key string device key
---@return table|nil row sighting row
function store.get(key)
    return MySQL.single.await([[
        SELECT device_key, citizenid, kind, x, y, z, seen_at, lost, lost_message, lost_contact, lost_at
        FROM phone_devices_seen WHERE device_key = ?
    ]], { key })
end

---Whether a device is in Lost Mode, answered from the cache after the first read. Read-only.
---@param key string device key
---@return boolean lost
function store.isLost(key)
    local cached = lostCache[key]
    if cached ~= nil then return cached end
    local row = MySQL.single.await('SELECT lost FROM phone_devices_seen WHERE device_key = ?', { key })
    local on = row ~= nil and util.truthy(row.lost)
    lostCache[key] = on
    return on
end

---Turn Lost Mode on for a device, stamping the banner text and callback number.
---@param key string device key
---@param message string|nil banner message (VARCHAR(120))
---@param contact string|nil callback number (VARCHAR(24))
---@param at integer unix seconds
function store.setLost(key, message, contact, at)
    lostCache[key] = true
    MySQL.update.await([[
        UPDATE phone_devices_seen
        SET lost = 1, lost_message = ?, lost_contact = ?, lost_at = ?
        WHERE device_key = ?
    ]], { message, contact, at, key })
end

---Turn Lost Mode off for a device and clear the banner it carried.
---@param key string device key
function store.clearLost(key)
    lostCache[key] = false
    MySQL.update.await([[
        UPDATE phone_devices_seen
        SET lost = 0, lost_message = NULL, lost_contact = NULL, lost_at = NULL
        WHERE device_key = ?
    ]], { key })
end

---Drop a device's sightings entirely; the next time it is opened it re-appears as a fresh row.
---@param key string device key
function store.forget(key)
    lostCache[key] = nil
    MySQL.update.await('DELETE FROM phone_devices_seen WHERE device_key = ?', { key })
end

return store
