---@type table Photos persistence layer: proves a URL was saved into the caller's gallery by the
---server before another player's NUI is allowed to render it.
local photos = require 'server.photos.store'
---@type table Voice Memos persistence layer: the equivalent ownership proof for audio messages.
local voices = require 'server.voicememos.store'
---@type table Shared helpers: linear-time whitespace trimming.
local util = require 'server.util'

---@type table Media guard; every function accepts client input and returns a trusted URL or nil.
local guard = {}

---@type integer URL column width shared by the phone's media-bearing tables.
local URL_MAX <const> = 512
---@type integer How long a freshly uploaded chat recording remains sendable without also saving it
---to the Voice Memos app.
local TEMP_VOICE_MS <const> = 10 * 60 * 1000
---@type table<string, table<string, integer>> citizenid -> URL -> expiry timer
local temporaryVoices = {}

---Trims a value and returns it when it is an HTTPS URL within the column width, else nil.
---@param value any
---@return string|nil url
local function httpsUrl(value)
    local url = util.trim(value)
    if url == '' or #url > URL_MAX or not url:match('^https://') then return nil end
    return url
end

---HTTPS shape check for server-authored content; client write paths use the ownership checks below.
---@param value any
---@return string|nil url
function guard.https(value) return httpsUrl(value) end

---Returns a URL only when it is an HTTPS item in the caller's server-owned Photos gallery.
---@param citizenid string|nil caller's framework character id
---@param value any client-supplied URL
---@return string|nil url
function guard.photo(citizenid, value)
    local url = httpsUrl(value)
    if type(citizenid) ~= 'string' or citizenid == '' or not url then return nil end
    return photos.hasUrl(citizenid, url) and url or nil
end

---Resolves a resent photo field: keeps `current` when the value matches it or fails guard.photo,
---accepts a new gallery URL, and clears on an empty value.
---@param citizenid string|nil caller's framework character id
---@param value any client-supplied URL
---@param current string|nil URL currently stored for this field
---@return string|nil url
function guard.photoOrCurrent(citizenid, value, current)
    local sent = util.trim(value)
    if sent == '' then return nil end
    if type(current) ~= 'string' or current == '' then current = nil end
    if sent == current then return current end
    return guard.photo(citizenid, value) or current
end

---Filters a client image list to distinct gallery-owned HTTPS URLs; entries already in `current`
---are kept without a lookup. Scans at most 64 entries.
---@param citizenid string|nil caller's framework character id
---@param values any client-supplied URL list
---@param limit integer maximum returned items
---@param current string[]|nil URLs currently stored for this list
---@return string[] urls
function guard.photos(citizenid, values, limit, current)
    local out, seen = {}, {}
    if type(values) ~= 'table' then return out end
    limit = math.max(0, math.floor(tonumber(limit) or 0))
    if limit == 0 then return out end
    local keep = {}
    if type(current) == 'table' then
        for i = 1, #current do
            if type(current[i]) == 'string' and current[i] ~= '' then keep[current[i]] = true end
        end
    end
    local scanLimit = math.min(#values, math.max(limit * 4, 32), 64)
    for i = 1, scanLimit do
        local sent = util.trim(values[i])
        local url = keep[sent] and sent or guard.photo(citizenid, values[i])
        if url and not seen[url] then
            seen[url] = true
            out[#out + 1] = url
            if #out >= limit then break end
        end
    end
    return out
end

---Returns a URL only when it is an HTTPS asset on giphy.com or one of its subdomains.
---@param value any client-supplied URL
---@return string|nil url
function guard.giphy(value)
    local url = httpsUrl(value)
    if not url then return nil end
    local host = url:lower():match('^https://([%w%.%-]+)[/%?#]')
        or url:lower():match('^https://([%w%.%-]+)$')
    if not host or (host ~= 'giphy.com' and not host:match('%.giphy%.com$')) then return nil end
    return url
end

---Marks an uploader-returned recording as sendable by its owner for TEMP_VOICE_MS.
---@param citizenid string|nil caller's framework character id
---@param value any uploader-returned URL
---@return string|nil url
function guard.rememberVoice(citizenid, value)
    local url = httpsUrl(value)
    if type(citizenid) ~= 'string' or citizenid == '' or not url then return nil end
    temporaryVoices[citizenid] = temporaryVoices[citizenid] or {}
    temporaryVoices[citizenid][url] = GetGameTimer() + TEMP_VOICE_MS
    return url
end

---Returns a URL only when it is an HTTPS recording in the caller's Voice Memos library or one
---remembered by guard.rememberVoice that has not expired.
---@param citizenid string|nil caller's framework character id
---@param value any client-supplied URL
---@return string|nil url
function guard.voice(citizenid, value)
    local url = httpsUrl(value)
    if type(citizenid) ~= 'string' or citizenid == '' or not url then return nil end
    if voices.hasUrl(citizenid, url) then return url end
    local mine = temporaryVoices[citizenid]
    local expires = mine and mine[url]
    local now = GetGameTimer()
    if expires and now <= expires then return url end
    if mine then
        mine[url] = nil
        if next(mine) == nil then temporaryVoices[citizenid] = nil end
    end
    return nil
end

util.onCleanup(function(_, citizenid)
    if citizenid then temporaryVoices[citizenid] = nil end
end)

return guard
