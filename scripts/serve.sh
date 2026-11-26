#!/usr/bin/env bash
# Archify Editor — 本地开发服务一键启动（固定 5180，供多个浏览器窗口访问同一地址）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Archify Editor 本地服务"
echo "    地址: http://127.0.0.1:5180/"
echo "    可在多个浏览器窗口打开上面同一地址；按 Ctrl+C 停止服务"

exec npm run serve
