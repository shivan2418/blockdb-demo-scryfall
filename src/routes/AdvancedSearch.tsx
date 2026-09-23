/**
 * Scryfall's advanced search page, section for section, over blockdb.
 *
 * The section order, labels and hint wording follow scryfall.com/advanced. Sections and
 * options this build can't answer (formats, prices, blocks, Lore Finder, display modes) are
 * left out rather than shown disabled.
 *
 * It opens in place of the filter sidebar on the browse page rather than on a page of its
 * own, so the results stay in view and there is nothing to navigate back from.
 *
 * Editing is local. Nothing queries until submit, which hands the draft to the browse
 * URL — so a half-filled form never fires a 40 MB block walk.
 */
import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { CriteriaPicker } from "../components/advanced/CriteriaPicker";
import { ControlLine, FormRow } from "../components/advanced/FormRow";
import { CheckGroup, SelectField, SymbolPicker, TextField } from "../components/advanced/fields";
import { StatRows } from "../components/advanced/StatRows";
import { toggleValue } from "../components/toggle";
import {
  COLOR_COMPARISONS,
  COLOR_OPTIONS,
  GAME_OPTIONS,
  LANGUAGE_OPTIONS,
  RARITY_OPTIONS,
} from "../data/advanced-fields";
import {
  COLORLESS,
  DEFAULT_COLOR_MATCH,
  SORT_LABELS,
  type CardFilters,
  type ColorMatch,
  type SortKey,
} from "../data/cards";
import { decodeState, encodeState } from "../data/url-state";

const SORT_OPTIONS = (Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({
  value: key,
  label: SORT_LABELS[key],
}));

/** Scryfall puts a small glyph in the label gutter; these stand in for its icon set. */
const ICONS = {
  name: "▭",
  text: "▤",
  type: "◈",
  colors: "◉",
  commander: "⬟",
  mana: "⬢",
  stats: "▦",
  games: "◫",
  sets: "✦",
  rarity: "★",
  criteria: "☰",
  artist: "✎",
  flavor: "❞",
  language: "⁂",
  preferences: "⚙",
};

/**
 * Colorless is the empty list, so it can't sit beside a colour in one filter: picking it clears
 * the colours, and picking a colour clears it.
 */
function toggleColor(selected: string[] | undefined, value: string): string[] | undefined {
  const compatible = selected?.filter((color) =>
    value === COLORLESS ? color === COLORLESS : color !== COLORLESS,
  );
  return toggleValue(compatible?.length ? compatible : undefined, value);
}

/** Old `/advanced` links open the panel on the browse page instead, keeping their query. */
export function AdvancedSearch() {
  const [params] = useSearchParams();
  const next = encodeState(decodeState(params));
  next.set(ADVANCED_PARAM, ADVANCED_VALUE);
  return <Navigate to={`/?${next.toString()}`} replace />;
}

/** `?panel=advanced` on the browse URL, so Back closes the panel like any other step. */
export const ADVANCED_PARAM = "panel";
export const ADVANCED_VALUE = "advanced";

export function AdvancedForm({
  initialFilters,
  initialSort,
  onSubmit,
  onClose,
}: {
  /** Seeded from the current search so the form opens filled in, not blank. */
  initialFilters: CardFilters;
  initialSort: SortKey;
  onSubmit: (filters: CardFilters, sort: SortKey) => void;
  onClose: () => void;
}) {
  const [filters, setFilters] = useState<CardFilters>(initialFilters);
  const [sort, setSort] = useState<SortKey>(initialSort);

  const patch = (changes: Partial<CardFilters>) => setFilters({ ...filters, ...changes });

  /** Written out per field rather than with a computed key, which would widen the patch type. */
  const append = (key: "text" | "manaCost", symbol: string) =>
    patch(
      key === "text"
        ? { text: `${filters.text ?? ""}${symbol}` }
        : { manaCost: `${filters.manaCost ?? ""}${symbol}` },
    );

  const submit = () => onSubmit(filters, sort);

  return (
    <form
      className="advanced"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="advanced-head">
        <h2>Advanced search</h2>
        <div className="advanced-head-actions">
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setFilters({});
              setSort("relevance");
            }}
          >
            Clear form
          </button>
          <button type="button" className="link-button" onClick={onClose}>
            ← Simple filters
          </button>
          <button type="submit" className="link-button adv-search-now">
            Search
          </button>
        </div>
      </div>

      <div className="adv-rows">
        <FormRow label="Card Name" icon={ICONS.name}>
          <TextField
            label="Card Name"
            placeholder="Any words in the name, e.g. “Fire”"
            value={filters.name}
            onChange={(name) => patch({ name })}
          />
        </FormRow>

        <FormRow
          label="Text"
          icon={ICONS.text}
          hint="Enter text that should appear in the rules box. Matched as a substring, ignoring case and accents, so word order does matter."
        >
          <ControlLine>
            <TextField
              label="Text"
              placeholder="Any text, e.g. “draw a card”"
              value={filters.text}
              onChange={(text) => patch({ text })}
            />
            <SymbolPicker onInsert={(symbol) => append("text", symbol)} />
          </ControlLine>
        </FormRow>

        <FormRow
          label="Type Line"
          icon={ICONS.type}
          hint="Any part of the type line: a card type, supertype or subtype. Matched as a substring, so “Creature” also finds “Artifact Creature”."
        >
          <TextField
            label="Type Line"
            placeholder="Enter a type, e.g. “Legendary Creature”"
            value={filters.type}
            onChange={(type) => patch({ type })}
          />
        </FormRow>

        <FormRow
          label="Colors"
          icon={ICONS.colors}
          hint="Choose how the colours you pick are compared. Colorless can't be combined with colours; “At most” already includes colorless cards."
        >
          <CheckGroup
            legend="Card colors"
            options={COLOR_OPTIONS}
            selected={filters.colors}
            pips
            onToggle={(value) => patch({ colors: toggleColor(filters.colors, value) })}
          />
          <ControlLine>
            <SelectField
              label="Color Comparison"
              options={COLOR_COMPARISONS}
              value={filters.colorMatch ?? DEFAULT_COLOR_MATCH}
              onChange={(colorMatch: ColorMatch) =>
                patch({ colorMatch: colorMatch === DEFAULT_COLOR_MATCH ? undefined : colorMatch })
              }
            />
          </ControlLine>
        </FormRow>

        <FormRow
          label="Commander"
          icon={ICONS.commander}
          hint="Cards whose colour identity fits inside the colours you select, so they can go in that commander’s deck. Colorless cards fit every identity; pick Colorless alone to find only those."
        >
          <CheckGroup
            legend="Commander colors"
            options={COLOR_OPTIONS}
            selected={filters.identity}
            pips
            onToggle={(value) => patch({ identity: toggleColor(filters.identity, value) })}
          />
        </FormRow>

        <FormRow
          label="Mana Cost"
          icon={ICONS.mana}
          hint="Finds cards with this exact mana cost. Braces are optional — “2WW” is read as {2}{W}{W}."
        >
          <ControlLine>
            <TextField
              label="Mana Cost"
              placeholder="Any mana symbols, e.g. “{W}{W}”"
              value={filters.manaCost}
              onChange={(manaCost) => patch({ manaCost })}
            />
            <SymbolPicker onInsert={(symbol) => append("manaCost", symbol)} />
          </ControlLine>
        </FormRow>

        <FormRow
          label="Stats"
          icon={ICONS.stats}
          hint="Restrict cards by their printed statistics. Cards without the stat are not returned."
        >
          <StatRows stats={filters.stats} onChange={(stats) => patch({ stats })} />
        </FormRow>

        <FormRow
          label="Games"
          icon={ICONS.games}
          hint="Include cards appearing in paper, Arena or Magic Online."
        >
          <CheckGroup
            legend="Games"
            options={GAME_OPTIONS}
            selected={filters.games}
            onToggle={(value) => patch({ games: toggleValue(filters.games, value) })}
          />
        </FormRow>

        <FormRow
          label="Sets"
          icon={ICONS.sets}
          hint="Restrict cards by set name or set code."
        >
          <TextField
            label="Set"
            placeholder="Enter a set name, e.g. “Bloomburrow”"
            value={filters.setName}
            onChange={(setName) => patch({ setName })}
          />
          <TextField
            label="Set code"
            placeholder="Or an exact set code, e.g. “blb”"
            value={filters.set}
            onChange={(set) => patch({ set })}
          />
        </FormRow>

        <FormRow
          label="Rarity"
          icon={ICONS.rarity}
          hint="Only return cards of the selected rarities."
        >
          <CheckGroup
            legend="Desired rarities"
            options={RARITY_OPTIONS}
            selected={filters.rarity}
            onToggle={(value) => patch({ rarity: toggleValue(filters.rarity, value) })}
          />
        </FormRow>

        <FormRow
          label="Criteria"
          icon={ICONS.criteria}
          hint="Click once to require a criterion, twice to exclude it. The box below matches one of the card’s keyword abilities, e.g. “Flying”."
        >
          <CriteriaPicker
            is={filters.is}
            not={filters.not}
            onChange={({ is, not }) => patch({ is, not })}
          />
          <TextField
            label="Keyword"
            placeholder="A keyword ability, e.g. “Flying”"
            value={filters.keyword}
            onChange={(keyword) => patch({ keyword })}
          />
        </FormRow>

        <FormRow label="Artist" icon={ICONS.artist}>
          <TextField
            label="Artist"
            placeholder="Any artist name, e.g. “Magali”"
            value={filters.artist}
            onChange={(artist) => patch({ artist })}
          />
        </FormRow>

        <FormRow
          label="Flavor Text"
          icon={ICONS.flavor}
          hint="Enter words that should appear in the flavour text."
        >
          <TextField
            label="Flavor Text"
            placeholder="Any flavor text, e.g. “Kjeldoran”"
            value={filters.flavor}
            onChange={(flavor) => patch({ flavor })}
          />
        </FormRow>

        <FormRow
          label="Language"
          icon={ICONS.language}
          hint="Only return cards printed in this language."
        >
          <SelectField
            label="Language"
            options={LANGUAGE_OPTIONS}
            value={filters.lang ?? ""}
            onChange={(lang) => patch({ lang: lang || undefined })}
          />
        </FormRow>

        <FormRow
          label="Preferences"
          icon={ICONS.preferences}
          hint="The order results are shown in."
        >
          <ControlLine>
            <SelectField
              label="Order"
              options={SORT_OPTIONS}
              value={sort}
              onChange={(next: SortKey) => setSort(next)}
            />
          </ControlLine>
        </FormRow>

      </div>

      <div className="advanced-submit">
        <button type="submit" className="adv-submit">
          Search with these options
        </button>
        <p className="adv-hint">
          A query fetches every block it touches, whole. Narrow searches are cheap; a single
          broad filter can pull tens of megabytes.
        </p>
      </div>
    </form>
  );
}
