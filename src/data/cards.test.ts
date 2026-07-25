import { describe, expect, test } from "vitest";
import { manaSymbols } from "./card-view";
import { DEFAULT_SINCE, buildOrderBy, buildWhere, hasAnyFilter, titleCase } from "./cards";
import { decodeState, encodeState, type BrowseState } from "./url-state";

describe("buildWhere", () => {
  test("falls back to the sort-field window when nothing is selected", () => {
    // Without this an unpruned query would download every shard.
    expect(buildWhere({})).toEqual({ image_updated_at: { gte: DEFAULT_SINCE } });
  });

  test("treats blank and whitespace-only text as unset", () => {
    expect(buildWhere({ name: "   " })).toEqual({ image_updated_at: { gte: DEFAULT_SINCE } });
  });

  test("maps text filters to contains", () => {
    expect(buildWhere({ name: "Bolt", type: "Instant" })).toEqual({
      name: { contains: "Bolt" },
      type_line: { contains: "Instant" },
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
    const wheres = [{}, { name: "x" }, { colors: ["W"] }, { cmc: [3] }].map(buildWhere);
    for (const where of wheres) {
      const operators = Object.values(where).flatMap((filter) => Object.keys(filter ?? {}));
      expect(operators.length).toBeGreaterThan(0);
      expect(operators.every((operator) => operator === "not")).toBe(false);
    }
  });

  test("drops the default window as soon as a real filter exists", () => {
    expect(buildWhere({ rarity: ["rare"] })).not.toHaveProperty("image_updated_at");
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

describe("titleCase", () => {
  test("capitalises each word so lowercase queries match printed names", () => {
    expect(titleCase("lightning bolt")).toBe("Lightning Bolt");
  });

  test("leaves existing capitals intact", () => {
    expect(titleCase("Sol Ring")).toBe("Sol Ring");
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
        set: "blb",
        keyword: "Flying",
        colors: ["R"],
        rarity: ["rare", "mythic"],
        cmc: [1, 2],
      },
      sort: "newest",
      page: 3,
    };
    expect(roundTrip(state)).toEqual(state);
  });

  test("omits defaults from the query string", () => {
    expect(encodeState({ filters: {}, sort: "relevance", page: 0 }).toString()).toBe("");
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
