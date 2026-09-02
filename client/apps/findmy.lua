---@type fun(nuiAction: string, serverEvent: string) NUI->server pass-through registrar (client.nui).
local proxyCallback = require 'client.nui'

-- Thin delegates into server/findmy: the device list and everything the owner can do to a device
-- from another one, plus the lock-screen passcode check a device in Lost Mode runs.
proxyCallback('sd-phone:findmy:list',      'sd-phone:server:findmy:list')
proxyCallback('sd-phone:findmy:playSound', 'sd-phone:server:findmy:playSound')
proxyCallback('sd-phone:findmy:setLost',   'sd-phone:server:findmy:setLost')
proxyCallback('sd-phone:findmy:clearLost', 'sd-phone:server:findmy:clearLost')
proxyCallback('sd-phone:findmy:erase',     'sd-phone:server:findmy:erase')
proxyCallback('sd-phone:findmy:unlock',    'sd-phone:server:findmy:unlock')

---Tells the server a device's screen went up or down, which is what records a sighting and, on
---the way up, replays Lost Mode onto a phone that was marked lost while nobody held it.
---@param kind string 'phone' | 'tablet'
---@param on boolean whether the screen is now up
local function report(kind, on)
    TriggerServerEvent('sd-phone:server:findmy:presence', kind, on)
end

---This phone opening and closing.
---@param open boolean
AddEventHandler('sd-phone:client:openState', function(open)
    report('phone', open == true)
end)

---A companion device (sd-tablet) taking or releasing the screen. One client serves both devices,
---so this is the only place the tablet's own open and close are visible.
---@param open boolean
AddEventHandler('sd-phone:client:companionState', function(open)
    report('tablet', open == true)
end)

---Server push: Lost Mode turned on or off for one of the player's devices. `kind` rides along so
---the phone and the tablet each ignore the other's push, since a companion mirrors every message.
---@param data table { kind: string, on: boolean, message?: string, contact?: string, unlock?: string, pinLength?: number }
RegisterNetEvent('sd-phone:client:findmy:lost', function(data)
    SendNUIMessage({ action = 'sd-phone:findmy:lost', data = data })
end)

---Server push: ring this device so its owner can hear where it is.
---@param data table { kind: string, seconds: number }
RegisterNetEvent('sd-phone:client:findmy:sound', function(data)
    SendNUIMessage({ action = 'sd-phone:findmy:sound', data = data })
end)
