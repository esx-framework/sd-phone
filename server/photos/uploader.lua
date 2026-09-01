---@type table sd-phone config root (configs/config.lua) - config.ApiKeys holds the media token.
local config = require 'configs.config'

---@type table Qbox CDN provider (server.photos.qbox): the multipart route through the Node helper.
local qbox = require 'server.photos.qbox'

---@type table Uploader module; the table returned at end of file.
local uploader = {}

---@type table Photos config (configs/photos.lua): which CDN the uploads go to.
local PHOTOS = type(config.Photos) == 'table' and config.Photos or {}

-- Response shape: { data = { id, url }, status = "ok" }.
---@type string Fivemanage media upload endpoint (v3 base64 route).
local UPLOAD_URL = 'https://api.fivemanage.com/api/v3/file/base64'

-- Media key: configs/server/apikeys.lua (FivemanageMedia), else the legacy convar below.
---@type string Legacy convar name still honoured when the config key is blank.
local CONVAR_KEY = 'sd_fivemanage_key'

---Returns the Fivemanage Media token: configs/server/apikeys.lua first, else the legacy
---convar; read fresh on every upload.
---@return string key the media token, or '' when unconfigured
local function mediaKey()
    local k = (config.ApiKeys or {}).FivemanageMedia
    if type(k) == 'string' and k ~= '' then return k end
    return GetConvar(CONVAR_KEY, '')
end

---Which CDN this server uploads to. Anything other than 'qbox' stays on Fivemanage, so a typo
---never silently sends media somewhere the owner did not choose.
---@return 'fivemanage'|'qbox'
function uploader.provider()
    return tostring(PHOTOS.Provider or 'fivemanage'):lower() == 'qbox' and 'qbox' or 'fivemanage'
end

---True when the active provider has a token set. Read at boot so a server missing its key is
---told once at startup, instead of every player discovering it as a capture that never lands.
---@return boolean
function uploader.configured()
    if uploader.provider() == 'qbox' then return qbox.configured() end
    return mediaKey() ~= ''
end

---Uploads a base64 data-URL to Fivemanage and hands back the hosted CDN URL. Asynchronous:
---calls `cb(url|nil, err, code)` exactly once. `err` is the human sentence the recording and
---bodycam UIs already surface; `code` is a stable token the phone maps to a translated line, so
---a caller can localise the reason without matching on English prose.
---@param base64Image string media as a base64 data-URL (data:image/...;base64,...)
---@param filename string suggested filename stored alongside the upload
---@param cb fun(url: string|nil, err: string|nil, code: 'no-key'|'bad-data'|'provider'|nil)
local function uploadFivemanage(base64Image, filename, cb)
    local key = mediaKey()

    if key == '' then
        print('^1[sd-phone:photos]^0 [UPLOAD] aborting: no Fivemanage media key. Set FivemanageMedia in configs/server/apikeys.lua, or the sd_fivemanage_key convar.')
        cb(nil, 'No Fivemanage media key configured on this server', 'no-key')
        return
    end

    if type(base64Image) ~= 'string' or base64Image == '' then
        print('^1[sd-phone:photos]^0 [UPLOAD] aborting: empty media payload')
        cb(nil, 'Empty media payload', 'bad-data')
        return
    end


    local body = json.encode({
        base64   = base64Image,
        filename = filename or ('sdphone-%d.jpg'):format(os.time()),
    })


    PerformHttpRequest(UPLOAD_URL, function(status, responseBody, _headers)

        -- Each branch reports the same 'provider' code to the player, who can act on none of
        -- them, while the console line names the one that actually happened.
        if status ~= 200 and status ~= 201 then
            print(('^1[sd-phone:photos]^0 [UPLOAD] Fivemanage rejected the upload: HTTP %s %s')
                :format(tostring(status), tostring(responseBody)))
            cb(nil, ('Fivemanage upload failed: HTTP %s'):format(tostring(status)), 'provider')
            return
        end

        if not responseBody or responseBody == '' then
            print('^1[sd-phone:photos]^0 [UPLOAD] Fivemanage returned an empty response body')
            cb(nil, 'Empty response from Fivemanage', 'provider')
            return
        end

        local okJson, decoded = pcall(json.decode, responseBody)
        if not okJson or type(decoded) ~= 'table' then
            print(('^1[sd-phone:photos]^0 [UPLOAD] unparseable Fivemanage response: %s')
                :format(tostring(responseBody)))
            cb(nil, 'Could not parse the Fivemanage response', 'provider')
            return
        end

        local url = type(decoded.data) == 'table' and decoded.data.url or nil
        if type(url) ~= 'string' or url == '' then
            print(('^1[sd-phone:photos]^0 [UPLOAD] Fivemanage returned no URL: %s'):format(tostring(responseBody)))
            cb(nil, 'Fivemanage returned no URL', 'provider')
            return
        end

        cb(url, nil)
    end, 'POST', body, {
        ['Content-Type']  = 'application/json',
        ['Authorization'] = key,
    })
end

---Uploads a base64 data-URL to whichever CDN this server is set to and hands back the hosted URL.
---Asynchronous: calls `cb(url|nil, err, code)` exactly once.
---@param base64Image string media as a base64 data-URL (data:image/...;base64,...)
---@param filename string suggested filename stored alongside the upload
---@param cb fun(url: string|nil, err: string|nil, code: 'no-key'|'bad-data'|'provider'|nil)
function uploader.uploadMedia(base64Image, filename, cb)
    if uploader.provider() == 'qbox' then
        qbox.uploadMedia(base64Image, filename, cb)
        return
    end
    uploadFivemanage(base64Image, filename, cb)
end

return uploader
