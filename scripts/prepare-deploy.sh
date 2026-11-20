#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist"
rm -rf "$OUT"
mkdir -p "$OUT"

# Только то, что нужно сайту (без node_modules и дублей GLB)
rsync -a \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude 'model*.glb' \
  --exclude 'model main.glb' \
  --exclude scripts \
  --exclude package.json \
  --exclude package-lock.json \
  --exclude compile-auto.html \
  --exclude compile.html \
  --exclude README.md \
  "$ROOT/" "$OUT/"

# models уже внутри
du -sh "$OUT" "$OUT/models"
echo "Deploy folder ready: $OUT"
