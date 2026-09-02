---@type table Boot reporter (server.boot): one console summary instead of per-module prints.
local boot       = require 'server.boot'
---@type table Voicemail persistence layer (server.voicemail.store): per-message row CRUD.
local store      = require 'server.voicemail.store'
---@type table Authoritative voicemail handlers (server.voicemail.actions): validation + delivery.
local actions    = require 'server.voicemail.actions'
---@type table Media uploader (server.photos.uploader): base64 to a hosted CDN URL, shared with
---Photos and Voice Memos; the API key never leaves the server.
local uploader   = require 'server.photos.uploader'
---@type table Shared media-upload budget (server.photos.mediaLimit): cooldown + rolling byte cap.
local mediaLimit = require 'server.photos.mediaLimit'
---@type table Player bridge (bridge.server.player): citizenid for the shared upload budget.
local player     = require 'bridge.server.player'
---@type table Shared server helpers (server.util): the ok/fail envelopes.
local util       = require 'server.util'

---@type integer Largest base64 payload accepted, before the per-character budget is consulted.
---A minute of Opus is well under a megabyte; this only bounds a client that sends something else.
local MAX_AUDIO_BYTES <const> = 8 * 1024 * 1024

---@type table<number, boolean> Srcs with an upload in flight, so one player cannot pile them up.
local uploading = {}

---Drops a departing player's in-flight upload marker.
AddEventHandler('playerDropped', function() uploading[source] = nil end)

---Bootstraps the voicemails schema once at boot.
CreateThread(function()
    local okSchema, err = pcall(store.ensureSchema)
    if not okSchema then
        boot.schemaFailed('voicemail', err)
        return
    end
    boot.schemaReady()
end)

-- NUI callbacks: thin delegates into server.voicemail.actions; payloads are type-guarded here.
lib.callback.register('sd-phone:server:voicemail:list',   function(src) return actions.list(src) end)
lib.callback.register('sd-phone:server:voicemail:seen',   function(src) return actions.seen(src) end)
lib.callback.register('sd-phone:server:voicemail:leave',  function(src, payload) return actions.leave(src, payload) end)
lib.callback.register('sd-phone:server:voicemail:delete', function(src, payload)
    return actions.delete(src, type(payload) == 'table' and payload.id or nil)
end)

---Whether this server can host a recording at all, so the call screen only offers to take a
---voicemail when there is somewhere to put it. Answered in the standard envelope, which the NUI
---reads through apiData: anything without `success` reads as "off" however the server is set up.
lib.callback.register('sd-phone:server:voicemail:enabled', function()
    return util.ok({ enabled = uploader.configured() })
end)

---Hosts a finished voicemail recording and hands the caller back its URL, which they then pass to
---`voicemail:leave`. Split in two rather than uploading and delivering in one call because the
---URL is what makes a message re-sendable: a delivery refused for a full mailbox or a rate limit
---does not have to pay for the upload twice.
---@param src number player server id
---@param payload table { audio: string } base64 audio data-URL from the NUI recorder
---@return table result { success, message?, data = { url } }
lib.callback.register('sd-phone:server:voicemail:upload', function(src, payload)
    payload = type(payload) == 'table' and payload or {}
    local audio = payload.audio

    if type(audio) ~= 'string' or not lib.string.startsWith(audio, 'data:audio/') then
        return util.fail('voicemail.badAudio', 'Bad audio payload')
    end
    if #audio > MAX_AUDIO_BYTES then
        return util.fail('voicemail.recordingTooLong', 'Recording is too long')
    end
    if uploading[src] then
        return util.fail('voicemail.uploadInProgress', 'Upload already in progress')
    end

    local okLimit, why = mediaLimit.check(player.getIdentifier(src), #audio)
    if not okLimit then
        return why == 'cooldown'
            and util.fail('voicemail.slowDownMoment', 'Slow down a moment')
            or util.fail('voicemail.uploadLimitReached', 'Upload limit reached, try again later')
    end

    local ext = audio:find('^data:audio/mpeg') and 'mp3'
        or audio:find('^data:audio/ogg') and 'ogg'
        or audio:find('^data:audio/wav') and 'wav'
        or 'webm'
    local filename = ('sdphone-voicemail-%d-%d.%s'):format(src, os.time(), ext)

    uploading[src] = true
    local done = promise.new()
    uploader.uploadMedia(audio, filename, function(url, err) done:resolve({ url = url, err = err }) end)
    local result = Citizen.Await(done)
    uploading[src] = nil

    if not result.url then
        print(('^1[sd-phone:voicemail]^0 upload failed: %s'):format(tostring(result.err)))
        return util.fail('voicemail.uploadFailed', 'Upload failed')
    end
    return util.ok({ url = result.url })
end)
