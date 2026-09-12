import { useEffect, useReducer } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { t } from '@/i18n';
import { formatRaceTime } from '@/apps/racing/data';
import type { HudSector, HudState, HudStyle, Standing } from '@/apps/racing/data';
import { RACING_ACCENT, RACING_ACCENT_SOFT } from '@/apps/racing/racingTheme';

const TICK_MS      = 50;
const BOARD_ROWS   = 5;
const SECTOR_CELLS = 4;
const MAX_PIPS     = 24;

const TEXT  = '#F2F5F8';
const SOFT  = 'rgba(242, 245, 248, 0.80)';
const MUTE  = 'rgba(242, 245, 248, 0.46)';
const FAINT = 'rgba(242, 245, 248, 0.14)';
const GAIN  = '#4ADE80';
const LOSS  = '#FF6B5A';

const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

const PANEL: CSSProperties = {
    background:   'rgba(8, 11, 16, 0.92)',
    border:       '1px solid rgba(255, 255, 255, 0.09)',
    boxShadow:    '0 8px 24px rgba(0, 0, 0, 0.45)',
    borderRadius: 13,
};

const ROW: CSSProperties = {
    background:   'rgba(255, 255, 255, 0.035)',
    borderRadius: 8,
};

function shortTime(ms: number): string {
    const full = formatRaceTime(ms);
    return full.startsWith('00:') ? full.slice(3) : full.replace(/^0/, '');
}

function Panel({ width, children }: { width: number; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2 p-2.5" style={{ ...PANEL, width }}>
            {children}
        </div>
    );
}

function Micro({ children, tone = MUTE }: { children: ReactNode; tone?: string }) {
    return (
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', lineHeight: 1, color: tone }}>
            {children}
        </span>
    );
}

function Chip({ children, tone = SOFT, live = false, size = 12 }: {
    children: ReactNode;
    tone?:    string;
    live?:    boolean;
    size?:    number;
}) {
    return (
        <span
            style={{
                fontFamily:   MONO,
                fontSize:     size,
                fontWeight:   700,
                lineHeight:   1,
                color:        tone,
                background:   live ? RACING_ACCENT_SOFT : 'rgba(255, 255, 255, 0.07)',
                border:       `1px solid ${live ? 'rgba(255, 255, 255, 0.10)' : 'transparent'}`,
                borderRadius: 6,
                padding:      '3px 7px',
                fontVariantNumeric: 'tabular-nums',
            }}
        >
            {children}
        </span>
    );
}

function PosTile({ pos, total }: { pos: number; total: number }) {
    return (
        <div
            className="flex w-[52px] shrink-0 flex-col items-center justify-center gap-[3px] py-[7px]"
            style={{ background: RACING_ACCENT_SOFT, border: `1px solid ${RACING_ACCENT}`, borderRadius: 10 }}
        >
            <span
                style={{
                    fontSize:   25,
                    fontWeight: 800,
                    lineHeight: 0.9,
                    letterSpacing: '-0.04em',
                    color:      TEXT,
                    fontVariantNumeric: 'tabular-nums',
                }}
            >
                {pos}
            </span>
            <Micro>{t('racing.hudOf', 'OF {n}', { n: total })}</Micro>
        </div>
    );
}

function PipStrip({ done, total }: { done: number; total: number }) {
    if (total <= 0) return null;

    if (total > MAX_PIPS) {
        const pct = Math.max(0, Math.min(1, done / total));
        return (
            <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ background: FAINT }}>
                <div
                    className="h-full rounded-full transition-[width] duration-300 ease-out"
                    style={{ width: `${pct * 100}%`, background: RACING_ACCENT }}
                />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-[3px]">
            {Array.from({ length: total }, (_, index) => (
                <span
                    key={index}
                    className="h-[3px] min-w-0 flex-1 rounded-full"
                    style={{ background: index < done ? RACING_ACCENT : FAINT }}
                />
            ))}
        </div>
    );
}

function HeadBlock({ state, current }: { state: HudState; current: string }) {
    return (
        <div className="flex items-stretch gap-2.5">
            <PosTile pos={state.pos} total={state.totalRacers} />
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                <div className="flex items-center justify-between gap-2">
                    <span className="flex items-baseline gap-1">
                        <Micro>{t('racing.hudLap', 'LAP')}</Micro>
                        <span
                            style={{
                                fontSize:   14,
                                fontWeight: 700,
                                lineHeight: 1,
                                color:      TEXT,
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            {state.lap}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: MUTE }}>/{state.totalLaps}</span>
                    </span>
                    <Chip tone={TEXT} live size={12.5}>{current}</Chip>
                </div>
                <PipStrip done={state.cp} total={state.cpTotal} />
            </div>
        </div>
    );
}

function GapText({ ms, ahead }: { ms: number; ahead: boolean }) {
    return (
        <span
            style={{
                fontFamily: MONO,
                fontSize:   11.5,
                fontWeight: 700,
                color:      ahead ? GAIN : LOSS,
                fontVariantNumeric: 'tabular-nums',
            }}
        >
            {ahead ? '-' : '+'}{shortTime(Math.abs(ms))}
        </span>
    );
}

function RacerRow({ lead, name, gap, you, children }: {
    lead:      ReactNode;
    name:      string;
    gap?:      ReactNode;
    you?:      boolean;
    children?: ReactNode;
}) {
    return (
        <div
            className="relative flex items-center gap-2 overflow-hidden py-[6px] ps-2.5 pe-2"
            style={you ? { ...ROW, background: RACING_ACCENT_SOFT } : ROW}
        >
            {you && <span className="absolute bottom-0 start-0 top-0 w-[3px]" style={{ background: RACING_ACCENT }} />}
            {lead}
            <span
                className="min-w-0 flex-1 truncate"
                style={{ fontSize: 12.5, fontWeight: you ? 700 : 600, color: you ? TEXT : SOFT }}
            >
                {name}
            </span>
            {children}
            {gap}
        </div>
    );
}

function Neighbours({ racers }: { racers: Standing[] }) {
    const meIndex = racers.findIndex(racer => racer.you);
    if (meIndex < 0) return null;

    const me     = racers[meIndex];
    const ahead  = meIndex > 0 ? racers[meIndex - 1] : null;
    const behind = meIndex < racers.length - 1 ? racers[meIndex + 1] : null;
    const myGap  = me.deltaMs ?? 0;

    const glyph = (mark: string, tone: string) => (
        <span className="w-[10px] shrink-0 text-center" style={{ fontSize: 10, lineHeight: 1, color: tone }}>
            {mark}
        </span>
    );

    return (
        <div className="flex flex-col gap-1">
            {ahead && (
                <RacerRow
                    lead={glyph('▲', MUTE)}
                    name={ahead.name}
                    gap={<GapText ms={(ahead.deltaMs ?? 0) - myGap} ahead />}
                />
            )}
            <RacerRow lead={glyph('●', RACING_ACCENT)} name={me.name} you />
            {behind && (
                <RacerRow
                    lead={glyph('▼', MUTE)}
                    name={behind.name}
                    gap={<GapText ms={(behind.deltaMs ?? 0) - myGap} ahead={false} />}
                />
            )}
        </div>
    );
}

function boardRows(racers: Standing[]): Standing[] {
    const head = racers.slice(0, BOARD_ROWS);
    const you  = racers.find(racer => racer.you);
    if (!you || head.includes(you)) return head;
    return [...racers.slice(0, BOARD_ROWS - 1), you];
}

function Board({ racers }: { racers: Standing[] }) {
    return (
        <div className="flex flex-col gap-1">
            {boardRows(racers).map(racer => (
                <RacerRow
                    key={racer.pos}
                    you={racer.you}
                    name={racer.name}
                    lead={(
                        <span
                            className="w-[12px] shrink-0 text-center"
                            style={{
                                fontFamily: MONO,
                                fontSize:   11.5,
                                fontWeight: 700,
                                color:      racer.you ? RACING_ACCENT : MUTE,
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            {racer.pos}
                        </span>
                    )}
                    gap={racer.deltaMs === null || racer.pos === 1
                        ? <Micro>{t('racing.hudLeader', 'LEAD')}</Micro>
                        : (
                            <span
                                style={{
                                    fontFamily: MONO,
                                    fontSize:   11,
                                    fontWeight: 700,
                                    color:      SOFT,
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                            >
                                +{shortTime(racer.deltaMs)}
                            </span>
                        )}
                />
            ))}
        </div>
    );
}

function sectorCells(sectors: HudSector[]): HudSector[] {
    const cells = sectors.slice(0, SECTOR_CELLS);
    while (cells.length < SECTOR_CELLS) cells.push({ ms: 0, done: false });
    return cells;
}

function deltaText(ms: number): string {
    const sign = ms > 0 ? '+' : '-';
    return `${sign}${(Math.abs(ms) / 1000).toFixed(2)}`;
}

function SectorBars({ sectors, liveMs, pb }: { sectors: HudSector[]; liveMs: number; pb?: number[] }) {
    const cells  = sectorCells(sectors);
    const runIdx = cells.findIndex(cell => !cell.done);

    const spans = cells.map((cell, index) => {
        const prevMs = index > 0 ? cells[index - 1].ms : 0;
        if (cell.done) return Math.max(0, cell.ms - prevMs);
        if (index === runIdx) return Math.max(0, liveMs - prevMs);
        return 0;
    });
    const peak = Math.max(...spans, 1);

    return (
        <div className="flex flex-col gap-[6px]">
            {cells.map((cell, index) => {
                const running = index === runIdx;
                const span    = spans[index];
                const fill    = cell.done ? GAIN : running ? RACING_ACCENT : FAINT;
                const width   = cell.done || running ? Math.max(0.06, span / peak) : 0;
                return (
                    <div key={index} className="flex items-center gap-2">
                        <Micro tone={running ? RACING_ACCENT : MUTE}>
                            {t('racing.hudSectorShort', 'S{n}', { n: index + 1 })}
                        </Micro>
                        <div className="h-[4px] min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: FAINT }}>
                            <div className="h-full rounded-full" style={{ width: `${width * 100}%`, background: fill }} />
                        </div>
                        {pb && pb.length > 0 && (
                            <span
                                className="w-[42px] text-end"
                                style={{
                                    fontFamily: MONO,
                                    fontSize:   10.5,
                                    fontWeight: 700,
                                    color:      cell.done && pb[index] ? (cell.ms - pb[index] <= 0 ? GAIN : LOSS) : FAINT,
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                            >
                                {cell.done && pb[index] ? deltaText(cell.ms - pb[index]) : ''}
                            </span>
                        )}
                        <span
                            className="w-[48px] text-end"
                            style={{
                                fontFamily: MONO,
                                fontSize:   11,
                                fontWeight: 700,
                                color:      cell.done ? TEXT : running ? TEXT : FAINT,
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            {cell.done || running ? shortTime(span) : t('racing.hudNoTime', '--')}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function Clocks({ best, total }: { best: string; total: string }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
                <Micro>{t('racing.hudBestLap', 'BEST')}</Micro>
                <Chip size={11.5}>{best}</Chip>
            </span>
            <span className="flex items-center gap-1.5">
                <Micro>{t('racing.hudTotalTime', 'TOTAL')}</Micro>
                <Chip size={11.5}>{total}</Chip>
            </span>
        </div>
    );
}

interface LayoutProps {
    bestMs:    number;
    current:   string;
    currentMs: number;
    total:     string;
    state:     HudState;
}

function SimpleHud({ current, state }: LayoutProps) {
    return (
        <Panel width={236}>
            <HeadBlock state={state} current={current} />
        </Panel>
    );
}

function CasualHud({ current, state }: LayoutProps) {
    return (
        <div className="flex flex-col gap-2">
            <Panel width={244}>
                <HeadBlock state={state} current={current} />
            </Panel>
            <Panel width={244}>
                <Neighbours racers={state.racers} />
            </Panel>
        </div>
    );
}

function AdvancedHud({ bestMs, current, currentMs, total, state }: LayoutProps) {
    return (
        <div className="flex flex-col gap-2">
            <Panel width={280}>
                <HeadBlock state={state} current={current} />
            </Panel>
            <Panel width={280}>
                <SectorBars sectors={state.sectors} liveMs={currentMs} pb={state.pbSectors} />
                <span className="h-px w-full" style={{ background: 'rgba(255, 255, 255, 0.08)' }} />
                <Clocks best={bestMs > 0 ? shortTime(bestMs) : t('racing.hudNoTime', '--')} total={total} />
            </Panel>
            <Panel width={280}>
                <Board racers={state.racers} />
            </Panel>
        </div>
    );
}

export function RaceHud({ style, state, startedAt }: {
    style:     HudStyle;
    state:     HudState;
    startedAt: number;
}) {
    const [, tick] = useReducer((n: number) => n + 1, 0);

    useEffect(() => {
        const id = window.setInterval(tick, TICK_MS);
        return () => window.clearInterval(id);
    }, []);

    const elapsed   = Math.max(0, performance.now() - startedAt);
    const currentMs = Math.max(0, elapsed - state.lapStartElapsedMs);

    const layout: LayoutProps = {
        bestMs:  state.bestLapMs,
        current: shortTime(currentMs),
        currentMs,
        total:   shortTime(elapsed),
        state,
    };

    if (style === 'advanced') return <AdvancedHud {...layout} />;
    if (style === 'casual')   return <CasualHud {...layout} />;
    return <SimpleHud {...layout} />;
}
