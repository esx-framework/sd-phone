---@type table CCTV settings (configs/cctv.lua), read so a placed camera inherits the live framing.
local CFG = require 'configs.cctv'

---@type number Field of view the placement preview uses, matching what an operator will see.
local FOV = tonumber(CFG.Fov) or 100.0

---@type number Metres the free camera moves per frame at full deflection.
local MOVE_SPEED = 0.18

---@type number Extra multiplier while the sprint control is held.
local FAST = 3.2

---@type number|nil The placement camera, nil when the tool is closed.
local cam = nil

---@type vector3 Where the placement camera sits.
local pos = vector3(0.0, 0.0, 0.0)

---@type number Placement camera pitch.
local pitch = 0.0

---@type number Placement camera yaw.
local yaw = 0.0

---The point eight metres in front of the placement camera, which is what a camera entry aims at.
---@return vector3
local function aimPoint()
    local p = math.rad(pitch)
    local y = math.rad(yaw)
    local cosP = math.cos(p)
    return vector3(-math.sin(y) * cosP, math.cos(y) * cosP, math.sin(p)) * 8.0
end

---Prints one camera's entry in the exact shape configs/cctv.lua expects, ready to paste. Console
---rather than a file write: this is an authoring tool, and a resource that rewrites its own config
---while the server is live is a worse idea than copying two lines.
local function dump()
    local look = pos + (aimPoint())
    print('^2[cctv]^0 paste into configs/cctv.lua:')
    print(("        { id = 'CHANGE_ME', label = 'CHANGE ME', category = 'Bank',"))
    print(("          coords = vec3(%.2f, %.2f, %.2f), look = vec3(%.2f, %.2f, %.2f) },")
        :format(pos.x, pos.y, pos.z, look.x, look.y, look.z))
end

---Closes the tool and hands the view back.
local function stop()
    if not cam then return end
    RenderScriptCams(false, false, 0, true, true)
    DestroyCam(cam, true)
    cam = nil
    ClearFocus()
    SetEntityVisible(PlayerPedId(), true, false)
    FreezeEntityPosition(PlayerPedId(), false)
end

---Opens a free camera the placer flies to where a security camera should hang, then reads the
---position and aim straight out of it. Placing by eye beats deriving a position from a shop's
---counter: a camera wants a ceiling corner, and only a human can see where that is.
local function start()
    if cam then stop() return end

    local ped = PlayerPedId()
    pos = GetEntityCoords(ped) + vector3(0.0, 0.0, 1.0)
    local rot = GetGameplayCamRot(2)
    pitch, yaw = rot.x, rot.z

    cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    SetCamCoord(cam, pos.x, pos.y, pos.z)
    SetCamRot(cam, pitch, 0.0, yaw, 2)
    SetCamFov(cam, FOV)
    RenderScriptCams(true, false, 0, true, true)
    FreezeEntityPosition(ped, true)
    SetEntityVisible(ped, false, false)

    print('^2[cctv]^0 placement camera open. WASD to fly, SHIFT for faster, mouse to aim, ENTER to print the entry, BACKSPACE to close.')

    CreateThread(function()
        while cam do
            DisableControlAction(0, 1, true)
            DisableControlAction(0, 2, true)
            DisableControlAction(0, 24, true)
            DisableControlAction(0, 25, true)

            yaw = yaw - GetDisabledControlNormal(0, 1) * 8.0
            pitch = math.max(-89.0, math.min(89.0, pitch - GetDisabledControlNormal(0, 2) * 8.0))

            local speed = MOVE_SPEED * (IsDisabledControlPressed(0, 21) and FAST or 1.0)
            local forward = aimPoint() / 8.0
            local right = vector3(math.cos(math.rad(yaw)), math.sin(math.rad(yaw)), 0.0)

            if IsDisabledControlPressed(0, 32) then pos = pos + forward * speed end
            if IsDisabledControlPressed(0, 33) then pos = pos - forward * speed end
            if IsDisabledControlPressed(0, 34) then pos = pos - right * speed end
            if IsDisabledControlPressed(0, 35) then pos = pos + right * speed end
            if IsDisabledControlPressed(0, 44) then pos = pos + vector3(0.0, 0.0, speed) end
            if IsDisabledControlPressed(0, 36) then pos = pos - vector3(0.0, 0.0, speed) end

            SetCamCoord(cam, pos.x, pos.y, pos.z)
            SetCamRot(cam, pitch, 0.0, yaw, 2)
            SetFocusPosAndVel(pos.x, pos.y, pos.z, 0.0, 0.0, 0.0)

            if IsDisabledControlJustPressed(0, 191) then dump() end
            if IsDisabledControlJustPressed(0, 177) then stop() break end

            Wait(0)
        end
    end)
end

RegisterCommand('cctvplace', start, false)

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then stop() end
end)
