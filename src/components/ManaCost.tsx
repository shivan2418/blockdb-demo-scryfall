import { manaSymbols } from "../data/card-view";
import { ManaSymbol } from "./ManaSymbol";

/** Renders `"{2}{R}"` as Scryfall's mana symbols. */
export function ManaCost({ cost }: { cost: string | undefined }) {
  const symbols = manaSymbols(cost);
  if (symbols.length === 0) return null;

  return (
    <span className="mana-cost" aria-label={cost}>
      {symbols.map((symbol, index) => (
        <ManaSymbol key={`${symbol}-${index}`} symbol={symbol} decorative />
      ))}
    </span>
  );
}
