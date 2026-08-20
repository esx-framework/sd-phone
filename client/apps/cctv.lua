---@type table CCTV settings (configs/cctv.lua): the camera list and the framing.
local CFG = require 'configs.cctv'

---@type boolean Whether the section works at all.
local ENABLED = CFG.Enabled ~= false

---@type number Field of view every camera renders at.
local FOV = tonumber(CFG.Fov) or 62.0

---@type integer Milliseconds a dropped view keeps its streaming focus, so flicking between
---cameras does not tear the world down and build it again between each one.
local FOCUS_GRACE_MS = math.floor((tonumber(CFG.FocusGraceSeconds) or 3) * 1000)

---@type table<string, table> Cameras by id, so a request names one rather than sending coordinates
---the client would have to trust.
local CAMERAS = {}
for _, cam in ipairs(CFG.Cameras or {}) do
    if type(cam) == 'table' and type(cam.id) == 'string' then CAMERAS[cam.id] = cam end
end

---@type number|nil The scripted camera currently rendering, nil when the officer sees their own view.
local cam = nil

---@type string|nil Id of the camera being watched.
local active = nil

---@type boolean Whether the streaming focus is currently ours to clear.
local focused = false

---@type integer GetGameTimer at which an unwatched focus may be released.
local releaseAt = 0

---Points the scripted camera at one of the configured cameras. Reuses the camera object across a
---switch so the picture cuts rather than tearing down and rebuilding the render path.
---@param entry table camera definition
local function aim(entry)
    local at = entry.coords
    local look = entry.look

    if not cam then
        cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    end

    SetCamCoord(cam, at.x, at.y, at.z)
    PointCamAtCoord(cam, look.x, look.y, look.z)
    SetCamFov(cam, FOV)
end

---Streams the world around a camera. Without this a viewer standing across the map renders an empty
---lot: only the officer's own surroundings are loaded, and a scripted camera does not pull the map
---to it on its own.
---@param entry table camera definition
local function focus(entry)
    local at = entry.coords
    SetFocusPosAndVel(at.x, at.y, at.z, 0.0, 0.0, 0.0)
    focused = true
    releaseAt = 0
end

---Hands the view back to the officer and lets the world stream around them again.
local function release()
    if cam then
        RenderScriptCams(false, false, 0, true, true)
        DestroyCam(cam, true)
        cam = nil
    end
    active = nil
    if focused then
        ClearFocus()
        focused = false
    end
    releaseAt = 0
end

---Opens a camera, or switches to another one without dropping the view in between.
---@param id any camera id from configs/cctv.lua
---@return boolean opened
local function open(id)
    if not ENABLED or type(id) ~= 'string' then return false end
    local entry = CAMERAS[id]
    if not entry then return false end

    focus(entry)
    aim(entry)

    if not active then
        RenderScriptCams(true, false, 0, true, true)
    end
    active = id
    return true
end

RegisterNUICallback('sd-phone:cctv:list', function(_, cb)
    if not ENABLED then
        cb({ success = true, data = { enabled = false, cameras = {} } })
        return
    end

    local list = {}
    for i = 1, #(CFG.Cameras or {}) do
        local entry = CFG.Cameras[i]
        list[#list + 1] = { id = entry.id, label = entry.label, category = entry.category }
    end
    cb({ success = true, data = { enabled = true, cameras = list } })
end)

RegisterNUICallback('sd-phone:cctv:watch', function(data, cb)
    local id = type(data) == 'table' and data.cameraId or nil
    if type(id) ~= 'string' then
        cb({ success = false, message = 'No such camera' })
        return
    end

    -- The server decides, not this file. Everything here only moves the caller's own camera, but
    -- "only your own camera" still means seeing inside a bank from across the map, so the police
    -- gate has to be somewhere a tampered client cannot reach. It also writes the audit row.
    local res = lib.callback.await('sd-phone:server:mdt:cctv:watch', false, { cameraId = id })
    if type(res) ~= 'table' or res.success ~= true then
        cb({ success = false, message = type(res) == 'table' and res.message or 'Cameras are not available' })
        return
    end

    cb({ success = open(id), data = { cameraId = id } })
end)

RegisterNUICallback('sd-phone:cctv:close', function(_, cb)
    -- The focus outlives the camera by a moment: a viewer stepping back to the list and straight
    -- into another camera keeps the world it already streamed.
    if cam then
        RenderScriptCams(false, false, 0, true, true)
        DestroyCam(cam, true)
        cam = nil
    end
    active = nil
    releaseAt = GetGameTimer() + FOCUS_GRACE_MS
    cb({ success = true })
end)

---Drops a focus nobody came back for, and gives the view back if the phone closed mid-watch.
CreateThread(function()
    while true do
        Wait(500)
        if focused and not active and releaseAt > 0 and GetGameTimer() >= releaseAt then
            ClearFocus()
            focused = false
            releaseAt = 0
        end
    end
end)

---The phone closing mid-watch must hand the view back, or the officer is left staring through a
---camera with no way to leave it.
---@param open boolean
AddEventHandler('sd-phone:client:openState', function(open)
    if not open then release() end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then release() end
end)
