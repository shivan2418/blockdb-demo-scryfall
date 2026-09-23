import { describe, expect, test } from "vitest";
import { manaSymbols } from "./card-view";
import { datasetDate } from "./collection";
import {
  colorFilter,
  usesDefaultWindow,
  DEFAULT_WINDOW,
  buildOrderBy,
  buildWhere,
  fold,
  hasAnyFilter,
  normalizeManaCost,
  type CardFilters,
} from "./cards";
import { decodeState, encodeState, type BrowseState } from "./url-state";

describe("colorFilter", () => {
  test("maps each Scryfall comparison to its list operator", () => {
    expect(colorFilter(["W", "U"])).toEqual({ some: { in: ["W", "U"] } });
    expect(colorFilter(["W", "U"], "including")).toEqual({ hasEvery: ["W", "U"] });
    expect(colorFilter(["W", "U"], "atmost")).toEqual({ every: { in: ["W", "U"] } });
    expect(colorFilter(["W", "U"], "exactly")).toEqual({
      hasEvery: ["W", "U"],
      every: { in: ["W", "U"] },
    });
  });

  test("reads colorless as the empty list, whatever the comparison", () => {
    expect(colorFilter(["C"])).toEqual({ isEmpty: true });
    expect(colorFilter(["C"], "including")).toEqual({ isEmpty: true });
  });

  test("lets colours win over colorless when a URL carries both", () => {
    expect(colorFilter(["C", "R"])).toEqual({ some: { in: ["R"] } });
  });

  test("is undefined for nothing, or only unknown values", () => {
    expect(colorFilter(undefined)).toBeUndefined();
    expect(colorFilter(["Q"])).toBeUndefined();
  });
});

describe("buildWhere", () => {
  test("applies commander identity as at-most, so colorless cards fit every identity", () => {
    // `every` can't prune alone here, so block order gets the admit-everything name range.
    expect(buildWhere({ identity: ["R", "G"] })).toEqual({
      color_identity: { every: { in: ["R", "G"] } },
      name: { startsWith: "" },
    });
  });

  test("narrows colorless under a non-name order, since isEmpty can't prune here", () => {
    expect(usesDefaultWindow({ colors: ["C"] }, "newest")).toBe(true);
    expect(usesDefaultWindow({ colors: ["C"] }, "name")).toBe(false);
    expect(usesDefaultWindow({ colors: ["C"], rarity: ["mythic"] }, "newest")).toBe(false);
    expect(buildWhere({ colors: ["C"] }, "newest")).toEqual({
      colors: { isEmpty: true },
      name: { startsWith: DEFAULT_WINDOW },
    });
  });

  test("leaves an unfiltered browse in block order empty — the walk stops at the first page", () => {
    expect(buildWhere({})).toEqual({});
    expect(buildWhere({}, "name")).toEqual({});
    expect(buildWhere({}, "name-desc")).toEqual({});
  });

  test("narrows an unfiltered browse to the default window under any other order", () => {
    // Without this, sorting by anything but name would download every block.
    for (const sort of ["newest", "oldest", "cmc", "cmc-desc", "popular"] as const) {
      expect(buildWhere({}, sort)).toEqual({ name: { startsWith: DEFAULT_WINDOW } });
    }
    expect(buildWhere({ rarity: ["rare"] }, "newest")).toEqual({ rarity: { in: ["rare"] } });
  });

  test("treats blank and whitespace-only text as unset", () => {
    expect(buildWhere({ name: "   " })).toEqual({});
  });

  test("maps text filters to contains on the folded columns, folding the query", () => {
    expect(buildWhere({ name: "Bolt", type: "Instant" })).toEqual({
      name_fold: { contains: "bolt" },
      type_line_fold: { contains: "instant" },
    });
    expect(buildWhere({ artist: "Lim-Dûl", text: "FLYING" })).toEqual({
      artist_fold: { contains: "lim-dul" },
      oracle_text_fold: { contains: "flying" },
    });
  });

  test("maps multi-valued colors through some/in", () => {
    expect(buildWhere({ colors: ["R", "G"] })).toEqual({ colors: { some: { in: ["R", "G"] } } });
  });

  test("maps keyword to the some shorthand", () => {
    expect(buildWhere({ keyword: "Flying" })).toEqual({ keywords: { some: "Flying" } });
  });

  test("maps discrete numeric and enum filters to in", () => {
    expect(buildWhere({ cmc: [0, 7], rarity: ["mythic"] })).toEqual({
      cmc: { in: [0, 7] },
      rarity: { in: ["mythic"] },
    });
  });

  test("lower-cases set codes to match stored values", () => {
    expect(buildWhere({ set: "BLB" })).toEqual({ set: { equals: "blb" } });
  });

  test("never emits a `not`-only where, which the engine rejects", () => {
    const cases: CardFilters[] = [
      {},
      { name: "x" },
      { colors: ["W"] },
      { cmc: [3] },
      // NOT criteria are `not` riders, so on their own they leave nothing to prune with.
      { not: ["reprint"] },
      // So are isEmpty and every here: colorless cards sit in every block.
      { colors: ["C"] },
      { colors: ["W", "U"], colorMatch: "atmost" },
      { not: ["reprint", "digital"] },
      { stats: [{ field: "power", op: "not", value: "2" }] },
    ];
    const wheres = cases.flatMap((filters) => [buildWhere(filters, "name"), buildWhere(filters, "newest")]);

    for (const where of wheres) {
      // An empty where is fine; one made only of riders is what the engine refuses.
      const operators = Object.values(where).flatMap((filter) => Object.keys(filter ?? {}));
      if (operators.length > 0) expect(operators.every((operator) => operator === "not")).toBe(false);
    }
  });

  test("keeps a NOT criterion once something else prunes", () => {
    expect(buildWhere({ rarity: ["rare"], not: ["reprint"] })).toEqual({
      rarity: { in: ["rare"] },
      reprint: { not: true },
    });
  });

  test("maps criteria onto their indexed booleans", () => {
    expect(buildWhere({ is: ["reserved", "fullart"], not: ["digital"] })).toEqual({
      reserved: { equals: true },
      full_art: { equals: true },
      digital: { not: true },
    });
  });

  test("maps stat rows through the operators each field actually has", () => {
    expect(
      buildWhere({
        stats: [
          { field: "cmc", op: "equals", value: "3" },
          { field: "power", op: "not", value: "*" },
        ],
      }),
    ).toEqual({ cmc: { equals: 3 }, power: { not: "*" } });
  });

  test("uses the range operators the rebuild gave `cmc`", () => {
    expect(buildWhere({ stats: [{ field: "cmc", op: "gte", value: "5" }] })).toEqual({
      cmc: { gte: 5 },
    });
    expect(buildWhere({ stats: [{ field: "cmc", op: "lt", value: "2" }] })).toEqual({
      cmc: { lt: 2 },
    });
  });

  test("routes a comparison on a string stat to its derived numeric column", () => {
    // power is printed text (`*`, `1+*`), so the build pairs it with power_num, derived by the
    // `numeric` normalizer. The comparison goes there; the printed column can't answer it.
    expect(buildWhere({ stats: [{ field: "power", op: "gte", value: "4" }] })).toEqual({
      power_num: { gte: 4 },
    });
    expect(buildWhere({ stats: [{ field: "toughness", op: "lt", value: "2" }] })).toEqual({
      toughness_num: { lt: 2 },
    });
  });

  test("keeps equality on the printed column, so `= *` still means something", () => {
    // 915 cards really are printed `*`. Sending that to the numeric column would match nothing,
    // since a value with no numeric reading is absent there rather than zero.
    expect(buildWhere({ stats: [{ field: "power", op: "equals", value: "*" }] })).toEqual({
      power: { equals: "*" },
    });
    // `not` is a rider the engine refuses as a sole constraint, so it keeps company with an
    // empty name prefix — same as every other criterion toggled to NOT.
    expect(buildWhere({ stats: [{ field: "power", op: "not", value: "*" }] })).toEqual({
      power: { not: "*" },
      name: { startsWith: "" },
    });
  });

  test("drops a comparison whose bound has no numeric reading", () => {
    // "power greater than *" is not a question, so no clause is invented for it.
    expect(buildWhere({ stats: [{ field: "power", op: "gte", value: "*" }] })).toEqual({});
  });

  test("ignores stat rows with a blank or non-numeric value", () => {
    expect(buildWhere({ stats: [{ field: "cmc", op: "equals", value: "  " }] })).toEqual({});
    expect(buildWhere({ stats: [{ field: "cmc", op: "equals", value: "abc" }] })).toEqual({});
  });

  test("lets an explicit mana value row win over the sidebar's chips", () => {
    // Both target `cmc` and the engine takes one filter per field.
    expect(
      buildWhere({ cmc: [1, 2], stats: [{ field: "cmc", op: "equals", value: "5" }] }),
    ).toEqual({ cmc: { equals: 5 } });
  });

  test("compares mana cost whole, since the field has no `contains`", () => {
    expect(buildWhere({ manaCost: "2ww" })).toEqual({ mana_cost: { equals: "{2}{W}{W}" } });
  });

  test("maps the remaining advanced text and enum filters", () => {
    expect(
      buildWhere({ flavor: "Kjeldoran", setName: "Bloomburrow", identity: ["G"], games: ["arena"], lang: "JA" }),
    ).toEqual({
      flavor_text_fold: { contains: "kjeldoran" },
      set_name_fold: { contains: "bloomburrow" },
      color_identity: { every: { in: ["G"] } },
      games: { some: { in: ["arena"] } },
      lang: { equals: "ja" },
    });
  });

  test("drops colors and games that are not in the build's value set", () => {
    expect(buildWhere({ colors: ["Q"], games: ["sega"] })).toEqual({});
  });
});

describe("buildWhere rider fallbacks", () => {
  test("treats a contains under three characters as a rider, as the engine does", () => {
    // It has no trigrams to look up; without the name range findMany throws NEEDS_PRUNING.
    expect(buildWhere({ name: "a" })).toEqual({
      name_fold: { contains: "a" },
      name: { startsWith: "" },
    });
    expect(buildWhere({ name: "ab" }, "newest")).toEqual({
      name_fold: { contains: "ab" },
      name: { startsWith: DEFAULT_WINDOW },
    });
    expect(buildWhere({ name: "abc" }, "newest")).toEqual({ name_fold: { contains: "abc" } });
  });

  test("narrows a boolean that occurs in every block under a non-name order", () => {
    expect(usesDefaultWindow({ is: ["foil"] }, "newest")).toBe(true);
    expect(buildWhere({ is: ["foil"] }, "newest")).toEqual({
      foil: { equals: true },
      name: { startsWith: DEFAULT_WINDOW },
    });
    // `reserved` is concentrated in old sets, so it still prunes.
    expect(usesDefaultWindow({ is: ["reserved"] }, "newest")).toBe(false);
  });
});

describe("free text and keywords", () => {
  test("collapses runs of whitespace inside a search", () => {
    expect(buildWhere({ name: "  lightning   bolt " })).toEqual({
      name_fold: { contains: "lightning bolt" },
    });
  });

  test("finds a keyword whatever its case", () => {
    expect(buildWhere({ keyword: "flying" })).toEqual({ keywords: { some: "Flying" } });
    expect(buildWhere({ keyword: "battle cry" })).toEqual({ keywords: { some: "Battle Cry" } });
  });

  test("matches every casing the data holds for one keyword", () => {
    expect(buildWhere({ keyword: "family gathering" }).keywords).toEqual({
      some: { in: ["Family gathering", "Family Gathering"] },
    });
  });

  test("passes an unknown keyword through as typed", () => {
    expect(buildWhere({ keyword: "Not A Keyword" })).toEqual({ keywords: { some: "Not A Keyword" } });
  });
});

describe("normalizeManaCost", () => {
  test("wraps bare symbols so `equals` can be used without typing braces", () => {
    expect(normalizeManaCost("2ww")).toBe("{2}{W}{W}");
  });

  test("keeps multi-digit generic costs whole", () => {
    expect(normalizeManaCost("10")).toBe("{10}");
  });

  test("passes braced input through, uppercased and unspaced", () => {
    expect(normalizeManaCost(" {w/u}{r} ")).toBe("{W/U}{R}");
  });
});

describe("hasAnyFilter", () => {
  test("ignores empty and whitespace values", () => {
    expect(hasAnyFilter({})).toBe(false);
    expect(hasAnyFilter({ name: "  ", colors: [] })).toBe(false);
  });

  test("detects both text and list filters", () => {
    expect(hasAnyFilter({ name: "Bolt" })).toBe(true);
    expect(hasAnyFilter({ cmc: [1] })).toBe(true);
  });
});

describe("buildOrderBy", () => {
  test("leaves natural order alone", () => {
    expect(buildOrderBy("relevance")).toBeUndefined();
  });

  test("orders on indexed fields", () => {
    expect(buildOrderBy("newest")).toEqual({ released_at: "desc" });
    expect(buildOrderBy("popular")).toEqual({ edhrec_rank: "asc" });
    expect(buildOrderBy("cmc-desc")).toEqual({ cmc: "desc" });
  });
});

describe("fold", () => {
  test("lowercases and strips diacritics, like the build's fold normalizer", () => {
    expect(fold("Lim-Dûl the Necromancer")).toBe("lim-dul the necromancer");
    expect(fold("Jötun Grunt")).toBe("jotun grunt");
  });

  test("leaves ligatures alone, as the normalizer does", () => {
    expect(fold("Æther Vial")).toBe("æther vial");
  });
});

describe("manaSymbols", () => {
  test("splits a cost into pips", () => {
    expect(manaSymbols("{2}{R}")).toEqual(["2", "R"]);
  });

  test("keeps hybrid pips whole", () => {
    expect(manaSymbols("{W/U}")).toEqual(["W/U"]);
  });

  test("handles cards with no cost", () => {
    expect(manaSymbols(undefined)).toEqual([]);
    expect(manaSymbols("")).toEqual([]);
  });
});

describe("url state", () => {
  const roundTrip = (state: BrowseState) => decodeState(encodeState(state));

  test("survives a round trip with every filter set", () => {
    const state: BrowseState = {
      filters: {
        name: "Bolt",
        type: "Instant",
        text: "damage",
        artist: "Guay",
        flavor: "Kjeldoran",
        manaCost: "{R}",
        set: "blb",
        setName: "Bloomburrow",
        keyword: "Flying",
        lang: "ja",
        colors: ["R"],
        colorMatch: "exactly",
        identity: ["R", "G"],
        rarity: ["rare", "mythic"],
        cmc: [1, 2],
        games: ["paper", "arena"],
        stats: [
          { field: "power", op: "equals", value: "3" },
          { field: "loyalty", op: "not", value: "4" },
        ],
        is: ["reserved", "fullart"],
        not: ["digital"],
      },
      sort: "newest",
      page: 3,
    };
    expect(roundTrip(state)).toEqual(state);
  });

  test("drops stat rows, criteria and languages it does not recognise", () => {
    const params = new URLSearchParams({
      // In order: unknown field, unknown operator, an operator `startsWith` that no stat offers,
      // blank value, then two that survive (power now supports gte via its derived column).
      stats: "bogus:equals:1,cmc:sideways:2,power:startsWith:4,power:equals:,power:gte:4,cmc:gte:4",
      is: "reserved,notacriterion",
      lang: "elvish",
    });
    const { filters } = decodeState(params);
    expect(filters.stats).toEqual([
      { field: "power", op: "gte", value: "4" },
      { field: "cmc", op: "gte", value: "4" },
    ]);
    expect(filters.is).toEqual(["reserved"]);
    expect(filters.lang).toBeUndefined();
  });

  test("omits blank stat rows from the query string", () => {
    const params = encodeState({
      filters: { stats: [{ field: "cmc", op: "equals", value: "  " }] },
      sort: "relevance",
      page: 0,
    });
    expect(params.toString()).toBe("");
  });

  test("omits defaults from the query string", () => {
    expect(encodeState({ filters: {}, sort: "relevance", page: 0 }).toString()).toBe("");
  });

  test("drops colour letters it does not recognise", () => {
    const { filters } = decodeState(new URLSearchParams("colors=X,R&identity=Q"));
    expect(filters.colors).toEqual(["R"]);
    expect(filters.identity).toBeUndefined();
    expect(hasAnyFilter(decodeState(new URLSearchParams("colors=X")).filters)).toBe(false);
  });

  test("ignores an unknown sort and a nonsense page", () => {
    const params = new URLSearchParams({ sort: "bogus", page: "-4" });
    expect(decodeState(params).sort).toBe("relevance");
    expect(decodeState(params).page).toBe(0);
  });

  test("parses cmc back into numbers", () => {
    expect(decodeState(new URLSearchParams({ cmc: "0,3" })).filters.cmc).toEqual([0, 3]);
  });
});

describe("datasetDate", () => {
  test("reads the bulk file's UTC timestamp out of the collection key", () => {
    expect(datasetDate("default-cards-20260721211623")?.toISOString()).toBe(
      "2026-07-21T21:16:23.000Z",
    );
  });

  test("is undefined when the key carries no timestamp", () => {
    expect(datasetDate("default-cards")).toBeUndefined();
  });
});
