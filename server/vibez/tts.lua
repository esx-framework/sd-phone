---@type table sd-phone config root (configs/config.lua).
local config   = require 'configs.config'
---@type table Media uploader (server.photos.uploader): base64 -> hosted CDN URL, provider-agnostic.
local uploader = require 'server.photos.uploader'

---@type table Clout TTS knobs (configs/vibez.lua TTS): Enabled, Endpoint, Voices.
local CFG = (config.Vibez and config.Vibez.TTS) or {}
---@type boolean Whether text to speech is offered at all.
local ENABLED = CFG.Enabled == true
---@type string The relay that turns {text, voice} into base64 audio.
local ENDPOINT = (type(CFG.Endpoint) == 'string' and CFG.Endpoint ~= '' and CFG.Endpoint)
    or 'https://tiktok-tts.weilnet.workers.dev/api/generation'
---@type integer Longest spoken line accepted, matching the composer's own cap.
local MAX_LEN = 300

---@type table<string, boolean> Every voice code the config offers, for validating what a client asks for.
local VOICES = {}
for _, v in ipairs(CFG.Voices or {}) do
    if type(v) == 'table' and type(v[2]) == 'string' then VOICES[v[2]] = true end
end

---@type table Clout TTS module; the table returned at end of file.
local tts = {}

---@type table<integer, { text: string, voice: string, url: string }> The last clip each player
---generated in the composer preview, reused by the post so a previewed voice is not made twice.
local recent = {}

---Normalises a line the same way generation does, so a cache key matches what was actually spoken.
---@param text any
---@return string
local function keyText(text)
    text = type(text) == 'string' and text or ''
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    if #text > MAX_LEN then text = text:sub(1, MAX_LEN) end
    return text
end

---Whether text to speech is switched on.
---@return boolean
function tts.enabled() return ENABLED end

---Whether a voice code is one the config offers, so a client cannot ask for an arbitrary one.
---@param code any
---@return boolean
function tts.voiceValid(code) return type(code) == 'string' and VOICES[code] == true end

---Turns a line of text into a hosted audio clip: asks the endpoint for base64 audio, then uploads
---it through the shared media uploader. Blocking, so it runs inside a callback coroutine; a failure
---returns nil and the caller carries on without a voiceover rather than failing the whole post.
---@param text string what to speak
---@param voice string a voice code from the config
---@return string|nil url hosted audio URL, nil on any failure
function tts.generate(text, voice)
    if not ENABLED then return nil end
    if not tts.voiceValid(voice) then return nil end
    text = type(text) == 'string' and text or ''
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    if text == '' then return nil end
    if #text > MAX_LEN then text = text:sub(1, MAX_LEN) end

    local gen = promise.new()
    PerformHttpRequest(ENDPOINT, function(status, body)
        if status ~= 200 or type(body) ~= 'string' or body == '' then gen:resolve(nil); return end
        local okj, decoded = pcall(json.decode, body)
        local data = okj and type(decoded) == 'table' and decoded.data
        gen:resolve((type(data) == 'string' and #data > 0) and data or nil)
    end, 'POST', json.encode({ text = text, voice = voice }), { ['Content-Type'] = 'application/json' })

    local base64 = Citizen.Await(gen)
    if not base64 then
        print('^3[sd-phone:vibez]^0 TTS generation failed; the post is uploaded without a voiceover.')
        return nil
    end

    local up = promise.new()
    uploader.uploadMedia('data:audio/mpeg;base64,' .. base64,
        ('clout-tts-%d.mp3'):format(math.random(100000, 999999)),
        function(url) up:resolve(url) end)
    local url = Citizen.Await(up)
    if type(url) ~= 'string' or url == '' then
        print('^3[sd-phone:vibez]^0 TTS audio could not be uploaded; the post is kept without a voiceover.')
        return nil
    end
    return url
end

---Remembers the clip a player just previewed, so posting the same text and voice reuses it.
---@param src integer player server id
---@param text string
---@param voice string
---@param url string hosted audio URL
function tts.remember(src, text, voice, url)
    recent[src] = { text = keyText(text), voice = voice, url = url }
end

---The URL a player already generated for this exact text and voice, or nil when none matches.
---@param src integer player server id
---@param text string
---@param voice string
---@return string|nil
function tts.cachedFor(src, text, voice)
    local r = recent[src]
    if r and r.voice == voice and r.text == keyText(text) then return r.url end
    return nil
end

---Drops a player's remembered clip (on post, or when they disconnect).
---@param src integer player server id
function tts.forget(src) recent[src] = nil end

return tts
