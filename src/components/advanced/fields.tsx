import type { Option } from "../../data/advanced-fields";
import { MANA_SYMBOLS } from "../../data/advanced-fields";

export function TextField({
  label,
  placeholder,
  value,
  onChange,
  wide = true,
}: {
  label: string;
  placeholder: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  wide?: boolean;
}) {
  return (
    <input
      type="text"
      className={wide ? "adv-input" : "adv-input adv-input-narrow"}
      aria-label={label}
      value={value ?? ""}
      placeholder={placeholder}
      autoComplete="off"
      onChange={(event) => onChange(event.target.value || undefined)}
    />
  );
}

/**
 * A select whose unsupported options stay visible but disabled, so the operators this build
 * lacks are apparent from the dropdown itself rather than only from the hint.
 */
export function SelectField<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[] | Option[];
  value: string;
  onChange: (value: T) => void;
}) {
  return (
    <select
      className="adv-select"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map((option) => (
        // A disabled option already reads as unavailable; spelling it out in the label would
        // widen the select to the longest reason.
        <option
          key={option.value}
          value={option.value}
          disabled={Boolean(option.unsupported)}
          title={option.unsupported}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Checkbox row, Scryfall's box-then-label shape. */
export function CheckGroup({
  legend,
  options,
  selected,
  onToggle,
  pips = false,
}: {
  legend: string;
  options: Option[];
  selected: string[] | undefined;
  onToggle: (value: string) => void;
  /** Render a coloured mana pip between the box and the label, as the colour rows do. */
  pips?: boolean;
}) {
  return (
    <div className="adv-checks" role="group" aria-label={legend}>
      {options.map((option) => (
        <label
          key={option.value}
          className={`adv-check ${option.unsupported ? "adv-check-off" : ""}`}
          title={option.unsupported}
        >
          <input
            type="checkbox"
            checked={selected?.includes(option.value) ?? false}
            disabled={Boolean(option.unsupported)}
            onChange={() => onToggle(option.value)}
          />
          {pips && (
            <span className={`pip pip-${option.value.toLowerCase()}`} aria-hidden="true">
              {option.value}
            </span>
          )}
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * Scryfall's "Add symbol" picker. Appends `{X}` to the field it belongs to rather than
 * opening a palette, which is the same result in one control.
 */
export function SymbolPicker({ onInsert }: { onInsert: (symbol: string) => void }) {
  return (
    <select
      className="adv-select adv-symbol"
      aria-label="Add symbol"
      value=""
      onChange={(event) => {
        if (event.target.value) onInsert(`{${event.target.value}}`);
      }}
    >
      <option value="">⊕ Add symbol</option>
      {MANA_SYMBOLS.map((symbol) => (
        <option key={symbol} value={symbol}>
          {`{${symbol}}`}
        </option>
      ))}
    </select>
  );
}
