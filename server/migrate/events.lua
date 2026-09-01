---@type table Import telemetry (server.migrate.events). One place every progress line goes, so a
---run started from the console and a run started from the admin panel report identically: the
---console always gets the line, and any admin watching the panel gets it pushed as well.
local events = {}

---@type integer Lines kept for a panel opened part way through a run. A full import writes a few
---dozen; the cap only matters if a porter is ever made chatty.
local MAX_LINES = 400

---@type integer Smallest gap between two pushes of the same progress state, in ms. Porter progress
---reports can arrive thousands of times a second on a large table; the panel only needs to see a
---bar move.
local PUSH_INTERVAL = 200

---@type table<number, boolean> Player server ids currently watching the panel's migration page.
local watchers = {}

---@type { at: number, level: string, text: string }[] This run's log, oldest first.
local lines = {}

---@type integer Monotonic id so the panel can append only what it has not already rendered.
local lineSeq = 0

---@type table Current run state. Mirrored to the panel wholesale; small enough that diffing it
---would cost more than sending it.
local state = { phase = 'idle' }

---@type integer GetGameTimer() reading of the last state push.
local lastPush = 0

---@type integer Longest history the throughput chart keeps, in samples. At one a second that is
---twenty-five minutes, past any import this has been measured against.
local MAX_SAMPLES = 1500

---@type integer GetGameTimer() reading of the moment this run started.
local runStart = 0

---@type { t: number, rows: number }[] Rows processed against seconds elapsed. Sampled here rather
---than pushed on every progress report: a panel that opens mid-run needs the history, but a panel
---already watching can derive the same curve from the states it is being sent.
local series = {}

---@type { t: number, key: string }[] Where each domain took over, so the chart can show which one
---owns a stretch of the curve.
local marks = {}

---@type integer GetGameTimer() reading of the last sample taken.
local lastSample = 0

---Seconds since this run started.
---@return number
local function elapsed()
    return runStart > 0 and ((GetGameTimer() - runStart) / 1000) or 0
end

---Colour a console line by severity. Plain text for the panel, which styles by level itself.
---@param level string 'info' | 'warn' | 'error' | 'ok'
---@param text string
---@return string
local function paint(level, text)
    if level == 'error' then return ('^1%s^0'):format(text) end
    if level == 'warn'  then return ('^3%s^0'):format(text) end
    if level == 'ok'    then return ('^2%s^0'):format(text) end
    return text
end

---Sends a payload to every watching admin. A watcher who has dropped is forgotten on the way.
---@param payload table
local function push(payload)
    for src in pairs(watchers) do
        if GetPlayerName(src) then
            TriggerClientEvent('sd-phone:client:migrate:push', src, payload)
        else
            watchers[src] = nil
        end
    end
end

---Starts a fresh run log. Anything from the previous run is dropped rather than accumulated: the
---panel shows one run at a time and the console has the scrollback.
---@param initial table starting state
function events.reset(initial)
    lines = {}
    lineSeq = 0
    state = initial or { phase = 'idle' }
    lastPush = 0
    runStart = GetGameTimer()
    series = {}
    marks = {}
    lastSample = 0
    push({ reset = true, state = state, lines = lines })
end

---Records one log line: always to the server console, and to any watching panel.
---@param level string 'info' | 'warn' | 'error' | 'ok'
---@param text string
function events.log(level, text)
    print(('^5[sd-phone:migrate]^0 %s'):format(paint(level, text)))

    lineSeq = lineSeq + 1
    local line = { id = lineSeq, at = os.time(), level = level, text = text }
    lines[#lines + 1] = line
    if #lines > MAX_LINES then table.remove(lines, 1) end

    push({ lines = { line }, state = state })
end

---Merges a patch into the run state. Progress patches are throttled; anything that changes the
---phase, or a patch marked urgent, goes out immediately so the panel never lags a transition.
---@param patch table fields to merge
---@param urgent? boolean bypass the throttle
function events.setState(patch, urgent)
    local phaseChanged  = patch.phase ~= nil and patch.phase ~= state.phase
    local domainChanged = patch.currentDomain ~= nil and patch.currentDomain ~= state.currentDomain

    for k, v in pairs(patch) do state[k] = v end

    local now = GetGameTimer()

    if domainChanged then
        marks[#marks + 1] = { t = elapsed(), key = patch.currentDomain }
    end

    if patch.doneRows ~= nil and (lastSample == 0 or (now - lastSample) >= 1000) then
        lastSample = now
        series[#series + 1] = { t = elapsed(), rows = patch.doneRows }
        if #series > MAX_SAMPLES then table.remove(series, 1) end
    end
    if urgent or phaseChanged or (now - lastPush) >= PUSH_INTERVAL then
        lastPush = now
        push({ state = state })
    end
end

---The whole current run, for a panel that has just opened: state, the log so far, and the sampled
---throughput history it would otherwise have no way to draw.
---@return table
function events.snapshot()
    return { state = state, lines = lines, series = series, marks = marks }
end

---@return table
function events.state() return state end

---Starts pushing this run to an admin.
---@param src number player server id
function events.subscribe(src)
    if type(src) == 'number' and src > 0 then watchers[src] = true end
end

---Stops pushing to an admin. Called when the panel closes and when the player drops.
---@param src number player server id
function events.unsubscribe(src)
    watchers[src] = nil
end

AddEventHandler('playerDropped', function()
    events.unsubscribe(source)
end)

return events
