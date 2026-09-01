import { isFiveM } from '@/core/nui';
import { apiData } from '@/core/api';

export interface HealthDay {
    day:       string;
    steps:     number;
    distanceM: number;
    activeMs:  number;
    peakHr:    number;
}

export interface HealthSummary {
    goal:    number;
    today:   HealthDay;
    history: HealthDay[];
}

export interface LeaderEntry {
    rank:  number;
    name:  string;
    steps: number;
    you:   boolean;
}

export interface HealthBoard {
    entries: LeaderEntry[];
    rank:    number | null;
    steps:   number;
}

const DEV_NAMES = ['Jane Doe', 'Mike Ross', 'Alex Stone', 'Rae Patel', 'Chris Kim', 'Dana Vega'];

function devDay(back: number, steps: number): HealthDay {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return {
        day:       d.toISOString().slice(0, 10),
        steps,
        distanceM: Math.round(steps * 0.72),
        activeMs:  steps * 900,
        peakHr:    steps > 0 ? 120 + (back % 5) * 8 : 0,
    };
}

function devSummary(): HealthSummary {
    const counts = [7420, 3180, 9960, 5240, 11380, 2870, 6744];
    const history = counts.map((steps, i) => devDay(counts.length - 1 - i, steps));
    return { goal: 10000, today: history[history.length - 1], history };
}

function devBoard(): HealthBoard {
    const entries: LeaderEntry[] = [
        { rank: 1, name: 'Samuel Black', steps: 12480, you: false },
        ...DEV_NAMES.map((name, i) => ({ rank: i + 2, name, steps: 11200 - i * 1450, you: false })),
    ];
    entries.splice(3, 0, { rank: 4, name: 'You', steps: 6744, you: true });
    return { entries: entries.map((e, i) => ({ ...e, rank: i + 1 })), rank: 4, steps: 6744 };
}

export async function apiSummary(): Promise<HealthSummary | null> {
    if (!isFiveM) return devSummary();
    return apiData<HealthSummary>('sd-phone:health:summary');
}

export async function apiLeaderboard(): Promise<HealthBoard | null> {
    if (!isFiveM) return devBoard();
    return apiData<HealthBoard>('sd-phone:health:leaderboard');
}
