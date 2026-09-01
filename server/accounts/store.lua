---@type table Store module; the table returned at end of file.
local store = {}

---@type table Shared server helpers (server.util): collation conversion.
local util = require 'server.util'
---@type table Crypto helper (server.crypto): scrypt hashing and vault encryption over Node.
local crypto = require 'server.crypto'

-- The pepper the pre-scrypt digest was built with. Shipped in the source of every sd-phone, so it
-- protects nothing; it survives only so hashes written before scrypt can still be verified once.
---@type string Legacy engine password pepper.
local LEGACY_PEPPER = 'sd-phone-v1::accounts::do-not-leak-this-string'

---@type string Prefix marking a hash produced by the scrypt path.
local SCRYPT_TAG = 'scrypt$'

---The pre-scrypt digest. Verification only; nothing new is ever written in this format.
---@param password string plaintext password
---@return string hash 24-char hex digest
local function legacyHash(password)
    local input = password .. LEGACY_PEPPER
    local h1, h2, h3 = 0x12345678, 0x87654321, 0xABCDEF01
    for i = 1, #input do
        local b = input:byte(i)
        h1 = (h1 * 31 + b) & 0xFFFFFFFF
        h2 = ((h2 ~ ((b << (i % 8)) & 0xFFFFFFFF)) + 0x9E3779B9) & 0xFFFFFFFF
        h3 = (((h3 << 5) | (h3 >> 27)) + b * (h1 + 1)) & 0xFFFFFFFF
    end
    return ('%08x%08x%08x'):format(h1, h2, h3)
end

---Hashes a password for storage: salted scrypt, or the legacy digest when the helper is absent.
---The result is NOT stable across calls, so it can only be written, never compared.
---@param password string plaintext password
---@return string hash
function store.hashPassword(password)
    return crypto.hashPassword(password) or legacyHash(password)
end

---Checks a plaintext password against whichever format the row holds.
---@param plain string plaintext password
---@param stored any stored hash
---@return boolean verified
function store.verifyPassword(plain, stored)
    if type(stored) ~= 'string' or stored == '' then return false end
    if stored:sub(1, #SCRYPT_TAG) == SCRYPT_TAG then
        return crypto.verifyPassword(plain, stored)
    end
    -- An account carried over from lb-phone still holds its bcrypt hash. Accepting it is what lets
    -- its owner in with the password they already use, rather than being locked out of a mailbox
    -- lb never recorded an owner for. needsRehash reports true for this shape, so the first
    -- successful sign-in rewrites the account to scrypt and it never takes this path again.
    if stored:sub(1, 4) == '$2a$' or stored:sub(1, 4) == '$2b$' or stored:sub(1, 4) == '$2y$' then
        return crypto.verifyBcrypt(plain, stored)
    end
    return legacyHash(plain) == stored
end

---True when a verified password is held in an older format and should be written back as scrypt.
---@param stored any stored hash
---@return boolean stale
function store.needsRehash(stored)
    if not crypto.available() then return false end
    return type(stored) ~= 'string' or stored:sub(1, #SCRYPT_TAG) ~= SCRYPT_TAG
end

---Creates the engine tables idempotently: phone_app_accounts, phone_app_sessions, and the
---phone_passwords vault.
function store.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS phone_app_accounts (
            id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
            app           VARCHAR(24)  NOT NULL,
            username      VARCHAR(64)  NOT NULL,
            display_name  VARCHAR(50)  NOT NULL DEFAULT '',
            password_hash VARCHAR(255) NOT NULL,
            email         VARCHAR(120) NULL,
            phone         VARCHAR(20)  NULL,
            created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_app_username (app, username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ]])
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS phone_app_sessions (
            app        VARCHAR(24) NOT NULL,
            citizenid  VARCHAR(64) NOT NULL,
            account_id INT UNSIGNED NOT NULL,
            PRIMARY KEY (app, citizenid, account_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ]])
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS phone_passwords (
            id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
            citizenid  VARCHAR(64)  NOT NULL,
            app        VARCHAR(24)  NOT NULL,
            username   VARCHAR(64)  NOT NULL,
            password   VARCHAR(255) NOT NULL,
            email      VARCHAR(120) NULL,
            phone      VARCHAR(20)  NULL,
            created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_vault (citizenid, app, username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ]])
    -- Tables created before the explicit COLLATE above picked up the server default (newer
    -- MariaDB: utf8mb4_uca1400_ai_ci), which breaks joins against the app tables.
    util.ensureCollation('phone_app_accounts')
    util.ensureCollation('phone_app_sessions')
    util.ensureCollation('phone_passwords')

    -- Both columns held a 24-char digest / a plaintext password and were sized for it. A scrypt
    -- hash is ~86 chars and an encrypted vault secret longer still, so an install that predates
    -- them has to be widened before either can be written.
    util.ensureColumnWidth('phone_app_accounts', 'password_hash', 'password_hash VARCHAR(255) NOT NULL', 255)
    util.ensureColumnWidth('phone_passwords', 'password', 'password VARCHAR(255) NOT NULL', 255)

    -- An account is identified by its contacts alone, which cannot say who owns it: an account
    -- with only an email is unattributable, and an email need not be the holder's, so counting a
    -- quota by contact would let a stranger consume it. The creator is stamped instead.
    -- A player may hold several sessions per app at once; the most recently used one is the
    -- active account. A timestamp rather than a flag, so switching is a single-row write that
    -- cannot leave two rows both claiming to be active.
    util.ensureColumns('phone_app_sessions', {
        last_used = 'last_used TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    })
    util.ensureIndex('phone_app_sessions', 'idx_app_sessions_active', '(app, citizenid, last_used)')

    util.ensureColumns('phone_app_accounts', {
        created_by = 'created_by VARCHAR(64) NULL',
    })
    util.ensureIndex('phone_app_accounts', 'idx_app_accounts_creator', '(app, created_by)')

    -- Referential integrity, added on boot so existing installs migrate with no manual SQL.
    -- Each is a no-op once present; orphaned children are cleared first (they point at a
    -- parent that is already gone) and a type or collation mismatch is skipped, never fatal.
    util.ensureForeignKey('phone_app_sessions', 'account_id', 'phone_app_accounts', 'id', 'fk_app_sessions_account')
end

---Maps a phone_app_accounts row to the camelCase account shape, passwordHash included.
---@param row table|nil raw DB row
---@return table|nil account
local function rowToAccount(row)
    if not row then return nil end
    return {
        id           = row.id,
        app          = row.app,
        username     = row.username,
        displayName  = row.display_name,
        passwordHash = row.password_hash,
        email        = row.email,
        phone        = row.phone,
    }
end

---One account by app + username. Read-only.
---@param app string account app key
---@param username string account username (already trimmed/lowered by the caller)
---@return table|nil account
function store.getAccount(app, username)
    return rowToAccount(MySQL.single.await(
        'SELECT * FROM phone_app_accounts WHERE app = ? AND username = ?',
        { app, username }
    ))
end

---One account by row id. Read-only.
---@param id number account row id
---@return table|nil account
function store.getAccountById(id)
    return rowToAccount(MySQL.single.await(
        'SELECT * FROM phone_app_accounts WHERE id = ?', { id }
    ))
end

---Returns accounts in `app` whose linked email or phone matches; nil skips that side of the
---search. Read-only.
---@param app string account app key
---@param email string|nil linked email to match
---@param phone string|nil linked phone (digits) to match
---@return table[] accounts
function store.findAccountsByContact(app, email, phone)
    local rows = MySQL.query.await([[
        SELECT * FROM phone_app_accounts
        WHERE app = ? AND ((? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?))
    ]], { app, email, email, phone, phone }) or {}
    local out = {}
    for i = 1, #rows do out[i] = rowToAccount(rows[i]) end
    return out
end

---Inserts a new account row; returns nil when the insert fails.
---@param app string account app key
---@param username string account username
---@param displayName string display name
---@param passwordHash string peppered hash (never the plaintext)
---@param email string|nil linked recovery email
---@param phone string|nil linked recovery phone (digits)
---@return number|nil insertId
---@param createdBy string|nil creator citizenid, stamped so the per-app cap can count them
function store.insertAccount(app, username, displayName, passwordHash, email, phone, createdBy)
    return MySQL.insert.await([[
        INSERT INTO phone_app_accounts (app, username, display_name, password_hash, email, phone, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]], { app, username, displayName, passwordHash, email, phone, createdBy })
end

---How many accounts a character has created in one app. Rows from before the column existed
---carry no creator and are not counted, so they neither block nor consume a quota.
---@param app string account app key
---@param citizenid string framework per-character id
---@return integer count
function store.countAccountsFor(app, citizenid)
    if not citizenid or citizenid == '' then return 0 end
    local row = MySQL.single.await(
        'SELECT COUNT(*) AS n FROM phone_app_accounts WHERE app = ? AND created_by = ?',
        { app, citizenid })
    return tonumber(row and row.n) or 0
end

---Replaces an account's stored hash.
---@param id number account row id
---@param passwordHash string peppered hash
function store.setPassword(id, passwordHash)
    MySQL.update.await('UPDATE phone_app_accounts SET password_hash = ? WHERE id = ?', { passwordHash, id })
end

---Deletes an account and its sessions, sessions first.
---@param id number account row id
function store.deleteAccount(id)
    local acc = store.getAccountById(id)
    MySQL.update.await('DELETE FROM phone_app_sessions WHERE account_id = ?', { id })
    MySQL.update.await('DELETE FROM phone_app_accounts WHERE id = ?', { id })
    -- Vault rows are keyed by name, not by account id, so they outlive the account: every
    -- character who saved this login would keep being offered a dead one in the switcher.
    -- Scoped to this username on purpose, so deleting one account leaves your others alone.
    if acc then
        MySQL.update.await('DELETE FROM phone_passwords WHERE app = ? AND username = ?',
            { acc.app, acc.username })
    end
end

---Signs a citizen into an account and makes it the active one. Sessions the citizen already
---holds in the app are kept, so several accounts stay signed in at once and the switcher can
---move between them without a password.
---@param app string account app key
---@param citizenid string framework per-character id
---@param accountId number account row id
function store.setSession(app, citizenid, accountId)
    MySQL.query.await([[
        INSERT INTO phone_app_sessions (app, citizenid, account_id, last_used)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE last_used = CURRENT_TIMESTAMP
    ]], { app, citizenid, accountId })
end

---Every account the citizen is currently signed into for `app`, most recently used first, so
---the head of the list is the active account. Read-only.
---@param app string account app key
---@param citizenid string framework per-character id
---@return table[] accounts
function store.listSessionAccounts(app, citizenid)
    local rows = MySQL.query.await([[
        SELECT a.* FROM phone_app_sessions s
        JOIN phone_app_accounts a ON a.id = s.account_id
        WHERE s.app = ? AND s.citizenid = ?
        ORDER BY s.last_used DESC, a.id ASC
    ]], { app, citizenid }) or {}
    local out = {}
    for i = 1, #rows do out[i] = rowToAccount(rows[i]) end
    return out
end

-- An account row carries no picture: every app keeps its own profile table and its own idea of
-- what a picture is, so the switcher reads them from the app that owns them. Apps absent from
-- this map have no picture to offer and fall back to a placeholder.
---@type table<string, table> app key -> { table, key column, url column, gallery = first of a JSON array }
local AVATAR_SOURCES = {
    birdy     = { table = 'phone_birdy_profiles',     key = 'handle',   column = 'avatar' },
    photogram = { table = 'phone_photogram_profiles', key = 'username', column = 'avatar' },
    vibez     = { table = 'phone_vibez_profiles',     key = 'username', column = 'avatar' },
    cherry    = { table = 'phone_cherry_profiles',    key = 'username', column = 'photos', gallery = true },
}

---The first entry of a photo gallery, which oxmysql hands back either decoded or as raw JSON.
---@param value any stored gallery column
---@return string|nil url
local function firstPhoto(value)
    if type(value) == 'table' then return value[1] end
    if type(value) ~= 'string' or value == '' then return nil end
    local decoded, list = pcall(json.decode, value)
    if not decoded or type(list) ~= 'table' then return nil end
    return list[1]
end

---Profile pictures for a set of account usernames in one app, keyed by LOWERCASE username: the
---username columns collate case-insensitively, so a profile may spell its own key differently
---from the account row the caller matched it to. Read-only.
---@param app string account app key
---@param usernames string[] account usernames
---@return table<string, string> avatars username (lowercase) -> url
function store.avatarsFor(app, usernames)
    local src = AVATAR_SOURCES[app]
    if not src or not usernames or #usernames == 0 then return {} end

    local holes = ('?, '):rep(#usernames - 1) .. '?'
    -- The app's table, not the engine's: a server whose app has never booted has nothing to read,
    -- which must cost the switcher a picture and nothing more.
    local queried, rows = pcall(MySQL.query.await, ('SELECT %s AS username, %s AS avatar FROM %s WHERE %s IN (%s)')
        :format(src.key, src.column, src.table, src.key, holes), usernames)
    if not queried or type(rows) ~= 'table' then return {} end

    local out = {}
    for i = 1, #rows do
        local url = src.gallery and firstPhoto(rows[i].avatar) or rows[i].avatar
        if type(url) == 'string' and url ~= '' then
            out[tostring(rows[i].username):lower()] = url
        end
    end
    return out
end

---Ends every session a citizen holds in an app (idempotent: no rows is a no-op).
---@param app string account app key
---@param citizenid string framework per-character id
---@return integer cleared sessions removed
function store.clearSession(app, citizenid)
    return MySQL.update.await(
        'DELETE FROM phone_app_sessions WHERE app = ? AND citizenid = ?',
        { app, citizenid }
    ) or 0
end

---Ends one account's session, leaving the citizen's other sessions in the app signed in.
---@param app string account app key
---@param citizenid string framework per-character id
---@param accountId number account row id
---@return integer cleared sessions removed
function store.clearAccountSession(app, citizenid, accountId)
    return MySQL.update.await(
        'DELETE FROM phone_app_sessions WHERE app = ? AND citizenid = ? AND account_id = ?',
        { app, citizenid, accountId }
    ) or 0
end

---Signs a citizen out of every app at once (idempotent).
---@param citizenid string framework per-character id
---@return integer cleared sessions removed
function store.clearAllSessions(citizenid)
    return MySQL.update.await('DELETE FROM phone_app_sessions WHERE citizenid = ?', { citizenid }) or 0
end

---Returns every citizen currently signed into an account in `app`. Read-only.
---@param app string account app key
---@param accountId number account row id
---@return string[] citizenids
function store.sessionCitizens(app, accountId)
    local rows = MySQL.query.await(
        'SELECT citizenid FROM phone_app_sessions WHERE app = ? AND account_id = ?',
        { app, accountId }
    ) or {}
    local out = {}
    for i = 1, #rows do out[i] = rows[i].citizenid end
    return out
end

---The citizen's active account in an app: the session they most recently signed into or
---switched to. Nil when they hold no session. Read-only.
---@param app string account app key
---@param citizenid string framework per-character id
---@return table|nil account
function store.getSessionAccount(app, citizenid)
    local row = MySQL.single.await([[
        SELECT a.* FROM phone_app_sessions s
        JOIN phone_app_accounts a ON a.id = s.account_id
        WHERE s.app = ? AND s.citizenid = ?
        ORDER BY s.last_used DESC, a.id ASC
        LIMIT 1
    ]], { app, citizenid })
    return rowToAccount(row)
end

-- The Passwords app shows a player their saved logins, so the vault has to be reversible and
-- cannot be hashed. It is encrypted instead, under a key held outside the database, so a dump of
-- the tables alone does not hand over passwords players may have reused elsewhere.
---Encrypts a vault secret for storage, passing it through untouched when no key is available.
---@param plain string|nil
---@return string|nil stored
local function sealSecret(plain)
    if type(plain) ~= 'string' or plain == '' then return plain end
    return crypto.encrypt(plain) or plain
end

---Reveals a stored vault secret. Rows written before encryption are already plaintext and are
---returned as they are, which is what lets the vault migrate one entry at a time.
---@param stored any
---@return any plain
local function openSecret(stored)
    if type(stored) ~= 'string' or stored == '' then return stored end
    return crypto.decrypt(stored) or stored
end

---Upserts one vault entry for a character, keyed UNIQUE (citizenid, app, username).
---@param citizenid string framework per-character id (the vault's owner)
---@param app string account app key
---@param username string saved login username
---@param password string saved login password, encrypted at rest
---@param email string|nil saved linked email
---@param phone string|nil saved linked phone (digits)
function store.saveVaultEntry(citizenid, app, username, password, email, phone)
    MySQL.query.await([[
        INSERT INTO phone_passwords (citizenid, app, username, password, email, phone)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE password = VALUES(password), email = VALUES(email), phone = VALUES(phone)
    ]], { citizenid, app, username, sealSecret(password), email, phone })
end

---Returns all of one character's vault entries, ordered app then username. `created` is a unix
---timestamp in SECONDS, deliberately NOT pre-formatted here - the UI formats it with the
---player's chosen language so the vault matches dates everywhere else in the phone.
---Read-only.
---@param citizenid string framework per-character id
---@return table[] entries
function store.listVaultEntries(citizenid)
    local rows = MySQL.query.await([[
        SELECT id, app, username, password, email, phone, UNIX_TIMESTAMP(created_at) AS created
        FROM phone_passwords WHERE citizenid = ? ORDER BY app, username
    ]], { citizenid }) or {}
    for i = 1, #rows do
        rows[i].password = openSecret(rows[i].password)
    end
    return rows
end

---Encrypts vault rows still held in plaintext. Unlike a password hash, a vault secret IS the
---plaintext, so it can be converted in place instead of waiting to be re-saved one entry at a
---time. Idempotent: an already-sealed row is filtered out by the query.
---@return integer sealed rows converted
function store.sealPlaintextVault()
    if not crypto.available() then return 0 end

    local rows = MySQL.query.await("SELECT id, password FROM phone_passwords WHERE password NOT LIKE 'v1$%'") or {}
    local sealed = 0
    for i = 1, #rows do
        local blob = crypto.encrypt(rows[i].password)
        if blob and blob ~= rows[i].password then
            MySQL.update.await('UPDATE phone_passwords SET password = ? WHERE id = ?', { blob, rows[i].id })
            sealed = sealed + 1
        end
    end
    if sealed > 0 then
        print(('^2[sd-phone:accounts]^0 encrypted %d saved password%s that were stored in plaintext.')
            :format(sealed, sealed == 1 and '' or 's'))
    end
    return sealed
end

---Upgrades legacy account hashes using passwords their owners already saved in the vault. A
---signed-in player never re-enters a password, so lazy rehash alone would leave those accounts on
---the old hash forever. Each candidate is checked against the stored legacy hash first, so a
---stale vault entry can never overwrite a password it does not actually match.
---@return integer upgraded accounts converted
function store.rehashFromVault()
    if not crypto.available() then return 0 end

    local rows = MySQL.query.await([[
        SELECT a.id, a.password_hash, p.password
        FROM phone_passwords p
        JOIN phone_app_accounts a ON a.app = p.app AND a.username = p.username
        WHERE a.password_hash NOT LIKE 'scrypt$%'
    ]]) or {}

    local seen, upgraded = {}, 0
    for i = 1, #rows do
        local row = rows[i]
        if not seen[row.id] then
            local plain = openSecret(row.password)
            if type(plain) == 'string' and plain ~= '' and legacyHash(plain) == row.password_hash then
                MySQL.update.await('UPDATE phone_app_accounts SET password_hash = ? WHERE id = ?',
                    { store.hashPassword(plain), row.id })
                seen[row.id] = true
                upgraded = upgraded + 1
            end
            Wait(0)
        end
    end

    if upgraded > 0 then
        print(('^2[sd-phone:accounts]^0 upgraded %d account password%s to scrypt from saved logins.')
            :format(upgraded, upgraded == 1 and '' or 's'))
    end
    return upgraded
end

---Deletes one vault entry, scoped to citizenid AND id.
---@param citizenid string framework per-character id
---@param id number vault row id
function store.deleteVaultEntry(citizenid, id)
    MySQL.update.await('DELETE FROM phone_passwords WHERE citizenid = ? AND id = ?', { citizenid, id })
end

---Updates every saved vault copy of this login to the new password.
---@param app string account app key
---@param username string account username
---@param password string the new plaintext password, encrypted before it is written
function store.syncVaultPassword(app, username, password)
    MySQL.update.await(
        'UPDATE phone_passwords SET password = ? WHERE app = ? AND username = ?',
        { sealSecret(password), app, username }
    )
end

---Migrates credentials once from the Birdy and Mail tables: Birdy profiles become accounts and
---sessions, Mail accounts copy with the email as username; INSERT IGNORE makes re-runs no-ops.
function store.migrateLegacy()
    MySQL.query.await([[
        INSERT IGNORE INTO phone_app_accounts (app, username, display_name, password_hash)
        SELECT 'birdy', p.handle, p.display_name, p.password
        FROM phone_birdy_profiles p
        WHERE p.handle <> '' AND p.password <> ''
    ]])
    -- The NOT EXISTS is load-bearing, not belt-and-braces: the session key is
    -- (app, citizenid, account_id), so a character who already signed into a second Squawk
    -- account would collect a SECOND session row here rather than being ignored, and
    -- getSessionAccount would then pick between them arbitrarily.
    MySQL.query.await([[
        INSERT IGNORE INTO phone_app_sessions (app, citizenid, account_id)
        SELECT 'birdy', p.citizenid, a.id
        FROM phone_birdy_profiles p
        JOIN phone_app_accounts a ON a.app = 'birdy' AND a.username = p.handle COLLATE utf8mb4_unicode_ci
        WHERE p.logged_in = 1
          AND NOT EXISTS (
              -- Wrapped in a derived table: a bare subquery over the INSERT's own target is
              -- rejected outright by MySQL.
              SELECT 1 FROM (SELECT citizenid FROM phone_app_sessions WHERE app = 'birdy') s
              WHERE s.citizenid = p.citizenid
          )
    ]])
    MySQL.query.await([[
        INSERT IGNORE INTO phone_app_accounts (app, username, display_name, password_hash, email)
        SELECT 'mail', m.email, m.display_name, m.password_hash, m.email
        FROM phone_mail_accounts m
    ]])
end

return store
