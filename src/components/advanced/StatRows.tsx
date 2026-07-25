import {
  STAT_FIELDS,
  STAT_FIELD_OPTIONS,
  statOpOptions,
  statSupports,
  type StatField,
  type StatOp,
} from "../../data/advanced-fields";
import type { StatFilter } from "../../data/cards";
import { ControlLine } from "./FormRow";
import { SelectField } from "./fields";

const EMPTY_ROW: StatFilter = { field: "cmc", op: "equals", value: "" };

/**
 * Scryfall's repeatable stat rows. One row per stat at most: two rows on the same field
 * would be two filters on one field, which the engine does not take — so a field already
 * used elsewhere is disabled in the other rows' dropdowns.
 */
export function StatRows({
  stats,
  onChange,
}: {
  stats: StatFilter[] | undefined;
  onChange: (next: StatFilter[] | undefined) => void;
}) {
  const rows = stats?.length ? stats : [EMPTY_ROW];

  // Rows with a blank value are kept in the draft so the selects stay usable while the user
  // is still deciding; `buildWhere` and the URL codec both skip them.
  const patch = (index: number, changes: Partial<StatFilter>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...changes } : row)));

  const remove = (index: number) => {
    const next = rows.filter((_, at) => at !== index);
    onChange(next.length ? next : undefined);
  };

  const unused = STAT_FIELDS.filter((field) => !rows.some((row) => row.field === field));

  return (
    <div className="adv-stats">
      {rows.map((row, index) => (
        <ControlLine key={`${row.field}-${index}`}>
          <SelectField
            label={`Stat ${index + 1}`}
            value={row.field}
            // Switching from Mana Value to a string stat can strand a range operator on a
            // field that has none, so fall back to equality when that happens.
            onChange={(field: StatField) =>
              patch(index, { field, op: statSupports(field, row.op) ? row.op : "equals" })
            }
            options={STAT_FIELD_OPTIONS.map((option) => ({
              ...option,
              // Free to pick this row's own field again; taken elsewhere means unavailable.
              unsupported:
                option.value !== row.field && rows.some((other) => other.field === option.value)
                  ? "Already used by another stat row — the engine takes one filter per field."
                  : undefined,
            }))}
          />
          <SelectField
            label={`Stat ${index + 1} requirement`}
            options={statOpOptions(row.field)}
            value={row.op}
            onChange={(op: StatOp) => patch(index, { op })}
          />
          <input
            type={row.field === "cmc" ? "number" : "text"}
            className="adv-input adv-input-narrow"
            aria-label={`Stat ${index + 1} value`}
            placeholder='Any value, e.g. "2"'
            value={row.value}
            onChange={(event) => patch(index, { value: event.target.value })}
          />
          {rows.length > 1 && (
            <button
              type="button"
              className="adv-row-remove"
              aria-label={`Remove stat ${index + 1}`}
              onClick={() => remove(index)}
            >
              ×
            </button>
          )}
        </ControlLine>
      ))}

      {unused.length > 0 && (
        <button
          type="button"
          className="adv-add"
          onClick={() => onChange([...rows, { ...EMPTY_ROW, field: unused[0]! }])}
        >
          + Add another stat
        </button>
      )}
    </div>
  );
}
