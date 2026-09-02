---@type fun(nuiAction: string, serverEvent: string) NUI->server pass-through registrar (client.nui).
local proxy = require 'client.nui'
---@type table Job bridge (bridge.client.job): live job name/grade off the framework's own events.
local job = require 'bridge.client.job'

-- Thin delegates into server/weazelnews: the public feed plus the boss-gated newsroom
-- (article CRUD, the breaking ticker).
proxy('sd-phone:weazelnews:feed',        'sd-phone:server:weazelnews:feed')
proxy('sd-phone:weazelnews:watch',       'sd-phone:server:weazelnews:watch')
proxy('sd-phone:weazelnews:view',        'sd-phone:server:weazelnews:view')
proxy('sd-phone:weazelnews:save',        'sd-phone:server:weazelnews:save')
proxy('sd-phone:weazelnews:delete',      'sd-phone:server:weazelnews:delete')
proxy('sd-phone:weazelnews:reschedule',  'sd-phone:server:weazelnews:reschedule')
proxy('sd-phone:weazelnews:publishNow',  'sd-phone:server:weazelnews:publishNow')
proxy('sd-phone:weazelnews:setBreaking', 'sd-phone:server:weazelnews:setBreaking')

-- The newsroom gate rides on the feed, which the app reads once when it mounts, and the switcher
-- keeps that instance alive across a close. Server pushes only ever follow a content change, so a
-- player hired onto (or fired from) a news job would hold the old gate until the app was killed
-- from the switcher. Every job change replays the push the app already refetches on.
job.onChange(function()
    SendNUIMessage({ action = 'sd-phone:weazelnews:feed', data = { type = 'job' } })
end)
