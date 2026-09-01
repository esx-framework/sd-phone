-- LIVE VIDEO RELAY. You almost certainly do not need this. Leave Enabled = false and everything
-- works: Photogram Live and Vibez Live both stream fine without it.
--
-- What it is for: those live broadcasts normally send their video through the game server. That is
-- fine for a few viewers. If you run big broadcasts and want the video to travel between players'
-- browsers instead of through the game, this sends it down a separate connection.
--
-- Turning it on needs a domain name with a working SSL certificate (https). There is no way around
-- that: the phone's screen is a web page, and browsers refuse insecure video connections. If you do
-- not have one, leave this off.
--
-- This is NOT the setting for video calls or voice. That is TURN, in configs/voice.lua.
-- This is NOT where photo uploads go. That is Provider in configs/photos.lua.
--
-- If you do turn it on, put these two lines in your server.cfg (never in this file, so a key cannot
-- end up in a git commit):
--     set sd_phone_relay_url "wss://media.example.com/ws"
--     set sd_phone_relay_key "paste-64-random-characters-here"
-- Generate the key with `openssl rand -hex 32`. The relay program in media-server/ needs the same
-- key as its SD_PHONE_RELAY_KEY environment variable. It is only used for this: it unlocks nothing
-- else on your server.
return {
    -- Off by default. Turn on only if you have the domain and certificate described above.
    Enabled = false,

    -- Run the relay inside this resource, so there is no separate program to install or keep
    -- running. Handy for testing on your own machine.
    --
    -- It still cannot give you a certificate. On a live server you need https in front of it and
    -- its address in sd_phone_relay_url, or players will not connect. Set this to false if you
    -- would rather run media-server/ on its own box.
    SelfHost = true,

    -- Which features use the relay. Turning one off does not break it, it just goes back to
    -- sending video through the game server like normal.
    --
    -- MDT bodycams are missing on purpose: the watching officer's screen draws the view in-game,
    -- so there is no video to relay in the first place.
    Features = {
        PhotogramLive = true,   -- Photogram Live broadcasts
        VibezLive     = true,   -- Vibez Live broadcasts
    },

    -- The settings below are fine as they are. Only change them if you know why you are.

    -- How long a viewer's pass to watch a stream lasts, in seconds (10 to 120). Kept short so that
    -- taking someone's permission away actually stops them watching, rather than waiting for a
    -- long pass to run out. The convar sd_phone_relay_ttl overrides this.
    TokenTtlSeconds = 45,

    -- How many seconds before a pass expires the phone quietly asks for a new one.
    RefreshLeadSeconds = 15,

    -- Let this server tell the relay to cut a stream off straight away, for example when an
    -- officer goes off duty. Turned off, a stream just lingers until its pass runs out.
    ControlChannel = true,

    -- The server.cfg setting names the URL and key are read from. Only change these if one of the
    -- names clashes with another resource on your server. The values themselves never live here.
    UrlConvar        = 'sd_phone_relay_url',
    KeyConvar        = 'sd_phone_relay_key',
    TtlConvar        = 'sd_phone_relay_ttl',
    ControlUrlConvar = 'sd_phone_relay_control_url',
}
