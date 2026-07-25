/**
 * Scryfall's advanced search page, section for section, over static-shard.
 *
 * The section order, labels and hint wording follow scryfall.com/advanced. Rows this build
 * cannot answer — Formats, Prices, Block, Lore Finder and several Preferences — render in
 * place, disabled, with the reason: the gaps are as informative as the fields that work.
 *
 * Editing is local. Nothing queries until submit, which encodes the draft into the browse
 * URL — so a half-filled form never fires a 40 MB shard walk.
 */
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  UNSUPPORTED_SECTIONS,
} from "../data/advanced-fields";
import { SORT_LABELS, type CardFilters, type SortKey } from "../data/cards";
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
  formats: "⬒",
  sets: "✦",
  rarity: "★",
  criteria: "☰",
  prices: "⬓",
  artist: "✎",
  flavor: "❞",
  lore: "⌕",
  language: "⁂",
  preferences: "⚙",
};

export function AdvancedSearch() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Seeded from the URL so "Refine this search" from the results page arrives filled in.
  const initial = decodeState(params);
  const [filters, setFilters] = useState<CardFilters>(initial.filters);
  const [sort, setSort] = useState<SortKey>(initial.sort);

  const patch = (changes: Partial<CardFilters>) => setFilters({ ...filters, ...changes });

  /** Written out per field rather than with a computed key, which would widen the patch type. */
  const append = (key: "text" | "manaCost", symbol: string) =>
    patch(
      key === "text"
        ? { text: `${filters.text ?? ""}${symbol}` }
        : { manaCost: `${filters.manaCost ?? ""}${symbol}` },
    );

  const submit = () => {
    const query = encodeState({ filters, sort, page: 0 }).toString();
    navigate(query ? `/?${query}` : "/");
  };

  return (
    <form
      className="advanced"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="advanced-head">
        <h1>Advanced Search</h1>
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
          hint="Enter text that should appear in the rules box. Matched as a substring, so word order does matter — and matching is case-sensitive, though a failed search is retried in Title Case."
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
          hint="Matches cards containing any of the colours you select. Colourless and the other comparisons need several filters on one field, which the engine does not allow."
        >
          <CheckGroup
            legend="Card colors"
            options={COLOR_OPTIONS}
            selected={filters.colors}
            pips
            onToggle={(value) => patch({ colors: toggleValue(filters.colors, value) })}
          />
          <ControlLine>
            <SelectField
              label="Color Comparison"
              options={COLOR_COMPARISONS}
              value="any"
              onChange={() => undefined}
            />
          </ControlLine>
        </FormRow>

        <FormRow
          label="Commander"
          icon={ICONS.commander}
          hint="Colour identity, matched the same way — any of the colours you select. Scryfall’s version returns only cards that fit inside the identity, which would need the “at most” comparison above."
        >
          <CheckGroup
            legend="Commander colors"
            options={COLOR_OPTIONS}
            selected={filters.identity}
            pips
            onToggle={(value) => patch({ identity: toggleValue(filters.identity, value) })}
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
          hint="Restrict cards by their printed statistics. Cards without the stat are not returned. Mana value takes any comparison; power, toughness and loyalty are stored as strings, so they compare for equality only."
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

        <FormRow label="Formats" icon={ICONS.formats} unavailable={UNSUPPORTED_SECTIONS.formats}>
          <ControlLine>
            <SelectField
              label="Format Status"
              options={[
                { value: "legal", label: "Legal" },
                { value: "restricted", label: "Restricted" },
                { value: "banned", label: "Banned" },
              ]}
              value="legal"
              onChange={() => undefined}
            />
            <SelectField
              label="Format"
              options={[{ value: "", label: "" }]}
              value=""
              onChange={() => undefined}
            />
          </ControlLine>
        </FormRow>

        <FormRow
          label="Sets"
          icon={ICONS.sets}
          hint="Restrict cards by set name or set code. Blocks are not in the source data."
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

        <FormRow label="Block or Group" icon={ICONS.sets} unavailable={UNSUPPORTED_SECTIONS.block}>
          <TextField
            label="Block or Group"
            placeholder="Enter a block name"
            value=""
            onChange={() => undefined}
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
          hint="Click once to require a criterion, twice to exclude it. These are the boolean fields the build indexed; the box below matches one of the card’s parsed keyword abilities."
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

        <FormRow label="Prices" icon={ICONS.prices} unavailable={UNSUPPORTED_SECTIONS.prices}>
          <ControlLine>
            <SelectField
              label="Currency"
              options={[
                { value: "usd", label: "USD" },
                { value: "eur", label: "Euros" },
                { value: "tix", label: "MTGO Tickets" },
              ]}
              value="usd"
              onChange={() => undefined}
            />
            <TextField
              label="Currency value"
              placeholder="Any value, e.g. “15.00”"
              value=""
              onChange={() => undefined}
              wide={false}
            />
          </ControlLine>
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

        <FormRow label="Lore Finder™" icon={ICONS.lore} unavailable={UNSUPPORTED_SECTIONS.lore}>
          <TextField
            label="Lore Finder"
            placeholder="Any text, especially names. e.g. “Jhoira”"
            value=""
            onChange={() => undefined}
          />
        </FormRow>

        <FormRow
          label="Language"
          icon={ICONS.language}
          hint="Specify a printed language. Scryfall defaults to English; this defaults to any, because English alone is 113,494 of the 116,138 records and would fetch nearly every shard."
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
          hint="Result ordering. The display modes and printing preferences below have nothing behind them in this build."
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

        <FormRow label="Display" icon={ICONS.preferences} unavailable={UNSUPPORTED_SECTIONS.display}>
          <SelectField
            label="Display"
            options={[{ value: "images", label: "Display as Images" }]}
            value="images"
            onChange={() => undefined}
          />
        </FormRow>

        <FormRow label="Prefer" icon={ICONS.preferences} unavailable={UNSUPPORTED_SECTIONS.prefer}>
          <SelectField
            label="Prefer"
            options={[{ value: "none", label: "Prefer No Preference" }]}
            value="none"
            onChange={() => undefined}
          />
        </FormRow>

        <FormRow label="Printings" icon={ICONS.preferences} unavailable={UNSUPPORTED_SECTIONS.prints}>
          <CheckGroup
            legend="Printings"
            options={[{ value: "prints", label: "Show all card prints" }]}
            selected={undefined}
            onToggle={() => undefined}
          />
        </FormRow>

        <FormRow label="Extra Cards" icon={ICONS.preferences} unavailable={UNSUPPORTED_SECTIONS.extras}>
          <CheckGroup
            legend="Extra cards"
            options={[
              { value: "extras", label: "Include extra cards (tokens, planes, schemes, etc)" },
            ]}
            selected={undefined}
            onToggle={() => undefined}
          />
        </FormRow>
      </div>

      <div className="advanced-submit">
        <button type="submit" className="adv-submit">
          Search with these options
        </button>
        <p className="adv-hint">
          A query fetches every shard it touches, whole. Narrow searches are cheap; a single
          broad filter can pull tens of megabytes.
        </p>
      </div>
    </form>
  );
}
