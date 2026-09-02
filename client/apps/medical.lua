---@type fun(nuiAction: string, serverEvent: string) NUI->server pass-through registrar (client.nui).
local proxyCallback = require 'client.nui'

---@type string[] NUI action suffixes proxied 1:1 to sd-phone:server:medical:<action>.
local ACTIONS = { 'get', 'set', 'lookup' }

-- Thin delegates into server/medical.
for _, action in ipairs(ACTIONS) do
    proxyCallback('sd-phone:medical:' .. action, 'sd-phone:server:medical:' .. action)
end
