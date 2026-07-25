/**
 * The query facade. Everything the UI knows about static-shard goes through
 * here, so the components deal in plain filter objects.
 */
import { ShardError, type OrderByOf, type WhereOf } from "static-shard";
import { schema, type Schema } from "../shard-db/schema";
import { numericColumnFor, statSupports, type CriterionId, type StatField, type StatOp } from "./advanced-fields";
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

/** Same guard for `games`, whose value set the build also closed. */
type CardGame = CardMeta["fields"]["games"]["values"][number];
const CARD_GAMES: readonly string[] = schema[COLLECTION].fields.games.values;

function knownGames(values: string[]): CardGame[] {
  return values.filter((value): value is CardGame => CARD_GAMES.includes(value));
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

/** One row of the advanced form's Stats section. `value` stays a string — power holds `*`. */
export interface StatFilter {
  field: StatField;
  op: StatOp;
  value: string;
}

export interface CardFilters {
  name?: string;
  type?: string;
  text?: string;
  artist?: string;
  flavor?: string;
  /** Compared whole, not as a substring — `mana_cost` was indexed without `contains`. */
  manaCost?: string;
  /** Matches cards containing ANY of these colors (one filter per field, implicit-AND only). */
  colors?: string[];
  /** Colour identity, same any-of semantics as `colors`. */
  identity?: string[];
  rarity?: string[];
  cmc?: number[];
  set?: string;
  setName?: string;
  keyword?: string;
  games?: string[];
  lang?: string;
  stats?: StatFilter[];
  /** Criteria toggled to IS — each maps to one indexed boolean being true. */
  is?: CriterionId[];
  /** Criteria toggled to NOT. These are `not` riders and cannot prune on their own. */
  not?: CriterionId[];
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
      clean(filters.flavor) ||
      clean(filters.manaCost) ||
      clean(filters.set) ||
      clean(filters.setName) ||
      clean(filters.keyword) ||
      clean(filters.lang) ||
      filters.colors?.length ||
      filters.identity?.length ||
      filters.rarity?.length ||
      filters.cmc?.length ||
      filters.games?.length ||
      filters.stats?.some((stat) => clean(stat.value)) ||
      filters.is?.length ||
      filters.not?.length,
  );
}

/**
 * `"2WW"` → `"{2}{W}{W}"`, so the field's `equals` operator can be used without making the
 * user type braces. Anything already braced is passed through uppercased.
 */
export function normalizeManaCost(value: string): string {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  if (compact.includes("{")) return compact;
  return (compact.match(/\d+|[A-Z/]/g) ?? []).map((token) => `{${token}}`).join("");
}

/**
 * Each criterion writes one indexed boolean. Keys are literal so the generated `WhereOf`
 * still checks every assignment, and the `Record<CriterionId, …>` makes the compiler
 * complain if a criterion is added to the table without a clause here.
 */
const CRITERION_CLAUSES: Record<CriterionId, (where: DraftWhere, on: boolean) => void> = {
  reserved: (where, on) => void (where.reserved = on ? { equals: true } : { not: true }),
  promo: (where, on) => void (where.promo = on ? { equals: true } : { not: true }),
  reprint: (where, on) => void (where.reprint = on ? { equals: true } : { not: true }),
  variation: (where, on) => void (where.variation = on ? { equals: true } : { not: true }),
  digital: (where, on) => void (where.digital = on ? { equals: true } : { not: true }),
  oversized: (where, on) => void (where.oversized = on ? { equals: true } : { not: true }),
  fullart: (where, on) => void (where.full_art = on ? { equals: true } : { not: true }),
  textless: (where, on) => void (where.textless = on ? { equals: true } : { not: true }),
  spotlight: (where, on) =>
    void (where.story_spotlight = on ? { equals: true } : { not: true }),
  booster: (where, on) => void (where.booster = on ? { equals: true } : { not: true }),
  foil: (where, on) => void (where.foil = on ? { equals: true } : { not: true }),
  nonfoil: (where, on) => void (where.nonfoil = on ? { equals: true } : { not: true }),
  gamechanger: (where, on) =>
    void (where.game_changer = on ? { equals: true } : { not: true }),
  hires: (where, on) => void (where.highres_image = on ? { equals: true } : { not: true }),
};

const COMPARISONS = ["lt", "lte", "gt", "gte"] as const;
const isComparison = (op: StatOp): op is (typeof COMPARISONS)[number] =>
  (COMPARISONS as readonly string[]).includes(op);

/** `{ gte: 5 }` etc. — one clause from an operator plus an already-parsed bound. */
const numericClause = (op: StatOp, amount: number): Record<string, number> => ({ [op]: amount });

/**
 * `cmc` is a real number column, so every operator goes straight to it.
 *
 * Power, toughness and loyalty are printed as text (`*`, `1+*`, `∞`), so the build pairs each with
 * a `_num` column derived by the `numeric` normalizer. Comparisons go to the number; equality stays
 * on the printed string, which is the only way `= *` can mean anything. Cards whose printed value
 * has no numeric reading are simply absent from the derived column, so they drop out of comparisons
 * rather than being pinned to a fake 0.
 */
const STAT_CLAUSES: Record<StatField, (where: DraftWhere, op: StatOp, value: string) => void> = {
  cmc: (where, op, value) => {
    const amount = Number.parseFloat(value);
    if (!Number.isFinite(amount)) return;
    where.cmc = numericClause(op, amount) as DraftWhere["cmc"];
  },
  power: (where, op, value) => applyStat(where, "power", op, value),
  toughness: (where, op, value) => applyStat(where, "toughness", op, value),
  loyalty: (where, op, value) => applyStat(where, "loyalty", op, value),
};

function applyStat(where: DraftWhere, field: StatField, op: StatOp, value: string): void {
  const draft = where as Record<string, unknown>;
  if (!isComparison(op)) {
    draft[field] = op === "not" ? { not: value } : { equals: value };
    return;
  }
  const numeric = numericColumnFor(field);
  const amount = Number.parseFloat(value);
  // statSupports already hid comparisons when the build has no numeric column; a non-numeric bound
  // ("compare power to *") has no meaning, so drop the clause rather than invent one.
  if (numeric === undefined || !Number.isFinite(amount)) return;
  draft[numeric] = numericClause(op, amount);
}

/**
 * `not` is a rider: the engine rejects a where whose every clause is a `not`, because there
 * would be nothing to prune shards with. Criteria toggled to NOT can produce exactly that.
 */
function prunes(where: DraftWhere): boolean {
  return Object.values(where).some((filter) =>
    Object.keys(filter ?? {}).some((operator) => operator !== "not"),
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

  const flavor = clean(filters.flavor);
  if (flavor) where.flavor_text = { contains: flavor };

  const manaCost = clean(filters.manaCost);
  if (manaCost) where.mana_cost = { equals: normalizeManaCost(manaCost) };

  const set = clean(filters.set);
  if (set) where.set = { equals: set.toLowerCase() };

  const setName = clean(filters.setName);
  if (setName) where.set_name = { contains: setName };

  const keyword = clean(filters.keyword);
  if (keyword) where.keywords = { some: keyword };

  const lang = clean(filters.lang);
  if (lang) where.lang = { equals: lang.toLowerCase() };

  const colors = filters.colors?.length ? knownColors(filters.colors) : [];
  if (colors.length) where.colors = { some: { in: colors } };

  const identity = filters.identity?.length ? knownColors(filters.identity) : [];
  if (identity.length) where.color_identity = { some: { in: identity } };

  if (filters.rarity?.length) where.rarity = { in: filters.rarity };
  if (filters.cmc?.length) where.cmc = { in: filters.cmc };

  const games = filters.games?.length ? knownGames(filters.games) : [];
  if (games.length) where.games = { some: { in: games } };

  for (const criterion of filters.is ?? []) CRITERION_CLAUSES[criterion](where, true);
  for (const criterion of filters.not ?? []) CRITERION_CLAUSES[criterion](where, false);

  // Last, so an explicit Mana Value row wins over the sidebar's mana-value chips — both
  // target `cmc` and the engine takes one filter per field. Rows whose operator the field
  // does not have are dropped rather than downgraded; the form disables those, so they only
  // arrive from a hand-edited URL.
  for (const stat of filters.stats ?? []) {
    const value = clean(stat.value);
    if (value && statSupports(stat.field, stat.op)) {
      STAT_CLAUSES[stat.field](where, stat.op, value);
    }
  }

  // Never leave the where unprunable — see DEFAULT_SINCE.
  if (!prunes(where)) where.image_updated_at = { gte: DEFAULT_SINCE };

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

/** The `contains` filters — the case-sensitive ones, since the trigram index is not folded. */
const TEXT_FILTERS = ["name", "type", "text", "artist", "flavor", "setName"] as const;

/** Title-cases only the free-text filters, which are the case-sensitive ones. */
function titleCaseFilters(filters: CardFilters): CardFilters {
  const titleCased: CardFilters = { ...filters };
  for (const key of TEXT_FILTERS) {
    const value = filters[key];
    if (value) titleCased[key] = titleCase(value);
  }
  return titleCased;
}

function hasTextFilter(filters: CardFilters): boolean {
  return TEXT_FILTERS.some((key) => clean(filters[key]));
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
