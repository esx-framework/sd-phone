---@type fun(nuiAction: string, serverEvent: string) NUI->server pass-through registrar (client.nui).
local proxyCallback = require 'client.nui'

-- Thin delegates into server/voicemail. `upload` blocks for as long as the CDN takes, which is
-- why the recorder shows its own progress state until the envelope comes back.
proxyCallback('sd-phone:voicemail:list',    'sd-phone:server:voicemail:list')
proxyCallback('sd-phone:voicemail:seen',    'sd-phone:server:voicemail:seen')
proxyCallback('sd-phone:voicemail:delete',  'sd-phone:server:voicemail:delete')
proxyCallback('sd-phone:voicemail:leave',   'sd-phone:server:voicemail:leave')
proxyCallback('sd-phone:voicemail:upload',  'sd-phone:server:voicemail:upload')
proxyCallback('sd-phone:voicemail:enabled', 'sd-phone:server:voicemail:enabled')

---Server push: someone left us a voicemail. Relays the row so the Voicemail tab can show it
---without a refetch.
---@param vm table voicemail record from server/voicemail
RegisterNetEvent('sd-phone:client:voicemail:new', function(vm)
    SendNUIMessage({ action = 'sd-phone:voicemail:new', data = vm })
end)
