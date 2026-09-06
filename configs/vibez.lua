-- Vibez app. The feed, profiles and comments are server-backed and need no tuning here; the
-- knobs below only govern Live video - the broadcaster encodes its camera view to a real video
-- stream (VP8/VP9) and the server (server/vibez/live.lua) relays it to viewers.
return {
    Live = {
        -- Whether players can broadcast at all. Off by default: a live stream relays real
        -- video through your server, so it costs bandwidth on every viewer. With this off
        -- the Go LIVE action is hidden from the app and the server refuses to start one.
        Enabled           = false,

        -- Concurrent viewers allowed on one stream (0 = unlimited). Each viewer costs
        -- ~Bitrate of server uplink, so this is the main protection knob on large servers.
        MaxViewers        = 50,

        -- Target video encode bitrate, bits/s. Higher = sharper but more bandwidth per
        -- viewer. ~900 kbps is a good 540p balance.
        Bitrate           = 900000,

        -- Broadcaster capture/encode frame rate.
        Fps               = 25,

        -- How often (ms) the encoder emits a chunk. Lower = lower latency, slightly
        -- more overhead.
        TimesliceMs       = 250,

        -- The broadcaster re-anchors the stream this often (ms) so people joining
        -- mid-stream get a clean picture quickly. Lower = faster joins but marginally
        -- less efficient.
        KeyframeMs        = 4000,

        -- Per-viewer latent send ceiling (bytes/s) the server uses to pace each chunk
        -- onto the wire without slamming the net thread.
        RelayBytesPerSec  = 512 * 1024,
    },
}
