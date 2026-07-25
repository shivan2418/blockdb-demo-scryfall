import { useEffect, useRef, useState } from "react";
import type { Card } from "../data/card-view";
import { countCards, searchCards, type CardFilters, type SortKey } from "../data/cards";

export interface SearchState {
  status: "loading" | "ready" | "error";
  records: Card[];
  hasMore: boolean;
  correctedCase: boolean;
  /** Approximate upper bound from `count()`; null until it arrives. */
  total: number | null;
  totalExact: boolean;
  error: string | null;
}

const INITIAL: SearchState = {
  status: "loading",
  records: [],
  hasMore: false,
  correctedCase: false,
  total: null,
  totalExact: false,
  error: null,
};

/**
 * Runs the search, then fills in the total separately — `count()` needs no
 * shard fetches, so results paint without waiting on it.
 *
 * Every render gets a fresh request id and late responses from superseded
 * queries are dropped, so fast typing can't flicker older results back in.
 */
export function useCardSearch(filters: CardFilters, sort: SortKey, page: number): SearchState {
  const [state, setState] = useState<SearchState>(INITIAL);
  const requestId = useRef(0);
  const key = JSON.stringify([filters, sort, page]);

  useEffect(() => {
    const id = ++requestId.current;
    const superseded = () => id !== requestId.current;
    setState((prev) => ({ ...prev, status: "loading", error: null }));

    void (async () => {
      try {
        const result = await searchCards(filters, sort, page);
        if (superseded()) return;
        setState({
          status: "ready",
          records: result.records,
          hasMore: result.hasMore,
          correctedCase: result.correctedCase,
          total: null,
          totalExact: false,
          error: null,
        });

        const { count, exact } = await countCards(filters);
        if (superseded()) return;
        setState((prev) => ({ ...prev, total: count, totalExact: exact }));
      } catch (error) {
        if (superseded()) return;
        setState({
          ...INITIAL,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    // `key` serializes every input; filters is a new object each render.
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
