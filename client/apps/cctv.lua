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

---@type table Pan, tilt and zoom limits. A fixed camera swings within its mount rather than
---flying, so every one of these is a bound rather than a speed to be exceeded.
local CTL = type(CFG.Controls) == 'table' and CFG.Controls or {}
local LOOK_SPEED = tonumber(CTL.LookSpeed) or 1.35
local ZOOM_SPEED = tonumber(CTL.ZoomSpeed) or 2.2

---@type number Pan allowed each way from the resting aim on the camera currently open. At or above
---360 the camera spins freely and the angle wraps instead of stopping.
local panLimit = 360.0
---@type number Tilt allowed above the resting aim on the camera currently open.
local tiltUp = 22.0
---@type number Tilt allowed below the resting aim on the camera currently open.
local tiltDown = 34.0
---@type number Narrowest field of view the camera currently open will zoom to.
local zoomMin = 22.0
---@type number Widest field of view the camera currently open will zoom to.
local zoomMax = 70.0

---Reads one camera's limits, falling back to the shared Controls block for anything it does not
---name. Doing this per camera is what lets a dome on a bank ceiling spin while a camera bolted
---beside a doorway only covers the doorway.
---@param entry table camera definition
local function limitsFor(entry)
    panLimit = tonumber(entry.PanDegrees) or tonumber(CTL.PanDegrees) or 70.0
    tiltUp   = tonumber(entry.TiltUp)     or tonumber(CTL.TiltUp)     or 22.0
    tiltDown = tonumber(entry.TiltDown)   or tonumber(CTL.TiltDown)   or 34.0
    zoomMin  = tonumber(entry.ZoomMinFov) or tonumber(CTL.ZoomMinFov) or 22.0
    zoomMax  = tonumber(entry.ZoomMaxFov) or tonumber(CTL.ZoomMaxFov) or 70.0
end

---Whether the camera currently open spins without stops rather than hitting pan limits.
---@return boolean
local function freeSpin()
    return panLimit >= 360.0
end

---@type number Resting pitch of the camera, from where it is to what it looks at.
local basePitch = 0.0
---@type number Resting yaw of the camera.
local baseYaw = 0.0
---@type number Operator offset from the resting aim, in degrees.
local panOffset = 0.0
---@type number Operator offset above/below the resting aim, in degrees.
local tiltOffset = 0.0
---@type number Current field of view.
local fov = FOV

---@type number|nil The scripted camera currently rendering, nil when the officer sees their own view.
local cam = nil

---@type string|nil Id of the camera being watched.
local active = nil

---@type boolean Whether the streaming focus is currently ours to clear.
local focused = false

---@type integer GetGameTimer at which an unwatched focus may be released.
local releaseAt = 0

---@type boolean Whether the pan/tilt/zoom loop is running.
local controlling = false

---@type fun() Drops the camera and hands the phone back. Assigned below, once the pieces it needs
---exist, so the control loop can call it without the file having to be ordered around it.
local leaveCamera = function() end

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
    limitsFor(entry)

    -- Take the resting aim once by pointing at the target, read the rotation back, then RELEASE the
    -- point-at before driving the camera by rotation. PointCamAtCoord is not a one-shot aim: it puts
    -- the camera into a tracking mode that re-aims every frame and silently discards SetCamRot, so
    -- without StopCamPointing the operator's pan and tilt are written and thrown away.
    PointCamAtCoord(cam, look.x, look.y, look.z)
    local rot = GetCamRot(cam, 2)
    basePitch, baseYaw = rot.x, rot.z
    StopCamPointing(cam)
    SetCamRot(cam, basePitch, 0.0, baseYaw, 2)
    panOffset, tiltOffset = 0.0, 0.0
    fov = FOV
    SetCamFov(cam, fov)
end

---Applies the operator's pan, tilt and zoom on top of the camera's resting aim.
local function applyLook()
    if not cam then return end
    SetCamRot(cam, basePitch + tiltOffset, 0.0, baseYaw + panOffset, 2)
    SetCamFov(cam, fov)
end

---Clamps a value into a range.
---@param value number
---@param low number
---@param high number
---@return number
local function clamp(value, low, high)
    if value < low then return low end
    if value > high then return high end
    return value
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
    controlling = false
    if cam then
        RenderScriptCams(false, false, 0, true, true)
        DestroyCam(cam, true)
        cam = nil
    end
    if active then
        SendNUIMessage({ action = 'sd-phone:cctv:exit', data = {} })
        TriggerEvent('sd-phone:client:cameraCursor', true)
    end
    active = nil
    if focused then
        ClearFocus()
        focused = false
    end
    releaseAt = 0
end

---Runs while a camera is up: reads the look stick and the zoom, keeps the operator's own character
---still, and blocks the controls that would otherwise fire a weapon or open a menu behind the feed.
local function startControl()
    if controlling then return end
    controlling = true

    CreateThread(function()
        while controlling and active do
            -- 0 is the mouse/keyboard control group, 2 the "look" group.
            DisableControlAction(0, 1, true)   -- LookLeftRight
            DisableControlAction(0, 2, true)   -- LookUpDown
            DisableControlAction(0, 24, true)  -- Attack
            DisableControlAction(0, 25, true)  -- Aim
            DisableControlAction(0, 47, true)  -- Weapon
            DisableControlAction(0, 245, true) -- Chat
            DisablePlayerFiring(PlayerId(), true)

            local dx = GetDisabledControlNormal(0, 1)
            local dy = GetDisabledControlNormal(0, 2)

            if dx ~= 0.0 or dy ~= 0.0 then
                -- Zooming in narrows the swing, the way a real zoom makes a mount feel slower.
                local scale = LOOK_SPEED * (fov / zoomMax)
                local nextPan = panOffset - dx * scale * 10.0
                if freeSpin() then
                    -- Wrap rather than clamp, so the operator can keep spinning past the seam
                    -- instead of hitting an invisible stop at some arbitrary bearing.
                    panOffset = (nextPan + 180.0) % 360.0 - 180.0
                else
                    panOffset = clamp(nextPan, -panLimit, panLimit)
                end
                tiltOffset = clamp(tiltOffset - dy * scale * 8.0, -tiltDown, tiltUp)
                applyLook()
            end

            -- 177 is BACKSPACE/CANCEL. The phone has no input focus while a camera is up, so the
            -- way out has to be a game control rather than a button the operator cannot click.
            if IsDisabledControlJustPressed(0, 177) or IsDisabledControlJustPressed(0, 202) then
                leaveCamera()
                break
            end

            if IsDisabledControlJustPressed(0, 241) or IsDisabledControlJustPressed(0, 15) then
                fov = clamp(fov - ZOOM_SPEED, zoomMin, zoomMax)
                applyLook()
            elseif IsDisabledControlJustPressed(0, 242) or IsDisabledControlJustPressed(0, 14) then
                fov = clamp(fov + ZOOM_SPEED, zoomMin, zoomMax)
                applyLook()
            end

            Wait(0)
        end
        controlling = false
    end)
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

    local first = active == nil
    -- Set before the control loop starts: the loop runs while `active` is a camera, so starting it
    -- first meant it read nil on its opening check and exited before a single frame.
    active = id

    if first then
        RenderScriptCams(true, false, 0, true, true)
        -- The phone stays LOADED (it draws the overlay) but gives up input, so the operator can
        -- swing the camera with the same stick and mouse they move with. Hiding the handset is the
        -- NUI's job, not this file's: it is told below.
        SetNuiFocus(false, false)
        -- The shell owns NUI focus while the phone is open and will reclaim it the moment look mode
        -- ends. This is the flag it already honours for the Camera app releasing the cursor on
        -- purpose; without it the pointer is taken back and the camera stops responding.
        TriggerEvent('sd-phone:client:cameraCursor', false)
        startControl()
    end
    SendNUIMessage({ action = 'sd-phone:cctv:enter', data = {
        cameraId = entry.id,
        label    = entry.label,
        category = entry.category,
    } })
    return true
end

---Drops the camera, gives the phone its input back and tells the UI, keeping the streaming focus
---warm for a moment in case the operator steps straight into another camera.
leaveCamera = function()
    controlling = false
    if cam then
        RenderScriptCams(false, false, 0, true, true)
        DestroyCam(cam, true)
        cam = nil
    end
    if active then SendNUIMessage({ action = 'sd-phone:cctv:exit', data = {} }) end
    active = nil
    releaseAt = GetGameTimer() + FOCUS_GRACE_MS
    TriggerEvent('sd-phone:client:cameraCursor', true)
    SetNuiFocus(true, true)
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
    leaveCamera()
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
