---@type table Store module; the table returned at end of file.
local store = {}

---Create the Medical ID table if it doesn't exist. Run once at boot. Blood type is deliberately
---absent: it belongs to the framework's own character record and is read live, so a card can never
---disagree with the record an EMS terminal reads.
function store.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS phone_medical_id (
            citizenid      VARCHAR(64)  NOT NULL,
            allergies      VARCHAR(200) NULL,
            conditions     VARCHAR(200) NULL,
            medications    VARCHAR(200) NULL,
            notes          VARCHAR(300) NULL,
            organ_donor    TINYINT(1)   NOT NULL DEFAULT 0,
            contact_name   VARCHAR(60)  NULL,
            contact_number VARCHAR(20)  NULL,
            show_on_lock   TINYINT(1)   NOT NULL DEFAULT 1,
            updated_at     INT          NULL,
            PRIMARY KEY (citizenid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
end

---A character's stored Medical ID row, or nil when they have never filled one in. Read-only.
---@param cid string citizenid
---@return table|nil row
function store.get(cid)
    return MySQL.single.await([[
        SELECT citizenid, allergies, conditions, medications, notes, organ_donor,
               contact_name, contact_number, show_on_lock, updated_at
        FROM phone_medical_id WHERE citizenid = ?
    ]], { cid })
end

---Writes a character's whole Medical ID row. The caller merges the patch onto the current row
---first, so one statement covers both the first save and every edit after it.
---@param cid string citizenid
---@param row table already-validated column values
---@param updatedAt integer unix seconds
function store.upsert(cid, row, updatedAt)
    MySQL.query.await([[
        INSERT INTO phone_medical_id
            (citizenid, allergies, conditions, medications, notes, organ_donor,
             contact_name, contact_number, show_on_lock, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            allergies      = VALUES(allergies),
            conditions     = VALUES(conditions),
            medications    = VALUES(medications),
            notes          = VALUES(notes),
            organ_donor    = VALUES(organ_donor),
            contact_name   = VALUES(contact_name),
            contact_number = VALUES(contact_number),
            show_on_lock   = VALUES(show_on_lock),
            updated_at     = VALUES(updated_at)
    ]], {
        cid, row.allergies, row.conditions, row.medications, row.notes,
        row.organDonor and 1 or 0, row.contactName, row.contactNumber,
        row.showOnLock and 1 or 0, updatedAt,
    })
end

return store
