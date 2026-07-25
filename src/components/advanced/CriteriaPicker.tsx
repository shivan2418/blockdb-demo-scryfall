import { CRITERIA, type CriterionId } from "../../data/advanced-fields";

type State = "off" | "is" | "not";

/**
 * Scryfall's Criteria box is an autocomplete over `is:` predicates with an IS/NOT toggle
 * per token. Ours are the indexed booleans, and there are only fourteen, so they are all
 * on screen and each one cycles off → IS → NOT.
 *
 * NOT works because `not` is enabled on every boolean field — but it is a rider the engine
 * cannot prune with, so a NOT-only search falls back to the default window in `buildWhere`.
 */
export function CriteriaPicker({
  is,
  not,
  onChange,
}: {
  is: CriterionId[] | undefined;
  not: CriterionId[] | undefined;
  onChange: (next: { is: CriterionId[] | undefined; not: CriterionId[] | undefined }) => void;
}) {
  const stateOf = (id: CriterionId): State =>
    is?.includes(id) ? "is" : not?.includes(id) ? "not" : "off";

  const cycle = (id: CriterionId) => {
    const next: State = stateOf(id) === "off" ? "is" : stateOf(id) === "is" ? "not" : "off";
    const without = (ids: CriterionId[] | undefined) => ids?.filter((item) => item !== id);
    const add = (ids: CriterionId[] | undefined) => [...(without(ids) ?? []), id];

    const nextIs = next === "is" ? add(is) : without(is);
    const nextNot = next === "not" ? add(not) : without(not);
    onChange({
      is: nextIs?.length ? nextIs : undefined,
      not: nextNot?.length ? nextNot : undefined,
    });
  };

  return (
    <div className="adv-criteria">
      {CRITERIA.map((criterion) => {
        const state = stateOf(criterion.id);
        return (
          <button
            key={criterion.id}
            type="button"
            className={`adv-criterion adv-criterion-${state}`}
            aria-pressed={state !== "off"}
            title={criterion.hint}
            onClick={() => cycle(criterion.id)}
          >
            <span className="adv-criterion-state" aria-hidden="true">
              {state === "not" ? "NOT" : "IS"}
            </span>
            {criterion.label}
          </button>
        );
      })}
    </div>
  );
}
