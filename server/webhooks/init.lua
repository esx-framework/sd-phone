---@type table sd-phone config root (configs/config.lua); config.Webhooks is server-only.
local config = require 'configs.config'

---@type table Webhook settings (configs/server/webhooks.lua). Empty when the file is absent, so a
---server that never created one behaves exactly as before.
local cfg = config.Webhooks or {}

---@type integer Discord's hard cap on an embed description. Post bodies are capped well below
---their app limits anyway; this is the backstop that keeps a malformed payload from being
---rejected wholesale.
local MAX_DESCRIPTION = 2000

---@type integer Milliseconds between outbound sends. Discord rate-limits a webhook to roughly 30
---requests a minute and answers 429 past that, so posts are spaced rather than fired at once.
local SEND_GAP = 2200

---@type table<string, { colour: integer, label: string }> Per-app embed dressing, so both feeds
---stay readable when an owner points them at the same channel.
local APPS = {
    birdy     = { colour = 0x1D9BF0, label = 'Birdy' },
    photogram = { colour = 0xE1306C, label = 'Photogram' },
}

---@type table[] Pending sends, oldest first. Drained by the worker below.
local queue = {}
---@type boolean Whether the drain thread is running; one is enough.
local draining = false

---Whether a configured value is a usable Discord webhook URL. A blank entry is the off switch, so
---it is not worth a warning; anything else non-empty is a typo worth naming once at send time.
---@param url any
---@return boolean
local function usable(url)
    return type(url) == 'string' and url:find('^https://[%w%.]*discord[%w%.]*%.com/api/webhooks/') ~= nil
end

---Whether an image reference can go in an embed. The apps' own sanitizeImages already whitelists
---what it stores, so this only guards against a hook payload carrying something else.
---@param url any
---@return boolean
local function httpUrl(url)
    return type(url) == 'string' and url:find('^https?://') ~= nil
end

---Clips a string to a BYTE budget without splitting a UTF-8 character. Discord rejects invalid
---UTF-8 outright, and `#` and `sub` are byte-wise, so a naive cut mid-character loses the whole
---post. The ellipsis is itself three bytes and is budgeted for.
---@param s string
---@param maxBytes integer
---@return string
local function clip(s, maxBytes)
    if #s <= maxBytes then return s end
    local cut = maxBytes - 3
    -- Byte at cut+1 being a continuation byte (0x80-0xBF) means the cut landed mid-character.
    while cut > 0 do
        local b = s:byte(cut + 1)
        if not b or b < 0x80 or b > 0xBF then break end
        cut = cut - 1
    end
    return s:sub(1, cut) .. '…'
end

---Sends one queued payload and schedules the next. Failures are reported once and dropped.
local function drain()
    draining = true
    CreateThread(function()
        while #queue > 0 do
            local job = table.remove(queue, 1)
            PerformHttpRequest(job.url, function(status, body)
                -- 204 is Discord's success for a webhook execute; 200 covers ?wait=true setups.
                if status ~= 204 and status ~= 200 then
                    print(('^3[sd-phone:webhooks]^0 %s webhook rejected the post (HTTP %s)%s'):format(
                        job.app, tostring(status), body and (': ' .. tostring(body):sub(1, 200)) or ''))
                end
            end, 'POST', json.encode(job.payload), { ['Content-Type'] = 'application/json' })

            if #queue > 0 then Wait(SEND_GAP) end
        end
        draining = false
    end)
end

---Queues one webhook payload.
---@param app string
---@param url string
---@param payload table
local function enqueue(app, url, payload)
    queue[#queue + 1] = { app = app, url = url, payload = payload }
    if not draining then drain() end
end

---Builds the Discord body for one post. Nil when there is nothing worth sending.
---@param app string 'birdy'|'photogram'
---@param data { handle: string, displayName?: string, text?: string, images?: string[], location?: string }
---@return table|nil
local function embedFor(app, data)
    local meta = APPS[app]
    local text = type(data.text) == 'string' and data.text or ''
    text = clip(text, MAX_DESCRIPTION)

    ---@type string[] Only the images that are actually linkable.
    local images = {}
    if type(data.images) == 'table' then
        for i = 1, #data.images do
            if httpUrl(data.images[i]) then images[#images + 1] = data.images[i] end
        end
    end

    -- A post with neither text nor a usable image has nothing to mirror.
    if text == '' and #images == 0 then return nil end

    local name = data.handle or 'someone'
    if type(data.displayName) == 'string' and data.displayName ~= '' and data.displayName ~= name then
        name = ('%s (@%s)'):format(data.displayName, name)
    else
        name = '@' .. name
    end

    ---@type string[] Footer parts: where it was taken, and how many photos went unshown.
    local footer = { meta.label }
    if type(data.location) == 'string' and data.location ~= '' then footer[#footer + 1] = data.location end
    if #images > 1 then footer[#footer + 1] = ('+%d more photo%s'):format(#images - 1, #images > 2 and 's' or '') end

    local embed = {
        color       = meta.colour,
        author      = { name = name },
        description = text ~= '' and text or nil,
        image       = images[1] and { url = images[1] } or nil,
        footer      = { text = table.concat(footer, '  •  ') },
        timestamp   = os.date('!%Y-%m-%dT%H:%M:%SZ'),
    }

    local payload = { embeds = { embed } }
    if type(cfg.Username) == 'string' and cfg.Username ~= '' then payload.username = cfg.Username end
    if httpUrl(cfg.AvatarUrl) then payload.avatar_url = cfg.AvatarUrl end
    return payload
end

---Mirrors one post, if that app has a webhook configured. Never raises: the post is already
---written, and a broken webhook must not reach back into it.
---@param app string
---@param url any
---@param data table
local function relay(app, url, data)
    if type(url) ~= 'string' or url == '' then return end
    if not usable(url) then
        print(('^3[sd-phone:webhooks]^0 %s webhook URL does not look like a Discord webhook, ignoring it.'):format(app))
        return
    end
    local built = embedFor(app, data)
    if built then enqueue(app, url, built) end
end

AddEventHandler('sd-phone:server:birdy:post', function(data)
    if type(data) ~= 'table' then return end
    pcall(relay, 'birdy', cfg.Birdy, {
        handle      = data.username,
        displayName = data.displayName,
        text        = data.body,
        images      = data.images,
    })
end)

AddEventHandler('sd-phone:server:photogram:post', function(data)
    if type(data) ~= 'table' then return end
    -- A private account's posts are for its followers. Mirroring them into Discord would undo a
    -- visibility choice the player made deliberately, so they never leave the phone.
    if data.private == true then return end
    pcall(relay, 'photogram', cfg.Photogram, {
        handle   = data.username,
        text     = data.caption,
        images   = data.images,
        location = data.location,
    })
end)

---@type table Exposed for tests; nothing else reads this.
return { embedFor = embedFor, usable = usable }
