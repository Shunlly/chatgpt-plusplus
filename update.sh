#!/usr/bin/env bash
set -euo pipefail

if command -v codexplusplus >/dev/null 2>&1; then
  exec codexplusplus update "$@"
fi

if command -v codex-plusplus >/dev/null 2>&1; then
  exec codex-plusplus update "$@"
fi

echo "[!] codexplusplus is not installed in PATH; running the installer instead." >&2
exec bash -c "$(curl -fsSL https://raw.githubusercontent.com/b-nnett/codex-plusplus/main/install.sh)"
