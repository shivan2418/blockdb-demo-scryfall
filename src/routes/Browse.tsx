import { useSearchParams } from "react-router-dom";
import { CardGrid, GridSkeleton } from "../components/CardGrid";
import { FilterPanel } from "../components/FilterPanel";
import { Pagination } from "../components/Pagination";
import { SearchBar } from "../components/SearchBar";
import {
  DEFAULT_WINDOW,
  SORT_LABELS,
  hasAnyFilter,
  usesDefaultWindow,
  type CardFilters,
  type SortKey,
} from "../data/cards";
import { decodeState, encodeState, type BrowseState } from "../data/url-state";
import { useCardSearch } from "../hooks/useCardSearch";
import { ADVANCED_PARAM, ADVANCED_VALUE, AdvancedForm } from "./AdvancedSearch";

const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[];

function ResultSummary({
  total,
  exact,
  filtered,
}: {
  total: number | null;
  exact: boolean;
  filtered: boolean;
}) {
  if (total === null) return <p className="summary">Counting…</p>;
  const amount = `${total.toLocaleString()} ${total === 1 ? "card" : "cards"}`;
  return (
    <p className="summary">
      {/* count() is an upper bound unless the where pruned to zero or was empty. */}
      {exact ? amount : `about ${amount}`}
      {filtered ? (total === 1 && exact ? " matches" : " match") : " in view"}
    </p>
  );
}

export function Browse() {
  const [params, setParams] = useSearchParams();
  const state = decodeState(params);
  const { filters, sort, page } = state;

  const advanced = params.get(ADVANCED_PARAM) === ADVANCED_VALUE;

  const commit = (next: BrowseState, keepAdvanced = advanced) => {
    const encoded = encodeState(next);
    if (keepAdvanced) encoded.set(ADVANCED_PARAM, ADVANCED_VALUE);
    setParams(encoded, { replace: false });
  };
  const setAdvanced = (open: boolean) => commit(state, open);
  const setFilters = (nextFilters: CardFilters) =>
    commit({ filters: nextFilters, sort, page: 0 });

  const result = useCardSearch(filters, sort, page);
  const filtered = hasAnyFilter(filters);

  return (
    <div className={`browse ${advanced ? "browse-advanced" : ""}`}>
      {advanced ? (
        <aside className="filters filters-advanced">
          {/* Re-seeds the draft whenever the applied search changes, e.g. from the search bar. */}
          <AdvancedForm
            key={encodeState({ filters, sort, page: 0 }).toString()}
            initialFilters={filters}
            initialSort={sort}
            onSubmit={(nextFilters, nextSort) =>
              commit({ filters: nextFilters, sort: nextSort, page: 0 })
            }
            onClose={() => setAdvanced(false)}
          />
        </aside>
      ) : (
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          onReset={() => commit({ filters: {}, sort: "relevance", page: 0 })}
          onAdvanced={() => setAdvanced(true)}
        />
      )}

      <main className="results">
        <div className="results-bar">
          <SearchBar
            value={filters.name ?? ""}
            onChange={(name) => setFilters({ ...filters, name: name || undefined })}
          />
          <label className="sort">
            <span className="field-label">Sort</span>
            <select
              value={sort}
              onChange={(event) =>
                commit({ filters, sort: event.target.value as SortKey, page: 0 })
              }
            >
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          {!advanced && (
            <button type="button" className="link-button" onClick={() => setAdvanced(true)}>
              Refine
            </button>
          )}
        </div>

        {usesDefaultWindow(filters, sort) && (
          <p className="notice">
            Sorting {filtered ? "this search" : "all 116,138 cards"} this way would mean
            downloading every card, so this view is limited to names starting with “
            {DEFAULT_WINDOW}”. {filtered ? "Add a narrower filter" : "Search or filter"} to sort the
            full set.
          </p>
        )}

        {result.status !== "error" && (
          <ResultSummary total={result.total} exact={result.totalExact} filtered={filtered} />
        )}

        {result.status === "error" && <p className="error">{result.error}</p>}

        {result.status === "loading" && <GridSkeleton />}

        {result.status === "ready" && result.records.length === 0 && page === 0 && (
          <p className="empty">No cards matched. Try a broader search.</p>
        )}

        {/* Only reachable from a hand-edited or stale link: Pagination never offers a page past the end. */}
        {result.status === "ready" && result.records.length === 0 && page > 0 && (
          <p className="empty">
            This page is past the last result.{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => commit({ filters, sort, page: 0 })}
            >
              Back to the first page
            </button>
          </p>
        )}

        {result.status === "ready" && result.records.length > 0 && (
          <>
            <CardGrid cards={result.records} />
            <Pagination
              page={page}
              hasMore={result.hasMore}
              shown={result.records.length}
              onPage={(nextPage) => commit({ filters, sort, page: nextPage })}
            />
          </>
        )}
      </main>
    </div>
  );
}
