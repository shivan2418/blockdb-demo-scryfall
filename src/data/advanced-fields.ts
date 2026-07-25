/**
 * Option tables for the advanced search form, mirroring Scryfall's own advanced page
 * section by section.
 *
 * Every option here is either backed by an indexed field with the operator it needs, or
 * carries an `unsupported` reason explaining what the build would have to change to make
 * it work. Nothing is silently dropped: the form renders the disabled control anyway, so
 * the shape of the page matches Scryfall's and the gaps are legible rather than invisible.
 *
 * Enum values were read off the dataset itself rather than guessed — `dw` for Dwarvish,
 * not `dwa`.
 */
import { schema } from "../shard-db/schema";
import { COLLECTION } from "./collection";

/** The reason a control is inert, shown under it verbatim. */
export type Unsupported = string;

export interface Option<T extends string = string> {
  value: T;
  label: string;
  /** Present ⟺ the control is rendered disabled with this explanation. */
  unsupported?: Unsupported;
}

// ---------- colours ----------

export const COLOR_OPTIONS: Option[] = [
  { value: "W", label: "White" },
  { value: "U", label: "Blue" },
  { value: "B", label: "Black" },
  { value: "R", label: "Red" },
  { value: "G", label: "Green" },
  {
    value: "C",
    label: "Colorless",
    unsupported:
      "Colorless is the absence of any colour — an empty `colors` array. Multi-valued fields " +
      "only offer `some`, which needs a value to match, so there is no way to ask for none.",
  },
];

/**
 * Scryfall's colour comparison. Only "any of" survives: the engine takes one filter per
 * field and `some: { in: [...] }` is a disjunction, so requiring *all* selected colours
 * (Scryfall's "including") or forbidding the unselected ones ("exactly", "at most") would
 * each need several filters on `colors` at once.
 */
export const COLOR_COMPARISONS: Option[] = [
  { value: "any", label: "Any of these colors" },
  {
    value: "exactly",
    label: "Exactly these colors",
    unsupported: "Needs more than one filter on `colors`; the engine allows one per field.",
  },
  {
    value: "including",
    label: "Including these colors",
    unsupported: "Needs to AND several `colors` filters together.",
  },
  {
    value: "atmost",
    label: "At most these colors",
    unsupported: "Needs to exclude every unselected colour, which is one filter each.",
  },
];

// ---------- stats ----------

export const STAT_FIELDS = ["cmc", "power", "toughness", "loyalty"] as const;
export type StatField = (typeof STAT_FIELDS)[number];

export const STAT_FIELD_OPTIONS: Option<StatField>[] = [
  { value: "cmc", label: "Mana Value" },
  { value: "power", label: "Power" },
  { value: "toughness", label: "Toughness" },
  { value: "loyalty", label: "Loyalty" },
];

/** Operator names as the engine spells them, so a row maps straight onto a where clause. */
export const STAT_OPS = ["equals", "not", "lt", "lte", "gt", "gte"] as const;
export type StatOp = (typeof STAT_OPS)[number];

const STAT_OP_LABELS: Record<StatOp, string> = {
  equals: "equal to",
  lt: "less than",
  gt: "greater than",
  lte: "less than or equal to",
  gte: "greater than or equal to",
  not: "not equal to",
};

/** Scryfall's dropdown order, which puts the comparisons between = and ≠. */
const STAT_OP_ORDER: StatOp[] = ["equals", "lt", "gt", "lte", "gte", "not"];

/**
 * Power, toughness and loyalty are printed as text — they hold `*`, `1+*`, `∞` — so the build
 * declares each one twice: the printed string, plus a `_num` column derived from it with the
 * `numeric` normalizer. Equality runs against the printed value (so `= *` finds the 915 cards
 * that really are `*`); comparisons run against the number.
 *
 * A stat therefore offers the UNION of its two columns' operators, and availability still comes
 * off the generated schema rather than a hand-kept list — a rebuild that changes either column
 * changes this dropdown with it.
 */
const STAT_COLUMNS: Record<StatField, { printed: string; numeric?: string }> = {
  cmc: { printed: "cmc" },
  power: { printed: "power", numeric: "power_num" },
  toughness: { printed: "toughness", numeric: "toughness_num" },
  loyalty: { printed: "loyalty", numeric: "loyalty_num" },
};

const operatorsOf = (field: string): readonly string[] =>
  (schema[COLLECTION].fields as Record<string, { operators: readonly string[] } | undefined>)[field]?.operators ?? [];

const STAT_OPERATORS: Record<StatField, readonly string[]> = Object.fromEntries(
  STAT_FIELDS.map((field) => {
    const { printed, numeric } = STAT_COLUMNS[field];
    return [field, [...new Set([...operatorsOf(printed), ...(numeric === undefined ? [] : operatorsOf(numeric))])]];
  }),
) as unknown as Record<StatField, readonly string[]>;

export const statSupports = (field: StatField, op: StatOp): boolean =>
  STAT_OPERATORS[field].includes(op);

/** The derived numeric column backing this stat's comparisons, when the build produced one. */
export const numericColumnFor = (field: StatField): string | undefined => STAT_COLUMNS[field].numeric;

const whyUnsupported = (field: StatField): Unsupported =>
  `This operator is not indexed on \`${field}\` in this build.`;

/** The operator dropdown for one stat, with whatever that field cannot do left disabled. */
export function statOpOptions(field: StatField): Option<StatOp>[] {
  return STAT_OP_ORDER.map((op) => ({
    value: op,
    label: STAT_OP_LABELS[op],
    unsupported: statSupports(field, op) ? undefined : whyUnsupported(field),
  }));
}

export const isStatField = (value: string): value is StatField =>
  (STAT_FIELDS as readonly string[]).includes(value);

export const isStatOp = (value: string): value is StatOp =>
  (STAT_OPS as readonly string[]).includes(value);

// ---------- criteria ----------

/**
 * Scryfall's Criteria box is an autocomplete over `is:` predicates. Ours are exactly the
 * indexed booleans, so they are listed in full instead — fourteen toggles is friendlier
 * than an autocomplete over fourteen things. Each cycles off → IS → NOT, since `not` is
 * available on every boolean field.
 */
export const CRITERIA = [
  { id: "reserved", label: "Reserved List", hint: "on the Reserved List" },
  { id: "promo", label: "Promo", hint: "a promotional printing" },
  { id: "reprint", label: "Reprint", hint: "not the first printing of the card" },
  { id: "variation", label: "Variation", hint: "a variant of another card in the same set" },
  { id: "digital", label: "Digital", hint: "digital-only, from Arena or Magic Online" },
  { id: "oversized", label: "Oversized", hint: "an oversized printing" },
  { id: "fullart", label: "Full Art", hint: "the art fills the whole card" },
  { id: "textless", label: "Textless", hint: "printed with no rules text" },
  { id: "spotlight", label: "Story Spotlight", hint: "marked as a story spotlight" },
  { id: "booster", label: "Found in Boosters", hint: "appears in draft boosters" },
  { id: "foil", label: "Available in Foil", hint: "printed in a foil finish" },
  { id: "nonfoil", label: "Available in Non-Foil", hint: "printed in a nonfoil finish" },
  { id: "gamechanger", label: "Game Changer", hint: "on the Commander Game Changer list" },
  { id: "hires", label: "High-Res Image", hint: "has a high-resolution scan" },
] as const;

export type CriterionId = (typeof CRITERIA)[number]["id"];

const CRITERION_IDS: readonly string[] = CRITERIA.map((criterion) => criterion.id);

export const isCriterionId = (value: string): value is CriterionId =>
  CRITERION_IDS.includes(value);

// ---------- plain enumerations ----------

export const RARITY_OPTIONS: Option[] = [
  { value: "common", label: "Common" },
  { value: "uncommon", label: "Uncommon" },
  { value: "rare", label: "Rare" },
  { value: "mythic", label: "Mythic Rare" },
];

export const GAME_OPTIONS: Option[] = [
  { value: "paper", label: "Paper" },
  { value: "arena", label: "Arena" },
  { value: "mtgo", label: "Magic Online" },
];

/**
 * Every code below occurs in the dataset. Scryfall's own first option is "Default", which
 * means English — ours is "Any", because `lang: en` matches 113,494 of 116,138 records and
 * a filter that broad only tells the engine to fetch everything.
 */
export const LANGUAGE_OPTIONS: Option[] = [
  { value: "", label: "Any language" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "ru", label: "Russian" },
  { value: "zhs", label: "Simplified Chinese" },
  { value: "zht", label: "Traditional Chinese" },
  { value: "he", label: "Hebrew" },
  { value: "la", label: "Latin" },
  { value: "grc", label: "Ancient Greek" },
  { value: "ar", label: "Arabic" },
  { value: "sa", label: "Sanskrit" },
  { value: "ph", label: "Phyrexian" },
  { value: "qya", label: "Quenya" },
  { value: "dw", label: "Dwarvish" },
];

const LANGUAGE_CODES: readonly string[] = LANGUAGE_OPTIONS.map((option) => option.value);

export const isLanguage = (value: string): boolean => LANGUAGE_CODES.includes(value);

/** Offered by the "Add symbol" pickers next to Text and Mana Cost. */
export const MANA_SYMBOLS = [
  "W",
  "U",
  "B",
  "R",
  "G",
  "C",
  "X",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "T",
  "Q",
  "S",
  "E",
];

// ---------- sections with nothing behind them ----------

/**
 * Scryfall rows this build cannot answer at all. They render in place, disabled, with the
 * reason — the honest version of "as many fields as we support".
 */
export const UNSUPPORTED_SECTIONS = {
  formats:
    "`legalities` is stored as an unindexed JSON field in this build, so format legality " +
    "cannot be filtered. Indexing it would mean flattening each format into its own field.",
  prices:
    "`prices` is stored as an unindexed JSON field, and price comparison would need range " +
    "operators on the flattened numbers.",
  block:
    "Blocks are not part of the Scryfall bulk record, so there is no field to index. Only " +
    "set code, set name and set type are present.",
  lore:
    "Lore Finder searches name, type, rules text and flavour text at once. The engine ANDs " +
    "one filter per field and cannot OR across fields, so this needs four queries merged " +
    "client-side.",
  display:
    "This demo renders one view — the image grid. Checklist, text and full views were never " +
    "built, so there is nothing to switch to.",
  prefer:
    "Choosing between printings means ranking rows that already matched. The engine filters " +
    "and sorts; it has no notion of preferring one duplicate over another.",
  prints:
    "The dataset is Scryfall's `default-cards`, which already carries one printing per card. " +
    "There is no oracle-level grouping to collapse or expand.",
  extras:
    "Tokens, emblems and schemes are already in this dataset (`layout` holds `token`, " +
    "`emblem`, `scheme` and more). Excluding them would take one `not` filter per layout, " +
    "and the engine allows one filter per field.",
} as const;
