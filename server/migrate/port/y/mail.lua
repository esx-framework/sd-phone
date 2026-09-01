---@type table Mail porter (server.migrate.port.y.mail). Carries YSeries mail into sd-phone.
---
---YSeries has no mail ACCOUNTS: mail is delivered straight to a phone_imei and every sender is a
---system address, so there is no mailbox on the far side to copy. One is synthesised per character
---who received mail, addressed on this server's own domain.
local M = {}

---@type table Migration data layer (server.migrate.store): the mailbox writer + JSON helpers.
local store = require 'server.migrate.store'
---@type table YSeries source reads (server.migrate.ystore): paged table reads.
local ystore = require 'server.migrate.ystore'
---@type table Mail app config (configs.mail): the one domain this server issues addresses on.
local mailCfg = require 'configs.mail'
---@type table Shared helpers (server.util): trim + truthiness.
local util = require 'server.util'
---@type table Framework citizen reads (bridge.server.records): character names for the addresses
---YSeries never recorded, so a mailbox reads as its owner rather than as a citizenid.
local records = require 'bridge.server.records'

---@type integer Rows read per page. Mail is the largest YSeries table on a live server.
local PAGE <const> = 5000

---@type integer Messages kept per mailbox, newest first. The whole inbox lands in one JSON column,
---so an unbounded copy would put a multi-megabyte blob on a single row; a bot that sent one player
---ninety thousand notices would make that row unreadable.
local MAX_PER_BOX <const> = 250

---The local part of an address, lowercased, punctuation-safe.
---@param value any
---@return string
local function localPart(value)
    local s = tostring(value or ''):match('^([^@]+)') or 'mail'
    s = s:lower():gsub('[^%w%.%-_]', '')
    return s ~= '' and s or 'mail'
end

---Rewrites any address onto this server's configured mail domain. YSeries servers run their own
---(summitrp.com, hookline.com), and every sd-phone path that validates an address assumes
---configs/mail.lua Domain, so the local part is kept and the domain replaced.
---@param address any
---@return string
local function onOurDomain(address)
    return (localPart(address) .. '@' .. mailCfg.Domain):sub(1, mailCfg.MaxEmailLength or 64)
end

---The mailbox address for a character, derived from their name and made unique. YSeries never
---recorded one, so this is minted rather than migrated.
---@param cid string
---@param taken table<string, boolean> addresses already issued
---@param nameOf table<string, string> cid -> 'first last'
---@return string
local function addressFor(cid, taken, nameOf)
    local base = localPart((nameOf[cid] or cid):gsub('%s+', '.'))
    local candidate = (base .. '@' .. mailCfg.Domain):sub(1, mailCfg.MaxEmailLength or 64)

    local n = 1
    while taken[candidate] do
        n = n + 1
        candidate = (('%s%d@%s'):format(base, n, mailCfg.Domain)):sub(1, mailCfg.MaxEmailLength or 64)
    end

    taken[candidate] = true
    return candidate
end

---@param ctx table migration context (imeiToCid, dryRun)
---@return { accounts: number, messages: number, skipped: number, truncated: number }
function M.run(ctx)
    local out = { accounts = 0, messages = 0, skipped = 0, truncated = 0 }
    if not ystore.table('mails') then return out end

    local okNames, nameOf = pcall(records.namesFor, ctx.cids or {})
    if not okNames or type(nameOf) ~= 'table' then nameOf = {} end
    local taken, addressOf, inbox = {}, {}, {}

    local offset = 0
    while true do
        local page = ystore.page('mails',
            '`id`, `phone_imei`, `title`, `content`, `sender`, `sender_display_name`, `is_read`, UNIX_TIMESTAMP(`timestamp`) AS ts',
            offset, PAGE, '`id` DESC')
        if #page == 0 then break end
        offset = offset + #page

        for _, m in ipairs(page) do
            local cid = ctx.imeiToCid[m.phone_imei]
            if not cid then
                out.skipped = out.skipped + 1
            else
                local address = addressOf[cid]
                if not address then
                    address = addressFor(cid, taken, nameOf)
                    addressOf[cid] = address
                    inbox[address] = {}
                    out.accounts = out.accounts + 1
                end

                local box = inbox[address]
                if #box >= MAX_PER_BOX then
                    out.truncated = out.truncated + 1
                else
                    -- Built to the shape server/mail/actions.lua writes for a real send; getting it
                    -- wrong renders a message with no sender, no recipients and no body.
                    box[#box + 1] = {
                        id      = ('ymail%s'):format(m.id),
                        folder  = 'inbox',
                        from    = {
                            name  = util.trim(m.sender_display_name) ~= '' and util.trim(m.sender_display_name)
                                    or localPart(m.sender),
                            email = onOurDomain(m.sender),
                        },
                        to      = { address },
                        subject = util.trim(m.title),
                        body    = util.trim(m.content),
                        sentAt  = os.date('!%Y-%m-%dT%H:%M:%S', math.floor(tonumber(m.ts) or os.time())),
                        read    = util.truthy(m.is_read),
                        flagged = false,
                    }
                    out.messages = out.messages + 1
                end
            end
        end
    end

    local rows, engineRows = {}, {}
    for cid, address in pairs(addressOf) do
        rows[#rows + 1] = {
            address:sub(1, 64), '', localPart(address):sub(1, 64),
            store.encodeJson(inbox[address]) or '[]',
            store.encodeJson({ cid }) or '[]',
        }
        engineRows[#engineRows + 1] = { 'mail', address:sub(1, 64), localPart(address):sub(1, 50), '' }
    end

    if not ctx.dryRun then
        store.insertMailAccounts(rows)
        store.insertPgAccounts(engineRows)
    end

    return out
end

return M
