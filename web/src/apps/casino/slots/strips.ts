export type SlotSymbolId = 'crown' | 'seven' | 'horseshoe' | 'bell' | 'diamond' | 'club' | 'heart' | 'spade';

export const STRIP_LEN = 32;

const CR: SlotSymbolId = 'crown';
const S7: SlotSymbolId = 'seven';
const HS: SlotSymbolId = 'horseshoe';
const BL: SlotSymbolId = 'bell';
const DI: SlotSymbolId = 'diamond';
const CL: SlotSymbolId = 'club';
const HE: SlotSymbolId = 'heart';
const SP: SlotSymbolId = 'spade';

export const REELS: SlotSymbolId[][] = [
    [SP, HE, DI, BL, SP, CL, HE, S7, SP, DI, HE, HS, CL, SP, HE, BL, DI, CR, SP, CL, HE, DI, BL, HS, SP, CL, HE, S7, DI, CL, BL, HS],
    [HE, SP, CL, DI, HE, BL, SP, HS, CL, HE, DI, SP, S7, HE, CL, BL, SP, DI, HE, HS, CL, SP, BL, DI, CR, HE, SP, CL, S7, DI, BL, HS],
    [DI, HE, SP, CL, BL, HE, SP, DI, HS, CL, HE, SP, BL, DI, S7, HE, CL, SP, HS, DI, HE, BL, SP, CL, HE, CR, DI, SP, S7, CL, BL, HS],
];

export function stripAt(reel: number, index: number): SlotSymbolId {
    const strip = REELS[reel];
    return strip[(((index - 1) % STRIP_LEN) + STRIP_LEN) % STRIP_LEN];
}

export function windowAt(reel: number, stop: number): SlotSymbolId[] {
    return [stripAt(reel, stop - 1), stripAt(reel, stop), stripAt(reel, stop + 1)];
}
