---@type table sd-phone config root (configs/config.lua).
local config = require 'configs.config'

---@type table Crash curve module; the table returned at end of file. Pure arithmetic: no FiveM
---API, no state, no randomness of its own. Everything that decides money in Crash - where the
---round busts and what multiplier a moment in time is worth - lives here so one suite can pin it.
local curve = {}

---@type table Casino limits (config.Casino.Crash); hoisted with defaults so a missing config file
---cannot silently raise the ceiling on a payout.
local C = (config.Casino or {}).Crash or {}

---@type integer Highest multiplier a round can reach, in basis points (100 = 1.00x). The round
---busts here at the latest, which is what bounds the largest possible payout.
local MAX_X100 = math.floor((C.MaxMultiplier or 100) * 100)
---@type integer Lowest bust, in basis points. A round busting at 1.00x is the instant bust: the
---multiplier never exceeds it, so no cash out can beat it.
local MIN_X100 = 100

---@type number Growth rate per millisecond, e^(0.16/s). 2.00x lands at 4.33s and 100.00x at
---28.78s, which is what makes the curve readable on a phone without feeling slow.
local K = 0.00016

---@type number House take. The bust is drawn so that P(bust >= m) = 0.97 / m for every m, which
---returns 0.97 per chip at every cash out target: the edge cannot be strategied away.
local RETURN = 97

---@type string Appended to the server seed before hashing to produce the round's published
---commitment. The bust is derived from the UNSALTED hash of the same seed, so publishing the
---commitment up front binds the seed without handing anyone the bust point it decides.
curve.COMMIT_SUFFIX = ':commit'

---@type integer Highest bust in basis points, read by the round loop and the tests.
curve.MAX_X100 = MAX_X100
---@type integer Lowest bust in basis points.
curve.MIN_X100 = MIN_X100
---@type number Growth rate per millisecond, exported for the fairness panel's derivation.
curve.K = K

---The multiplier a round is worth after `elapsedMs` of running, in basis points. Monotonic and
---floored, so the value a cash out is paid at can only ever round toward the house.
---@param elapsedMs number milliseconds since the running phase started
---@return integer x100 multiplier in basis points, never below 100
function curve.multAt(elapsedMs)
    local ms = tonumber(elapsedMs) or 0
    if not (ms > 0) then return MIN_X100 end
    local x100 = math.floor(100 * math.exp(K * ms))
    if x100 < MIN_X100 then return MIN_X100 end
    if x100 > MAX_X100 then return MAX_X100 end
    return x100
end

---The instant a round reaches `x100`, the inverse of multAt. Ceiled, so the round is never cut
---short of the multiplier it committed to.
---@param x100 integer multiplier in basis points
---@return integer ms milliseconds from the start of the running phase
function curve.bustAtMs(x100)
    local m = tonumber(x100) or MIN_X100
    if m <= MIN_X100 then return 0 end
    return math.ceil(math.log(m / 100) / K)
end

---Turns a uniform sample in [0, 1) into a bust point. floor(97 / (1 - X)) gives
---P(bust >= m) = 0.97 / m, so a player targeting any multiplier returns 0.97 per chip staked and
---3.96% of rounds bust at 1.00x with nobody able to escape.
---@param x number uniform sample in [0, 1)
---@return integer x100 bust multiplier in basis points, clamped to [100, MAX_X100]
function curve.bustFromX(x)
    local u = tonumber(x)
    if not u or u ~= u or u < 0 or u >= 1 then u = 0 end
    local x100 = math.floor(RETURN / (1 - u))
    if x100 < MIN_X100 then return MIN_X100 end
    if x100 > MAX_X100 then return MAX_X100 end
    return x100
end

---Derives a round's bust point from the SHA-256 of its server seed. The first 13 hex characters
---are 52 bits, which Lua 5.4 carries exactly as an integer, so the sample is reproducible to the
---bit by anyone holding the revealed seed.
---@param hex string|nil lowercase hex digest of the server seed
---@return integer|nil x100 bust multiplier in basis points, nil when the digest is unusable
function curve.bustFromHash(hex)
    if type(hex) ~= 'string' or #hex < 13 then return nil end
    local head = hex:sub(1, 13)
    if head:match('^%x+$') ~= head then return nil end
    local h = tonumber(head, 16)
    if not h then return nil end
    return curve.bustFromX(h / 2 ^ 52)
end

return curve
