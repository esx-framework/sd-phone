export function comma(n: number): string {
    return Math.round(n).toLocaleString('en-US');
}

export function compact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
    return String(Math.round(n));
}

export function duration(secs: number): string {
    if (!Number.isFinite(secs) || secs <= 0) return '0s';
    if (secs < 60) return `${Math.max(1, Math.round(secs))}s`;
    const mins = Math.floor(secs / 60);
    const rest = Math.round(secs % 60);
    if (mins < 60) return rest > 0 ? `${mins}m ${rest}s` : `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function clockOf(epoch: number): string {
    return new Date(epoch * 1000).toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}
