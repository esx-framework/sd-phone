---@type table<string, integer> Poker value of every card rank. The ace sits high at 14 and only
---ever counts as 1 inside the wheel, which is handled where straights are detected.
local RANK_VALUE = {
    ['2'] = 2, ['3'] = 3, ['4'] = 4, ['5'] = 5, ['6'] = 6, ['7'] = 7, ['8'] = 8,
    ['9'] = 9, ['10'] = 10, ['J'] = 11, ['Q'] = 12, ['K'] = 13, ['A'] = 14,
}

---@type integer Weight of the category digit. Ranks top out at 14, so base 15 gives every tiebreak
---its own place value and one integer then compares two hands exactly - suits never enter it, so
---equal integers are a real tie and the pot splits.
local CAT_WEIGHT = 759375

---@type table<integer, string> Category index to the i18n key the showdown copy uses.
local CATEGORY = {
    [8] = 'straightFlush', [7] = 'quads', [6] = 'fullHouse', [5] = 'flush', [4] = 'straight',
    [3] = 'trips', [2] = 'twoPair', [1] = 'pair', [0] = 'highCard',
}

---@type table Hand-strength module; the table returned at end of file. Pure: no FiveM API, no
---state and no randomness, so the evaluation that decides who takes a pot is unit testable on its
---own and can be re-run against a logged showdown.
local eval = {}

---@param rank string card rank as the shoe spells it
---@return integer value 2..14, 0 for a rank this deck does not carry
function eval.value(rank) return RANK_VALUE[rank] or 0 end

---Packs a category and its five tiebreak ranks into one comparable integer.
---@param cat integer category index, 0 (high card) .. 8 (straight flush)
---@param r1 integer primary tiebreak
---@param r2 integer
---@param r3 integer
---@param r4 integer
---@param r5 integer
---@return integer score
local function pack(cat, r1, r2, r3, r4, r5)
    return cat * CAT_WEIGHT + r1 * 50625 + r2 * 3375 + r3 * 225 + r4 * 15 + r5
end

---@param a table group { rank, n }
---@param b table group { rank, n }
---@return boolean before true when `a` outranks `b`: more cards first, then the higher rank
local function byGroup(a, b)
    if a.n ~= b.n then return a.n > b.n end
    return a.rank > b.rank
end

---Scores exactly five cards. Every hand in the game is compared through this one number, so the
---category order and the tiebreak vector below are the whole ruleset.
---@param cards table[] five cards, each { rank, suit }
---@return integer score comparable; higher wins, equal is an exact tie
function eval.score5(cards)
    local v, flush = {}, true
    local suit = cards[1].suit
    for i = 1, 5 do
        v[i] = RANK_VALUE[cards[i].rank] or 0
        if cards[i].suit ~= suit then flush = false end
    end
    table.sort(v, function(a, b) return a > b end)

    local count = {}
    for i = 1, 5 do count[v[i]] = (count[v[i]] or 0) + 1 end
    local groups = {}
    for rank, n in pairs(count) do groups[#groups + 1] = { rank = rank, n = n } end
    table.sort(groups, byGroup)

    -- A-2-3-4-5 is a straight to the FIVE, not to the ace: the wheel is the lowest straight there
    -- is, and scoring it at 14 would beat every other straight in the game.
    local straightHigh
    if #groups == 5 then
        if v[1] - v[5] == 4 then straightHigh = v[1]
        elseif v[1] == 14 and v[2] == 5 then straightHigh = 5 end
    end

    if straightHigh and flush then return pack(8, straightHigh, 0, 0, 0, 0) end
    if groups[1].n == 4 then return pack(7, groups[1].rank, groups[2].rank, 0, 0, 0) end
    if groups[1].n == 3 and groups[2].n == 2 then return pack(6, groups[1].rank, groups[2].rank, 0, 0, 0) end
    if flush then return pack(5, v[1], v[2], v[3], v[4], v[5]) end
    if straightHigh then return pack(4, straightHigh, 0, 0, 0, 0) end
    if groups[1].n == 3 then return pack(3, groups[1].rank, groups[2].rank, groups[3].rank, 0, 0) end
    if groups[1].n == 2 and groups[2].n == 2 then return pack(2, groups[1].rank, groups[2].rank, groups[3].rank, 0, 0) end
    if groups[1].n == 2 then return pack(1, groups[1].rank, groups[2].rank, groups[3].rank, groups[4].rank, 0) end
    return pack(0, v[1], v[2], v[3], v[4], v[5])
end

---Best five-card hand out of the cards handed in (seven at a showdown: two hole plus five board).
---Enumerates every five-card combination rather than pattern-matching seven, which is 21 scorings
---per player and leaves no shape for a special case to miss.
---@param cards table[] five to seven cards, each { rank, suit }
---@return integer score best comparable score, -1 when fewer than five cards were given
---@return table[]|nil best the five cards making that score
function eval.best7(cards)
    local n = #cards
    if n < 5 then return -1, nil end
    local best, bestCards = -1, nil
    local hand = {}
    for a = 1, n - 4 do
        for b = a + 1, n - 3 do
            for c = b + 1, n - 2 do
                for d = c + 1, n - 1 do
                    for e = d + 1, n do
                        hand[1], hand[2], hand[3], hand[4], hand[5] = cards[a], cards[b], cards[c], cards[d], cards[e]
                        local s = eval.score5(hand)
                        if s > best then
                            best = s
                            bestCards = { hand[1], hand[2], hand[3], hand[4], hand[5] }
                        end
                    end
                end
            end
        end
    end
    return best, bestCards
end

---@param score integer score from score5 / best7
---@return string key i18n key for the category ('straightFlush', 'quads', ... 'highCard')
function eval.describe(score)
    local n = tonumber(score)
    if not n or n < 0 then return 'highCard' end
    return CATEGORY[math.floor(n / CAT_WEIGHT)] or 'highCard'
end

return eval
