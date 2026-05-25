#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_DIR="$ROOT_DIR/backend/src/main/resources/db/migration"
LOCAL_DIR="$ROOT_DIR/backend/src/main/resources/db/migration-local"

if [[ ! -d "$BASE_DIR" ]]; then
  echo "[flyway-guard] Missing directory: $BASE_DIR"
  exit 1
fi

if [[ ! -d "$LOCAL_DIR" ]]; then
  echo "[flyway-guard] No migration-local directory found. Guard skipped."
  exit 0
fi

python3 - "$BASE_DIR" "$LOCAL_DIR" <<'PY'
import pathlib
import sys

base_dir = pathlib.Path(sys.argv[1])
local_dir = pathlib.Path(sys.argv[2])

def collect_repeatables(folder: pathlib.Path):
    out = {}
    for path in folder.glob("R__*.sql"):
        name = path.name
        if not name.startswith("R__") or not name.endswith(".sql"):
            continue
        description = name[3:-4].replace("_", " ").strip().lower()
        out.setdefault(description, []).append(path)
    return out

base = collect_repeatables(base_dir)
local = collect_repeatables(local_dir)

duplicates = []
for description in sorted(set(base.keys()) & set(local.keys())):
    duplicates.append((description, sorted(base[description] + local[description])))

if duplicates:
    print("[flyway-guard] Duplicate repeatable migration descriptions found.")
    print("[flyway-guard] Keep each repeatable description in ONE location only.")
    for description, paths in duplicates:
        print(f"  - {description}")
        for p in paths:
            print(f"      -> {p}")
    sys.exit(1)

print("[flyway-guard] OK: no duplicate repeatable descriptions between migration and migration-local.")
PY
