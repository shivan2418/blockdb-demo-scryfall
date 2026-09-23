import type { ReactNode } from "react";
import type { CardFilters, ColorMatch } from "../data/cards";
import { useDraftText } from "../hooks/useDraftText";
import { ManaSymbol } from "./ManaSymbol";
import { toggleValue } from "./toggle";

const COLORS = [
  { value: "W", name: "White" },
  { value: "U", name: "Blue" },
  { value: "B", name: "Black" },
  { value: "R", name: "Red" },
  { value: "G", name: "Green" },
];

/** The chips follow whichever comparison the advanced form last set. */
const COLOR_MATCH_HINTS: Record<ColorMatch, string> = {
  any: "Matches cards containing any selected color.",
  including: "Matches cards containing all selected colors.",
  exactly: "Matches cards of exactly the selected colors.",
  atmost: "Matches cards with no colors beyond those selected.",
};

const RARITIES = ["common", "uncommon", "rare", "mythic"];
const MANA_VALUES = [0, 1, 2, 3, 4, 5, 6, 7];

function ChipGroup<T extends string | number>({
  options,
  selected,
  onToggle,
  labelOf = String,
  titleOf,
  classOf,
}: {
  options: T[];
  selected: T[] | undefined;
  onToggle: (value: T) => void;
  labelOf?: (value: T) => ReactNode;
  titleOf?: (value: T) => string;
  classOf?: (value: T) => string;
}) {
  return (
    <div className="chips">
      {options.map((option) => {
        const active = selected?.includes(option) ?? false;
        return (
          <button
            key={String(option)}
            type="button"
            className={`chip ${classOf?.(option) ?? ""} ${active ? "chip-on" : ""}`}
            aria-pressed={active}
            title={titleOf?.(option)}
            onClick={() => onToggle(option)}
          >
            {labelOf(option)}
          </button>
        );
      })}
    </div>
  );
}

function TextFilter({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  const [text, setText] = useDraftText(value ?? "", (next) => onChange(next || undefined));

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="text"
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => setText(event.target.value)}
      />
    </label>
  );
}

export function FilterPanel({
  filters,
  onChange,
  onReset,
  onAdvanced,
}: {
  filters: CardFilters;
  onChange: (filters: CardFilters) => void;
  onReset: () => void;
  onAdvanced: () => void;
}) {
  const patch = (changes: Partial<CardFilters>) => onChange({ ...filters, ...changes });

  return (
    <aside className="filters">
      <div className="filters-head">
        <h2>Filters</h2>
        <button type="button" className="link-button" onClick={onReset}>
          Reset
        </button>
      </div>

      <button type="button" className="advanced-toggle" onClick={onAdvanced}>
        Advanced search
        <span>Text, types, stats, sets, artist and more →</span>
      </button>

      <section className="filter-group">
        <span className="field-label">Colors</span>
        <ChipGroup
          options={COLORS.map((color) => color.value)}
          selected={filters.colors}
          labelOf={(value) => <ManaSymbol symbol={value} decorative />}
          titleOf={(value) => COLORS.find((color) => color.value === value)?.name ?? value}
          classOf={(value) => `chip-color chip-${value.toLowerCase()}`}
          onToggle={(value) => patch({ colors: toggleValue(filters.colors, value) })}
        />
        <p className="hint">{COLOR_MATCH_HINTS[filters.colorMatch ?? "any"]}</p>
      </section>

      <section className="filter-group">
        <span className="field-label">Rarity</span>
        <ChipGroup
          options={RARITIES}
          selected={filters.rarity}
          labelOf={(value) => value[0]!.toUpperCase() + value.slice(1)}
          onToggle={(value) => patch({ rarity: toggleValue(filters.rarity, value) })}
        />
      </section>

      <section className="filter-group">
        <span className="field-label">Mana value</span>
        <ChipGroup
          options={MANA_VALUES}
          selected={filters.cmc}
          labelOf={(value) => String(value)}
          onToggle={(value) => patch({ cmc: toggleValue(filters.cmc, value) })}
        />
      </section>

      <section className="filter-group">
        <TextFilter
          label="Type"
          placeholder="Creature, Instant…"
          value={filters.type}
          onChange={(value) => patch({ type: value })}
        />
        <TextFilter
          label="Rules text"
          placeholder="draw a card"
          value={filters.text}
          onChange={(value) => patch({ text: value })}
        />
        <TextFilter
          label="Artist"
          placeholder="Rebecca Guay"
          value={filters.artist}
          onChange={(value) => patch({ artist: value })}
        />
        <TextFilter
          label="Set code"
          placeholder="blb"
          value={filters.set}
          onChange={(value) => patch({ set: value })}
        />
        <TextFilter
          label="Keyword"
          placeholder="Flying"
          value={filters.keyword}
          onChange={(value) => patch({ keyword: value })}
        />
      </section>
    </aside>
  );
}
