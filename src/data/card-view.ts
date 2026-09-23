/**
 * Pure read helpers over a card record.
 *
 * The generated schema types the nested Scryfall blobs (`image_uris`,
 * `card_faces`, `prices`, `legalities`) as `unknown`, so every reader here
 * narrows defensively. Image URLs are resolved in this one module so swapping
 * the CDN for self-hosted files later is a single-file change.
 */
import type { Records } from "../blockdb/schema";
import { COLLECTION } from "./collection";

export type Card = Records[typeof COLLECTION];

export type ImageSize = "small" | "normal" | "large" | "png" | "art_crop" | "border_crop";

export interface CardFace {
  name?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  flavor_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  artist?: string;
  image_uris?: unknown;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Flattens an object to its string-valued entries, dropping anything else. */
function stringEntries(value: unknown): [string, string][] {
  return Object.entries(asObject(value) ?? {}).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
}

function stringMap(value: unknown): Record<string, string> {
  return Object.fromEntries(stringEntries(value));
}

/** Faces of a split / transforming / modal card; empty for ordinary cards. */
export function faces(card: Card): CardFace[] {
  return Array.isArray(card.card_faces)
    ? card.card_faces.map((face) => (asObject(face) ?? {}) as CardFace)
    : [];
}

/**
 * Image URLs for a card — one per face when the card is double-faced, since
 * those carry `image_uris` per face instead of at the top level.
 */
export function imageUrls(card: Card, size: ImageSize = "normal"): string[] {
  const top = stringMap(card.image_uris)[size];
  if (top) return [top];
  return faces(card)
    .map((face) => stringMap(face.image_uris)[size])
    .filter((url): url is string => Boolean(url));
}

export function primaryImage(card: Card, size: ImageSize = "normal"): string | undefined {
  return imageUrls(card, size)[0];
}

/** `"{2}{R}"` → `["2", "R"]`; hybrid and phyrexian pips stay intact (`"W/U"`). */
export function manaSymbols(cost: string | undefined): string[] {
  if (!cost) return [];
  return [...cost.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]!);
}

/** The card's type line, joining faces when only per-face lines exist. */
export function typeLine(card: Card): string {
  if (card.type_line) return card.type_line;
  return faces(card)
    .map((face) => face.type_line)
    .filter(Boolean)
    .join(" // ");
}

export interface Legality {
  format: string;
  status: string;
}

const LEGAL_FORMATS = [
  "standard",
  "pioneer",
  "modern",
  "legacy",
  "vintage",
  "commander",
  "pauper",
  "brawl",
];

/** Legalities for the formats worth showing, in a stable display order. */
export function legalities(card: Card): Legality[] {
  const raw = stringMap(card.legalities);
  return LEGAL_FORMATS.filter((format) => raw[format]).map((format) => ({
    format,
    status: raw[format]!,
  }));
}

export interface Price {
  label: string;
  value: string;
}

const PRICE_LABELS: Record<string, string> = {
  usd: "USD",
  usd_foil: "USD foil",
  eur: "EUR",
  tix: "MTGO tix",
};

export function prices(card: Card): Price[] {
  const raw = stringMap(card.prices);
  return Object.entries(PRICE_LABELS)
    .filter(([key]) => raw[key])
    .map(([key, label]) => ({ label, value: raw[key]! }));
}

/** Power/toughness or loyalty, whichever the card has. */
export function statLine(card: Card): string | undefined {
  if (card.power || card.toughness) return `${card.power ?? ""}/${card.toughness ?? ""}`;
  if (card.loyalty) return `Loyalty ${card.loyalty}`;
  return undefined;
}
