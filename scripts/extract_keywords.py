"""Write every keyword ability in the bulk dump to src/data/keywords.json.

Scryfall's `keywords` casing is inconsistent ("Flying", "Battle Cry", "Pick a Perk"), and blockdb
compares list elements exactly, so the app looks the typed keyword up in this list case-insensitively
before querying. Rerun after each data refresh: python3 scripts/extract_keywords.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
config = json.loads((ROOT / "blockdb.config.json").read_text())
dump = ROOT / config["input"]["path"]

keywords = set()
with dump.open() as lines:
    for line in lines:
        if line.strip():
            keywords.update(json.loads(line).get("keywords", []))

out = ROOT / "src" / "data" / "keywords.json"
out.write_text(json.dumps(sorted(keywords, key=str.lower), ensure_ascii=False, indent=0) + "\n")
print(f"{len(keywords)} keywords → {out.relative_to(ROOT)}")
