import { HashRouter, Link, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { ADVANCED_PARAM, ADVANCED_VALUE, AdvancedSearch } from "./routes/AdvancedSearch";
import { Browse } from "./routes/Browse";
import { CardDetail } from "./routes/CardDetail";
import { datasetDate } from "./data/collection";

// Formatted in UTC, the zone the bulk file's timestamp is in, so a late-evening
// dump doesn't show up as the next day for viewers in other time zones.
const DATASET_LABEL = datasetDate()?.toLocaleDateString("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Opens the advanced panel over the current search, or over a blank one from other pages. */
function AdvancedLink() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const next = new URLSearchParams(pathname === "/" ? params : undefined);
  next.set(ADVANCED_PARAM, ADVANCED_VALUE);
  return (
    <Link to={`/?${next.toString()}`} className="link-button">
      Advanced search
    </Link>
  );
}

function App() {
  return (
    // HashRouter keeps deep links working on GitHub Pages without a 404.html
    // redirect, since the server only ever serves index.html.
    <HashRouter>
      <div className="app">
        <header className="app-header">
          <Link to="/" className="brand">
            <strong>shardfall</strong>
            <span>116,138 Magic cards, queried from static files</span>
          </Link>
          <nav className="app-nav">
            <AdvancedLink />
            <a
              href="https://github.com/shivan2418/static-shard"
              target="_blank"
              rel="noreferrer"
              className="link-button"
            >
              static-shard ↗
            </a>
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/advanced" element={<AdvancedSearch />} />
          <Route path="/card/:id" element={<CardDetail />} />
          <Route path="*" element={<Browse />} />
        </Routes>

        <footer className="app-footer">
          <p>
            An unofficial wrapper around{" "}
            <a href="https://scryfall.com" target="_blank" rel="noreferrer">
              Scryfall
            </a>
            ’s{" "}
            <a href="https://scryfall.com/docs/api/bulk-data" target="_blank" rel="noreferrer">
              default-cards bulk data
            </a>
            {DATASET_LABEL && <>, as downloaded on {DATASET_LABEL}</>}. Card data and images come
            from Scryfall, and images load from its CDN. Not affiliated with or endorsed by
            Scryfall.
          </p>
          <p>
            Built as a proof of concept for{" "}
            <a href="https://github.com/shivan2418/static-shard" target="_blank" rel="noreferrer">
              static-shard
            </a>
            : no backend, no database — every query fetches only the shard files it needs.
          </p>
          <p>
            Magic: The Gathering card images, text and mana symbols are © Wizards of the Coast. This
            site is unofficial Fan Content permitted under the Wizards of the Coast Fan Content
            Policy, and is not produced by or endorsed by Wizards of the Coast.
          </p>
        </footer>
      </div>
    </HashRouter>
  );
}

export default App;
