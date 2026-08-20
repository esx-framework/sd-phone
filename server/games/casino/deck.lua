---@type table Shoe module; the table returned at end of file. Baccarat and Texas Hold'em both need
---a multi-deck shoe dealt from server RNG, and both must agree with server/games/blackjack.lua on
---the card shape so one card renderer serves every table game.
local deck = {}

---@type string[] Card ranks, ace first; identical to server/games/blackjack.lua.
local RANKS = { 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K' }
---@type string[] Card suits; identical to server/games/blackjack.lua.
local SUITS = { 'S', 'H', 'D', 'C' }

---A fresh, shuffled shoe. Fisher-Yates over server RNG via lib.table.shuffle; a client can never
---see or bias it.
---@param decks integer number of 52-card decks in the shoe
---@return table[] shoe shuffled array of { rank, suit }
function deck.fresh(decks)
    local shoe, n = {}, 0
    for _ = 1, decks do
        for _, s in ipairs(SUITS) do
            for _, r in ipairs(RANKS) do n = n + 1; shoe[n] = { rank = r, suit = s } end
        end
    end
    return lib.table.shuffle(shoe)
end

---Draws the top card off a shoe (mutates it).
---@param shoe table[]
---@return table card { rank, suit } removed from the top
function deck.draw(shoe) return table.remove(shoe) end

return deck
