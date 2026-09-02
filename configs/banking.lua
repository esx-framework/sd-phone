-- Wallet / Banking app. The phone reads the player's framework bank balance (through the
-- multi-banking adapter in bridge/server/banking.lua) and keeps its own transaction log
-- (phone_bank_transactions) as the source of truth for the list - most banking resources
-- don't expose a portable "list transactions" API, so the phone records its own entries
-- and exposes an export others can use.
return {
    TransactionLimit = 50,          -- most-recent transactions returned to the app
    MinSend          = 1,           -- smallest allowed transfer
    MaxSend          = 100000000,   -- transfer cap

    -- Allow sending to a character who is currently offline (best-effort credit via a
    -- direct framework DB write). Only honoured when the active banking resource keeps
    -- balances in the framework account; own-table resources (wasabi, okok, prism, tgg,
    -- fd) require the recipient to be online.
    AllowOffline     = true,

    -- Let the sender tick "Send Anonymously". Hides them from the RECIPIENT only: that row,
    -- statement and banner read "Anonymous" with no counterparty to send back to. Server-side
    -- logging is never anonymised, so sd-phone:server:banking:transfer still carries the real
    -- sender, with an `anonymous` flag alongside it.
    AllowAnonymous   = true,

    -- The card shown at the top of the Wallet, and the default for a character who has never
    -- customised theirs. Brand ids: fleeca, maze, lombank, pacific, blaine. Colour and Pattern
    -- are optional overrides; leave them nil to use the bank's authentic pair.
    --   Colours:  emerald, crimson, cobalt, navy, bronze, graphite, teal, violet, slate,
    --             amber, rose, midnight, mint, burgundy
    --   Patterns: wave, meander, pinstripe, guilloche, crosshatch, chevron, dots, grid,
    --             diamond, scales, topo, circuit, carbon, none
    -- Locked = true forces this on everyone and hides the customiser. Purely cosmetic: every
    -- card reads the same framework account.
    Card = {
        Brand   = 'fleeca',
        Color   = nil,
        Pattern = nil,
        Locked  = false,
    },

    -- Repeating transfers the player schedules from the Wallet. A due order is put through the
    -- ordinary transfer path, so it obeys MinSend/MaxSend behaviour, writes both statement rows
    -- and fires sd-phone:server:banking:transfer exactly like a manual send. The payer must be
    -- connected for the money to move (no framework has an offline debit); an order belonging to
    -- someone offline simply stays due and runs on their next connection.
    StandingOrders = {
        Enabled   = true,
        MaxActive = 10,        -- orders one character may have switched on at once
        MinAmount = 1,         -- smallest allowed per-run amount
        MaxAmount = 1000000,   -- largest allowed per-run amount
    },

    -- Person-to-person invoicing from the Wallet's Invoices tab (business invoicing is
    -- configured in configs/services.lua and unaffected by this block).
    PersonalInvoices = {
        Enabled    = true,
        MinAmount  = 1,        -- smallest allowed invoice
        MaxAmount  = 1000000,  -- largest allowed invoice
        MaxPending = 10,       -- outstanding unpaid invoices one sender may have at once
    },
}
