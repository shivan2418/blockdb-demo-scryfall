import type { CardFilters } from "../data/cards";
import { toggleValue } from "./toggle";

const COLORS = [
  { value: "W", label: "W", name: "White" },
  { value: "U", label: "U", name: "Blue" },
  { value: "B", label: "B", name: "Black" },
  { value: "R", label: "R", name: "Red" },
  { value: "G", label: "G", name: "Green" },
];

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
  labelOf?: (value: T) => string;
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
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="text"
        value={value ?? ""}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value || undefined)}
      />
    </label>
  );
}

export function FilterPanel({
  filters,
  onChange,
  onReset,
}: {
  filters: CardFilters;
  onChange: (filters: CardFilters) => void;
  onReset: () => void;
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

      <section className="filter-group">
        <span className="field-label">Colors</span>
        <ChipGroup
          options={COLORS.map((color) => color.value)}
          selected={filters.colors}
          labelOf={(value) => COLORS.find((color) => color.value === value)?.label ?? value}
          titleOf={(value) => COLORS.find((color) => color.value === value)?.name ?? value}
          classOf={(value) => `chip-color chip-${value.toLowerCase()}`}
          onToggle={(value) => patch({ colors: toggleValue(filters.colors, value) })}
        />
        <p className="hint">Matches cards containing any selected color.</p>
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
