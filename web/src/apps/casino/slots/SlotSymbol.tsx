import type { SlotSymbolId } from './strips';

const PLATE =
    '<rect x="6" y="6" width="52" height="52" rx="13" fill="#F3F6F4"/>'
  + '<rect x="7" y="7" width="50" height="50" rx="12" fill="none" stroke="#0B0B0B" stroke-opacity="0.14" stroke-width="1.5"/>';

const ART: Record<SlotSymbolId, string> = {
    crown:
        '<path d="M8 44 L4 17 L20 28 L32 9 L44 28 L60 17 L56 44 Z" fill="#D4AF5F"/>'
      + '<path d="M8 44 L4 17 L20 28 L32 9 L32 44 Z" fill="#F0D48A"/>'
      + '<rect x="7" y="43" width="50" height="11" rx="4" fill="#A97F31"/>'
      + '<rect x="7" y="43" width="50" height="4" rx="2" fill="#FFF3CE"/>'
      + '<circle cx="32" cy="33" r="5" fill="#C1272D"/>'
      + '<circle cx="30.2" cy="31.2" r="1.5" fill="#FF9AA0"/>'
      + '<circle cx="4" cy="16" r="3.4" fill="#FFF3CE"/>'
      + '<circle cx="60" cy="16" r="3.4" fill="#FFF3CE"/>'
      + '<circle cx="32" cy="8" r="3.6" fill="#FFF3CE"/>',
    seven:
        '<path d="M12 10 H52 V19 L33 55 H19 L37 21 H12 Z" fill="#C1272D" stroke="#D4AF5F" stroke-width="3" stroke-linejoin="round"/>'
      + '<path d="M15.5 13.5 H48 L46 18 H15.5 Z" fill="#E0555A"/>'
      + '<path d="M33.5 24 L23 50" fill="none" stroke="#E0555A" stroke-width="3" stroke-linecap="round"/>',
    horseshoe:
        '<path d="M19 52 C7 44 6 26 16 16 C24 8 40 8 48 16 C58 26 57 44 45 52" fill="none" stroke="#D4AF5F" stroke-width="10" stroke-linecap="round"/>'
      + '<path d="M19 52 C9 44 8 27 17 17" fill="none" stroke="#F0D48A" stroke-width="3.4" stroke-linecap="round"/>'
      + '<g fill="#8A6524">'
      + '<circle cx="14.5" cy="41" r="2.1"/><circle cx="12.5" cy="30" r="2.1"/><circle cx="17.5" cy="20" r="2.1"/>'
      + '<circle cx="32" cy="14.5" r="2.1"/>'
      + '<circle cx="46.5" cy="20" r="2.1"/><circle cx="51.5" cy="30" r="2.1"/><circle cx="49.5" cy="41" r="2.1"/>'
      + '</g>'
      + '<rect x="13" y="49" width="11" height="6" rx="2.5" fill="#A97F31"/>'
      + '<rect x="40" y="49" width="11" height="6" rx="2.5" fill="#A97F31"/>',
    bell:
        '<path d="M32 11 C21 11 15 19 15 29 C15 40 12 44 9 47 H55 C52 44 49 40 49 29 C49 19 43 11 32 11 Z" fill="#D4AF5F"/>'
      + '<path d="M32 11 C21 11 15 19 15 29 C15 40 12 44 9 47 H26 C24 44 23 40 23 29 C23 19 26 13 32 11 Z" fill="#F0D48A"/>'
      + '<rect x="7" y="45" width="50" height="6" rx="3" fill="#A97F31"/>'
      + '<circle cx="32" cy="56" r="4.6" fill="#A97F31"/>'
      + '<circle cx="32" cy="9" r="4" fill="#F0D48A"/>'
      + '<path d="M19.5 21 C20.5 17.5 23.5 14.5 27 13.5" fill="none" stroke="#FFF3CE" stroke-width="2.4" stroke-linecap="round"/>',
    diamond: PLATE + '<path d="M32 14 L47 32 L32 50 L17 32 Z" fill="#C1272D"/>',
    heart:   PLATE + '<path d="M32 49 C21 40 15 34 15 27.5 C15 22 19 18 24 18 C27.6 18 30.6 20 32 22.6 C33.4 20 36.4 18 40 18 C45 18 49 22 49 27.5 C49 34 43 40 32 49 Z" fill="#C1272D"/>',
    club:
        PLATE
      + '<circle cx="32" cy="23" r="8.4" fill="#141414"/><circle cx="22.5" cy="34.5" r="8.4" fill="#141414"/><circle cx="41.5" cy="34.5" r="8.4" fill="#141414"/>'
      + '<path d="M29 34 H35 L38.5 49 H25.5 Z" fill="#141414"/>',
    spade:
        PLATE
      + '<path d="M32 14 C32 14 47.5 26.5 47.5 35 C47.5 39.8 44 43.2 39.6 43.2 C37.2 43.2 35.2 42.2 33.8 40.8 L36.4 49.5 H27.6 L30.2 40.8 C28.8 42.2 26.8 43.2 24.4 43.2 C20 43.2 16.5 39.8 16.5 35 C16.5 26.5 32 14 32 14 Z" fill="#141414"/>',
};

function toUri(body: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const BG = Object.fromEntries(
    (Object.keys(ART) as SlotSymbolId[]).map(id => [id, toUri(ART[id])]),
) as Record<SlotSymbolId, string>;

export function SlotSymbol({ id, size }: { id: SlotSymbolId; size: number }) {
    return (
        <span
            aria-hidden="true"
            style={{
                display: 'block',
                width: size,
                height: size,
                backgroundImage: BG[id],
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
            }}
        />
    );
}
