# Prompt: consumer feedback on static-shard from a 116k-record demo

> Paste the section below into a fresh session in `/home/emil/Programming/static-shard`.
> It is written to be self-contained.

---

You are working in the `static-shard` repo. What follows is field feedback from building a real
consumer app against static-shard 0.0.0 — a Scryfall-style Magic card browser over the full
Scryfall `default-cards` dump. Treat these as findings to verify, not instructions to implement:
every claim below was measured or read from the source, but you should confirm each against the
current code and the relevant ADR before changing anything. Several of these are deliberate design
choices (ADR-0008 in particular), so the useful output may be documentation or a wizard change
rather than an engine change.

## The consumer app (for reproduction)

- Location: `/home/emil/Programming/shard-test` (React + Vite SPA, links both packages locally).
- Dataset: Scryfall `default-cards`, **116,138 records**, 532 MB NDJSON source.
- Build config: `shardBytes` 2 MB, `sortField: "image_updated_at"`, `pk: "id"`, and — importantly —
  **nearly every field indexed** (the `init` wizard's recommendations were accepted broadly).
- Resulting tree: **529 shards, 722 MB total**, `manifest.json` **3.3 MB**, index 23 MB.
- Measurements were taken in Chrome via `performance.getEntriesByType('resource')`, deduplicated by
  URL and summed on `decodedBodySize`. Note React StrictMode double-invokes effects in dev, so raw
  request counts were ~2× the distinct counts; all numbers below are **distinct** resources.

## Finding 1 — `count()` overestimates by orders of magnitude, and reads as a result count

`executeCount` sums `manifest.shards[i].count` across every *candidate* shard, so it reports how many
records live in the files a query would have to read — not how many match.

| Query | `count()` returned | Actual matches | Factor |
|---|---|---|---|
| `name: { contains: "Black Lotus" }` | ~4,359 | **18** | **242×** |
| `set: { equals: "blb" }` | ~988 | ≥60 (not isolated) | — |
| `image_updated_at: { gte: … }` | ~1,712 | ~1,700 | ~1× |

The first row is the problem case: 56 candidate shards × ~78 records each = 4,359. `exact: false` is
returned honestly, and ADR-0008 documents the upper-bound design — but a consumer building "about
N results" UI gets a number that is wrong by 2+ orders of magnitude on exactly the queries users
type most (selective text search). It's a cost estimate presented in the shape of a result count.

**Worth investigating:** the inverted index appears to be value → *shard list* (see
`shardIndicesForFilter`), so no record-level count exists to return. If each posting entry also
carried **how many records in that shard hold the value**, then `count()` for a single-field
`equals`/`in` would become exact at zero extra fetch cost (index chunks are already being read).
Multi-field AND would remain an upper bound — `min` of per-field counts is a much tighter one than
the current shard-population sum. Please check whether the chunk format has room for this and what
it costs in index size.

## Finding 2 — read amplification is dominated by sort-field locality

`executeFindMany` fetches **every candidate shard whole**, materializes all matches, then sorts, then
slices. `limit` therefore trims output but never reduces fetching. Measured cost per page:

| Query | Distinct shards | Bytes fetched | Useful payload |
|---|---|---|---|
| `get(id)` | **1** (+1 index chunk) | **1.1 MB** | 1 record — matches the ADR-0003 §10 claim ✅ |
| `image_updated_at: { gte: … }` (60/page) | 38 | 37.7 MB | ~1,700 records |
| `set: { equals: "blb" }` | 42 | 41.7 MB | 988 records |
| `name: { contains: "Black Lotus" }` | 56 | 55.8 MB | 18 records (~83 KB) |

`get(id)` is excellent and behaves exactly as documented. Everything else costs 35–55 MB per page.

The root cause is not the index — it's that **`sortField` determines shard locality, and this build
chose a field uncorrelated with anything users query**. `image_updated_at` (a bulk-rescan timestamp)
scatters any result set uniformly across all 529 shards, so ~50 matching records touch ~50 shards and
each drags in ~1 MB. Note this is the same phenomenon as Finding 1: the count overestimate factor
*is* the read-amplification factor.

**Worth considering, roughly in order of leverage:**

1. **Wizard/doc guidance on `sortField`.** This is the single highest-leverage knob and currently
   reads as an incidental choice. `init` recommending a timestamp because it's monotonic is close to
   worst-case. Guidance like "pick the field your most common filter or ordering uses" — plus a
   warning when the chosen sort field is not among the indexed/filterable ones — would have changed
   this build. Sorting by `name` here would make name search near-contiguous.
2. **Column projection / a summary tier.** List views need ~6 fields (id, name, set, rarity, image,
   mana cost); detail views need all ~80. Records here average 4.6 KB, so a grid page pays ~10× for
   fields it never reads. Either a `select`-style projection or a build-time "summary shard" tier
   would cut list-view bytes by roughly that factor. This is architectural — worth a spike, not a
   patch.
3. **`shardBytes` guidance.** Cost ≈ shards_touched × shardBytes, and shards_touched is set by
   locality, so smaller shards reduce waste close to linearly. 2 MB was the default-ish choice and is
   probably too large for a scattered-access dataset; the docs could frame the tradeoff explicitly
   (more requests vs. less waste per request).
4. **Compression.** Whether the `dataset.gzip` path is exercised by default, and whether it should be
   for NDJSON shards on hosts that don't compress unknown extensions.

## Finding 3 — `contains` / `startsWith` are case-sensitive with no normalized index

`matchesValueOp` implements `contains` as `value.includes(opValue)`, and `trigramsOf` slices the raw
string without normalization. So on a dataset of Title Case names, `contains: "bolt"` matches nothing
while `contains: "Bolt"` works. Every consumer building a search box hits this immediately.

The demo works around it by retrying the query with each text filter title-cased when the literal
query returns zero rows — which is a hack in app code that every consumer will reinvent, and it still
fails on mid-word matches.

**Worth considering:** a per-field `caseInsensitive: true` (or `lowercase: true`) index option that
stores folded trigrams and folded values, with the client folding the query to match. If that's out
of scope, this deserves a loud call-out in the README/ADR-0003 §7 rather than being discoverable only
by reading `filter.ts`.

## Finding 4 — `kind: "json"` fields emit `unknown`, forcing hand-written types

`config.ts` treats `json` as payload-only (correctly — it can't be indexed or sorted), and
`codegen.ts` emits those fields as `unknown`. But they're still *read* by every consumer: in this app
`image_uris`, `card_faces`, `prices`, and `legalities` carry the data the UI is built from.

The result is that the one part of the generated client that isn't type-safe is the part holding the
payload, and each consuming app re-declares the same interfaces plus narrowing helpers by hand. That
undercuts the "typed client" pitch specifically for nested data, which is common in real datasets.

**Worth considering:** a `tsType` (plus optional `tsImport`) escape hatch per json field in
`static-shard.config.json`, so codegen emits `image_uris?: ImageUris` and an import, leaving the
declaration to the consumer but keeping it in one place. Validation stays out of scope — this is
purely a compile-time convenience.

## Finding 5 — the manifest grows large when many fields are indexed

`manifest.json` is **3.3 MB** here and is fetched on every cold load before any query can run.
ADR-0003 says the root manifest stays "routing-essential only" with rich pruning data spilled to
sidecars, so indexing ~75 fields appears to defeat that intent (likely via inline zonemap `pairs`).

**Worth considering:** a spill threshold that scales with field count, and/or a build-time warning
when the manifest exceeds some budget (say 500 KB) suggesting the user index fewer fields. The `init`
wizard happily recommended indexing almost everything, which is what produced this.

## What would be most useful back

1. Confirm or correct each finding against the current code — especially my reading that postings are
   shard-level only (Finding 1) and that `limit` cannot reduce shard fetching (Finding 2).
2. For each, say whether it's working-as-designed (→ docs change), a tractable improvement, or a
   deferred v2 item, and why.
3. If you agree Finding 2's item 1 (sortField guidance) is the highest-leverage fix, propose the
   concrete wizard/docs change — that alone would have changed this build's cost profile.

Do not make sweeping engine changes off the back of this. Investigate, then propose.
