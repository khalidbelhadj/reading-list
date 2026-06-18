#!/usr/bin/env bash
# Build the distributable Chrome extension zip (manifest at the archive root).
# Usage: extension/build.sh   ->   reading-list-extension.zip in the repo root
set -euo pipefail

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="$(cd "$dir/.." && pwd)/reading-list-extension.zip"

find "$dir" -name '.DS_Store' -delete 2>/dev/null || true
rm -f "$out"
( cd "$dir" && zip -rq "$out" . -x '*.DS_Store' -x 'build.sh' )

echo "Built $out"
