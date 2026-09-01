---@type table Dark Chat porter (server.migrate.port.y.darkchat). Carries YSeries' channels, their
---members and messages across.
---
---The two sides key differently: YSeries Dark Chat is username-keyed with its own accounts, while
---sd-phone's is CITIZENID-keyed with a separate nickname per character. `darkchat_loggedin` is the
---bridge, so a username that nobody was signed in as cannot be attributed and its rows are skipped.
local M = {}

---@type table Migration data layer (server.migrate.store).
local store = require 'server.migrate.store'
---@type table YSeries source reads (server.migrate.ystore): paged reads + the owner map.
local ystore = require 'server.migrate.ystore'
---@type table Attachment extraction (server.migrate.media): message media is object-wrapped.
local media = require 'server.migrate.media'
---@type table Shared helpers (server.util): trim + ids.
local util = require 'server.util'

---@type integer Rows read per page.
local PAGE <const> = 5000

---A room id and invite code derived from a YSeries channel name. sd-phone keys rooms by id and
---requires a unique code; YSeries has neither, only the name.
---@param name string
---@return string id, string code
local function roomKeys(name)
    local slug = name:lower():gsub('[^%w]', ''):sub(1, 24)
    if slug == '' then slug = 'room' end
    return ('yd_%s'):format(slug):sub(1, 40), ('y%s'):format(slug):sub(1, 16)
end

---@param ctx table migration context (imeiToCid, dryRun)
---@return { rooms: number, members: number, messages: number, nicknames: number, skipped: number }
function M.run(ctx)
    local out = { rooms = 0, members = 0, messages = 0, nicknames = 0, skipped = 0 }
    if not ystore.table('darkchat_channels') then return out end

    -- username -> citizenid, through the handset that was signed in as it.
    local owners = ystore.accountOwners('darkchat')
    local cidOf, nickRows = {}, {}
    for username, imei in pairs(owners) do
        local cid = ctx.imeiToCid[imei]
        if cid then cidOf[username] = cid end
    end

    if ystore.table('darkchat_accounts') then
        local seen = {}
        local offset = 0
        while true do
            local page = ystore.page('darkchat_accounts', '`username`, `display_name`', offset, PAGE, '`username`')
            if #page == 0 then break end
            offset = offset + #page

            for _, a in ipairs(page) do
                local cid = cidOf[a.username]
                if cid and not seen[cid] then
                    seen[cid] = true
                    local nick = util.trim(a.display_name)
                    if nick == '' then nick = util.trim(a.username) end
                    if nick ~= '' then
                        nickRows[#nickRows + 1] = { cid, nick:sub(1, 40) }
                        out.nicknames = out.nicknames + 1
                    end
                end
            end
        end
        if not ctx.dryRun and #nickRows > 0 then store.insertDarkchatNicknames(nickRows) end
    end

    local roomOf = {}
    local offset = 0
    while true do
        local page = ystore.page('darkchat_channels',
            '`name`, `ch_owner`, UNIX_TIMESTAMP(`timestamp`) AS ts', offset, PAGE, '`name`')
        if #page == 0 then break end
        offset = offset + #page

        local rows, codes = {}, {}
        for _, c in ipairs(page) do
            local name = util.trim(c.name)
            if name == '' then
                out.skipped = out.skipped + 1
            else
                local id, code = roomKeys(name)
                -- Two channel names can slug to one code; the later one takes a suffix rather than
                -- colliding on the unique key and dropping the whole room.
                local n = 1
                while codes[code] do
                    n = n + 1
                    code = (('y%s%d'):format(name:lower():gsub('[^%w]', ''):sub(1, 12), n)):sub(1, 16)
                    id = ('%s%d'):format(id:sub(1, 36), n)
                end
                codes[code] = true
                roomOf[name] = id

                rows[#rows + 1] = {
                    id, code, name:sub(1, 60),
                    cidOf[c.ch_owner] or 'yseries',
                    tonumber(c.ts) or os.time(),
                }
                out.rooms = out.rooms + 1
            end
        end
        if not ctx.dryRun and #rows > 0 then store.insertDarkchatRooms(rows) end
    end

    offset = 0
    while true do
        local page = ystore.page('darkchat_members', '`channel_name`, `username`', offset, PAGE,
            '`channel_name`, `username`')
        if #page == 0 then break end
        offset = offset + #page

        local rows = {}
        for _, m in ipairs(page) do
            local room = roomOf[util.trim(m.channel_name)]
            local cid = cidOf[m.username]
            if not room or not cid then
                out.skipped = out.skipped + 1
            else
                rows[#rows + 1] = { room, cid, os.time() }
                out.members = out.members + 1
            end
        end
        if not ctx.dryRun and #rows > 0 then store.insertDarkchatMembers(rows) end
    end

    offset = 0
    while true do
        local page = ystore.page('darkchat_messages',
            '`id`, `channel`, `sender`, `content`, `attachments`, UNIX_TIMESTAMP(`timestamp`) AS ts',
            offset, PAGE)
        if #page == 0 then break end
        offset = offset + #page

        local rows = {}
        for _, m in ipairs(page) do
            local room = roomOf[util.trim(m.channel)]
            if not room then
                out.skipped = out.skipped + 1
            else
                local urls = media.urls(m.attachments)
                local kind = #urls > 0 and 'image' or 'text'
                local meta = #urls > 0 and json.encode({ mediaUrl = urls[1] }) or nil
                local body = util.trim(m.content)
                if body == '' and kind == 'image' then body = 'Photo' end

                -- citizenid stays NULL for an author nobody was signed in as: the column is
                -- nullable precisely so a message keeps its author name without inventing an owner.
                rows[#rows + 1] = {
                    room, cidOf[m.sender], (util.trim(m.sender)):sub(1, 40),
                    body, kind, meta, tonumber(m.ts) or os.time(),
                }
                out.messages = out.messages + 1
            end
        end
        if not ctx.dryRun and #rows > 0 then store.insertDarkchatMessages(rows) end
    end

    return out
end

return M
