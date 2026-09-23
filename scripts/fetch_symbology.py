#!/usr/bin/env python3
"""Snapshot Scryfall's card-symbol list into src/data/symbology.json.

One request to https://api.scryfall.com/symbology. The app then looks symbols
up in this file instead of building svgs.scryfall.io URLs by hand, which
Scryfall asks clients not to do. Re-run when new symbols ship.

    python3 scripts/fetch_symbology.py
"""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path

URL = "https://api.scryfall.com/symbology"
OUT = Path("src/data/symbology.json")
USER_AGENT = "blockfall-demo/0.1 (blockdb proof of concept)"


def main() -> None:
    req = urllib.request.Request(
        URL, headers={"User-Agent": USER_AGENT, "Accept": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        symbols = json.load(resp)["data"]

    # Keyed by the braced symbol as it appears in mana costs and rules text.
    table = {
        s["symbol"]: {"svg": s["svg_uri"], "name": s["english"]}
        for s in symbols
        if s.get("svg_uri")
    }
    OUT.write_text(json.dumps(table, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(table)} symbols to {OUT}")


if __name__ == "__main__":
    main()
