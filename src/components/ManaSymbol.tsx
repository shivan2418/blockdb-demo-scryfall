import { Fragment } from "react";
import { symbolInfo } from "../data/symbols";

/**
 * One Scryfall card symbol, e.g. `"W"`, `"2/U"` or `"T"`. Unknown symbols fall
 * back to the braced text so nothing silently disappears.
 */
export function ManaSymbol({ symbol, decorative = false }: { symbol: string; decorative?: boolean }) {
  const info = symbolInfo(symbol);
  if (!info) return <span className="mana-symbol-missing">{`{${symbol}}`}</span>;
  return (
    <img
      className="mana-symbol"
      src={info.svg}
      alt={decorative ? "" : `{${symbol}}`}
      title={info.name}
      loading="lazy"
    />
  );
}

/** Rules text with each `{…}` token rendered as its symbol. */
export function SymbolText({ text }: { text: string }) {
  const parts = text.split(/\{([^}]+)\}/g);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <ManaSymbol key={index} symbol={part} />
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
