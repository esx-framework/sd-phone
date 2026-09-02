-- Find My (Settings -> Find My): where each of a character's devices was last seen, plus
-- Lost Mode. A sighting is recorded whenever a device is opened, put away, and on a slow tick
-- while it stays open, so a phone left in a stranger's pocket keeps reporting home.
return {
    -- Master switch. Off = the Find My row disappears from Settings and every callback refuses.
    Enabled = true,

    -- Milliseconds between sightings while a device is open. Lower means a fresher position on
    -- the map and one small UPDATE per open device per tick.
    SightingInterval = 60000,

    -- How long Play Sound rings the found device for, in seconds.
    SoundSeconds = 5,

    -- Seconds between Play Sound pushes, per character. Stops the button being used as a siren.
    SoundCooldown = 15,

    -- Longest Lost Mode message a player may leave on the lock screen. The column holds 120.
    MaxMessageLength = 120,
}
