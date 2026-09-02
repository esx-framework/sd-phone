---@type table Shared server helpers (server.util): index and foreign-key bootstrap.
local util = require 'server.util'

---@type table Store module; the table returned at end of file. One row per event owned by its
---organizer, plus one attendee row per invited character. Nothing is ever copied per attendee:
---an attendee reads the organizer's row through phone_calendar_attendees.
local store = {}

---@type integer Ceiling on one read of a character's calendar. An event row is small, but the
---read is otherwise unbounded in count.
local EVENT_CAP <const> = 500

---Creates the Calendar tables if they don't exist. Runs once at boot.
function store.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `phone_calendar_events` (
            `id`             VARCHAR(40)  NOT NULL,
            `organizer`      VARCHAR(60)  NOT NULL,
            `organizer_name` VARCHAR(80)  NOT NULL,
            `day_key`        CHAR(10)     NOT NULL,
            `title`          VARCHAR(120) NOT NULL,
            `all_day`        TINYINT(1)   NOT NULL DEFAULT 0,
            `start_time`     VARCHAR(5)   NULL,
            `end_time`       VARCHAR(5)   NULL,
            `location`       VARCHAR(120) NOT NULL DEFAULT '',
            `notes`          TEXT         NULL,
            `color`          VARCHAR(9)   NOT NULL,
            `created_at`     INT          NOT NULL,
            `updated_at`     INT          NOT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_organizer_day` (`organizer`, `day_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])

    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `phone_calendar_attendees` (
            `event_id`     VARCHAR(40) NOT NULL,
            `citizenid`    VARCHAR(60) NOT NULL,
            `number`       VARCHAR(24) NOT NULL,
            `name`         VARCHAR(80) NOT NULL,
            `status`       VARCHAR(10) NOT NULL DEFAULT 'pending',
            `invited_at`   INT         NOT NULL,
            `responded_at` INT         NULL,
            UNIQUE KEY `uniq_event_attendee` (`event_id`, `citizenid`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])

    util.ensureIndex('phone_calendar_attendees', 'idx_attendee_status', '(`citizenid`, `status`)')

    -- Deleting an event takes its guest list with it. Added on boot so existing installs migrate
    -- with no manual SQL; a no-op once present, and skipped rather than fatal on a mismatch.
    util.ensureForeignKey('phone_calendar_attendees', 'event_id', 'phone_calendar_events', 'id', 'fk_calendar_attendee_event')
end

---@type string Shared event projection, column for column with what actions.serialize reads.
local EVENT_SELECT = [[
    SELECT id, organizer, organizer_name, day_key, title, all_day, start_time, end_time,
           location, notes, color, created_at, updated_at
    FROM `phone_calendar_events`
]]

---Every event a character should see: the ones they organise, plus the ones they were invited to
---and have not declined. Read-only.
---@param cid string viewer citizenid
---@return table[] rows event rows, empty when none
function store.visibleTo(cid)
    return MySQL.query.await(EVENT_SELECT .. ([[
        WHERE organizer = ?
           OR id IN (
                SELECT event_id FROM `phone_calendar_attendees`
                WHERE citizenid = ? AND status IN ('pending', 'accepted')
              )
        ORDER BY day_key ASC
        LIMIT %d
    ]]):format(EVENT_CAP), { cid, cid }) or {}
end

---One event by id, whoever organises it. Read-only.
---@param id string event id
---@return table|nil row event row
function store.getEvent(id)
    return MySQL.single.await(EVENT_SELECT .. ' WHERE id = ? LIMIT 1', { id })
end

---How many events a character organises, which drives the per-character cap. Read-only.
---@param cid string organizer citizenid
---@return integer count
function store.countFor(cid)
    return MySQL.scalar.await('SELECT COUNT(*) FROM `phone_calendar_events` WHERE organizer = ?', { cid }) or 0
end

---Inserts a new event owned by `cid`, or updates one `cid` already owns. Every updated column is
---guarded on the stored organizer matching the caller, so an id copied out of someone else's
---calendar writes nothing rather than hijacking their event; created_at and organizer never move.
---@param cid string organizer citizenid
---@param name string organizer display-name snapshot
---@param ev table vetted fields { id, dayKey, title, allDay, startTime, endTime, location, notes, color }
---@param now integer unix seconds
function store.upsert(cid, name, ev, now)
    MySQL.query.await([[
        INSERT INTO `phone_calendar_events`
            (id, organizer, organizer_name, day_key, title, all_day, start_time, end_time,
             location, notes, color, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            organizer_name = IF(organizer = VALUES(organizer), VALUES(organizer_name), organizer_name),
            day_key        = IF(organizer = VALUES(organizer), VALUES(day_key), day_key),
            title          = IF(organizer = VALUES(organizer), VALUES(title), title),
            all_day        = IF(organizer = VALUES(organizer), VALUES(all_day), all_day),
            start_time     = IF(organizer = VALUES(organizer), VALUES(start_time), start_time),
            end_time       = IF(organizer = VALUES(organizer), VALUES(end_time), end_time),
            location       = IF(organizer = VALUES(organizer), VALUES(location), location),
            notes          = IF(organizer = VALUES(organizer), VALUES(notes), notes),
            color          = IF(organizer = VALUES(organizer), VALUES(color), color),
            updated_at     = IF(organizer = VALUES(organizer), VALUES(updated_at), updated_at)
    ]], {
        ev.id, cid, name, ev.dayKey, ev.title, ev.allDay and 1 or 0, ev.startTime, ev.endTime,
        ev.location, ev.notes, ev.color, now, now,
    })
end

---Deletes an event and its guest list, scoped to its organizer. Idempotent.
---@param cid string organizer citizenid
---@param id string event id
function store.delete(cid, id)
    MySQL.query.await('DELETE FROM `phone_calendar_attendees` WHERE event_id = ?', { id })
    MySQL.query.await('DELETE FROM `phone_calendar_events` WHERE id = ? AND organizer = ?', { id, cid })
end

---The guest list for one event, in invite order. Read-only.
---@param id string event id
---@return table[] rows { event_id, citizenid, number, name, status, invited_at, responded_at }
function store.attendeesFor(id)
    return MySQL.query.await([[
        SELECT event_id, citizenid, number, name, status, invited_at, responded_at
        FROM `phone_calendar_attendees` WHERE event_id = ? ORDER BY invited_at ASC, citizenid ASC
    ]], { id }) or {}
end

---The guest lists for a batch of events, keyed by event id. One query instead of one per event.
---Read-only.
---@param ids string[] event ids
---@return table<string, table[]> byEvent event id -> attendee rows
function store.attendeesForMany(ids)
    local byEvent = {}
    if #ids == 0 then return byEvent end

    local marks = {}
    for i = 1, #ids do marks[i] = '?' end
    local rows = MySQL.query.await([[
        SELECT event_id, citizenid, number, name, status, invited_at, responded_at
        FROM `phone_calendar_attendees` WHERE event_id IN (]] .. table.concat(marks, ',') .. [[)
        ORDER BY invited_at ASC, citizenid ASC
    ]], ids) or {}

    for _, row in ipairs(rows) do
        local list = byEvent[row.event_id]
        if not list then list = {} byEvent[row.event_id] = list end
        list[#list + 1] = row
    end
    return byEvent
end

---One attendee row. Read-only.
---@param id string event id
---@param cid string attendee citizenid
---@return table|nil row attendee row
function store.getAttendee(id, cid)
    return MySQL.single.await([[
        SELECT event_id, citizenid, number, name, status, invited_at, responded_at
        FROM `phone_calendar_attendees` WHERE event_id = ? AND citizenid = ? LIMIT 1
    ]], { id, cid })
end

---How many people sit on an event's guest list, which drives the attendee cap. Read-only.
---@param id string event id
---@return integer count
function store.countAttendees(id)
    return MySQL.scalar.await('SELECT COUNT(*) FROM `phone_calendar_attendees` WHERE event_id = ?', { id }) or 0
end

---Adds one pending attendee. INSERT IGNORE plus uniq_event_attendee make a replayed invite a
---no-op rather than a duplicate row.
---@param id string event id
---@param cid string invitee citizenid
---@param number string the phone number as the organizer entered it
---@param name string invitee display-name snapshot
---@param now integer unix seconds
function store.addAttendee(id, cid, number, name, now)
    MySQL.query.await([[
        INSERT IGNORE INTO `phone_calendar_attendees`
            (event_id, citizenid, number, name, status, invited_at, responded_at)
        VALUES (?, ?, ?, ?, 'pending', ?, NULL)
    ]], { id, cid, number, name, now })
end

---Records an attendee's answer.
---@param id string event id
---@param cid string attendee citizenid
---@param status string 'accepted' or 'declined'
---@param now integer unix seconds
function store.setStatus(id, cid, status, now)
    MySQL.update.await(
        'UPDATE `phone_calendar_attendees` SET status = ?, responded_at = ? WHERE event_id = ? AND citizenid = ?',
        { status, now, id, cid }
    )
end

---Removes one person from an event's guest list. Idempotent.
---@param id string event id
---@param cid string attendee citizenid
function store.removeAttendee(id, cid)
    MySQL.update.await('DELETE FROM `phone_calendar_attendees` WHERE event_id = ? AND citizenid = ?', { id, cid })
end

return store
