#!/usr/bin/env bash
# PUBLIC-ASSET-ONLY directory for the ISOLATED safety BETA Worker.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/.xoxo-safety-beta-dist"
test -f "$ROOT/index.html"
test -f "$ROOT/worker.js"
rm -rf -- "$OUT"
mkdir -p "$OUT/beta"
cp "$ROOT/index.html" "$OUT/index.html"
for name in manifest.webmanifest service-worker.js ads.txt \
  apple-touch-icon.png favicon-32x32.png icon-192x192.png icon-512x512.png; do
  if [ -f "$ROOT/$name" ]; then cp "$ROOT/$name" "$OUT/$name"; fi
done
shopt -s nullglob
for extension in png jpg jpeg webp svg gif ico woff woff2; do
  for file in "$ROOT"/*."$extension"; do
    cp "$file" "$OUT/$(basename "$file")"
  done
done
if [ -d "$ROOT/profile-frames" ]; then
  cp -R "$ROOT/profile-frames" "$OUT/profile-frames"
fi
for name in \
  stay-safe-sweetheart.js \
  stay-safe-report-form.js \
  stay-safe-evidence-picker.js \
  stay-safe-browser-report-adapter.js \
  stay-safe-browser-flow.js \
  stay-safe-chat-preview-bridge.js \
  admin-report-queue.js \
  admin-report-panel-bridge.js; do
  test -f "$ROOT/beta/$name" || {
    echo "Missing required BETA script: $name" >&2; exit 1;
  }
  cp "$ROOT/beta/$name" "$OUT/beta/$name"
done
# Defense in depth: no SQL, tests, source maps, secrets or private documents.
if find "$OUT" -type f \( -name '*.sql' -o -name '*.md' -o -name '*.cjs' \
  -o -name '*.py' -o -name '*.map' -o -name '.env*' -o -name '*.jsonc' \) \
  | grep -q .; then
  echo "Blocked: unexpected private file in BETA public assets" >&2
  exit 1
fi
test ! -e "$OUT/.github"
test ! -e "$OUT/worker.js"
test ! -e "$OUT/wrangler.jsonc"
echo "PASS: BETA public assets assembled without private SQL, GitHub or fixture files"
