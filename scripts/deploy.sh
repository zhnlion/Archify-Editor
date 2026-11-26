#!/usr/bin/env bash
# Archify Editor — Linux/macOS 一键部署（构建 + 可选轻量预览）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NO_SERVE=0
ARCHIFY_CHECK=0
PORT="${PORT:-4173}"

for arg in "$@"; do
  case "$arg" in
    --no-serve) NO_SERVE=1 ;;
    --with-archify-check) ARCHIFY_CHECK=1 ;;
    --port=*) PORT="${arg#*=}" ;;
    -h|--help)
      echo "Usage: $0 [--no-serve] [--with-archify-check] [--port=4173]"
      exit 0
      ;;
  esac
done

echo "==> Archify Editor deploy (Linux/macOS)"
echo "    cwd: $ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found. Install Node.js >= 18." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "ERROR: Node.js >= 18 required (found $(node -v))." >&2
  exit 1
fi

echo "==> node $(node -v) / npm $(npm -v)"

if [ -f package-lock.json ]; then
  echo "==> npm ci"
  npm ci
else
  echo "==> npm install"
  npm install
fi

echo "==> npm run build"
npm run build

if [ "$ARCHIFY_CHECK" -eq 1 ]; then
  CANDIDATES=(
    "${ARCHIFY_BIN:-}"
    "$ROOT/tools/archify/bin/archify.mjs"
  )
  FOUND=""
  for c in "${CANDIDATES[@]}"; do
    [ -n "$c" ] && [ -f "$c" ] && FOUND="$c" && break
  done
  if [ -n "$FOUND" ]; then
    echo "==> Archify CLI OK: $FOUND"
  else
    echo "==> WARN: Archify CLI not found (HTML finalize optional). Expect tools/archify or set ARCHIFY_BIN."
  fi
fi

echo "==> build OK → $ROOT/dist"
echo "    Tip: for lowest footprint, copy dist/ to Nginx and skip preview."

if [ "$NO_SERVE" -eq 1 ]; then
  echo "==> done (--no-serve)"
  exit 0
fi

echo "==> preview http://127.0.0.1:${PORT}/  (Ctrl+C to stop)"
npm run preview -- --host 0.0.0.0 --port "$PORT"
