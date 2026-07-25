import { useSearchParams } from "react-router-dom";
import { CardGrid, GridSkeleton } from "../components/CardGrid";
import { FilterPanel } from "../components/FilterPanel";
import { Pagination } from "../components/Pagination";
import { SearchBar } from "../components/SearchBar";
import { SORT_LABELS, hasAnyFilter, type CardFilters, type SortKey } from "../data/cards";
import { decodeState, encodeState, type BrowseState } from "../data/url-state";
import { useCardSearch } from "../hooks/useCardSearch";

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
  const amount = total.toLocaleString();
  return (
    <p className="summary">
      {/* count() is an upper bound unless the where pruned to zero or was empty. */}
      {exact ? `${amount} cards` : `about ${amount} cards`}
      {filtered ? " match" : " in view"}
    </p>
  );
}

export function Browse() {
  const [params, setParams] = useSearchParams();
  const state = decodeState(params);
  const { filters, sort, page } = state;

  const commit = (next: BrowseState) => setParams(encodeState(next), { replace: false });
  const setFilters = (nextFilters: CardFilters) =>
    commit({ filters: nextFilters, sort, page: 0 });

  const result = useCardSearch(filters, sort, page);
  const filtered = hasAnyFilter(filters);

  return (
    <div className="browse">
      <FilterPanel
        filters={filters}
        onChange={setFilters}
        onReset={() => commit({ filters: {}, sort: "relevance", page: 0 })}
      />

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
        </div>

        {!filtered && (
          <p className="notice">
            Showing the most recently updated cards. Search or filter to query the full set of
            116,138 — every result is fetched straight from static files.
          </p>
        )}

        {result.correctedCase && (
          <p className="notice">Matched using title case — card text is case-sensitive.</p>
        )}

        <ResultSummary total={result.total} exact={result.totalExact} filtered={filtered} />

        {result.status === "error" && <p className="error">{result.error}</p>}

        {result.status === "loading" && <GridSkeleton />}

        {result.status === "ready" && result.records.length === 0 && (
          <p className="empty">No cards matched. Try a broader search.</p>
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
