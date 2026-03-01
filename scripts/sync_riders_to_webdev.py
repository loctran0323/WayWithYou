#!/usr/bin/env python3
"""
Sync rides/fixtures/riders.json to webDev/data/riders.json so the webDev
search site uses the same data. Run this after editing the fixture.
"""
import json
import shutil
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
SOURCE = BASE / "rides" / "fixtures" / "riders.json"
DEST = BASE / "webDev" / "data" / "riders.json"

def main():
    if not SOURCE.exists():
        print(f"Source not found: {SOURCE}")
        return 1
    # Copy as-is (preserve format) so webDev server can parse it
    shutil.copy2(SOURCE, DEST)
    with open(SOURCE) as f:
        data = json.load(f)
    n = len(data) if isinstance(data, list) else 0
    print(f"Synced {n} riders to {DEST}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
