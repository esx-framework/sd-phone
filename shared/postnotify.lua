---@type table Post-notification module; the table returned at end of file. Resolves who a new
---Squawk post alerts, kept separate from the fan-out so the rule can be read and tested on its own.
local postnotify = {}

---Who a new post notifies, from the configured mode and the author's account.
---
---A protected author is always narrowed back to their followers. The notification carries a
---preview of the post body, so sending it server-wide would publish exactly what the protected
---flag exists to keep inside the follower list.
---@param mode any config.Birdy.PostNotifications: 'followers' | 'everyone' | false, or legacy true
---@param protected boolean|nil whether the author's account is protected
---@return string audience 'none' | 'followers' | 'everyone'
function postnotify.audience(mode, protected)
    if mode == false then return 'none' end
    if mode == 'everyone' and protected ~= true then return 'everyone' end
    return 'followers'
end

return postnotify
