
export const COLS = 7;
export const ROWS = 6;

type Disc = 0 | 1 | 2;
export type Player = 1 | 2;
export type Board = Disc[];

export const idx = (r: number, c: number): number => r * COLS + c;

export type Difficulty = 'easy' | 'medium' | 'hard';
export interface AiOptions { depth: number; blunder: number }
export const AI: Record<Difficulty, AiOptions> = {
    easy:   { depth: 2, blunder: 0.4 },
    medium: { depth: 4, blunder: 0.1 },
    hard:   { depth: 6, blunder: 0 },
};

export function emptyBoard(): Board {
    return Array<Disc>(ROWS * COLS).fill(0);
}

export function dropRow(board: Board, col: number): number {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[idx(r, col)] === 0) return r;
    }
    return -1;
}

function columnFull(board: Board, col: number): boolean {
    return board[idx(0, col)] !== 0;
}

export function isFull(board: Board): boolean {
    for (let c = 0; c < COLS; c++) if (!columnFull(board, c)) return false;
    return true;
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
    [0, 1], [1, 0], [1, 1], [1, -1],
];

export function findWin(board: Board, player: Player): number[] | null {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[idx(r, c)] !== player) continue;
            for (const [dr, dc] of DIRS) {
                const line = [idx(r, c)];
                let rr = r + dr;
                let cc = c + dc;
                while (
                    rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS &&
                    board[idx(rr, cc)] === player
                ) {
                    line.push(idx(rr, cc));
                    if (line.length === 4) return line;
                    rr += dr;
                    cc += dc;
                }
            }
        }
    }
    return null;
}

function hasWon(board: Board, player: Player): boolean {
    return findWin(board, player) !== null;
}

const other = (p: Player): Player => (p === 1 ? 2 : 1);


const CENTER = Math.floor(COLS / 2);
const SEARCH_ORDER: number[] = (() => {
    const order: number[] = [];
    for (let off = 0; off < COLS; off++) {
        if (off === 0) order.push(CENTER);
        else {
            if (CENTER - off >= 0) order.push(CENTER - off);
            if (CENTER + off < COLS) order.push(CENTER + off);
        }
    }
    return order;
})();

const WIN = 100_000;

function scoreWindow(a: Disc, b: Disc, c: Disc, d: Disc, me: Player): number {
    const foe = other(me);
    let mine = 0;
    let theirs = 0;
    let empty = 0;
    for (const v of [a, b, c, d]) {
        if (v === me) mine++;
        else if (v === foe) theirs++;
        else empty++;
    }
    if (mine > 0 && theirs > 0) return 0;
    if (mine === 4) return 1000;
    if (mine === 3 && empty === 1) return 18;
    if (mine === 2 && empty === 2) return 4;
    if (theirs === 3 && empty === 1) return -16;
    if (theirs === 2 && empty === 2) return -3;
    return 0;
}

function heuristic(board: Board, me: Player): number {
    let score = 0;

    let centerCount = 0;
    for (let r = 0; r < ROWS; r++) if (board[idx(r, CENTER)] === me) centerCount++;
    score += centerCount * 6;

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (c + 3 < COLS) {
                score += scoreWindow(
                    board[idx(r, c)], board[idx(r, c + 1)],
                    board[idx(r, c + 2)], board[idx(r, c + 3)], me,
                );
            }
            if (r + 3 < ROWS) {
                score += scoreWindow(
                    board[idx(r, c)], board[idx(r + 1, c)],
                    board[idx(r + 2, c)], board[idx(r + 3, c)], me,
                );
            }
            if (r + 3 < ROWS && c + 3 < COLS) {
                score += scoreWindow(
                    board[idx(r, c)], board[idx(r + 1, c + 1)],
                    board[idx(r + 2, c + 2)], board[idx(r + 3, c + 3)], me,
                );
            }
            if (r + 3 < ROWS && c - 3 >= 0) {
                score += scoreWindow(
                    board[idx(r, c)], board[idx(r + 1, c - 1)],
                    board[idx(r + 2, c - 2)], board[idx(r + 3, c - 3)], me,
                );
            }
        }
    }
    return score;
}

function search(
    board: Board,
    depth: number,
    alpha: number,
    beta: number,
    toMove: Player,
    me: Player,
): number {
    if (hasWon(board, me)) return WIN + depth;
    if (hasWon(board, other(me))) return -WIN - depth;

    const moves = SEARCH_ORDER.filter((c: number) => !columnFull(board, c));
    if (moves.length === 0) return 0;
    if (depth === 0) return heuristic(board, me);

    const maximizing = toMove === me;
    let best = maximizing ? -Infinity : Infinity;
    let a = alpha;
    let b = beta;

    for (const col of moves) {
        const r = dropRow(board, col);
        board[idx(r, col)] = toMove;
        const val = search(board, depth - 1, a, b, other(toMove), me);
        board[idx(r, col)] = 0;

        if (maximizing) {
            if (val > best) best = val;
            if (best > a) a = best;
        } else {
            if (val < best) best = val;
            if (best < b) b = best;
        }
        if (b <= a) break;
    }
    return best;
}

export function chooseMove(board: Board, me: Player, opts: AiOptions = AI.hard): number {
    const moves = SEARCH_ORDER.filter((c: number) => !columnFull(board, c));
    if (moves.length === 0) return -1;
    if (moves.length === 1) return moves[0];

    const foe = other(me);

    if (opts.blunder > 0 && Math.random() < opts.blunder) {
        return moves[Math.floor(Math.random() * moves.length)];
    }

    for (const col of moves) {
        const r = dropRow(board, col);
        board[idx(r, col)] = me;
        const win = hasWon(board, me);
        board[idx(r, col)] = 0;
        if (win) return col;
    }

    for (const col of moves) {
        const r = dropRow(board, col);
        board[idx(r, col)] = foe;
        const foeWin = hasWon(board, foe);
        board[idx(r, col)] = 0;
        if (foeWin) return col;
    }

    let bestCol = moves[0];
    let bestVal = -Infinity;
    for (const col of moves) {
        const r = dropRow(board, col);
        board[idx(r, col)] = me;
        const val = search(board, opts.depth - 1, -Infinity, Infinity, foe, me);
        board[idx(r, col)] = 0;
        if (val > bestVal) {
            bestVal = val;
            bestCol = col;
        }
    }
    return bestCol;
}
