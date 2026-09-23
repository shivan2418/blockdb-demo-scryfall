import { HashRouter, Link, Route, Routes } from "react-router-dom";
import { About } from "./routes/About";
import { AdvancedSearch } from "./routes/AdvancedSearch";
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

function App() {
  return (
    // HashRouter keeps deep links working on GitHub Pages without a 404.html
    // redirect, since the server only ever serves index.html.
    <HashRouter>
      <div className="app">
        <header className="app-header">
          <Link to="/" className="brand">
            <strong>blockfall</strong>
            <span>116,138 Magic cards, queried from static files</span>
          </Link>
          <nav className="app-nav">
            <Link to="/about" className="link-button">
              About
            </Link>
            <a
              href="https://github.com/shivan2418/blockdb"
              target="_blank"
              rel="noreferrer"
              className="link-button"
            >
              blockdb ↗
            </a>
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/advanced" element={<AdvancedSearch />} />
          <Route path="/card/:id" element={<CardDetail />} />
          <Route path="/about" element={<About />} />
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
            <a href="https://github.com/shivan2418/blockdb" target="_blank" rel="noreferrer">
              blockdb
            </a>
            : no backend, no database — every query fetches only the block files it needs.
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
