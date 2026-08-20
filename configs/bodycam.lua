-- Police bodycams and vehicle dashcams, watched from the MDT's Cameras section.
--
-- There is no second video stack here: an officer's own client encodes the view it is
-- already rendering and the server relays it to the terminals watching, exactly the way
-- Photogram Live relays a broadcast. The important consequence is that a camera costs
-- nothing at all until somebody opens it - no encoder, no readback, no bandwidth - and
-- the officer's client is told to start only once a viewer is actually attached.
--
-- Because the capture is the officer's own rendered frame, a bodycam shows what the
-- officer sees, from whatever camera they are playing on. A dashcam is the same feed,
-- labelled with the vehicle they are sitting in. FirstPerson below can force them into
-- first person while watched, but it is off by default: see the note on that setting.
return {
    -- Whether the Cameras section works at all. Off by default: every viewer costs roughly
    -- the profile bitrate of server uplink, the same as a live stream.
    Enabled = false,

    -- Framework jobs that carry a bodycam. Leave empty to mean "every police department in
    -- configs/mdt.lua". A job that is not a police department never gets a camera whatever
    -- is listed here, because the Cameras section is police-only on the server.
    Jobs = { 'police', 'bcso', 'sasp' },

    -- Whether an officer must be on duty to appear in the grid.
    RequireDuty = true,

    -- Put a broadcasting officer into first person for as long as they are being watched, and
    -- restore the view they had when the last viewer leaves.
    --
    -- OFF by default, and think before turning it on: the capture is the officer's own rendered
    -- frame, so this does not change the camera for the viewer, it changes it for the OFFICER,
    -- mid-roleplay, because somebody opened their tile. Left off, the feed is simply whatever
    -- camera they are playing on, which is the honest reading of a body-worn camera anyway.
    FirstPerson = false,

    Dashcam = {
        -- Whether an occupied police vehicle gets its own tile in the grid.
        Enabled = true,

        -- Vehicle models that carry a dashcam. Matched on the server against the model the
        -- officer is actually sitting in, so this is the authoritative list.
        Models = {
            'police', 'police2', 'police3', 'police4', 'policeb', 'policet',
            'sheriff', 'sheriff2', 'fbi', 'fbi2', 'riot', 'pranger', 'polmav',
        },

        -- Vehicle classes that carry a dashcam as well (18 is Emergency). A class can only be
        -- read on the client, so this is reported by the officer's own game rather than read
        -- from the vehicle server-side: it decides which tile appears, never who may watch.
        Classes = { 18 },
    },

    -- The grid thumbnail profile. Deliberately tiny: opening the Cameras section attaches
    -- one preview to every unit on the grid at once, so this figure is multiplied by the
    -- number of officers on duty.
    Preview = {
        -- Whether the grid streams live thumbnails at all. With this off the tiles render as
        -- offline cards and a feed is only established when an officer is opened full screen.
        Enabled = true,
        Fps     = 5,
        Width   = 384,
        Bitrate = 220000,
    },

    -- The full-screen profile, established only for the one camera an officer opened. Only ever
    -- one of these runs per viewer, so it can afford to be a real picture rather than a thumbnail.
    -- Width is capped by the broadcasting officer's own game resolution: asking for more than they
    -- render buys nothing but bitrate.
    Fullscreen = {
        Fps     = 30,
        Width   = 1600,
        Bitrate = 8000000,
    },

    -- How often (ms) the broadcaster emits a chunk. Lower is lower latency and slightly
    -- more overhead.
    TimesliceMs = 400,

    -- How often (ms) the broadcaster re-anchors with a fresh stream header, so a terminal
    -- opening a camera that has been running for a while gets a picture quickly.
    KeyframeMs = 4000,

    -- Per-viewer latent send ceiling (bytes/s) the server paces each chunk onto the wire
    -- with. Chunks cross the NUI boundary as base64, which is about a third larger than the
    -- encoded video itself, so leave headroom over the bitrates above.
    RelayBytesPerSec = 2048 * 1024,

    -- Terminals allowed on one officer's camera at once (0 = unlimited).
    MaxViewers = 6,

    -- Seconds a viewer may go quiet before the server drops them and, if they were the last
    -- one, tells the officer's client to stop encoding. The terminal refreshes the grid well
    -- inside this, so it only ever fires for a terminal that died without saying so.
    IdleSeconds = 15,

    -- Whether opening a camera FULL SCREEN writes a row to the MDT audit log, the same way
    -- a handset read does. Grid thumbnails are not logged one by one; the audited action is
    -- an officer choosing to watch a particular unit.
    LogViewing = true,
}
