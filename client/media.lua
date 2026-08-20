---@type fun(nuiAction: string, serverEvent: string) NUI->server pass-through registrar (client.nui).
local proxyCallback = require 'client.nui'

-- The media relay's control plane, and only its control plane. Media itself never comes through
-- here: the browser talks to the relay directly over its own socket, which is the entire point of
-- having one. All the game side does is answer where the relay is and hand out the signed tokens
-- that say this player may open a particular stream.
proxyCallback('sd-phone:relay:endpoint', 'sd-phone:server:relay:endpoint')
proxyCallback('sd-phone:relay:token',    'sd-phone:server:relay:token')
