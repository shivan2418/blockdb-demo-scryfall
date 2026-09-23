/**
 * Option tables for the advanced search form, mirroring Scryfall's own advanced page
 * section by section.
 *
 * Every option here is either backed by an indexed field with the operator it needs, or
 * carries an `unsupported` reason. The form leaves those out, so what's on screen works.
 *
 * Enum values were read off the dataset itself rather than guessed — `dw` for Dwarvish,
 * not `dwa`.
 */
import { schema } from "../blockdb/schema";
import type { ColorMatch } from "./cards";
import { COLLECTION } from "./collection";

/** Why an option can't be answered; the form hides options that carry one. */
export type Unsupported = string;

export interface Option<T extends string = string> {
  value: T;
  label: string;
  /** Present ⟺ the option is left out of the form. */
  unsupported?: Unsupported;
}

// ---------- colours ----------

export const COLOR_OPTIONS: Option[] = [
  { value: "W", label: "White" },
  { value: "U", label: "Blue" },
  { value: "B", label: "Black" },
  { value: "R", label: "Red" },
  { value: "G", label: "Green" },
  // Not a value in the data: the empty list, queried with `isEmpty`. Exclusive with the others.
  { value: "C", label: "Colorless" },
];

/** Scryfall's colour comparison, each one list operator on `colors` (see `colorFilter`). */
export const COLOR_COMPARISONS: Option<ColorMatch>[] = [
  { value: "any", label: "Any of these colors" },
  { value: "exactly", label: "Exactly these colors" },
  { value: "including", label: "Including these colors" },
  { value: "atmost", label: "At most these colors" },
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

/** The operator dropdown for one stat; what the field can't do is marked and so hidden. */
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
