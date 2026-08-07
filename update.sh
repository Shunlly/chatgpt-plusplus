#!/usr/bin/env bash
set -euo pipefail

if command -v chatgptplusplus >/dev/null 2>&1; then
  exec chatgptplusplus update "$@"
fi
if command -v chatgpt-plusplus >/dev/null 2>&1; then
  exec chatgpt-plusplus update "$@"
fi
if command -v codexplusplus >/dev/null 2>&1; then
  exec codexplusplus update "$@"
fi
if command -v codex-plusplus >/dev/null 2>&1; then
  exec codex-plusplus update "$@"
fi
echo "[!] chatgptplusplus is not installed in PATH; running the installer instead." >&2
exec bash -c "$(curl -fsSL https://raw.githubusercontent.com/Shunlly/chatgpt-plusplus/main/install.sh)"
