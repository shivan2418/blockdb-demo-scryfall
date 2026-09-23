import { Link } from "react-router-dom";

/** Why the demo exists, how it answers queries, and where that approach runs out. */
export function About() {
  return (
    <main className="about">
      <h1>About blockfall</h1>

      <section>
        <h2>Why it exists</h2>
        <p>
          blockfall is a proof of concept for{" "}
          <a href="https://github.com/shivan2418/blockdb" target="_blank" rel="noreferrer">
            blockdb
          </a>
          , a library for querying large datasets straight from static files. There is no server
          and no database: the whole site, including all 116,138 cards, is plain files on GitHub
          Pages. The question it tests is how far that gets you on a real dataset, with a search
          people actually use.
        </p>
        <p>
          It is modelled on <a href="https://scryfall.com">Scryfall</a>, whose data it uses. It is
          not a replacement for Scryfall, and it is not affiliated with it.
        </p>
      </section>

      <section>
        <h2>How it works</h2>
        <p>
          At build time, Scryfall's 532 MB bulk file is split into 530 compressed blocks of about
          1 MB each, sorted by card name, plus small indexes that record which blocks can hold each
          value. When you search, the browser reads the indexes, fetches only the blocks that could
          match, filters them locally, and stops once it has a page of results. A typical search
          downloads a few megabytes out of 59 MB.
        </p>
      </section>

      <section>
        <h2>Limitations</h2>
        <ul>
          <li>
            <strong>Counts are often estimates.</strong> The engine knows which blocks could match,
            not how many cards inside them do, so totals show as “about N” unless it has read every
            match.
          </li>
          <li>
            <strong>Sorting by anything but name is limited.</strong> Blocks are stored in name
            order, so a name sort can stop after the first page. Other orders have to read every
            block that could match. When a search can't narrow that down, it is limited to names
            starting with “A”, and the page says so.
          </li>
          <li>
            <strong>Broad searches cost more.</strong> Every block holds cards of every color, so a
            search like “including all five colors” can download around 15 MB.
          </li>
          <li>
            <strong>Some double-faced cards miss color filters.</strong> About 1,600 of them store
            their colors only per face, so color filters don't find them yet.
          </li>
          <li>
            <strong>Not every Scryfall option is here.</strong> Formats, prices, blocks, Lore Finder
            and display modes are left out, because the data isn't indexed for them or the engine
            can't combine filters that way (it has no OR across fields).
          </li>
          <li>
            <strong>The data is a snapshot.</strong> Cards and prices are from the date in the
            footer, not live. Card images load from Scryfall.
          </li>
        </ul>
      </section>

      <p>
        <Link to="/">← Back to the cards</Link>
      </p>
    </main>
  );
}
