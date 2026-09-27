#!/usr/bin/env python3
"""
Import a filtered subset of the official Lichess puzzle database into Supabase.

Examples:

  python import_lichess_to_supabase.py lichess_db_puzzle.csv.zst --limit 10000

  python import_lichess_to_supabase.py lichess_db_puzzle.csv \
      --limit 50000 \
      --min-popularity 60 \
      --min-rating 700 \
      --max-rating 2600

Required environment variables:

  SUPABASE_URL=https://YOUR_PROJECT.supabase.co

Use ONE of:
  SUPABASE_SECRET_KEY=sb_secret_...
  SUPABASE_SERVICE_ROLE_KEY=legacy-service-role-jwt

Never put either elevated key in browser/frontend code.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Iterable, TextIO

MATE_THEMES = {
    "mate",
    "mateIn1",
    "mateIn2",
    "mateIn3",
    "mateIn4",
    "mateIn5",
}

ENDGAME_THEMES = {
    "endgame",
    "pawnEndgame",
    "rookEndgame",
    "queenEndgame",
}

STRATEGY_THEMES = {
    "advantage",
    "quietMove",
    "defensiveMove",
    "crushing",
    "master",
}


def classify_difficulty(rating: int) -> str:
    if rating < 1200:
        return "Beginner"
    if rating < 1700:
        return "Intermediate"
    if rating < 2200:
        return "Advanced"
    return "Really Hard"


def classify_category(themes: list[str]) -> str:
    theme_set = set(themes)

    if theme_set & MATE_THEMES:
        return "Checkmate"

    if theme_set & ENDGAME_THEMES:
        return "Endgame"

    if theme_set & STRATEGY_THEMES:
        return "Strategy"

    return "Tactic"


def open_lichess_csv(path: Path) -> tuple[TextIO, object | None]:
    """
    Returns (text_stream, closer).

    For .zst files install:
      python -m pip install zstandard
    """
    if path.suffix.lower() != ".zst":
        return path.open("r", encoding="utf-8", newline=""), None

    try:
        import zstandard as zstd
    except ImportError as exc:
        raise SystemExit(
            "This is a .zst file. Install zstandard first:\n"
            "  python -m pip install zstandard"
        ) from exc

    raw = path.open("rb")
    reader = zstd.ZstdDecompressor().stream_reader(raw)
    text_stream = io.TextIOWrapper(reader, encoding="utf-8", newline="")
    return text_stream, raw


def post_batch(
    supabase_url: str,
    secret_key: str,
    rows: list[dict],
) -> None:
    endpoint = (
        supabase_url.rstrip("/")
        + "/rest/v1/chess_puzzles?on_conflict=id"
    )

    headers = {
        "apikey": secret_key,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }

    # New sb_secret_* keys should be sent as apikey, not JWT bearer tokens.
    # Legacy service_role keys are JWTs, so keep Authorization for them.
    if not secret_key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {secret_key}"

    request = urllib.request.Request(
        endpoint,
        data=json.dumps(rows, separators=(",", ":")).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            response.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Supabase returned HTTP {exc.code}: {body}"
        ) from exc


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--limit", type=int, default=10000)
    parser.add_argument("--batch-size", type=int, default=250)
    parser.add_argument("--min-popularity", type=int, default=60)
    parser.add_argument("--min-rating", type=int, default=700)
    parser.add_argument("--max-rating", type=int, default=2600)
    args = parser.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    secret_key = (
        os.environ.get("SUPABASE_SECRET_KEY", "").strip()
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    )

    if not supabase_url:
        raise SystemExit("Missing SUPABASE_URL")

    if not secret_key:
        raise SystemExit(
            "Missing SUPABASE_SECRET_KEY "
            "(or legacy SUPABASE_SERVICE_ROLE_KEY)"
        )

    if not args.input.exists():
        raise SystemExit(f"Input file does not exist: {args.input}")

    stream, closer = open_lichess_csv(args.input)

    inserted = 0
    scanned = 0
    batch: list[dict] = []

    try:
        reader = csv.DictReader(stream)

        expected = {
            "PuzzleId",
            "FEN",
            "Moves",
            "Rating",
            "Popularity",
            "Themes",
        }

        if not reader.fieldnames or not expected.issubset(reader.fieldnames):
            raise SystemExit(
                "Unexpected CSV columns. Make sure this is the official "
                "lichess_db_puzzle.csv(.zst) file."
            )

        for row in reader:
            scanned += 1

            try:
                rating = int(row["Rating"])
                popularity = int(row["Popularity"])
                rating_deviation = (
                    int(row["RatingDeviation"])
                    if row.get("RatingDeviation")
                    else None
                )
                nb_plays = (
                    int(row["NbPlays"])
                    if row.get("NbPlays")
                    else None
                )
                daily_date = (
                    int(row["DailyDate"])
                    if row.get("DailyDate")
                    else None
                )
            except (TypeError, ValueError):
                continue

            if rating < args.min_rating or rating > args.max_rating:
                continue

            if popularity < args.min_popularity:
                continue

            moves = row["Moves"].split()
            themes = row["Themes"].split()

            # First move is the opponent setup move.
            # We need at least that + one player solution move.
            if len(moves) < 2:
                continue

            batch.append(
                {
                    "id": row["PuzzleId"],
                    "source_fen": row["FEN"],
                    "moves": moves,
                    "rating": rating,
                    "rating_deviation": rating_deviation,
                    "popularity": popularity,
                    "nb_plays": nb_plays,
                    "themes": themes,
                    "game_url": row.get("GameUrl") or None,
                    "opening_tags": (row.get("OpeningTags") or "").split(),
                    "daily_date": daily_date,
                    "category": classify_category(themes),
                    "difficulty": classify_difficulty(rating),
                }
            )

            if len(batch) >= args.batch_size:
                post_batch(supabase_url, secret_key, batch)
                inserted += len(batch)
                batch.clear()
                print(
                    f"\rImported {inserted:,}/{args.limit:,} "
                    f"(scanned {scanned:,})",
                    end="",
                    flush=True,
                )

            if inserted + len(batch) >= args.limit:
                break

        if batch:
            remaining = max(0, args.limit - inserted)
            batch = batch[:remaining]

            if batch:
                post_batch(supabase_url, secret_key, batch)
                inserted += len(batch)

        print()
        print(f"Finished. Imported/upserted {inserted:,} puzzles.")
        print(
            "You can rerun the script safely: rows are upserted by PuzzleId."
        )

    finally:
        try:
            stream.close()
        finally:
            if closer is not None:
                closer.close()


if __name__ == "__main__":
    main()
