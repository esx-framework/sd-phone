-- Photos / Camera. The Camera app renders the live game view into a NUI canvas (vendored
-- three.js + CfxTexture in web/src/render/) for a first-person viewfinder. The shutter
-- grabs that canvas as a base64 data-URL and sends it to the server over a latent event
-- (server/photos/init.lua), which uploads it to Fivemanage and stores only the returned
-- CDN URL in `phone_photos`.
--
-- The Fivemanage Media key is read SERVER-SIDE so it never reaches clients: set FivemanageMedia
-- in configs/server/apikeys.lua (that file is excluded from fxmanifest files{}). A blank config
-- value still falls back to the legacy `sd_fivemanage_key` server convar. Create a "Media" token
-- at https://app.fivemanage.com.
return {
    -- Which CDN uploads go to: 'fivemanage' or 'qbox'.
    --
    -- 'fivemanage' uses the Fivemanage Media token (FivemanageMedia in configs/server/apikeys.lua,
    -- or the legacy sd_fivemanage_key convar).
    --
    -- 'qbox' uses the Qbox Dashboard CDN (QboxCdn in configs/server/apikeys.lua, or the
    -- sd_qbox_cdn_key convar). Generate the token at https://dashboard.qbox.re -> CDN -> API.
    -- Anything other than 'qbox' stays on Fivemanage, so a typo never quietly moves your media.
    Provider = 'fivemanage',

    -- JPEG quality (0.0 - 1.0). 0.85 matches NPWD's default and balances
    -- file size against visible compression artefacts.
    Quality = 0.85,

    -- Per-player retention cap. Once exceeded, oldest photos are pruned to
    -- keep the row count bounded.
    MaxPhotosPerPlayer = 200,

    -- Per-player cap on custom albums (Recents + Favourites are always-present
    -- standard albums and don't count toward this).
    MaxAlbumsPerPlayer = 50,

    -- Album-name length bounds. Max mirrors the React `<input maxLength>` so
    -- client and server agree.
    MinAlbumNameLength = 1,
    MaxAlbumNameLength = 40,

    -- Player URL import (the Import button in Photos). Imported URLs are stored and rendered
    -- as-is, NOT re-hosted, so every phone that shows the picture fetches it from that host. A
    -- hostile host would learn the IP address of each viewer, which is why only the hosts in
    -- ImportAllowlist are accepted: large image CDNs behind their own edge network, where the
    -- uploader never sees who views the file. Camera uploads are unaffected because their URL
    -- comes from the server uploader.
    AllowImport = true, -- master switch; false disables URL import and hides the button.

    -- Hosts to always reject. Exact hostnames, or '*.domain.com' for every subdomain.
    -- IP loggers and URL shorteners belong here: a shortener can redirect an otherwise
    -- fine-looking link to anywhere, and the viewer's client would follow it.
    ImportBlocklist = {
        'grabify.link', '*.grabify.link',
        'iplogger.org', '*.iplogger.org',
        'bit.ly', 'tinyurl.com', 't.co',
    },

    -- ONLY these hosts may be imported (the blocklist still applies on top). An empty list
    -- rejects every import instead of trusting the whole internet. '*.domain.com' matches the
    -- bare domain and every subdomain. Add a host only if its images are served by the platform
    -- itself, never by the person who uploaded them.
    ImportAllowlist = {
        '*.imgur.com',
        '*.discordapp.com', '*.discordapp.net', -- note: Discord attachment links expire after roughly a day
        '*.fivemanage.com',
        '*.ibb.co',
        '*.postimg.cc',
        '*.gyazo.com',
        '*.redd.it',
        '*.giphy.com',
        '*.tenor.com',
        '*.twimg.com',
        '*.pinimg.com',
        '*.githubusercontent.com',
        '*.googleusercontent.com',
        '*.unsplash.com',
        '*.pexels.com',
        '*.wikimedia.org',
    },
}
