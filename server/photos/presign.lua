---@type table sd-phone config root (configs/config.lua): Photos.DirectUpload.
local config   = require 'configs.config'
---@type table Media uploader (server.photos.uploader): the active provider and the media token.
local uploader = require 'server.photos.uploader'
---@type table Photos persistence layer (server.photos.store): the global URL read and the
---video/still classifier a claimed URL is checked against.
local store    = require 'server.photos.store'
---@type table Media URL ledger (server.media.ledger): every URL this server has ever hosted, for
---any app, which is what a claim is really measured against.
local ledger   = require 'server.media.ledger'

---@type table Presign module; the table returned at end of file. Mints one-shot upload slots so a
---client can put media straight into Fivemanage over ordinary HTTPS, and decides whether the URL
---it reports back afterwards may be written into phone_photos.
---
---That second job is the whole trust boundary. On the sliced path the server produced the URL
---from bytes it had in hand, so guard.photo could treat any phone_photos row as proof of
---ownership. Here the client reports the URL, and every check below is what keeps that inference
---true.
local presign = {}

---@type table Photos config (configs/photos.lua): the DirectUpload switch.
local PHOTOS = config.Photos or require 'configs.photos'

---@type string Fivemanage endpoint that mints a one-shot upload URL.
local PRESIGN_URL <const> = 'https://api.fivemanage.com/api/v3/file/presigned-url'

---@type string Host every claimed URL must sit under, trailing slash included.
local CDN_HOST <const> = 'https://r2.fivemanage.com/'

---@type integer Longest URL a claim may carry. phone_photos.url is VARCHAR(512).
local MAX_URL_CHARS <const> = 512

---@type integer How often expired slots are swept, in ms.
local SWEEP_MS <const> = 60000

---@type table<string, table<string, boolean>> Extensions a claim may end in, each mapped to the
---kinds that extension can legitimately be. The provider names the stored
---object and takes the extension from a content sniff, not from the filename sent with the upload
---- probing it on 2026-09-09 with a `.jpg` filename around text bytes returned a `.txt` object -
---so an extension here is the provider's verdict on the content, and a `.html` can only appear if
---the bytes really are one.
---
---This says only whether the phone hosts that sort of file. WHICH kind a given object is comes
---from the content type, because the extension cannot always say: MediaRecorder writes both a
---video clip and a voice memo into `.webm`, and only `video/webm` against `audio/webm` tells them
---apart.
---
---It has to stay a subset of what the apps can render: store.isVideoUrl reads the same extension
---to decide whether a photo row is a clip or a still, so admitting one it does not know would
---save a row that renders as a broken image.
local MEDIA_EXT <const> = {
    jpg  = { image = true }, jpeg = { image = true }, png = { image = true },
    webp = { image = true }, gif  = { image = true },
    mp4  = { video = true }, mov  = { video = true }, m4v = { video = true },
    mp3  = { audio = true }, m4a  = { audio = true }, wav = { audio = true },
    oga  = { audio = true }, weba = { audio = true },
    -- The two containers that carry either. MediaRecorder writes a clip and a voice memo into the
    -- same `.webm`, so this pair is why the kind cannot be read off the extension alone.
    webm = { video = true, audio = true },
    ogg  = { video = true, audio = true },
}

---@type table<number, { teamId: string, exp: integer }> The outstanding upload slot for each
---source. One per player: a later mint replaces an earlier one, so a client cannot bank slots and
---spend them on several URLs later.
local slots = {}

---@type table<string, integer> Six-bit value of each base64url character (RFC 4648 section 5).
local B64URL_VALUE = {}
do
    local alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    for i = 1, #alphabet do B64URL_VALUE[alphabet:sub(i, i)] = i - 1 end
end

---Decodes an unpadded base64url segment to the bytes it stands for; nil for anything carrying a
---character outside the alphabet, so a run of text that merely looks like a segment cannot be
---read as one.
---@param seg string
---@return string|nil bytes
local function b64urlDecode(seg)
    local acc, bits, out = 0, 0, {}
    for i = 1, #seg do
        local v = B64URL_VALUE[seg:sub(i, i)]
        if not v then return nil end
        acc  = (acc << 6) | v
        bits = bits + 6
        if bits >= 8 then
            bits = bits - 8
            out[#out + 1] = string.char((acc >> bits) & 0xFF)
        end
    end
    return table.concat(out)
end

---Reads the team and the expiry out of the JWT carried by a presigned URL.
---
---Where in the URL that token sits is the provider's to change, so rather than assume a query
---parameter name every three-part base64url run is tried and the first whose middle segment
---decodes to a payload naming a team wins. The host matches that shape too (api.fivemanage.com),
---which is exactly why a candidate only counts once it has decoded to something.
---
---The signature is never verified. This is a token the server minted seconds ago over its own
---authenticated channel, so nothing here is a trust decision and there is no HMAC key to want.
---Only the two scalars are read, by pattern, which keeps the module loadable outside FiveM.
---@param url string presigned upload URL
---@return string|nil teamId, integer|nil exp unix seconds
local function readToken(url)
    for _, payloadSeg in url:gmatch('([%w%-_]+)%.([%w%-_]+)%.[%w%-_]+') do
        local payload = b64urlDecode(payloadSeg)
        if payload and payload:find('"teamId"', 1, true) then
            local teamId = payload:match('"teamId"%s*:%s*"([^"]+)"') or payload:match('"teamId"%s*:%s*(%d+)')
            local exp    = tonumber(payload:match('"exp"%s*:%s*(%d+)'))
            -- The team lands in a URL prefix, so it is held to what can appear in one. It comes
            -- from our own token; this is only here so a surprise never reaches the comparison.
            if teamId and exp and teamId:match('^[%w%-_]+$') then return teamId, exp end
        end
    end
    return nil, nil
end

---One header by name, whatever case the provider sent it in.
---@param headers table|nil
---@param name string lowercase header name
---@return string|nil value
local function header(headers, name)
    if type(headers) ~= 'table' then return nil end
    for k, v in pairs(headers) do
        if type(k) == 'string' and k:lower() == name then
            return type(v) == 'table' and v[1] or v
        end
    end
    return nil
end

---Whether this server can mint upload slots at all. False sends the Camera down the sliced path,
---which is why nothing in this change deletes it.
---@return boolean
function presign.available()
    if PHOTOS.DirectUpload == false then return false end
    -- Shut until the ledger knows what already exists: a claim answered from a half-filled ledger
    -- would accept the very URLs it is there to refuse.
    if not ledger.ready() then return false end
    if uploader.provider() ~= 'fivemanage' then return false end
    return uploader.mediaKey() ~= ''
end

---Mints an upload slot for `src` and hands back the URL the page should POST to. Asynchronous:
---calls `cb(url|nil, code|nil)` exactly once. Only the URL crosses to the client; the team and
---the expiry stay here, because they are what the claim is later measured against.
---@param src number player the upload will come from
---@param cb fun(url: string|nil, code: 'unavailable'|'provider'|nil)
function presign.mint(src, cb)
    if not presign.available() then
        cb(nil, 'unavailable')
        return
    end

    PerformHttpRequest(PRESIGN_URL, function(status, body)
        if status ~= 200 and status ~= 201 then
            print(('^1[sd-phone:photos]^0 [PRESIGN] Fivemanage refused to mint a slot: HTTP %s %s')
                :format(tostring(status), tostring(body)))
            cb(nil, 'provider')
            return
        end

        local okJson, decoded = pcall(json.decode, body or '')
        local url = (okJson and type(decoded) == 'table' and type(decoded.data) == 'table')
            and decoded.data.presignedUrl or nil
        if type(url) ~= 'string' or url == '' then
            print(('^1[sd-phone:photos]^0 [PRESIGN] no presignedUrl in the response: %s'):format(tostring(body)))
            cb(nil, 'provider')
            return
        end

        -- Without a readable token there is no bucket to pin the claim to, and a slot that cannot
        -- be checked is worse than no slot at all.
        local teamId, exp = readToken(url)
        if not teamId or not exp then
            print('^1[sd-phone:photos]^0 [PRESIGN] the presigned URL carried no readable token; not minting a slot.')
            cb(nil, 'provider')
            return
        end

        slots[src] = { teamId = teamId, exp = exp }
        cb(url)
    end, 'GET', '', { ['Authorization'] = uploader.mediaKey() })
end

---Validates a URL a client reports having uploaded to, and hands back the trusted URL and the
---size the CDN says it is. Asynchronous: calls `cb(url|nil, code|nil, bytes|nil)` exactly once.
---
---The four rules, in the order a forged claim meets them:
---  1. an unexpired slot must exist for this source, and it is spent whatever the outcome;
---  2. the URL must sit inside the bucket that slot was minted for, be shaped like one of this
---     CDN's objects, and end in an extension this app hosts;
---  3. no other row in phone_photos may already hold it, or one player could claim a URL they saw
---     another share and guard.photo would then honour it as their own;
---  4. the object must actually be media of the kind its name promises, and within the byte cap.
---
---Rule 2 does more work than it looks. The provider names the stored object itself and derives
---the extension from a content sniff, so `.mp4` is Fivemanage's verdict on the bytes rather than
---anything the client chose to call the file.
---@param src number player making the claim
---@param url any URL the client reports, entirely untrusted
---@param opts { maxBytes: integer, kinds: table<'image'|'video'|'audio', boolean> } what this
---caller will accept. Both belong to the caller rather than to this module: the Camera and the
---MDT bodycam have ceilings an order of magnitude apart, and they take different kinds - Voice
---Memos wants audio and only audio, while a camera claim admitting an mp3 would drop a sound file
---into somebody's photo gallery.
---@param cb fun(url: string|nil, code: 'no-slot'|'expired'|'foreign-url'|'duplicate'|'probe-failed'|'bad-type'|'too-large'|nil, bytes: integer|nil)
function presign.claim(src, url, opts, cb)
    opts = type(opts) == 'table' and opts or {}
    local maxBytes = math.floor(tonumber(opts.maxBytes) or 0)
    local kinds    = type(opts.kinds) == 'table' and opts.kinds or {}
    local slot = slots[src]
    if not slot then
        cb(nil, 'no-slot')
        return
    end
    -- Spent on sight, whatever happens below. One mint yields at most one claim, and a claim that
    -- fails falls back to the sliced path rather than getting another go at the same slot.
    slots[src] = nil

    if os.time() >= slot.exp then
        cb(nil, 'expired')
        return
    end

    if type(url) ~= 'string' or #url > MAX_URL_CHARS then
        cb(nil, 'foreign-url')
        return
    end

    local prefix = CDN_HOST .. slot.teamId .. '/'
    if url:sub(1, #prefix) ~= prefix then
        cb(nil, 'foreign-url')
        return
    end

    -- The prefix pin is a string comparison, so the rest of the URL is held to the one shape this
    -- CDN produces: a single object name. Anything looser and `team7/../other/x.mp4` sits under
    -- the prefix here yet resolves outside the bucket the moment a browser normalises it.
    local name, ext = url:sub(#prefix + 1):match('^([%w%-_]+)%.([%a%d]+)$')
    local extKinds = name and MEDIA_EXT[(ext or ''):lower()] or nil
    if not extKinds then
        cb(nil, 'foreign-url')
        return
    end

    -- Both, and in this order. The ledger covers every app that has ever hosted media here; the
    -- phone_photos read covers URLs that arrived some other way, such as an allowlisted import.
    if ledger.has(url) or store.urlExistsAnywhere(url) then
        cb(nil, 'duplicate')
        return
    end

    -- One byte, not the file. A HEAD would be the natural probe and FiveM cannot send one at all
    -- (PerformHttpRequest answers status 0), but R2 honours Range: asking for `bytes=0-0` returns
    -- 206 with a single byte and a `content-range` naming the object's true length, which is all
    -- this needs. Downloading the object instead would cost the server 94 MB per bodycam
    -- recording, trading the packet loss this change removes for bandwidth somewhere else.
    PerformHttpRequest(url, function(status, body, headers)
        -- 206 is the expected answer. 200 means the range was ignored - a cached response does
        -- that - and the whole object arrived instead, which still answers both questions.
        if status ~= 206 and status ~= 200 then
            print(('^1[sd-phone:photos]^0 [PRESIGN] src=%s claimed an object that is not there: HTTP %s')
                :format(tostring(src), tostring(status)))
            cb(nil, 'probe-failed')
            return
        end

        -- The content type is what decides the kind, and it is the CDN's own verdict on the bytes
        -- rather than anything the client chose. The extension above only said the phone hosts
        -- this sort of file at all; it cannot say which sort, because `.webm` is both a clip and
        -- a voice memo.
        local ctype = header(headers, 'content-type')
        local kind  = type(ctype) == 'string' and ctype:match('^(%a+)/') or nil
        kind = kind and kind:lower() or nil

        -- What the object is allowed to be here. For an extension that can only be one thing, the
        -- CDN's verdict has to agree with it AND with what the caller takes: that is what refuses
        -- a .jpg served as video/mp4, which would otherwise be stored as a row store.isVideoUrl
        -- reads as a still and renders broken.
        --
        -- For a dual container the CDN's verdict is not usable. Fivemanage sniffs a voice memo
        -- recorded into a .webm as `video/webm`, because WebM is a video container and the sniff
        -- sees the container rather than the tracks inside it. Holding audio callers to `audio/`
        -- there refused every real voice memo. So for .webm and .ogg the claim accepts the object
        -- when the caller takes either kind the extension could be, and leans on the extension for
        -- what the app will render. Nothing that carries real weight rests on this - the bucket,
        -- the slot, uniqueness and the size cap are all unaffected.
        local ambiguous = false
        do
            local n = 0
            for _ in pairs(extKinds) do n = n + 1 end
            ambiguous = n > 1
        end

        local allowed = false
        if ambiguous then
            for k in pairs(extKinds) do
                if kinds[k] then allowed = true break end
            end
        else
            allowed = kind ~= nil and kinds[kind] == true and extKinds[kind] == true
        end

        if not allowed then
            print(('^1[sd-phone:photos]^0 [PRESIGN] src=%s claimed a .%s the CDN serves as %s, which this caller does not take')
                :format(tostring(src), ext, tostring(ctype)))
            cb(nil, 'bad-type')
            return
        end

        -- `content-range: bytes 0-0/98304000` states the whole object's length, which is the
        -- number the cap is about. Only when the range was ignored does the body's own length
        -- stand in for it, and then the body really is the whole object.
        local range = header(headers, 'content-range')
        local total = range and tonumber(range:match('/(%d+)%s*$')) or nil
        local bytes = total or (type(body) == 'string' and #body or 0)
        if bytes <= 0 then
            cb(nil, 'probe-failed')
            return
        end
        if bytes > maxBytes then
            cb(nil, 'too-large')
            return
        end

        -- Recorded before the caller is told, so the object is known to every later claim even if
        -- the row that was going to hold it never saves.
        ledger.record(url)
        cb(url, nil, bytes)
    end, 'GET', '', { ['Range'] = 'bytes=0-0' })
end

---Drops a source's slot. Called when a player leaves, so a slot cannot outlive them and be spent
---by whoever the server hands that source id to next.
---@param src number
function presign.forget(src)
    slots[src] = nil
end

-- Sweeps slots whose token has expired. A claim checks the expiry itself, so this only keeps the
-- table from holding a slot per player who minted one and then never came back.
CreateThread(function()
    while true do
        Wait(SWEEP_MS)
        local now = os.time()
        for src, slot in pairs(slots) do
            if now >= slot.exp then slots[src] = nil end
        end
    end
end)

return presign
