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

# Inject the opt-in loader into the BETA COPY only. Production index.html stays untouched.
python3 - "$OUT/index.html" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
html = p.read_text(encoding="utf-8")
loader = """
<script id="xoxo-safety-beta-asset-loader">
(function(){
  if (!/(?:^|\\.)workers\\.dev$/i.test(location.hostname)) return;
  var params = new URLSearchParams(location.search);
  if (params.get("xoxo_safety_chat_beta") !== "1") return;
  var names = [
    "stay-safe-sweetheart.js",
    "stay-safe-report-form.js",
    "stay-safe-evidence-picker.js",
    "stay-safe-browser-report-adapter.js",
    "stay-safe-browser-flow.js",
    "stay-safe-chat-preview-bridge.js"
  ];
  if (params.get("xoxo_safety_admin_beta") === "1") {
    names.push("admin-report-queue.js", "admin-report-panel-bridge.js");
  }
  (async function(){
    for (var i=0;i<names.length;i++) {
      await new Promise(function(resolve,reject){
        var s=document.createElement("script");
        s.src="/beta/"+names[i];
        s.onload=resolve;
        s.onerror=function(){reject(new Error("Safety BETA script unavailable: "+names[i]));};
        document.head.appendChild(s);
      });
    }
  })().catch(function(err){console.error("[XOXO Safety BETA]",err);});
})();
</script>
"""
if 'id="xoxo-safety-beta-asset-loader"' in html:
    raise SystemExit("Duplicate safety BETA loader")
if "</body>" not in html:
    raise SystemExit("Missing closing body in BETA index")
html = html.replace("</body>", loader + "\n</body>", 1)
p.write_text(html, encoding="utf-8")
PY
grep -q 'xoxo-safety-beta-asset-loader' "$OUT/index.html"
