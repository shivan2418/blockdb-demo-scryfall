/**
 * Card-symbol lookup over a snapshot of Scryfall's `/symbology` list
 * (regenerate with `scripts/fetch_symbology.py`). The SVGs are hotlinked from
 * svgs.scryfall.io, same as the card images.
 */
import symbology from "./symbology.json";

export interface SymbolInfo {
  svg: string;
  name: string;
}

const TABLE: Record<string, SymbolInfo> = symbology;

/** `"W"` or `"{W}"` → its SVG and English name; undefined if Scryfall has no such symbol. */
export function symbolInfo(symbol: string): SymbolInfo | undefined {
  const braced = symbol.startsWith("{") ? symbol : `{${symbol}}`;
  return TABLE[braced];
}
