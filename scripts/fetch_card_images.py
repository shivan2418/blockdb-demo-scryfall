#!/usr/bin/env python3
"""Download Scryfall card images for local hosting (no hotlinking).

Image URLs come from the local bulk JSONL, so this makes zero calls to
api.scryfall.com — only the image CDN is touched. Downloads are rate limited
and identify themselves via User-Agent, per Scryfall's API guidelines, which
ask that apps cache images locally rather than hotlink them.

Resumable: existing files are skipped, so re-running picks up where it stopped.
Safe to Ctrl-C — in-flight downloads finish and a summary is printed.

    python3 scripts/fetch_card_images.py --limit 50   # quick smoke test
    python3 scripts/fetch_card_images.py              # the full set

Output layout (sharded 2 chars deep so no directory holds 100k+ files):
    public/card-images/<variant>/<id[:2]>/<id>.jpg
    public/card-images/<variant>/<id[:2]>/<id>-0.jpg   # multi-faced cards
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import signal
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

USER_AGENT = "static-shard-demo/0.1 (local image cache for a static-shard demo app)"

# Every variant is JPEG except `png`.
EXTENSIONS = {"png": ".png"}
VARIANTS = ["small", "normal", "large", "png", "art_crop", "border_crop"]

stop = threading.Event()


class RateLimiter:
    """Allow at most `rate` acquisitions per second, across all threads."""

    def __init__(self, rate: float) -> None:
        self._interval = 1.0 / rate if rate > 0 else 0.0
        self._lock = threading.Lock()
        self._next = time.monotonic()

    def acquire(self) -> None:
        if not self._interval:
            return
        with self._lock:
            now = time.monotonic()
            wait = max(0.0, self._next - now)
            self._next = max(now, self._next) + self._interval
        if wait:
            time.sleep(wait)


def fetch(url: str, dest: Path, limiter: RateLimiter, retries: int) -> int:
    """Download `url` to `dest`, returning bytes written.

    Writes to a .part file and renames, so an interrupted download never leaves
    a truncated file that a later run would mistake for complete.
    """
    for attempt in range(retries + 1):
        if stop.is_set():
            raise KeyboardInterrupt
        limiter.acquire()
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": USER_AGENT, "Accept": "image/*"}
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
            dest.parent.mkdir(parents=True, exist_ok=True)
            tmp = dest.with_name(dest.name + ".part")
            tmp.write_bytes(data)
            os.replace(tmp, dest)
            return len(data)
        except urllib.error.HTTPError as err:
            if err.code == 404 or attempt == retries:
                raise
            retry_after = (err.headers or {}).get("Retry-After", "")
            delay = float(retry_after) if retry_after.isdigit() else 2.0**attempt
            time.sleep(delay)
        except (urllib.error.URLError, TimeoutError, OSError):
            if attempt == retries:
                raise
            time.sleep(2.0**attempt)
    raise RuntimeError("unreachable")


def plan(jsonl: Path, out: Path, variant: str, placeholders: bool, limit: int):
    """Yield (dest, url) pairs by streaming the JSONL (it is far too big to load)."""
    ext = EXTENSIONS.get(variant, ".jpg")
    found = 0
    with jsonl.open(encoding="utf-8") as handle:
        for line in handle:
            if stop.is_set():
                return
            line = line.strip()
            if not line:
                continue
            card = json.loads(line)
            if not placeholders and card.get("image_status") in ("missing", "placeholder"):
                continue
            card_id = card.get("id")
            if not card_id:
                continue

            # Single-faced cards carry image_uris at the top level; split /
            # transforming cards carry one set per face instead.
            targets = []
            top = card.get("image_uris") or {}
            if top.get(variant):
                targets.append((f"{card_id}{ext}", top[variant]))
            else:
                for i, face in enumerate(card.get("card_faces") or []):
                    url = (face.get("image_uris") or {}).get(variant)
                    if url:
                        targets.append((f"{card_id}-{i}{ext}", url))

            for name, url in targets:
                yield out / variant / card_id[:2] / name, url
                found += 1
                if limit and found >= limit:
                    return


def human(size: float) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(size) < 1024 or unit == "TB":
            return f"{size:.1f} {unit}"
        size /= 1024
    return ""


def main() -> int:
    default_jsonl = next(iter(sorted(glob.glob("default-cards-*.jsonl"))), None)

    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--jsonl", default=default_jsonl, help="Scryfall bulk JSONL")
    parser.add_argument("--out", default="public/card-images", help="output directory")
    parser.add_argument("--variant", default="small", choices=VARIANTS)
    parser.add_argument("--rate", type=float, default=10.0, help="requests/sec (default 10)")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--limit", type=int, default=0, help="stop after N images (0 = all)")
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--placeholders", action="store_true", help="include placeholder art")
    args = parser.parse_args()

    if not args.jsonl:
        print("error: no default-cards-*.jsonl found; pass --jsonl", file=sys.stderr)
        return 2
    jsonl = Path(args.jsonl)
    if not jsonl.is_file():
        print(f"error: {jsonl} not found", file=sys.stderr)
        return 2

    out = Path(args.out)
    signal.signal(signal.SIGINT, lambda *_: stop.set())

    print(f"scanning {jsonl} for '{args.variant}' images...", flush=True)
    work, already = [], 0
    for dest, url in plan(jsonl, out, args.variant, args.placeholders, args.limit):
        if dest.exists():
            already += 1
        else:
            work.append((dest, url))
    total = len(work) + already
    print(f"{total} images referenced — {already} already on disk, {len(work)} to fetch")
    if not work:
        print("nothing to do")
        return 0

    print(f"downloading at ~{args.rate}/s with {args.workers} workers (Ctrl-C to stop)\n")
    limiter = RateLimiter(args.rate)
    done = failed = 0
    downloaded_bytes = 0
    started = time.monotonic()
    failures: list[tuple[Path, str]] = []
    lock = threading.Lock()

    def worker(item: tuple[Path, str]) -> None:
        nonlocal done, failed, downloaded_bytes
        dest, url = item
        try:
            size = fetch(url, dest, limiter, args.retries)
        except KeyboardInterrupt:
            return
        except Exception as err:  # noqa: BLE001 - one bad image must not kill the run
            with lock:
                failed += 1
                failures.append((dest, f"{type(err).__name__}: {err}"))
            return
        with lock:
            done += 1
            downloaded_bytes += size
            if done % 100 == 0 or done + failed == len(work):
                elapsed = time.monotonic() - started
                rate = done / elapsed if elapsed else 0
                remaining = (len(work) - done - failed) / rate if rate else 0
                print(
                    f"  {done}/{len(work)}  {human(downloaded_bytes)}  "
                    f"{rate:.1f}/s  eta {remaining / 60:.0f}m",
                    flush=True,
                )

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        try:
            pool.map(worker, work)
        except KeyboardInterrupt:
            stop.set()

    elapsed = time.monotonic() - started
    print(f"\ndownloaded {done} in {elapsed / 60:.1f}m ({human(downloaded_bytes)})")
    if done:
        average = downloaded_bytes / done
        print(f"average {human(average)}/image → full set of {total} ≈ {human(average * total)}")
    if failed:
        log = Path("scripts/failed-images.log")
        log.write_text("\n".join(f"{d}\t{e}" for d, e in failures), encoding="utf-8")
        print(f"{failed} failed — see {log} (re-run to retry; finished files are skipped)")
    if stop.is_set():
        print("stopped early — re-run to resume")
    return 0


if __name__ == "__main__":
    sys.exit(main())
