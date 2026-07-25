import { manaSymbols } from "../data/card-view";

const COLOR_PIPS: Record<string, string> = {
  W: "pip-w",
  U: "pip-u",
  B: "pip-b",
  R: "pip-r",
  G: "pip-g",
};

/** Renders `"{2}{R}"` as coloured pips; hybrid pips keep their slash. */
export function ManaCost({ cost }: { cost: string | undefined }) {
  const symbols = manaSymbols(cost);
  if (symbols.length === 0) return null;

  return (
    <span className="mana-cost">
      {symbols.map((symbol, index) => (
        <span
          key={`${symbol}-${index}`}
          className={`pip ${COLOR_PIPS[symbol] ?? "pip-generic"}`}
          title={symbol}
        >
          {symbol}
        </span>
      ))}
    </span>
  );
}
