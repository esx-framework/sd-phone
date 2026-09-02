-- Calendar app - per-character events that live server-side, keyed by citizenid,
-- so they follow the character across sessions and devices. An event belongs to
-- the character who created it (the organizer); everyone else on it is an
-- invitee whose RSVP decides whether the event shows up in their own calendar.
return {
    MaxEventsPerPlayer   = 300,
    MaxAttendeesPerEvent = 20,   -- guests on one event, the organizer aside
    MaxTitleLength       = 120,  -- characters
    MaxLocationLength    = 120,  -- characters
    MaxNotesLength       = 2000, -- characters
}
