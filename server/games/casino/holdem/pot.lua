---@type table Pot module; the table returned at end of file. Pure: it takes a contribution ledger
---and hands back the pot layers and the awards, with no FiveM API and no table state. Every chip a
---player loses at hold'em passes through these two functions, so they are the part that is proved
---rather than eyeballed - a layer that is one chip out mints or burns real money.
local pot = {}

---Splits a hand's contributions into the main pot and any side pots.
---
---Two rules do the work. The uncalled top bet comes off first, so the seat nobody matched gets its
---overspend back instead of paying itself out of its own pot. Then each level sums across EVERY
---seat, folded ones included: dead money belongs to the layer it was put into, and skipping folded
---seats is what leaks chips out of a hand.
---@param contrib table<integer, integer> seat index -> chips that seat put in across all four streets
---@param folded table<integer, boolean>|nil seat index -> true when that seat folded
---@return table[] pots main pot first, each { amount: integer, eligible: integer[] }
---@return table<integer, integer> refunds seat -> chips handed straight back, uncontested
---@return boolean ok false when the layers plus refunds do not equal the contributions
function pot.build(contrib, folded)
    folded = folded or {}

    local left, total = {}, 0
    for seat, amount in pairs(contrib or {}) do
        local n = math.floor(tonumber(amount) or 0)
        if n > 0 then
            left[seat] = n
            total = total + n
        end
    end

    local refunds, refunded = {}, 0
    local hiSeat, hi, second = nil, 0, 0
    for seat, n in pairs(left) do
        if n > hi then
            second = hi
            hi = n
            hiSeat = seat
        elseif n > second then
            second = n
        end
    end
    -- The refund follows the chips, not the cards. A folded seat can hold the strict top
    -- contribution when the table folded it for leaving or disconnecting mid-bet, and the part
    -- nobody matched was never contested, so handing it to whoever is left would be a gift.
    if hiSeat and hi > second then
        refunds[hiSeat] = hi - second
        refunded = hi - second
        left[hiSeat] = second
    end

    local levelSet = {}
    for seat, n in pairs(left) do
        if n > 0 and not folded[seat] then levelSet[n] = true end
    end
    local levels = {}
    for n in pairs(levelSet) do levels[#levels + 1] = n end
    table.sort(levels)

    local pots, prev, assigned = {}, 0, 0
    for i = 1, #levels do
        local level = levels[i]
        local amount = 0
        for _, n in pairs(left) do
            amount = amount + (math.min(n, level) - math.min(n, prev))
        end
        local eligible = {}
        for seat, n in pairs(left) do
            if not folded[seat] and n >= level then eligible[#eligible + 1] = seat end
        end
        table.sort(eligible)
        if amount > 0 then
            pots[#pots + 1] = { amount = amount, eligible = eligible }
            assigned = assigned + amount
        end
        prev = level
    end

    -- Dead money sitting above the highest level anyone is still eligible for. It cannot arise from
    -- a legal betting sequence, but folding it into the top layer keeps the hand chip-neutral
    -- instead of losing the difference, and the ok flag still reports the shape as sound.
    local residual = total - refunded - assigned
    if residual > 0 and #pots > 0 then
        pots[#pots].amount = pots[#pots].amount + residual
        assigned = assigned + residual
    end

    return pots, refunds, (assigned + refunded) == total
end

---Awards every layer to the best hand holding it.
---
---A tie splits evenly and the remainder chips go one each to the tied seats in `order`, which is
---seat order clockwise from the button: the standard odd-chip rule, and the only reason a three-way
---split of 100 does not quietly lose a chip.
---@param pots table[] layers from pot.build
---@param scores table<integer, integer>|nil seat -> comparable hand score (empty when uncontested)
---@param order integer[]|nil seat indices clockwise from the button, for the odd chip
---@return table[] awards one row per winning seat per layer, { seat, amount, pot }
---@return table<integer, integer> totals seat -> chips won across every layer
function pot.award(pots, scores, order)
    local awards, totals = {}, {}
    local rank = {}
    for i = 1, #(order or {}) do rank[order[i]] = i end

    for p = 1, #(pots or {}) do
        local layer = pots[p]
        local best, winners = nil, {}
        for i = 1, #layer.eligible do
            local seat = layer.eligible[i]
            local score = scores and scores[seat]
            if score then
                if not best or score > best then
                    best, winners = score, { seat }
                elseif score == best then
                    winners[#winners + 1] = seat
                end
            end
        end
        -- Nobody was evaluated: everyone else folded, so the layer goes to whoever is left standing
        -- and no cards are shown.
        if #winners == 0 then
            for i = 1, #layer.eligible do winners[i] = layer.eligible[i] end
        end

        if #winners > 0 then
            table.sort(winners, function(a, b) return (rank[a] or a) < (rank[b] or b) end)
            local share = layer.amount // #winners
            local odd = layer.amount % #winners
            for i = 1, #winners do
                local seat = winners[i]
                local amount = share + (i <= odd and 1 or 0)
                if amount > 0 then
                    awards[#awards + 1] = { seat = seat, amount = amount, pot = p }
                    totals[seat] = (totals[seat] or 0) + amount
                end
            end
        end
    end

    return awards, totals
end

return pot
