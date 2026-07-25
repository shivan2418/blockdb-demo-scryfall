/**
 * The query facade. Everything the UI knows about static-shard goes through
 * here, so the components deal in plain filter objects.
 */
import { ShardError, type OrderByOf, type WhereOf } from "static-shard";
import { schema, type Schema } from "../shard-db/schema";
import type { Card } from "./card-view";
import { cards } from "./client";
import { COLLECTION } from "./collection";

type CardMeta = Schema[typeof COLLECTION];

/**
 * The build declares `colors` as a closed value set, so `in` accepts only those values. Filters
 * arrive from the URL as free text, hence the guard — and it reads the permitted values off the
 * generated schema rather than restating them, so a rebuild that widens the set widens this too.
 */
type CardColor = CardMeta["fields"]["colors"]["values"][number];
const CARD_COLORS: readonly string[] = schema[COLLECTION].fields.colors.values;

function knownColors(values: string[]): CardColor[] {
  return values.filter((value): value is CardColor => CARD_COLORS.includes(value));
}

/** Only indexed fields, each with only the operators the build actually made available. */
export type CardWhere = WhereOf<CardMeta>;
export type CardOrderBy = OrderByOf<CardMeta>;

/** The generated schema is `as const`, so `WhereOf` comes back readonly — assemble into this. */
type DraftWhere = { -readonly [K in keyof CardWhere]: CardWhere[K] };

export const PAGE_SIZE = 60;

/**
 * A query downloads every shard it touches, whole — `limit` only trims the
 * result, it does not reduce fetching. An unfiltered browse would therefore
 * pull all 529 shards (~722 MB) just to fill one page.
 *
 * `image_updated_at` is the dataset's sort field, so a range on it is the one
 * filter that prunes to a contiguous handful of shards. This cutoff is the
 * newest ~1,500 cards (~7 shards) and stands in whenever the user has selected
 * nothing else.
 */
export const DEFAULT_SINCE = "2026-07-13T13:14:30Z";

export interface CardFilters {
  name?: string;
  type?: string;
  text?: string;
  artist?: string;
  /** Matches cards containing ANY of these colors (one filter per field, implicit-AND only). */
  colors?: string[];
  rarity?: string[];
  cmc?: number[];
  set?: string;
  keyword?: string;
}

export type SortKey =
  | "relevance"
  | "newest"
  | "oldest"
  | "name"
  | "name-desc"
  | "cmc"
  | "cmc-desc"
  | "popular";

export const SORT_LABELS: Record<SortKey, string> = {
  relevance: "Default order",
  newest: "Newest release",
  oldest: "Oldest release",
  name: "Name A–Z",
  "name-desc": "Name Z–A",
  cmc: "Mana value ↑",
  "cmc-desc": "Mana value ↓",
  popular: "Most popular",
};

/** `"lightning bolt"` → `"Lightning Bolt"`, matching how card names are printed. */
export function titleCase(value: string): string {
  return value.replace(/\b\p{Ll}/gu, (char) => char.toUpperCase());
}

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/** True when nothing was selected, so the default-window filter is what will run. */
export function isDefaultBrowse(filters: CardFilters): boolean {
  return Object.keys(buildWhere(filters)).length === 1 && !hasAnyFilter(filters);
}

export function hasAnyFilter(filters: CardFilters): boolean {
  return Boolean(
    clean(filters.name) ||
      clean(filters.type) ||
      clean(filters.text) ||
      clean(filters.artist) ||
      clean(filters.set) ||
      clean(filters.keyword) ||
      filters.colors?.length ||
      filters.rarity?.length ||
      filters.cmc?.length,
  );
}

export function buildWhere(filters: CardFilters): CardWhere {
  const where: DraftWhere = {};

  const name = clean(filters.name);
  if (name) where.name = { contains: name };

  const type = clean(filters.type);
  if (type) where.type_line = { contains: type };

  const text = clean(filters.text);
  if (text) where.oracle_text = { contains: text };

  const artist = clean(filters.artist);
  if (artist) where.artist = { contains: artist };

  const set = clean(filters.set);
  if (set) where.set = { equals: set.toLowerCase() };

  const keyword = clean(filters.keyword);
  if (keyword) where.keywords = { some: keyword };

  const colors = filters.colors?.length ? knownColors(filters.colors) : [];
  if (colors.length) where.colors = { some: { in: colors } };
  if (filters.rarity?.length) where.rarity = { in: filters.rarity };
  if (filters.cmc?.length) where.cmc = { in: filters.cmc };

  // Never leave the where empty — see DEFAULT_SINCE.
  if (Object.keys(where).length === 0) where.image_updated_at = { gte: DEFAULT_SINCE };

  return where;
}

export function buildOrderBy(sort: SortKey): CardOrderBy | undefined {
  switch (sort) {
    case "relevance":
      return undefined;
    case "newest":
      return { released_at: "desc" };
    case "oldest":
      return { released_at: "asc" };
    case "name":
      return { name: "asc" };
    case "name-desc":
      return { name: "desc" };
    case "cmc":
      return { cmc: "asc" };
    case "cmc-desc":
      return { cmc: "desc" };
    case "popular":
      // Unranked cards sort first (the engine orders missing values low), so
      // this reads as "popularity, obscure cards last" rather than a strict top-N.
      return { edhrec_rank: "asc" };
  }
}

/** Title-cases only the free-text filters, which are the case-sensitive ones. */
function titleCaseFilters(filters: CardFilters): CardFilters {
  return {
    ...filters,
    name: filters.name && titleCase(filters.name),
    type: filters.type && titleCase(filters.type),
    text: filters.text && titleCase(filters.text),
    artist: filters.artist && titleCase(filters.artist),
  };
}

function hasTextFilter(filters: CardFilters): boolean {
  return Boolean(clean(filters.name) || clean(filters.type) || clean(filters.text) || clean(filters.artist));
}

export interface SearchResult {
  records: Card[];
  hasMore: boolean;
  /** Set when the literal query found nothing and the title-cased retry did. */
  correctedCase: boolean;
  /**
   * The filters the returned records were actually fetched with — the title-cased set whenever
   * `correctedCase`. Counting the caller's original filters instead would report 0 for exactly the
   * queries the retry rescued, since the literal query is the one that matched nothing.
   */
  appliedFilters: CardFilters;
  /**
   * Exact match count, when the query already had to see every match — free, and vastly better than
   * `count()`'s zero-fetch upper bound (which reads ~35,000 for an artist with 396 cards). Absent
   * when the shard walk stopped as soon as the page was full, since the tail was never fetched.
   */
  total?: number;
}

export async function searchCards(
  filters: CardFilters,
  sort: SortKey,
  page: number,
): Promise<SearchResult> {
  const run = (applied: CardFilters) =>
    cards.findMany({
      where: buildWhere(applied),
      orderBy: buildOrderBy(sort),
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });

  try {
    const result = await run(filters);
    // `contains` is a case-sensitive substring test and the trigram index isn't
    // case-normalized, so a lowercase query can't match Title Case card names.
    // Retry once, title-cased, before reporting no results.
    if (result.records.length === 0 && hasTextFilter(filters)) {
      const titleCased = titleCaseFilters(filters);
      const retried = await run(titleCased);
      if (retried.records.length > 0) {
        return { ...retried, correctedCase: true, appliedFilters: titleCased };
      }
    }
    return { ...result, correctedCase: false, appliedFilters: filters };
  } catch (error) {
    throw friendlyError(error);
  }
}

export async function countCards(filters: CardFilters): Promise<{ count: number; exact: boolean }> {
  try {
    return await cards.count(buildWhere(filters));
  } catch (error) {
    throw friendlyError(error);
  }
}

export async function getCard(id: string): Promise<Card | null> {
  try {
    return await cards.get(id);
  } catch (error) {
    throw friendlyError(error);
  }
}

function friendlyError(error: unknown): Error {
  if (error instanceof ShardError) {
    if (error.code === "LIMIT_EXCEEDED") {
      return new Error("That search matches too many cards to load at once — narrow it with a filter.");
    }
    return new Error(`Could not load card data (${error.code}).`);
  }
  return error instanceof Error ? error : new Error("Something went wrong loading cards.");
}
