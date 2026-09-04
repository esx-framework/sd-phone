-- Birdy app - the in-game microblog (posts, likes, follows, DMs, alerts).
-- Content is per-character, stored in the phone_birdy_* tables created on
-- resource start.
return {
    -- New profiles start unverified. Flip to true to hand everyone the blue
    -- check, or set a badge per-account with /birdyverify <handle> <type>.
    DefaultVerified = false,

    -- Buying the blue check from inside the app (Profile > Edit profile).
    -- Only blue is ever purchasable: the gold business and grey government
    -- badges assert who someone is, so they stay staff-granted through the
    -- admin panel or /birdyverify. Set Enabled = false to hide the row.
    Verification = {
        Enabled = true,
        Price   = 25000,
        Account = 'bank',
    },

    -- Max length of a post / reply body. Mirrors the React composer's
    -- maxLength so client and server agree.
    MaxPostLength = 280,

    -- Max length of a direct message.
    MaxDmLength = 500,

    -- Polls. A post carries either a poll or media, never both, and the post
    -- body is the question. Options are 2 to MaxPollOptions choices.
    MaxPollOptions      = 4,
    MaxPollOptionLength = 40,

    -- Durations the composer offers, in seconds. The server accepts only
    -- these exact values, so add a duration here and to the React composer
    -- together (web/src/apps/birdy/data.ts).
    PollDurations = { 3600, 86400, 259200, 604800 },

    -- Posts returned per feed load (newest first).
    FeedLimit = 50,

    -- Days of post history the Search tab's trending-hashtag counts look at.
    TrendingWindowDays = 7,

    -- Notifications returned per alerts-tab load.
    NotificationLimit = 50,

    -- Who a new post notifies.
    --   'followers' - each of the author's followers, the way a real feed app does
    --   'everyone'  - every Squawk account on the server, so nobody misses a post
    --   false       - nobody; posts land silently and only likes, replies, reposts and follows
    --                 still notify
    -- (`true` is still read as 'followers'.)
    --
    -- 'everyone' writes one notification row per account per post, so it scales as posts times
    -- players: fine for a small or news-driven server, heavy on a busy one where a prolific poster
    -- alerts the whole map every time they type.
    --
    -- A PROTECTED account always notifies its followers only, whatever this is set to. The alert
    -- carries a preview of the post body, so sending it server-wide would publish the very posts
    -- that account chose to keep to its followers.
    PostNotifications = 'followers',

    -- Account field bounds, mirrored by the React register/login forms.
    MaxNameLength     = 32,
    MinHandleLength   = 2,
    MaxHandleLength   = 15,
    MinPasswordLength = 4,
    MaxPasswordLength = 64,
    MaxBioLength      = 160,
}
