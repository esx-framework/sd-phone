---@type table sd-phone config root (configs/config.lua) - config.ApiKeys holds the CDN token.
local config = require 'configs.config'

---@type table Qbox CDN provider; the table returned at end of file.
local qbox = {}

---@type string This resource's name, used to reach the Node upload helper's exports.
local RESOURCE = GetCurrentResourceName()

---@type string Legacy convar name honoured when the config key is blank.
local CONVAR_KEY = 'sd_qbox_cdn_key'

---@type integer Seconds an in-flight upload may wait for the helper before it is given up on.
local TIMEOUT = 60

---@type boolean|nil Cached result of the helper probe; nil until first use.
local ready

---@type table<string, fun(url: string|nil, err: string|nil, code: string|nil)> Ticket -> the
---caller waiting on it. An upload is asynchronous, so the callback outlives the call that made it.
local waiting = {}

---@type integer Rolling counter behind each ticket, keeping them unique within a session.
local nextTicket = 0

---Calls one of the Node helper's exports, swallowing a missing runtime.
---@param name string export name
---@param ... any arguments
---@return boolean okCall, any result
local function call(name, ...)
    return pcall(function(...) return exports[RESOURCE][name](exports[RESOURCE], ...) end, ...)
end

---True when the Node upload helper answered. Probed once, then cached.
---@return boolean available
function qbox.available()
    if ready == nil then
        local okCall, res = call('sdUploadReady')
        ready = okCall and res == true
        if not ready then
            print('^1[sd-phone:photos]^0 Node upload helper did not load, so the Qbox CDN cannot be reached. Switch Provider back to \'fivemanage\' in configs/photos.lua.')
        end
    end
    return ready
end

---The Qbox CDN token: configs/server/apikeys.lua first, else the convar; read fresh every upload.
---@return string key the API token, or '' when unconfigured
function qbox.key()
    local k = (config.ApiKeys or {}).QboxCdn
    if type(k) == 'string' and k ~= '' then return k end
    return GetConvar(CONVAR_KEY, '')
end

---Whether a token is set either way round.
---@return boolean
function qbox.configured()
    return qbox.key() ~= ''
end

---Settles a waiting caller exactly once, whoever gets there first.
---@param ticket string
---@param url string|nil
---@param err string|nil
---@param code string|nil
local function settle(ticket, url, err, code)
    local cb = waiting[ticket]
    if not cb then return end
    waiting[ticket] = nil
    cb(url, err, code)
end

---Hands the outcome of a finished upload back to whoever asked for it.
AddEventHandler('sd-phone:server:upload:done', function(ticket, url, err, code)
    settle(tostring(ticket), url, err, code)
end)

---Uploads a base64 data-URL to the Qbox CDN and hands back the hosted URL. Asynchronous: calls
---`cb(url|nil, err, code)` exactly once.
---@param base64Image string media as a base64 data-URL
---@param filename string suggested filename stored alongside the upload
---@param cb fun(url: string|nil, err: string|nil, code: 'no-key'|'bad-data'|'provider'|nil)
function qbox.uploadMedia(base64Image, filename, cb)
    local key = qbox.key()

    if key == '' then
        print('^1[sd-phone:photos]^0 [UPLOAD] aborting: no Qbox CDN key. Set QboxCdn in configs/server/apikeys.lua, or the sd_qbox_cdn_key convar.')
        cb(nil, 'No Qbox CDN key configured on this server', 'no-key')
        return
    end

    if type(base64Image) ~= 'string' or base64Image == '' then
        print('^1[sd-phone:photos]^0 [UPLOAD] aborting: empty media payload')
        cb(nil, 'Empty media payload', 'bad-data')
        return
    end

    if not qbox.available() then
        cb(nil, 'The Qbox CDN uploader is unavailable on this server', 'provider')
        return
    end

    nextTicket = nextTicket + 1
    local ticket = ('%d'):format(nextTicket)
    waiting[ticket] = cb

    local okCall = call('sdUploadQbox', ticket, key, base64Image, filename or ('sdphone-%d.jpg'):format(os.time()))
    if not okCall then
        settle(ticket, nil, 'The Qbox CDN uploader could not be reached', 'provider')
        return
    end

    SetTimeout(TIMEOUT * 1000, function()
        settle(ticket, nil, 'The Qbox CDN did not answer in time', 'provider')
    end)
end

return qbox
