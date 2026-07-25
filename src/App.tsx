import { HashRouter, Link, Route, Routes } from "react-router-dom";
import { Browse } from "./routes/Browse";
import { CardDetail } from "./routes/CardDetail";

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
          <a
            href="https://github.com/shivan2418/static-shard"
            target="_blank"
            rel="noreferrer"
            className="link-button"
          >
            static-shard ↗
          </a>
        </header>

        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/card/:id" element={<CardDetail />} />
          <Route path="*" element={<Browse />} />
        </Routes>

        <footer className="app-footer">
          No backend, no database — every query fetches only the shard files it needs. Card data and
          images from Scryfall.
        </footer>
      </div>
    </HashRouter>
  );
}

export default App;
