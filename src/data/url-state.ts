/**
 * The URL is the single source of truth for browse state, so every result view
 * is a shareable link and back/forward work for free.
 *
 * The advanced form reads the same params, which is what lets "edit this search" round-trip
 * between the results page and `/advanced` without a store between them.
 */
import {
  isCriterionId,
  isLanguage,
  isStatField,
  isStatOp,
  statSupports,
  type CriterionId,
} from "./advanced-fields";
import { SORT_LABELS, type CardFilters, type SortKey, type StatFilter } from "./cards";

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

/**
 * `"cmc:gte:3,power:equals:2"` → stat rows, dropping anything the tables don't recognise,
 * including an operator the named field was not indexed with.
 */
function decodeStats(value: string | null): StatFilter[] | undefined {
  const rows = (splitList(value) ?? []).flatMap((entry) => {
    const [field, op, ...rest] = entry.split(":");
    if (!field || !op || !isStatField(field) || !isStatOp(op)) return [];
    if (!statSupports(field, op)) return [];
    const raw = rest.join(":").trim();
    return raw ? [{ field, op, value: raw }] : [];
  });
  return rows.length ? rows : undefined;
}

function encodeStats(stats: StatFilter[] | undefined): string | undefined {
  const rows = (stats ?? [])
    .filter((stat) => stat.value.trim())
    .map((stat) => `${stat.field}:${stat.op}:${stat.value.trim()}`);
  return rows.length ? rows.join(",") : undefined;
}

function decodeCriteria(value: string | null): CriterionId[] | undefined {
  const ids = (splitList(value) ?? []).filter(isCriterionId);
  return ids.length ? ids : undefined;
}

export function decodeState(params: URLSearchParams): BrowseState {
  const sort = params.get("sort");
  const page = Number.parseInt(params.get("page") ?? "", 10);
  const cmc = splitList(params.get("cmc"))
    ?.map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value));
  const lang = params.get("lang") ?? undefined;

  return {
    filters: {
      name: params.get("q") ?? undefined,
      type: params.get("type") ?? undefined,
      text: params.get("text") ?? undefined,
      artist: params.get("artist") ?? undefined,
      flavor: params.get("flavor") ?? undefined,
      manaCost: params.get("mana") ?? undefined,
      set: params.get("set") ?? undefined,
      setName: params.get("setname") ?? undefined,
      keyword: params.get("kw") ?? undefined,
      lang: lang && isLanguage(lang) ? lang : undefined,
      colors: splitList(params.get("colors")),
      identity: splitList(params.get("identity")),
      rarity: splitList(params.get("rarity")),
      cmc: cmc?.length ? cmc : undefined,
      games: splitList(params.get("games")),
      stats: decodeStats(params.get("stats")),
      is: decodeCriteria(params.get("is")),
      not: decodeCriteria(params.get("not")),
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
  setText("flavor", filters.flavor);
  setText("mana", filters.manaCost);
  setText("set", filters.set);
  setText("setname", filters.setName);
  setText("kw", filters.keyword);
  setText("lang", filters.lang);
  setList("colors", filters.colors);
  setList("identity", filters.identity);
  setList("rarity", filters.rarity);
  setList("cmc", filters.cmc);
  setList("games", filters.games);
  setText("stats", encodeStats(filters.stats));
  setList("is", filters.is);
  setList("not", filters.not);

  if (state.sort !== EMPTY_STATE.sort) params.set("sort", state.sort);
  if (state.page > 0) params.set("page", String(state.page));

  return params;
}
