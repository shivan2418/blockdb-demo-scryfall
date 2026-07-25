/**
 * The URL is the single source of truth for browse state, so every result view
 * is a shareable link and back/forward work for free.
 */
import { SORT_LABELS, type CardFilters, type SortKey } from "./cards";

export interface BrowseState {
  filters: CardFilters;
  sort: SortKey;
  page: number;
}

export const EMPTY_STATE: BrowseState = { filters: {}, sort: "relevance", page: 0 };

const isSortKey = (value: string): value is SortKey => value in SORT_LABELS;

const splitList = (value: string | null): string[] | undefined => {
  const parts = value?.split(",").filter(Boolean);
  return parts?.length ? parts : undefined;
};

export function decodeState(params: URLSearchParams): BrowseState {
  const sort = params.get("sort");
  const page = Number.parseInt(params.get("page") ?? "", 10);
  const cmc = splitList(params.get("cmc"))
    ?.map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value));

  return {
    filters: {
      name: params.get("q") ?? undefined,
      type: params.get("type") ?? undefined,
      text: params.get("text") ?? undefined,
      artist: params.get("artist") ?? undefined,
      set: params.get("set") ?? undefined,
      keyword: params.get("kw") ?? undefined,
      colors: splitList(params.get("colors")),
      rarity: splitList(params.get("rarity")),
      cmc: cmc?.length ? cmc : undefined,
    },
    sort: sort && isSortKey(sort) ? sort : EMPTY_STATE.sort,
    page: Number.isFinite(page) && page > 0 ? page : 0,
  };
}

export function encodeState(state: BrowseState): URLSearchParams {
  const params = new URLSearchParams();
  const { filters } = state;

  const setText = (key: string, value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) params.set(key, trimmed);
  };
  const setList = (key: string, values: (string | number)[] | undefined) => {
    if (values?.length) params.set(key, values.join(","));
  };

  setText("q", filters.name);
  setText("type", filters.type);
  setText("text", filters.text);
  setText("artist", filters.artist);
  setText("set", filters.set);
  setText("kw", filters.keyword);
  setList("colors", filters.colors);
  setList("rarity", filters.rarity);
  setList("cmc", filters.cmc);

  if (state.sort !== EMPTY_STATE.sort) params.set("sort", state.sort);
  if (state.page > 0) params.set("page", String(state.page));

  return params;
}
