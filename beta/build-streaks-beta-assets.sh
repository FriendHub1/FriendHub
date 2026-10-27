#!/usr/bin/env bash
# Public assets only for the isolated XOXO Streaks BETA Worker.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/.xoxo-streaks-beta-dist"
test -f "$ROOT/index.html"
test -f "$ROOT/worker.js"
rm -rf -- "$OUT"
mkdir -p "$OUT/beta"
cp "$ROOT/index.html" "$OUT/index.html"
for name in manifest.webmanifest service-worker.js ads.txt apple-touch-icon.png favicon-32x32.png icon-192x192.png icon-512x512.png; do
  if [ -f "$ROOT/$name" ]; then cp "$ROOT/$name" "$OUT/$name"; fi
done
for extension in png jpg jpeg webp svg gif ico woff woff2; do
  for file in "$ROOT"/*."$extension"; do
    [ -f "$file" ] && cp "$file" "$OUT/$(basename "$file")"
  done
done
if [ -d "$ROOT/profile-frames" ]; then cp -R "$ROOT/profile-frames" "$OUT/profile-frames"; fi
for name in xoxo-streaks.js xoxo-streaks-chat-bridge.js xoxo-streaks-beta-host.js; do
  test -f "$ROOT/beta/$name" || { echo "Missing required BETA script: $name" >&2; exit 1; }
  cp "$ROOT/beta/$name" "$OUT/beta/$name"
done
if find "$OUT" -type f \( -name '*.sql' -o -name '*.md' -o -name '*.cjs' -o -name '*.py' -o -name '*.map' -o -name '.env*' -o -name '*.jsonc' \) | grep -q .; then
  echo "Blocked: unexpected private file in BETA public assets" >&2
  exit 1
fi
test ! -e "$OUT/.github"
test ! -e "$OUT/worker.js"
test ! -e "$OUT/wrangler.jsonc"
# Inject loader into the isolated copy only; root index.html remains untouched.
python3 - "$OUT/index.html" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
html = p.read_text(encoding="utf-8")
loader = """
<script id="xoxo-streaks-beta-asset-loader">
(function(){
  if (!/(?:^|\\.)workers\\.dev$/i.test(location.hostname)) return;
  if (new URLSearchParams(location.search).get("xoxo_streaks_beta") !== "1") return;
  ["xoxo-streaks.js","xoxo-streaks-chat-bridge.js","xoxo-streaks-beta-host.js"].reduce(function(chain,name){
    return chain.then(function(){return new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src="/beta/"+name;
      script.onload=resolve;
      script.onerror=function(){reject(new Error("Streaks BETA asset unavailable"));};
      document.head.appendChild(script);
    });});
  },Promise.resolve()).catch(function(){console.warn("[XOXO Streaks BETA] Preview assets unavailable.");});
})();
</script>
"""
if 'id="xoxo-streaks-beta-asset-loader"' in html:
    raise SystemExit("Duplicate Streaks BETA loader")
if "</body>" not in html:
    raise SystemExit("Missing closing body in BETA index")
p.write_text(html.replace("</body>", loader + "\n</body>", 1), encoding="utf-8")
PY
grep -q 'xoxo-streaks-beta-asset-loader' "$OUT/index.html"
echo "PASS: isolated Streaks BETA assets built; source index.html untouched"
