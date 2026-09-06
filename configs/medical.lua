-- Medical ID. The card itself is always on: every player can fill one in from Health, and it is
-- readable from their own lock screen. What this file configures is the OTHER way in - a medic
-- reading someone else's card in the field.
--
-- Why that matters: the lock-screen card can only be read by someone else on a server running
-- unique phones (configs/uniqueandsim.lua with DataOwner 'device' or 'sim'), because on every
-- other setup a phone shows its HOLDER's data, not its owner's. Scanning works on all of them.
return {
    Scan = {
        -- Adds a "Scan Medical ID" option to the target eye on other players, for the jobs below.
        -- The scanned card opens on the medic's own phone. Needs ox_target, qb-target or qtarget;
        -- with none of them running this simply never appears.
        Enabled = true,

        -- Jobs allowed to scan. Grade is ignored: a probationary medic on scene needs the card as
        -- much as a chief does. Set to {} to turn scanning off without disabling the feature.
        Jobs = { 'ambulance', 'ems', 'doctor' },

        -- Metres. The server re-checks this against both players' real positions, so a client that
        -- lies about who it is standing next to is refused.
        Distance = 2.5,

        -- true  - only a player who is downed or dead can be scanned.
        -- false - anyone can, which is what you want if medics also run clinics and check-ups.
        RequireDowned = false,

        -- Tell the person they were scanned. Off by default: a medic reading the card of someone
        -- who is unconscious should not be popping a notification on their screen.
        NotifyTarget = false,
    },
}
