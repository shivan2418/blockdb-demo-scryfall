# blockfall

A Scryfall-style browser for 116,138 Magic: The Gathering cards that runs with no backend and no
database. It's a static site on GitHub Pages, built as a proof of concept for
[blockdb](https://github.com/shivan2418/blockdb).

**Live:** https://shivan2418.github.io/blockdb-demo-scryfall/

## How it works

At build time, `blockdb build` reads Scryfall's `default-cards` bulk file (532 MB of NDJSON) and
writes it out as static files:

- **Blocks:** 530 gzipped files of about 1 MB each, with the records sorted by card name.
- **Indexes:** a small index per indexed field that records which blocks can hold each value.
- **Manifest:** the file that ties the blocks and indexes together.

It also generates a typed client in `src/blockdb/`.

In the browser, a query such as "white and blue creatures with flying" first reads the indexes to
find out which blocks can hold a match. It then fetches only those blocks, filters the records
locally, and stops as soon as it has a full page of results. A typical search downloads a few
megabytes at most, never the whole 59 MB dataset.

Card data and images come from [Scryfall](https://scryfall.com). The data is a snapshot, and the
images load from Scryfall's CDN, which [Scryfall allows](https://scryfall.com/blog/upcoming-api-changes-to-scryfall-image-uris-and-download-uris-221).

## What it can do

- **Search:** by name, rules text, type line, artist, flavor text and set name. Text matching
  ignores case and accents (`lim-dul` finds *Lim-Dûl*).
- **Colors:** "any of", "including", "exactly" and "at most", plus Colorless. Commander color
  identity works the way Scryfall's does: cards that fit inside the colors you pick.
- **Other filters:** rarity, mana value, exact mana cost, set, keyword, language, game (paper /
  Arena / MTGO), card criteria such as reserved list or full art, and stat comparisons (mana
  value, power, toughness, loyalty).
- **Advanced search:** opens inside the filter sidebar, so the results stay in view.
- **Sorting:** by name, release date, mana value or popularity.
- **Card pages:** show real mana symbols, rules text, prices and format legality.
- **Shareable URLs:** every search lives in the URL, so links work and Back behaves.

## Limits

These come from answering queries from static files. Most are deliberate trade-offs.

- **Match counts are often estimates.** They show as "about N cards" unless the engine has seen
  every match.
- **Sorting everything by anything other than name is narrowed.** Blocks are stored in name order,
  so a name sort can stop after the first page. Any other sort has to read every block that could
  match. For searches that can't narrow down which blocks to read, including an unfiltered browse
  and Colorless on its own, the view is limited to names starting with "A". The page says when
  this happens.
- **Some broad searches are expensive.** "Including all five colors" reads about 15 MB, because
  every block holds cards of every color.
- **Double-faced cards and color filters:** about 1,600 of these cards store their colors only on
  each face, so color filters don't find them yet.
- **Some of Scryfall's advanced options are left out:** formats, prices, blocks, Lore Finder and
  display preferences.

## Running it locally

You need Node 24 and pnpm 10.33.4. The version is pinned in `package.json`, so `corepack enable`
picks it up.

```sh
pnpm install
pnpm dev        # http://localhost:5173
```

The built dataset is committed in `public/blockdb/`, so you don't need the Scryfall bulk file
unless you're rebuilding the data.

| Command | What it does |
|---|---|
| `pnpm dev` | Start the Vite dev server |
| `pnpm build` | Typecheck and build the site into `dist/` |
| `pnpm preview` | Serve the production build locally |
| `pnpm test` | Run the unit tests (query building, URL state) |
| `pnpm lint` | Run oxlint |

## Refreshing the card data

1. Download the latest `default-cards` file from
   [Scryfall's bulk data page](https://scryfall.com/docs/api/bulk-data) into the project root. It's
   gitignored.
2. In `blockdb.config.json`, update `input.path` and `collection` to the new file's timestamp.
   Update `COLLECTION` in `src/data/collection.ts` to match. The footer's "downloaded on" date is
   read from that key.
3. Run `pnpm exec blockdb build`. This regenerates `public/blockdb/` and `src/blockdb/`.
   If a newer dump adds fields that can be missing, the build stops with a schema-drift error
   listing every such field. Add `"absent": true` to each in `blockdb.config.json`, or run
   `pnpm exec blockdb init --reinfer`. Since v0.2.1 that refreshes only facts about the data and
   keeps the sort field, indexes, `contains` opt-ins and compression setting. Review the config
   diff either way.
4. Commit and push. Each refresh adds about 59 MB to the git history.

The mana symbol table (`src/data/symbology.json`) is a snapshot of Scryfall's `/symbology` list.
When new symbols come out, refresh it with `python3 scripts/fetch_symbology.py`.
The keyword list (`src/data/keywords.json`) comes from the dump itself. It lets a keyword search
ignore case, so regenerate it after each refresh with `python3 scripts/extract_keywords.py`.

## Deploying

Every push to `master` runs `.github/workflows/pages.yml`. It installs the dependencies, runs the
tests, builds the site and publishes `dist/` to GitHub Pages. blockdb installs from its
[v0.6.0 GitHub Release](https://github.com/shivan2418/blockdb/releases/tag/v0.6.0) tarballs.

The blocks are gzipped rather than brotli-compressed on purpose. GitHub Pages serves both as raw
bytes, so the browser has to decompress them itself, and Chrome can't decompress brotli natively
yet.

## Project layout

```
blockdb.config.json    dataset schema: sort field, indexed fields, derived columns
public/blockdb/        the built dataset (generated, committed)
src/blockdb/           typed client generated by `blockdb build`
src/data/cards.ts      turns UI filters into blockdb queries
src/data/url-state.ts  URL ↔ search state
src/routes/            Browse, AdvancedSearch (sidebar form), CardDetail
src/components/        filters, grid, mana symbols, pagination
```

## Credits

Card data and images are provided by [Scryfall](https://scryfall.com). This project is not
affiliated with or endorsed by Scryfall.

Magic: The Gathering card images, text and mana symbols are © Wizards of the Coast. This is
unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy, and is not
produced by or endorsed by Wizards of the Coast.
