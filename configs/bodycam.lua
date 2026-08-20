-- Police bodycams and vehicle dashcams, watched from the MDT's Cameras section.
--
-- There is no second video stack here: an officer's own client encodes the view it is
-- already rendering and the server relays it to the terminals watching, exactly the way
-- Photogram Live relays a broadcast. The important consequence is that a camera costs
-- nothing at all until somebody opens it - no encoder, no readback, no bandwidth - and
-- the officer's client is told to start only once a viewer is actually attached.
--
-- Because the capture is the officer's own rendered frame, a bodycam shows what the
-- officer sees. FirstPerson below puts them in first person while they are being watched,
-- which is what makes the feed read as a body-worn camera rather than a chase cam. A
-- dashcam is the same feed, labelled with the vehicle the officer is sitting in.
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

    -- Put a broadcasting officer into first person for as long as they are being watched,
    -- and restore the view they had when the last viewer leaves. Turn this off if you would
    -- rather the feed be whatever camera the officer is playing on.
    FirstPerson = true,

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
        Fps     = 4,
        Width   = 320,
        Bitrate = 120000,
    },

    -- The full-screen profile, established only for the one camera an officer opened.
    Fullscreen = {
        Fps     = 20,
        Width   = 720,
        Bitrate = 800000,
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
    RelayBytesPerSec = 512 * 1024,

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
