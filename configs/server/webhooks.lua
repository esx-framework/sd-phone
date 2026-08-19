-- SERVER-ONLY DISCORD WEBHOOKS. Like configs/server/apikeys.lua next to it, this file is
-- deliberately NOT listed in fxmanifest files{} (which uses `configs/*.lua`, so it never matches
-- this subfolder), meaning the URLs stay on the server and never ship to a connected client. Keep
-- configs/server/ out of files{}; a broad glob like `configs/**.lua` would hand every webhook here
-- to anyone who joins. config.lua merges this in server-side only, reachable as config.Webhooks.
--
-- A webhook URL mirrors that app's new posts into a Discord channel: the text, the first image,
-- and who posted it. Leave a URL blank and that app sends nothing - the whole feature is off
-- until you fill one in, and the two apps are independent.
--
-- To create one: Discord -> Server Settings -> Integrations -> Webhooks -> New Webhook, pick the
-- channel, then Copy Webhook URL.
--
-- Posts are mirrored under the IN-GAME persona only: the handle and display name, never the
-- character name or citizenid. A channel fed by these is safe to leave public; it cannot be used
-- to work out which player is behind an account.
--
-- Only top-level posts are mirrored. Birdy replies, comments and likes are not.
-- Photogram posts from PRIVATE accounts are never mirrored: marking an account private is a
-- visibility choice the app honours, and relaying those to Discord would quietly undo it.
return {
    -- Birdy (the microblog). Blank = off.
    Birdy = '',

    -- Photogram (the photo feed). Blank = off.
    Photogram = '',

    -- What Discord shows as the sender. The webhook's own name/avatar are used when these are
    -- blank, so leaving them alone is fine.
    Username  = 'sd-phone',
    AvatarUrl = '',
}
