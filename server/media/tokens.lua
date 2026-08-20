---@type table Crypto bridge (server.crypto): the Node helper's availability probe.
local crypto = require 'server.crypto'

---@type table Tokens module; the table returned at end of file. Turns a claim set into the signed
---SDMR/1 string the relay verifies, and signs the control-channel requests that go the other way.
---It decides nothing: every claim it writes was settled by the caller before it was handed over.
local tokens = {}

---@type string This resource's name, used to reach the Node crypto helper's exports.
local RESOURCE = GetCurrentResourceName()

---@type string Token version prefix. It sits inside the signed material, so a future sdmr2 can
---never be read as an sdmr1 whose claims happen to line up.
local PREFIX = 'sdmr1'

---@type integer Longest token the relay accepts, in characters.
local MAX_TOKEN_CHARS = 1024

---@type string base64url alphabet (RFC 4648 section 5), padding stripped.
local B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

---@type table<string, string> JSON escapes for the characters a claim may legitimately contain.
local ESCAPES = {
    ['"'] = '\\"', ['\\'] = '\\\\', ['\b'] = '\\b',
    ['\f'] = '\\f', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t',
}

---@type boolean|nil Whether the Node helper mints the whole token itself. nil until first probed.
local nodeMints

---Calls one of the Node crypto helper's exports, swallowing both a missing runtime and a helper
---build that predates the relay exports. Reached through the export rather than server/crypto.lua
---so this module signs correctly whichever of the two lands first.
---@param name string export name
---@param ... any arguments
---@return boolean okCall, any result
local function call(name, ...)
    return pcall(function(...) return exports[RESOURCE][name](exports[RESOURCE], ...) end, ...)
end

---One base64url character by its six-bit value.
---@param v integer 0..63
---@return string
local function chr(v)
    return B64URL:sub(v + 1, v + 1)
end

---Encodes raw bytes as unpadded base64url.
---@param s string raw bytes
---@return string encoded
local function b64url(s)
    local out, i, n = {}, 1, #s
    while i + 2 <= n do
        local a, b, c = s:byte(i, i + 2)
        local v = (a << 16) | (b << 8) | c
        out[#out + 1] = chr(v >> 18) .. chr((v >> 12) & 63) .. chr((v >> 6) & 63) .. chr(v & 63)
        i = i + 3
    end

    local left = n - i + 1
    if left == 1 then
        local v = s:byte(i) << 16
        out[#out + 1] = chr(v >> 18) .. chr((v >> 12) & 63)
    elseif left == 2 then
        local a, b = s:byte(i, i + 1)
        local v = (a << 16) | (b << 8)
        out[#out + 1] = chr(v >> 18) .. chr((v >> 12) & 63) .. chr((v >> 6) & 63)
    end
    return table.concat(out)
end

---Decodes lowercase hex to the raw bytes it stands for.
---@param hex string even-length hex string
---@return string bytes
local function hexBytes(hex)
    return (hex:gsub('%x%x', function(pair) return string.char(tonumber(pair, 16)) end))
end

---Quotes a string as a JSON literal, escaping the quote, the backslash and every control
---character. A display name arrives from the framework rather than from a client, but it is the
---one claim that can carry anything at all, so it is escaped rather than trusted.
---@param s string
---@return string literal including the surrounding quotes
local function jsonString(s)
    local body = s:gsub('[%c"\\]', function(ch)
        return ESCAPES[ch] or ('\\u%04x'):format(ch:byte())
    end)
    return '"' .. body .. '"'
end

---Serialises a claim set as compact JSON with the fields in the order the protocol lists them.
---Built by hand rather than through json.encode because a Lua table has no field order and the
---relay reads the claims as a fixed, closed set.
---@param claims table { sub, src, name, key, role, gen, iat, exp, jti }
---@return string json
local function claimsJson(claims)
    return table.concat({
        '{"v":1,"iss":"sd-phone","sub":', jsonString(claims.sub),
        ',"src":', ('%d'):format(claims.src),
        ',"name":', jsonString(claims.name),
        ',"key":', jsonString(claims.key),
        ',"role":', jsonString(claims.role),
        ',"gen":', ('%d'):format(claims.gen),
        ',"iat":', ('%d'):format(claims.iat),
        ',"exp":', ('%d'):format(claims.exp),
        ',"jti":', jsonString(claims.jti),
        '}',
    })
end

---Whether a value is the 64 lowercase hex characters a relay key has to be.
---@param keyHex any
---@return boolean
local function validKey(keyHex)
    return type(keyHex) == 'string' and #keyHex == 64 and keyHex:match('^[0-9a-f]+$') ~= nil
end

---HMAC-SHA256 of `msg` under a hex key, as 64 lowercase hex characters. The key is the raw 32
---bytes the hex stands for rather than the hex text, which is what the relay decodes on its side.
---Nil when the key is malformed or the Node helper is unavailable, never an error.
---@param keyHex string 64 lowercase hex characters
---@param msg string message to sign
---@return string|nil hex
function tokens.hmacHex(keyHex, msg)
    if not validKey(keyHex) or type(msg) ~= 'string' then return nil end
    if not crypto.available() then return nil end

    local okCall, res = call('sdCryptoHmacHex', keyHex, msg)
    if not okCall or type(res) ~= 'string' or #res ~= 64 or not res:match('^[0-9a-f]+$') then return nil end
    return res
end

---Signs a claim set into a finished token, `sdmr1.<base64url(claims)>.<base64url(signature)>`.
---
---The Node helper is asked to mint the whole thing when it can, so the encoding and the signature
---come from one place; when it only offers the HMAC, the encoding is done here against the same
---signed material. Returns nil on a malformed key, an unusable claim set or a missing helper: this
---path fails closed, because a token that cannot be signed properly must not be issued at all.
---@param keyHex string 64 lowercase hex characters
---@param claims table { sub, src, name, key, role, gen, iat, exp, jti }
---@return string|nil token
function tokens.sign(keyHex, claims)
    if not validKey(keyHex) or type(claims) ~= 'table' then return nil end
    if not crypto.available() then return nil end

    local okBuild, body = pcall(claimsJson, claims)
    if not okBuild or type(body) ~= 'string' then return nil end

    if nodeMints ~= false then
        local okCall, res = call('sdCryptoRelayToken', keyHex, body)
        if okCall and type(res) == 'string' and res ~= '' then
            nodeMints = true
            return #res <= MAX_TOKEN_CHARS and res or nil
        end
        -- A helper that answers nothing for a key it should accept is a helper without the export.
        nodeMints = false
    end

    local signing = PREFIX .. '.' .. b64url(body)
    local hex = tokens.hmacHex(keyHex, signing)
    if not hex then return nil end

    local token = signing .. '.' .. b64url(hexBytes(hex))
    return #token <= MAX_TOKEN_CHARS and token or nil
end

return tokens
